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
 * Calculate urgency boost based on deadline
 * - If slack < 0: boost = 1000 (at risk!)
 * - Otherwise: boost = 100 / (1 + slack)
 * - If no due date but children have due dates: max(child_urgency) × 0.5
 */
export function calculateUrgencyBoost(
  task: Task,
  allTasks: Task[],
  hoursRemaining: number,
  dailyCadence: number,
  calculationsMap: Map<string, TaskCalculations>
): number {
  // If task has a due date, calculate urgency based on slack
  if (task.dueDate) {
    const slack = calculateSlack(task.dueDate, hoursRemaining, dailyCadence);
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
  dailyCadence: number,
  calculationsMap: Map<string, TaskCalculations>
): TaskCalculations {
  const taskIsLeaf = isLeaf(task.id, allTasks);
  const hoursRemaining = calculateTotalHoursRemaining(task, allTasks);
  const basePriority = calculateBasePriority(goal, project);
  const urgencyBoost = calculateUrgencyBoost(task, allTasks, hoursRemaining, dailyCadence, calculationsMap);
  const urgencyScore = basePriority + urgencyBoost;

  const daysNeeded = calculateDaysNeeded(hoursRemaining, dailyCadence);
  const slack = calculateSlack(task.dueDate, hoursRemaining, dailyCadence);

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
    daysUntilDue: task.dueDate
      ? differenceInDays(parseISO(task.dueDate), new Date())
      : undefined,
    daysNeeded,
    slack,
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

    return {
      task,
      parentName: parent?.name,
      projectName: project.name,
      goalName: goal.name,
      urgencyScore: calculations.urgencyScore,
      statusIndicator: getStatusIndicator(calculations.urgencyBoost, calculations.slack),
      slack: calculations.slack,
      expectedCompletion: calculations.expectedCompletionDate,
    };
  });

  // Sort by urgency score (descending), then by sort order (ascending)
  todaysList.sort((a, b) => {
    if (a.urgencyScore !== b.urgencyScore) {
      return b.urgencyScore - a.urgencyScore; // Higher score first
    }
    return a.task.sortOrder - b.task.sortOrder; // Lower sort order first
  });

  return todaysList;
}
