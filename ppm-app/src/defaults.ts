import type { AppState, Goal, Project, Settings, Task } from './types';
import { toCalendarDate } from './utils/dates';

export const DEFAULT_SETTINGS: Settings = {
  dailyCadence: 2,
  priorityModel: 'multiplicative',
  sequenceMode: 'soft',
  tightSlackDays: 2,
};

/** Next free id for a prefix, ignoring ids that don't fit the `X<number>` shape. */
export function nextId<T extends { id: string }>(items: T[], prefix: string): string {
  const max = items.reduce((highest, item) => {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(item.id);
    if (!match) return highest;
    const num = Number(match[1]);
    return num > highest ? num : highest;
  }, 0);
  return `${prefix}${max + 1}`;
}

/**
 * Coerce anything that came from localStorage or an imported file into a valid
 * AppState. Everything downstream assumes numbers are numbers and references
 * resolve, so this is the only place allowed to be defensive.
 */
export function normalizeState(raw: unknown): AppState {
  const data = (raw ?? {}) as Partial<AppState>;
  const num = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  const goals: Goal[] = (Array.isArray(data.goals) ? data.goals : [])
    .filter((g): g is Goal => !!g && typeof g.id === 'string')
    .map((g) => ({ ...g, name: String(g.name ?? ''), priority: Math.max(0, num(g.priority, 0)) }));

  const goalIds = new Set(goals.map((g) => g.id));
  const projects: Project[] = (Array.isArray(data.projects) ? data.projects : [])
    .filter((p): p is Project => !!p && typeof p.id === 'string' && goalIds.has(p.goalId))
    .map((p) => ({ ...p, name: String(p.name ?? ''), priority: Math.max(0, num(p.priority, 0)) }));

  const projectIds = new Set(projects.map((p) => p.id));
  const tasks: Task[] = (Array.isArray(data.tasks) ? data.tasks : [])
    .filter((t): t is Task => !!t && typeof t.id === 'string' && projectIds.has(t.projectId))
    .map((t, i) => ({
      ...t,
      name: String(t.name ?? ''),
      sortOrder: num(t.sortOrder, i + 1),
      estHours: t.estHours === undefined || t.estHours === null ? undefined : Math.max(0, num(t.estHours, 0)),
      done: t.done === true,
    }));

  const taskIds = new Set(tasks.map((t) => t.id));
  for (const task of tasks) {
    if (task.parentTaskId && !taskIds.has(task.parentTaskId)) task.parentTaskId = undefined;
  }

  const settings = (data.settings ?? {}) as Partial<Settings>;
  return {
    goals,
    projects,
    tasks,
    settings: {
      dailyCadence: Math.min(24, Math.max(0.25, num(settings.dailyCadence, DEFAULT_SETTINGS.dailyCadence))),
      priorityModel: settings.priorityModel === 'additive' ? 'additive' : 'multiplicative',
      sequenceMode: settings.sequenceMode === 'strict' ? 'strict' : 'soft',
      tightSlackDays: Math.max(0, num(settings.tightSlackDays, DEFAULT_SETTINGS.tightSlackDays)),
    },
  };
}

