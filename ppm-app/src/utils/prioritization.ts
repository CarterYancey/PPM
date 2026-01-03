import { differenceInDays, addDays, parseISO, formatISO } from 'date-fns';
import type { Task, Goal, Project, TaskCalculations, TodayListItem } from '../types';
import { isLeaf, getChildren, getLeafDescendants } from './taskTree';

/**
 * Calculate the total hours remaining for a task
 * - For leaf tasks: return estHours if not done, 0 if done
 * - For parent tasks: sum of all incomplete descendant leaf tasks
 */
export function calculateTotalHoursRemaining(
  task: Task,
  allTasks: Task[]
): number {
  if (isLeaf(task.id, allTasks)) {
    return task.done ? 0 : (task.estHours || 0);
  }

  // Parent task: sum hours from all incomplete leaf descendants
  const leafDescendants = getLeafDescendants(task.id, allTasks);
  return leafDescendants.reduce((total, leaf) => {
    return total + (leaf.done ? 0 : (leaf.estHours || 0));
  }, 0);
}

/**
 * Calculate completion percentage for a task
 * - For leaf tasks: 0 or 100 based on done status
 * - For parent tasks: percentage based on completed vs total hours
 */
export function calculateCompletionPercentage(
  task: Task,
  allTasks: Task[]
): number {
  if (isLeaf(task.id, allTasks)) {
    return task.done ? 100 : 0;
  }

  const leafDescendants = getLeafDescendants(task.id, allTasks);
  if (leafDescendants.length === 0) return 0;

  const totalHours = leafDescendants.reduce((sum, leaf) => sum + (leaf.estHours || 0), 0);
  if (totalHours === 0) return 0;

  const completedHours = leafDescendants.reduce((sum, leaf) => {
    return sum + (leaf.done ? (leaf.estHours || 0) : 0);
  }, 0);

  return Math.round((completedHours / totalHours) * 100);
}

/**
 * Calculate base priority: (Goal.Priority + Project.Priority) × 10
 */
export function calculateBasePriority(goal: Goal, project: Project): number {
  return (goal.priority + project.priority) * 10;
}

/**
 * Calculate days needed to complete a task based on hours and daily cadence
 */
export function calculateDaysNeeded(hoursRemaining: number, dailyCadence: number): number {
  if (dailyCadence === 0) return 0;
  return Math.ceil(hoursRemaining / dailyCadence);
}

/**
 * Calculate expected completion date
 */
export function calculateExpectedCompletion(
  hoursRemaining: number,
  dailyCadence: number
): string {
  const daysNeeded = calculateDaysNeeded(hoursRemaining, dailyCadence);
  const completionDate = addDays(new Date(), daysNeeded);
  return formatISO(completionDate, { representation: 'date' });
}

/**
 * Calculate slack days: days_until_due - days_needed
 * Returns undefined if no due date
 */
export function calculateSlack(
  dueDate: string | undefined,
  hoursRemaining: number,
  dailyCadence: number
): number | undefined {
  if (!dueDate) return undefined;

  const today = new Date();
  const due = parseISO(dueDate);
  const daysUntilDue = differenceInDays(due, today);
  const daysNeeded = calculateDaysNeeded(hoursRemaining, dailyCadence);

  return daysUntilDue - daysNeeded;
}

/**
 * Get effective due date for a task
 * If task has a due date, return it. Otherwise, check parent task.
 * For root-level tasks, inherit from the project's due date if available.
 */
export function getEffectiveDueDate(task: Task, allTasks: Task[], projects: Project[]): string | undefined {
  if (task.dueDate) {
    return task.dueDate;
  }

  // Check parent task for due date
  if (task.parentTaskId) {
    const parent = allTasks.find((t) => t.id === task.parentTaskId);
    if (parent) {
      return getEffectiveDueDate(parent, allTasks, projects); // Recursive check
    }
  }

  // For root-level tasks, check the project's due date
  const project = projects.find((p) => p.id === task.projectId);
  if (project?.dueDate) {
    return project.dueDate;
  }

  return undefined;
}

