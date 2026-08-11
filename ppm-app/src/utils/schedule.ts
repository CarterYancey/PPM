import type { Goal, Project, Settings, Task } from '../types';
import {
  compareSequenceKeys,
  createTaskIndex,
  getAncestors,
  getLeaves,
  getSequenceKey,
  isLeaf,
  type TaskIndex,
} from './taskTree';
import { createValuationContext, valueOfTask, type ValuationContext } from './valuation';
import { dateForDayOffset, dayOffsetOf, startOfLocalDay } from './dates';

/**
 * The scheduler.
 *
 * One function produces the plan; every view reads from it. There is no separate
 * "urgency score" any more — see docs/SCHEDULING.md for why the old
 * score-and-sort approach could not be made to work.
 *
 * The plan is built backwards from the end of the work queue. At each step we
 * ask: of the work that could go last, which piece am I most willing to do last?
 * A task may only go last if it still meets its own deadline there; among the
 * ones that qualify, the least valuable goes last. That single rule is the whole
 * priority/deadline trade-off:
 *
 *   deadlines decide what is *allowed* to be deferred,
 *   value decides what actually *gets* deferred.
 *
 * Guarantee: the schedule misses a deadline only when every possible ordering
 * misses one. (Exchange argument: any task that still fits in the last slot can
 * be moved there without pushing anything else later, so choosing it can never
 * turn a feasible instance into an infeasible one.) A red task therefore means
 * "you are over-committed", not "the sort function guessed badly".
 */

export type ScheduleStatus = 'late' | 'tight' | 'ontrack' | 'nodeadline' | 'done';

export interface ScheduleEntry {
  taskId: string;
  isLeaf: boolean;
  /** Position in the work queue. Leaf tasks only; -1 for groups and done tasks. */
  order: number;
  hours: number;
  /** Whole days from today (0 = today) when this work starts and finishes. */
  startDay: number;
  finishDay: number;
  startDate: Date;
  finishDate: Date;
  /** Value used for ordering. Groups report the max of their leaves. */
  value: number;
  /** Tightest deadline that applies: the task's own, an ancestor's, or its project's. */
  effectiveDueDate?: string;
  dueDay?: number;
  /** dueDay - finishDay. Negative means the deadline will be missed. */
  slackDays?: number;
  /** Latest day this task could start on its own and still hit its deadline. */
  mustStartByDay?: number;
  status: ScheduleStatus;
}

export interface Schedule {
  /** Incomplete leaf tasks, in the order they should be worked. */
  queue: ScheduleEntry[];
  /** Every task (leaves, groups and completed tasks), keyed by id. */
  byTaskId: Map<string, ScheduleEntry>;
  /** Tasks that cannot meet their deadline in any ordering. */
  lateTaskIds: string[];
  overcommitted: boolean;
  totalHours: number;
  /** Day offset on which the last queued task finishes. */
  horizonDay: number;
  /** Tasks skipped because their project or goal is missing. */
  orphanTaskIds: string[];
  index: TaskIndex;
  today: Date;
}

const EPS = 1e-9;

interface Job {
  task: Task;
  hours: number;
  value: number;
  dueDay?: number;
  /** Hours of work capacity available between now and the end of the due day. */
  capacity: number;
  seqKey: number[];
  /** Position within its project's strict sequence. */
  seqIndex: number;
  projectId: string;
}

/**
 * The deadline that actually applies to a task: the earliest of its own due
 * date, any ancestor's, and its project's. The old code returned the task's own
 * date whenever it had one, so a subtask due in December under a milestone due
 * in September looked comfortable right up until the milestone blew up.
 */
export function getEffectiveDueDate(
  index: TaskIndex,
  task: Task,
  projectsById: Map<string, Project>
): string | undefined {
  const candidates: string[] = [];
  if (task.dueDate) candidates.push(task.dueDate);
  for (const ancestor of getAncestors(index, task.id)) {
    if (ancestor.dueDate) candidates.push(ancestor.dueDate);
  }
  const projectDue = projectsById.get(task.projectId)?.dueDate;
  if (projectDue) candidates.push(projectDue);
  if (candidates.length === 0) return undefined;
  return candidates.reduce((earliest, d) => (d < earliest ? d : earliest));
}

/**
 * Days are counted from today (day 0) and capacity is `cadence` hours per day,
 * so the work between cumulative hour H and H' lands on days
 * floor(H / cadence) .. ceil(H' / cadence) - 1.
 *
 * With a 2h/day cadence two 1h tasks therefore both land on day 0. The old code
 * rounded every task up to a whole day independently and threw away the rest of
 * the day's capacity, which inflated every projected finish date.
 */
function startDayOf(hoursBefore: number, cadence: number): number {
  return Math.max(0, Math.floor(hoursBefore / cadence + EPS));
}