/** Sample data, dated relative to today so it is actually schedulable. */
export function buildSampleData(today: Date = new Date()): AppState {
  const inDays = (days: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
    return toCalendarDate(d);
  };

  const goals: Goal[] = [
    { id: 'G1', name: 'Read 12 classic novels', priority: 5, targetDate: inDays(330), notes: 'Personal enrichment' },
    { id: 'G2', name: 'Maintain clean, organized home', priority: 8 },
    { id: 'G3', name: 'Earn AWS Solutions Architect', priority: 21, targetDate: inDays(150), notes: 'Career advancement' },
    { id: 'G4', name: 'Stay healthy and active', priority: 13 },
    { id: 'G5', name: 'Plan Japan trip', priority: 8, targetDate: inDays(200) },
  ];

  const projects: Project[] = [
    { id: 'P1', name: 'Reading list', goalId: 'G1', priority: 5 },
    { id: 'P2', name: 'Daily housekeeping', goalId: 'G2', priority: 8 },
    { id: 'P3', name: 'Weekly deep cleaning', goalId: 'G2', priority: 3 },
    { id: 'P4', name: 'AWS study plan', goalId: 'G3', priority: 13, dueDate: inDays(140) },
    { id: 'P5', name: 'Practice exam prep', goalId: 'G3', priority: 8, dueDate: inDays(120) },
    { id: 'P6', name: 'Running program', goalId: 'G4', priority: 8 },
    { id: 'P7', name: 'Meal prep system', goalId: 'G4', priority: 5 },
    { id: 'P8', name: 'Japan itinerary planning', goalId: 'G5', priority: 8, dueDate: inDays(60) },
    { id: 'P9', name: 'Japan logistics', goalId: 'G5', priority: 5 },
  ];

  const tasks: Task[] = [
    { id: 'T1', name: 'Read Moby Dick', projectId: 'P1', sortOrder: 1, estHours: 2, dueDate: inDays(21), done: false },
    { id: 'T2', name: 'Read Pride and Prejudice', projectId: 'P1', sortOrder: 2, estHours: 2, dueDate: inDays(50), done: false },

    { id: 'T3', name: 'Pass AWS exam', projectId: 'P4', sortOrder: 1, dueDate: inDays(140), done: false },
    { id: 'T4', name: 'Study compute services', projectId: 'P4', parentTaskId: 'T3', sortOrder: 1, done: false },
    { id: 'T5', name: 'Learn EC2 fundamentals', projectId: 'P4', parentTaskId: 'T4', sortOrder: 1, estHours: 2, done: false },
    { id: 'T6', name: 'Learn Lambda functions', projectId: 'P4', parentTaskId: 'T4', sortOrder: 2, estHours: 2, done: false },
    { id: 'T7', name: 'Study storage services', projectId: 'P4', parentTaskId: 'T3', sortOrder: 2, done: false },
    { id: 'T8', name: 'Learn S3 fundamentals', projectId: 'P4', parentTaskId: 'T7', sortOrder: 1, estHours: 2, done: false },
    { id: 'T9', name: 'Learn EBS and EFS', projectId: 'P4', parentTaskId: 'T7', sortOrder: 2, estHours: 2, done: false },

    { id: 'T10', name: 'Practice exam 1', projectId: 'P5', sortOrder: 1, estHours: 2, dueDate: inDays(90), done: false },
    { id: 'T11', name: 'Practice exam 2', projectId: 'P5', sortOrder: 2, estHours: 2, dueDate: inDays(120), done: false },

    { id: 'T12', name: 'Plan Japan itinerary', projectId: 'P8', sortOrder: 1, dueDate: inDays(60), done: false },
    { id: 'T13', name: 'Research Tokyo neighborhoods', projectId: 'P8', parentTaskId: 'T12', sortOrder: 1, estHours: 2, done: false },
    { id: 'T14', name: 'Research Kyoto attractions', projectId: 'P8', parentTaskId: 'T12', sortOrder: 2, estHours: 2, done: false },
    { id: 'T15', name: 'Create day-by-day schedule', projectId: 'P8', parentTaskId: 'T12', sortOrder: 3, estHours: 2, done: false },

    { id: 'T16', name: 'Book Japan flights', projectId: 'P9', sortOrder: 1, estHours: 2, dueDate: inDays(30), done: false },
    { id: 'T17', name: 'Book hotels', projectId: 'P9', sortOrder: 2, estHours: 2, done: false },

    { id: 'T18', name: 'Tidy kitchen', projectId: 'P2', sortOrder: 1, estHours: 1, done: false },
    { id: 'T19', name: 'Weekly 10k run', projectId: 'P6', sortOrder: 1, estHours: 1, done: false },
  ];

  return { goals, projects, tasks, settings: DEFAULT_SETTINGS };
}