/**
 * Calculate the latest start date for a task (when it MUST begin to meet its deadline)
 * Returns: number of days from today (can be negative if already late)
 * Returns undefined if no due date
 */
export function calculateLatestStartDate(
  dueDate: string | undefined,
  hoursRemaining: number,
  dailyCadence: number
): number | undefined {
  if (!dueDate) return undefined;

  const today = new Date();
  const due = parseISO(dueDate);
  const daysUntilDue = differenceInDays(due, today);
  const daysNeeded = calculateDaysNeeded(hoursRemaining, dailyCadence);

  // Latest start date = days until due - days needed
  // If negative, we're already past the latest start date
  return daysUntilDue - daysNeeded;
}

/**
 * Get the total remaining hours for all incomplete leaf tasks that share the same
 * effective due date constraint (same parent or same project for root tasks).
 * This is used to calculate the "cumulative" latest start date for scheduling.
 */
export function getCumulativeHoursForDeadline(
  task: Task,
  allTasks: Task[],
  projects: Project[],
  effectiveDueDate: string | undefined
): number {
  if (!effectiveDueDate) {
    // No deadline - just return this task's hours
    return task.estHours || 0;
  }

  // Find all sibling leaf tasks that share the same effective due date
  let siblingLeaves: Task[];

  if (task.parentTaskId) {
    // Task has a parent - get all leaf descendants of that parent
    siblingLeaves = getLeafDescendants(task.parentTaskId, allTasks);
  } else {
    // Root-level task - get all root-level leaf tasks in the same project
    siblingLeaves = allTasks.filter(t =>
      t.projectId === task.projectId &&
      !t.parentTaskId &&
      isLeaf(t.id, allTasks)
    );
  }

  // Filter to only incomplete tasks with the same effective due date
  const tasksWithSameDeadline = siblingLeaves.filter(t => {
    if (t.done) return false;
    const tDueDate = getEffectiveDueDate(t, allTasks, projects);
    return tDueDate === effectiveDueDate;
  });

  // Sum up total hours
  return tasksWithSameDeadline.reduce((sum, t) => sum + (t.estHours || 0), 0);
}

/**
 * Calculate urgency boost based on deadline
 * - If slack < 0: boost = 1000 (at risk!)
 * - Otherwise: boost = 100 / (1 + slack)
 * - If no due date but children have due dates: max(child_urgency) × 0.5
 */
export function calculateUrgencyBoost(
  task: Task,
  allTasks: Task[],
  projects: Project[],
  hoursRemaining: number,
  dailyCadence: number,
  calculationsMap: Map<string, TaskCalculations>
): number {
  // Get effective due date (task's own or inherited from parent or project)
  const effectiveDueDate = getEffectiveDueDate(task, allTasks, projects);

  // If task has a due date (own or inherited), calculate urgency based on slack
  if (effectiveDueDate) {
    const slack = calculateSlack(effectiveDueDate, hoursRemaining, dailyCadence);
    if (slack === undefined) return 0;

    if (slack < 0) {
      return 1000; // At risk!
    } else {
      return 100 / (1 + slack);
    }
  }

  // If task doesn't have due date, check if any children have due dates
  const children = getChildren(task.id, allTasks);
  if (children.length === 0) {
    return 0; // Leaf task with no due date
  }

  // Get max urgency boost from children
  const childBoosts = children
    .map((child) => {
      const childCalc = calculationsMap.get(child.id);
      return childCalc?.urgencyBoost || 0;
    })
    .filter((boost) => boost > 0);

  if (childBoosts.length === 0) {
    return 0;
  }

  // Parent inherits max child urgency, dampened by 0.5
  return Math.max(...childBoosts) * 0.5;
}

/**
 * Calculate all metrics for a task
 */
