import { addDays } from 'date-fns';
import type { Task, Goal, Project } from '../types';
import { generateTodaysList, getEffectiveDueDate } from './prioritization';
import { isLeaf } from './taskTree';

export type StatusIndicator = '🔴' | '🟡' | '🟢' | '⚪';

export interface TaskScheduleData {
  taskId: string;
  startDate: Date;
  finishDate: Date;
  statusIndicator: StatusIndicator;
  slack: number | undefined;
  hoursRemaining: number;
  isLeaf: boolean;
  effectiveDueDate: string | undefined;
}

/**
 * Calculate cumulative scheduling data for all tasks.
 * This is the single source of truth for task scheduling that should be used
 * by all components (Today's List, Projects, Gantt Chart, etc.)
 *
 * The scheduling is based on the priority-sorted order from generateTodaysList,
 * where tasks are worked on sequentially from highest to lowest priority.
 * Each task's start date is the previous task's finish date.
 */
export function calculateTaskScheduling(
  tasks: Task[],
  goals: Goal[],
  projects: Project[],
  dailyCadence: number
): Map<string, TaskScheduleData> {
  const scheduleMap = new Map<string, TaskScheduleData>();

  // Get the priority-sorted list of incomplete leaf tasks
  const todaysList = generateTodaysList(tasks, goals, projects, dailyCadence);

  // Calculate cumulative start and finish dates for leaf tasks
  let cumulativeDate = new Date();

  todaysList.forEach((item) => {
    const hoursForThisTask = item.task.estHours || 0;
    const daysForThisTask = Math.ceil(hoursForThisTask / dailyCadence);
    const startDate = new Date(cumulativeDate);
    const finishDate = addDays(cumulativeDate, daysForThisTask);

    // Update cumulative date for next task
    cumulativeDate = finishDate;

    // Get effective due date (task's own or inherited from parent or project)
    const effectiveDueDate = getEffectiveDueDate(item.task, tasks, projects);

    // Calculate status based on cumulative finish date vs due date
    const { statusIndicator, slack } = calculateStatusFromDates(
      finishDate,
      effectiveDueDate
    );

    scheduleMap.set(item.task.id, {
      taskId: item.task.id,
      startDate,
      finishDate,
      statusIndicator,
      slack,
      hoursRemaining: hoursForThisTask,
      isLeaf: true,
      effectiveDueDate,
    });
  });

  // Also add completed leaf tasks (they have 0 hours remaining, finish today)
  const completedLeafTasks = tasks.filter(t => isLeaf(t.id, tasks) && t.done);
  completedLeafTasks.forEach(task => {
    if (!scheduleMap.has(task.id)) {
      const today = new Date();
      const effectiveDueDate = getEffectiveDueDate(task, tasks, projects);
      scheduleMap.set(task.id, {
        taskId: task.id,
        startDate: today,
        finishDate: today,
        statusIndicator: '⚪',
        slack: undefined,
        hoursRemaining: 0,
        isLeaf: true,
        effectiveDueDate,
      });
    }
  });

  // Calculate finish dates for parent tasks (Groups)
  // A parent's finish date is the max finish date of all its leaf descendants
  calculateParentTaskSchedules(tasks, projects, scheduleMap);

  return scheduleMap;
}

/**
 * Calculate status indicator and slack based on finish date vs due date
 */
function calculateStatusFromDates(
  finishDate: Date,
  dueDateStr: string | undefined
): { statusIndicator: StatusIndicator; slack: number | undefined } {
  if (!dueDateStr) {
    return { statusIndicator: '⚪', slack: undefined };
  }

  const dueDate = new Date(dueDateStr);
  const today = new Date();

  const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daysUntilFinish = Math.floor((finishDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const slack = daysUntilDue - daysUntilFinish;

  let statusIndicator: StatusIndicator;
  if (slack < 0) {
    statusIndicator = '🔴'; // At risk - will finish after due date
  } else if (slack <= 2) {
    statusIndicator = '🟡'; // Tight - 2 days or less slack
  } else {
    statusIndicator = '🟢'; // On track
  }

  return { statusIndicator, slack };
}

/**
 * Calculate scheduling data for parent tasks based on their leaf descendants
 */
function calculateParentTaskSchedules(
  tasks: Task[],
  projects: Project[],
  scheduleMap: Map<string, TaskScheduleData>
): void {
  // Helper to get all leaf descendants of a task
  const getLeafDescendants = (taskId: string): Task[] => {
    const children = tasks.filter(t => t.parentTaskId === taskId);
    if (children.length === 0) return [];

    let leaves: Task[] = [];
    for (const child of children) {
      if (isLeaf(child.id, tasks)) {
        leaves.push(child);
      } else {
        leaves = leaves.concat(getLeafDescendants(child.id));
      }
    }
    return leaves;
  };

  // Process all parent tasks
  const parentTasks = tasks.filter(t => !isLeaf(t.id, tasks));

  parentTasks.forEach(parent => {
    const leafDescendants = getLeafDescendants(parent.id);
    if (leafDescendants.length === 0) return;

    // Get start and finish dates from leaf descendants
    const descendantSchedules = leafDescendants
      .map(leaf => scheduleMap.get(leaf.id))
      .filter((s): s is TaskScheduleData => s !== undefined);

    if (descendantSchedules.length === 0) return;

    // Parent starts when first descendant starts, finishes when last descendant finishes
    const startDates = descendantSchedules.map(s => s.startDate.getTime());
    const finishDates = descendantSchedules.map(s => s.finishDate.getTime());

    const minStartDate = new Date(Math.min(...startDates));
    const maxFinishDate = new Date(Math.max(...finishDates));

    // Calculate total hours remaining from incomplete descendants
    const hoursRemaining = descendantSchedules.reduce((sum, s) => sum + s.hoursRemaining, 0);

    // Get parent's effective due date
    const effectiveDueDate = getEffectiveDueDate(parent, tasks, projects);

    // Calculate status based on max finish date vs due date
    const { statusIndicator, slack } = calculateStatusFromDates(
      maxFinishDate,
      effectiveDueDate
    );

    scheduleMap.set(parent.id, {
      taskId: parent.id,
      startDate: minStartDate,
      finishDate: maxFinishDate,
      statusIndicator,
      slack,
      hoursRemaining,
      isLeaf: false,
      effectiveDueDate,
    });
  });
}

/**
 * Hook-friendly wrapper that returns scheduling data as a Map
 * Components can use this with useMemo for efficient caching
 */
export function getTaskScheduleData(
  tasks: Task[],
  goals: Goal[],
  projects: Project[],
  dailyCadence: number
): Map<string, TaskScheduleData> {
  return calculateTaskScheduling(tasks, goals, projects, dailyCadence);
}