function finishDayOf(hoursAfter: number, cadence: number): number {
  if (hoursAfter <= EPS) return 0;
  return Math.max(0, Math.ceil(hoursAfter / cadence - EPS) - 1);
}

/** Whole days of elapsed calendar time a standalone chunk of work occupies, minus one. */
function spanDays(hours: number, cadence: number): number {
  if (hours <= EPS) return 0;
  return Math.max(0, Math.ceil(hours / cadence - EPS) - 1);
}

/** Prefer `a` over `b` for the last remaining slot. */
function preferForLastSlot(a: Job, b: Job, forced: boolean): boolean {
  if (forced) {
    // Nothing left can hit its deadline here. Placing the task with the most
    // capacity last minimises how badly the worst deadline is missed
    // (Jackson's rule); value only breaks ties.
    if (a.capacity !== b.capacity) return a.capacity > b.capacity;
    if (a.value !== b.value) return a.value < b.value;
  } else {
    // Defer the least valuable work first; among equals, defer whatever has the
    // most room, then whatever the user sequenced later.
    if (a.value !== b.value) return a.value < b.value;
    if (a.capacity !== b.capacity) return a.capacity > b.capacity;
  }
  const seq = compareSequenceKeys(a.seqKey, b.seqKey);
  if (seq !== 0) return seq > 0;
  return a.task.id > b.task.id;
}