export function calculateTaskMetrics(
  task: Task,
  goal: Goal,
  project: Project,
  allTasks: Task[],
  projects: Project[],
  dailyCadence: number,
  calculationsMap: Map<string, TaskCalculations>
): TaskCalculations {
  const taskIsLeaf = isLeaf(task.id, allTasks);
  const hoursRemaining = calculateTotalHoursRemaining(task, allTasks);
  const basePriority = calculateBasePriority(goal, project);
  const urgencyBoost = calculateUrgencyBoost(task, allTasks, projects, hoursRemaining, dailyCadence, calculationsMap);
  const urgencyScore = basePriority + urgencyBoost;

  // Use effective due date (inherited from parent or project if needed)
  const effectiveDueDate = getEffectiveDueDate(task, allTasks, projects);
  const daysNeeded = calculateDaysNeeded(hoursRemaining, dailyCadence);
  const slack = calculateSlack(effectiveDueDate, hoursRemaining, dailyCadence);
  const latestStartDate = calculateLatestStartDate(effectiveDueDate, hoursRemaining, dailyCadence);

  let level = 0;
  let currentTask = task;
  while (currentTask.parentTaskId) {
    level++;
    currentTask = allTasks.find((t) => t.id === currentTask.parentTaskId)!;
    if (!currentTask) break;
  }

  return {
    taskId: task.id,
    level,
    isLeaf: taskIsLeaf,
    totalHoursRemaining: hoursRemaining,
    completionPercentage: calculateCompletionPercentage(task, allTasks),
    expectedCompletionDate: hoursRemaining > 0
      ? calculateExpectedCompletion(hoursRemaining, dailyCadence)
      : undefined,
    daysUntilDue: effectiveDueDate
      ? differenceInDays(parseISO(effectiveDueDate), new Date())
      : undefined,
    daysNeeded,
    slack,
    latestStartDate,
    urgencyScore,
    basePriority,
    urgencyBoost,
  };
}

/**
 * Calculate metrics for all tasks
 * Must be done in a specific order to handle parent urgency inheritance
 */
export function calculateAllTaskMetrics(
  tasks: Task[],
  goals: Goal[],
  projects: Project[],
  dailyCadence: number
): Map<string, TaskCalculations> {
  const calculationsMap = new Map<string, TaskCalculations>();

  // Process tasks in reverse dependency order (leaves first, then parents)
  // This ensures child calculations are available when processing parents
  const processedTasks = new Set<string>();

  const processTask = (task: Task) => {
    if (processedTasks.has(task.id)) return;

    // First process all children
    const children = getChildren(task.id, tasks);
    children.forEach(processTask);

    // Then process this task
    const project = projects.find((p) => p.id === task.projectId);
    const goal = project ? goals.find((g) => g.id === project.goalId) : undefined;

    if (project && goal) {
      const calculations = calculateTaskMetrics(
        task,
        goal,
        project,
        tasks,
        projects,
        dailyCadence,
        calculationsMap
      );
      calculationsMap.set(task.id, calculations);
    }

    processedTasks.add(task.id);
  };

  // Start with root tasks
  const rootTasks = tasks.filter((t) => !t.parentTaskId);
  rootTasks.forEach(processTask);

  return calculationsMap;
}

/**
 * Get status indicator based on urgency and slack
 */
export function getStatusIndicator(
  urgencyBoost: number,
  slack: number | undefined
): '🔴' | '🟡' | '🟢' | '⚪' {
  if (urgencyBoost >= 1000) return '🔴'; // At risk (slack < 0)
  if (slack === undefined) return '⚪'; // No deadline
  if (slack <= 2) return '🟡'; // Tight (2 days or less slack)
  return '🟢'; // On track
}

// Slack threshold: tasks with cumulative slack <= this are considered "urgent"
// and will be sorted by priority. Tasks with more slack defer to urgent tasks.
const URGENCY_SLACK_THRESHOLD = 5;

/**
 * Generate Today's List - sorted list of all incomplete leaf tasks
 */
