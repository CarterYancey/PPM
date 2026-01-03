import { addDays, parseISO, formatISO } from 'date-fns';
import type { Task, Goal, Project, TaskCalculations, TodayListItem, Settings } from '../types';
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

export function isWorkingDay(
  date: Date,
  workDays: number[],
  vacationDates: string[]
): boolean {
  const dayOfWeek = date.getDay();
  if (!workDays.includes(dayOfWeek)) return false;

  const dateKey = formatISO(date, { representation: 'date' });
  return !vacationDates.includes(dateKey);
}

export function advanceWorkingDays(
  startDate: Date,
  daysToAdvance: number,
  workDays: number[],
  vacationDates: string[]
): Date {
  if (daysToAdvance <= 0) return startDate;

  let currentDate = startDate;
  let remainingDays = daysToAdvance;

  while (remainingDays > 0) {
    currentDate = addDays(currentDate, 1);
    if (isWorkingDay(currentDate, workDays, vacationDates)) {
      remainingDays -= 1;
    }
  }

  return currentDate;
}

export function countWorkingDaysBetween(
  startDate: Date,
  endDate: Date,
  workDays: number[],
  vacationDates: string[]
): number {
  if (startDate.getTime() === endDate.getTime()) return 0;

  const step = endDate.getTime() > startDate.getTime() ? 1 : -1;
  let currentDate = addDays(startDate, step);
  let count = 0;

  while (
    (step > 0 && currentDate.getTime() <= endDate.getTime()) ||
    (step < 0 && currentDate.getTime() >= endDate.getTime())
  ) {
    if (isWorkingDay(currentDate, workDays, vacationDates)) {
      count += step;
    }
    currentDate = addDays(currentDate, step);
  }

  return count;
}

/**
 * Calculate days needed to complete a task based on hours and daily cadence
 */
export function calculateDaysNeeded(
  hoursRemaining: number,
  dailyCadence: number,
  workDays: number[],
  vacationDates: string[]
): number {
  void vacationDates;
  if (dailyCadence === 0 || workDays.length === 0) return 0;
  return Math.ceil(hoursRemaining / dailyCadence);
}

/**
 * Calculate expected completion date
 */
export function calculateExpectedCompletion(
  hoursRemaining: number,
  dailyCadence: number,
  workDays: number[],
  vacationDates: string[]
): string {
  const daysNeeded = calculateDaysNeeded(
    hoursRemaining,
    dailyCadence,
    workDays,
    vacationDates
  );
  const completionDate = advanceWorkingDays(
    new Date(),
    daysNeeded,
    workDays,
    vacationDates
  );
  return formatISO(completionDate, { representation: 'date' });
}

/**
 * Calculate slack days: days_until_due - days_needed
 * Returns undefined if no due date
 */
export function calculateSlack(
  dueDate: string | undefined,
  hoursRemaining: number,
  dailyCadence: number,
  workDays: number[],
  vacationDates: string[]
): number | undefined {
  if (!dueDate) return undefined;

  const today = new Date();
  const due = parseISO(dueDate);
  const daysUntilDue = countWorkingDaysBetween(today, due, workDays, vacationDates);
  const daysNeeded = calculateDaysNeeded(
    hoursRemaining,
    dailyCadence,
    workDays,
    vacationDates
  );

  return daysUntilDue - daysNeeded;
}

/**
 * Get effective due date for a task
 * If task has a due date, return it. Otherwise, check parent task.
 */
export function getEffectiveDueDate(task: Task, allTasks: Task[]): string | undefined {
  if (task.dueDate) {
    return task.dueDate;
  }

  // Check parent task for due date
  if (task.parentTaskId) {
    const parent = allTasks.find((t) => t.id === task.parentTaskId);
    if (parent) {
      return getEffectiveDueDate(parent, allTasks); // Recursive check
    }
  }

  return undefined;
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
  settings: Settings,
  calculationsMap: Map<string, TaskCalculations>
): number {
  // Get effective due date (task's own or inherited from parent)
  const effectiveDueDate = getEffectiveDueDate(task, allTasks);

  // If task has a due date (own or inherited), calculate urgency based on slack
  if (effectiveDueDate) {
    const slack = calculateSlack(
      effectiveDueDate,
      hoursRemaining,
      settings.dailyCadence,
      settings.workDays,
      settings.vacationDates
    );
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
  settings: Settings,
  calculationsMap: Map<string, TaskCalculations>
): TaskCalculations {
  const taskIsLeaf = isLeaf(task.id, allTasks);
  const hoursRemaining = calculateTotalHoursRemaining(task, allTasks);
  const basePriority = calculateBasePriority(goal, project);
  const urgencyBoost = calculateUrgencyBoost(task, allTasks, hoursRemaining, settings, calculationsMap);
  const urgencyScore = basePriority + urgencyBoost;

  // Use effective due date (inherited from parent if needed)
  const effectiveDueDate = getEffectiveDueDate(task, allTasks);
  const daysNeeded = calculateDaysNeeded(
    hoursRemaining,
    settings.dailyCadence,
    settings.workDays,
    settings.vacationDates
  );
  const slack = calculateSlack(
    effectiveDueDate,
    hoursRemaining,
    settings.dailyCadence,
    settings.workDays,
    settings.vacationDates
  );

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
      ? calculateExpectedCompletion(
        hoursRemaining,
        settings.dailyCadence,
        settings.workDays,
        settings.vacationDates
      )
      : undefined,
    daysUntilDue: effectiveDueDate
      ? countWorkingDaysBetween(
        new Date(),
        parseISO(effectiveDueDate),
        settings.workDays,
        settings.vacationDates
      )
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
  settings: Settings
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
        settings,
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
  settings: Settings
): TodayListItem[] {
  const calculationsMap = calculateAllTaskMetrics(tasks, goals, projects, settings);

  // Get only leaf tasks that are not done
  const leafTasks = tasks.filter((t) => isLeaf(t.id, tasks) && !t.done);

  const todaysList: TodayListItem[] = leafTasks.map((task) => {
    const project = projects.find((p) => p.id === task.projectId)!;
    const goal = goals.find((g) => g.id === project.goalId)!;
    const calculations = calculationsMap.get(task.id)!;

    // Get parent task name if exists
    const parent = task.parentTaskId ? tasks.find((t) => t.id === task.parentTaskId) : undefined;

    // Get effective due date (task's own or inherited from parent)
    const effectiveDueDate = getEffectiveDueDate(task, tasks);

    return {
      task: { ...task, dueDate: effectiveDueDate }, // Use effective due date for display
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