export function buildSchedule(
  tasks: Task[],
  goals: Goal[],
  projects: Project[],
  settings: Settings,
  now: Date = new Date()
): Schedule {
  const today = startOfLocalDay(now);
  const cadence = settings.dailyCadence > 0 ? settings.dailyCadence : 1;
  const index = createTaskIndex(tasks);
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const ctx: ValuationContext = createValuationContext(goals, projects, settings.priorityModel);

  // ---- Collect the work ----------------------------------------------------
  const jobs: Job[] = [];
  const orphanTaskIds: string[] = [];
  const doneLeaves: Task[] = [];

  for (const task of tasks) {
    if (!isLeaf(index, task.id)) continue;
    const value = valueOfTask(task, ctx);
    if (value === undefined) {
      orphanTaskIds.push(task.id);
      continue;
    }
    if (task.done) {
      doneLeaves.push(task);
      continue;
    }
    const effectiveDueDate = getEffectiveDueDate(index, task, projectsById);
    const dueDay = dayOffsetOf(effectiveDueDate, today);
    jobs.push({
      task,
      hours: Math.max(0, task.estHours || 0),
      value,
      dueDay,
      capacity: dueDay === undefined ? Infinity : (dueDay + 1) * cadence,
      seqKey: getSequenceKey(index, task.id),
      seqIndex: 0,
      projectId: task.projectId,
    });
  }

  // Strict mode: within a project, leaves are a single chain in tree order.
  const strict = settings.sequenceMode === 'strict';
  const chainTail = new Map<string, number>(); // projectId -> index of the last unplaced job
  if (strict) {
    const byProject = new Map<string, Job[]>();
    for (const job of jobs) {
      const list = byProject.get(job.projectId);
      if (list) list.push(job);
      else byProject.set(job.projectId, [job]);
    }
    for (const list of byProject.values()) {
      list.sort((a, b) => compareSequenceKeys(a.seqKey, b.seqKey));
      list.forEach((job, i) => {
        job.seqIndex = i;
      });
    }
  }

  // ---- Schedule backwards --------------------------------------------------
  const remaining = new Set(jobs.keys());
  const totalHours = jobs.reduce((sum, j) => sum + j.hours, 0);

  if (strict) {
    for (const i of remaining) {
      const job = jobs[i];
      const current = chainTail.get(job.projectId);
      if (current === undefined || job.seqIndex > jobs[current].seqIndex) {
        chainTail.set(job.projectId, i);
      }
    }
  }

  const tail: number[] = []; // filled last-to-first
  let cursorHours = totalHours;

  while (remaining.size > 0) {
    const eligible = strict ? [...chainTail.values()] : [...remaining];

    let pick = -1;
    let anyFits = false;
    for (const i of eligible) {
      const fits = jobs[i].capacity >= cursorHours - EPS;
      if (fits && !anyFits) {
        anyFits = true;
        pick = i;
        continue;
      }
      if (fits === anyFits && (pick === -1 || preferForLastSlot(jobs[i], jobs[pick], !anyFits))) {
        pick = i;
      }
    }

    tail.push(pick);
    cursorHours -= jobs[pick].hours;
    remaining.delete(pick);

    if (strict) {
      const projectId = jobs[pick].projectId;
      let next = -1;
      for (const i of remaining) {
        if (jobs[i].projectId !== projectId) continue;
        if (next === -1 || jobs[i].seqIndex > jobs[next].seqIndex) next = i;
      }
      if (next === -1) chainTail.delete(projectId);
      else chainTail.set(projectId, next);
    }
  }

  const order = tail.reverse();

  // ---- Forward pass: dates and status -------------------------------------
  const byTaskId = new Map<string, ScheduleEntry>();
  const queue: ScheduleEntry[] = [];
  const lateTaskIds: string[] = [];
  let elapsed = 0;

  order.forEach((jobIndex, position) => {
    const job = jobs[jobIndex];
    const startDay = startDayOf(elapsed, cadence);
    elapsed += job.hours;
    const finishDay = Math.max(startDay, finishDayOf(elapsed, cadence));
    const slackDays = job.dueDay === undefined ? undefined : job.dueDay - finishDay;

    const entry: ScheduleEntry = {
      taskId: job.task.id,
      isLeaf: true,
      order: position,
      hours: job.hours,
      startDay,
      finishDay,
      startDate: dateForDayOffset(startDay, today),
      finishDate: dateForDayOffset(finishDay, today),
      value: job.value,
      effectiveDueDate: getEffectiveDueDate(index, job.task, projectsById),
      dueDay: job.dueDay,
      slackDays,
      mustStartByDay: job.dueDay === undefined ? undefined : job.dueDay - spanDays(job.hours, cadence),
      status: statusFor(slackDays, settings.tightSlackDays),
    };
    if (entry.status === 'late') lateTaskIds.push(entry.taskId);
    queue.push(entry);
    byTaskId.set(entry.taskId, entry);
  });

  // Completed leaves: no work left, shown as done.
  for (const task of doneLeaves) {
    byTaskId.set(task.id, {
      taskId: task.id,
      isLeaf: true,
      order: -1,
      hours: 0,
      startDay: 0,
      finishDay: 0,
      startDate: today,
      finishDate: today,
      value: valueOfTask(task, ctx) ?? 0,
      effectiveDueDate: getEffectiveDueDate(index, task, projectsById),
      status: 'done',
    });
  }

  // ---- Roll groups up from their leaves ------------------------------------
  for (const task of tasks) {
    if (isLeaf(index, task.id)) continue;
    const leafEntries = getLeaves(index, task.id)
      .map((leaf) => byTaskId.get(leaf.id))
      .filter((e): e is ScheduleEntry => e !== undefined);
    const active = leafEntries.filter((e) => e.status !== 'done');

    const hours = active.reduce((sum, e) => sum + e.hours, 0);
    const startDay = active.length ? Math.min(...active.map((e) => e.startDay)) : 0;
    const finishDay = active.length ? Math.max(...active.map((e) => e.finishDay)) : 0;
    const effectiveDueDate = getEffectiveDueDate(index, task, projectsById);
    const dueDay = dayOffsetOf(effectiveDueDate, today);
    const slackDays = dueDay === undefined ? undefined : dueDay - finishDay;

    byTaskId.set(task.id, {
      taskId: task.id,
      isLeaf: false,
      order: -1,
      hours,
      startDay,
      finishDay,
      startDate: dateForDayOffset(startDay, today),
      finishDate: dateForDayOffset(finishDay, today),
      value: leafEntries.length ? Math.max(...leafEntries.map((e) => e.value)) : 0,
      effectiveDueDate,
      dueDay,
      slackDays,
      status: active.length === 0 ? 'done' : statusFor(slackDays, settings.tightSlackDays),
    });
  }

  return {
    queue,
    byTaskId,
    lateTaskIds,
    overcommitted: lateTaskIds.length > 0,
    totalHours,
    horizonDay: queue.length ? queue[queue.length - 1].finishDay : 0,
    orphanTaskIds,
    index,
    today,
  };
}

function statusFor(slackDays: number | undefined, tightSlackDays: number): ScheduleStatus {
  if (slackDays === undefined) return 'nodeadline';
  if (slackDays < 0) return 'late';
  if (slackDays <= tightSlackDays) return 'tight';
  return 'ontrack';
}

export const STATUS_EMOJI: Record<ScheduleStatus, string> = {
  late: '🔴',
  tight: '🟡',
  ontrack: '🟢',
  nodeadline: '⚪',
  done: '✅',
};

export const STATUS_LABEL: Record<ScheduleStatus, string> = {
  late: 'At risk',
  tight: 'Tight',
  ontrack: 'On track',
  nodeadline: 'No deadline',
  done: 'Done',
};

/** Progress of a set of leaves, weighted by estimated hours. */
export function completionPercentage(leaves: Task[]): number {
  const total = leaves.reduce((sum, t) => sum + (t.estHours || 0), 0);
  if (total === 0) {
    if (leaves.length === 0) return 0;
    return Math.round((leaves.filter((t) => t.done).length / leaves.length) * 100);
  }
  const done = leaves.filter((t) => t.done).reduce((sum, t) => sum + (t.estHours || 0), 0);
  return Math.round((done / total) * 100);
}