export function generateTodaysList(
  tasks: Task[],
  goals: Goal[],
  projects: Project[],
  dailyCadence: number
): TodayListItem[] {
  const calculationsMap = calculateAllTaskMetrics(tasks, goals, projects, dailyCadence);

  // Get only leaf tasks that are not done
  const leafTasks = tasks.filter((t) => isLeaf(t.id, tasks) && !t.done);

  const todaysList: TodayListItem[] = leafTasks.map((task) => {
    const project = projects.find((p) => p.id === task.projectId)!;
    const goal = goals.find((g) => g.id === project.goalId)!;
    const calculations = calculationsMap.get(task.id)!;

    // Get parent task name if exists
    const parent = task.parentTaskId ? tasks.find((t) => t.id === task.parentTaskId) : undefined;

    // Get effective due date (task's own or inherited from parent or project)
    const effectiveDueDate = getEffectiveDueDate(task, tasks, projects);

    // Calculate cumulative hours for all tasks sharing this deadline
    // This accounts for sibling subtasks that all need to be done
    const cumulativeHours = getCumulativeHoursForDeadline(task, tasks, projects, effectiveDueDate);
    const cumulativeSlack = calculateSlack(effectiveDueDate, cumulativeHours, dailyCadence);

    return {
      task: { ...task, dueDate: effectiveDueDate }, // Use effective due date for display
      parentName: parent?.name,
      projectName: project.name,
      goalName: goal.name,
      urgencyScore: calculations.urgencyScore,
      basePriority: calculations.basePriority,
      latestStartDate: calculations.latestStartDate,
      cumulativeSlack,
      statusIndicator: getStatusIndicator(calculations.urgencyBoost, calculations.slack),
      slack: calculations.slack,
      expectedCompletion: calculations.expectedCompletionDate,
    };
  });

  // Sort using priority-aware deadline scheduling:
  //
  // 1. URGENT tasks (cumulativeSlack <= threshold): sorted by PRIORITY (higher first)
  //    - These are tasks that need to start soon to meet their deadlines
  //    - Higher priority tasks should not be delayed by lower priority ones
  //
  // 2. NON-URGENT tasks (cumulativeSlack > threshold): sorted by DEADLINE (earlier first)
  //    - These have plenty of slack and should not preempt urgent tasks
  //    - Among non-urgent tasks, earlier deadlines come first
  //
  // 3. Tasks WITHOUT deadlines: go LAST, sorted by priority
  //
  // This ensures:
  // - Higher priority tasks are protected from slipping when deadlines are tight
  // - Higher priority tasks with lots of slack don't unnecessarily preempt urgent lower-priority work
  todaysList.sort((a, b) => {
    const aHasDeadline = a.cumulativeSlack !== undefined;
    const bHasDeadline = b.cumulativeSlack !== undefined;

    // Tasks without deadlines go last
    if (aHasDeadline && !bHasDeadline) return -1;
    if (!aHasDeadline && bHasDeadline) return 1;
    if (!aHasDeadline && !bHasDeadline) {
      // Both have no deadline - sort by priority (higher first)
      if (a.basePriority !== b.basePriority) {
        return b.basePriority - a.basePriority;
      }
      return a.task.sortOrder - b.task.sortOrder;
    }

    // Determine urgency based on cumulative slack
    const aIsUrgent = a.cumulativeSlack! <= URGENCY_SLACK_THRESHOLD;
    const bIsUrgent = b.cumulativeSlack! <= URGENCY_SLACK_THRESHOLD;

    // Urgent tasks come before non-urgent tasks
    if (aIsUrgent && !bIsUrgent) return -1;
    if (!aIsUrgent && bIsUrgent) return 1;

    if (aIsUrgent && bIsUrgent) {
      // Both are urgent - sort by PRIORITY (higher first)
      // This protects higher priority tasks from slipping
      if (a.basePriority !== b.basePriority) {
        return b.basePriority - a.basePriority;
      }
      // Same priority - earlier deadline first
      if (a.cumulativeSlack !== b.cumulativeSlack) {
        return a.cumulativeSlack! - b.cumulativeSlack!;
      }
      return a.task.sortOrder - b.task.sortOrder;
    }

    // Both are non-urgent - sort by DEADLINE (earlier cumulative slack first)
    // This ensures we still meet deadlines but don't preempt unnecessarily
    if (a.cumulativeSlack !== b.cumulativeSlack) {
      return a.cumulativeSlack! - b.cumulativeSlack!;
    }
    // Same slack - higher priority wins
    if (a.basePriority !== b.basePriority) {
      return b.basePriority - a.basePriority;
    }
    return a.task.sortOrder - b.task.sortOrder;
  });

  return todaysList;
}
