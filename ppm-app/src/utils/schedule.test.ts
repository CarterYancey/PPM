import { describe, expect, it } from 'vitest';
import type { Goal, Project, Settings, Task } from '../types';
import { buildSchedule, getEffectiveDueDate } from './schedule';
import { createTaskIndex } from './taskTree';
import { DEFAULT_SETTINGS } from '../defaults';

const TODAY = new Date(2026, 0, 5); // Mon 5 Jan 2026, local

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
});

const goal = (id: string, priority: number): Goal => ({ id, name: `Goal ${id}`, priority });
const project = (id: string, goalId: string, priority: number, dueDate?: string): Project => ({
  id,
  name: `Project ${id}`,
  goalId,
  priority,
  dueDate,
});
let seq = 0;
const task = (id: string, projectId: string, over: Partial<Task> = {}): Task => ({
  id,
  name: `Task ${id}`,
  projectId,
  sortOrder: ++seq,
  estHours: 2,
  done: false,
  ...over,
});

/** Day offset -> ISO calendar date, relative to TODAY. */
const day = (offset: number) => {
  const d = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const order = (tasks: Task[], goals: Goal[], projects: Project[], s = settings()) =>
  buildSchedule(tasks, goals, projects, s, TODAY).queue.map((e) => e.taskId);

describe('value ordering', () => {
  it('sorts by value when nothing has a deadline', () => {
    const goals = [goal('G1', 21), goal('G2', 3)];
    const projects = [project('P1', 'G1', 5), project('P2', 'G2', 5)];
    const tasks = [task('T1', 'P2'), task('T2', 'P1')];
    expect(order(tasks, goals, projects)).toEqual(['T2', 'T1']);
  });

  it('treats project priority as a weight within the goal (multiplicative)', () => {
    // Additive would rank P2 (1+13=14) above P1 (8+3=11); multiplicative keeps
    // the high-value goal's work first (24 vs 13).
    const goals = [goal('G1', 8), goal('G2', 1)];
    const projects = [project('P1', 'G1', 3), project('P2', 'G2', 13)];
    const tasks = [task('T1', 'P2'), task('T2', 'P1')];
    expect(order(tasks, goals, projects)).toEqual(['T2', 'T1']);
    expect(order(tasks, goals, projects, settings({ priorityModel: 'additive' }))).toEqual([
      'T1',
      'T2',
    ]);
  });

  it('pushes paused (priority 0) work to the end', () => {
    const goals = [goal('G1', 0), goal('G2', 1)];
    const projects = [project('P1', 'G1', 21), project('P2', 'G2', 1)];
    const tasks = [task('T1', 'P1'), task('T2', 'P2')];
    expect(order(tasks, goals, projects)).toEqual(['T2', 'T1']);
  });
});

describe('deadlines', () => {
  it('pulls low-value work forward when its deadline requires it', () => {
    const goals = [goal('G1', 21), goal('G2', 1)];
    const projects = [project('P1', 'G1', 5), project('P2', 'G2', 1)];
    // 2h/day. The cheap task must finish by day 0, so it has to go first.
    const tasks = [task('T1', 'P1'), task('T2', 'P2', { dueDate: day(0) })];
    expect(order(tasks, goals, projects)).toEqual(['T2', 'T1']);
  });

  it('leaves low-value work late when its deadline allows it', () => {
    const goals = [goal('G1', 21), goal('G2', 1)];
    const projects = [project('P1', 'G1', 5), project('P2', 'G2', 1)];
    const tasks = [task('T1', 'P1'), task('T2', 'P2', { dueDate: day(30) })];
    expect(order(tasks, goals, projects)).toEqual(['T1', 'T2']);
  });

  it('meets every deadline when a feasible ordering exists', () => {
    const goals = [goal('G1', 21), goal('G2', 8), goal('G3', 1)];
    const projects = [project('P1', 'G1', 8), project('P2', 'G2', 5), project('P3', 'G3', 2)];
    const tasks = [
      task('T1', 'P1', { estHours: 4, dueDate: day(9) }),
      task('T2', 'P1', { estHours: 2 }),
      task('T3', 'P2', { estHours: 4, dueDate: day(3) }),
      task('T4', 'P3', { estHours: 2, dueDate: day(1) }),
      task('T5', 'P3', { estHours: 2 }),
    ];
    const schedule = buildSchedule(tasks, goals, projects, settings(), TODAY);
    expect(schedule.lateTaskIds).toEqual([]);
    expect(schedule.overcommitted).toBe(false);
    // Lowest-value work with no deadline still lands last.
    expect(schedule.queue[schedule.queue.length - 1].taskId).toBe('T5');
  });

  it('flags genuine over-commitment', () => {
    const goals = [goal('G1', 5)];
    const projects = [project('P1', 'G1', 5)];
    // 12 hours of work, 2h/day, everything due in 2 days (6 hours of capacity).
    const tasks = [
      task('T1', 'P1', { estHours: 4, dueDate: day(2) }),
      task('T2', 'P1', { estHours: 4, dueDate: day(2) }),
      task('T3', 'P1', { estHours: 4, dueDate: day(2) }),
    ];
    const schedule = buildSchedule(tasks, goals, projects, settings(), TODAY);
    expect(schedule.overcommitted).toBe(true);
    expect(schedule.lateTaskIds.length).toBeGreaterThan(0);
  });

  it('does the overdue task first', () => {
    const goals = [goal('G1', 21), goal('G2', 1)];
    const projects = [project('P1', 'G1', 5), project('P2', 'G2', 1)];
    const tasks = [task('T1', 'P1'), task('T2', 'P2', { dueDate: day(-3) })];
    expect(order(tasks, goals, projects)).toEqual(['T2', 'T1']);
  });

  it('inherits the tightest deadline from ancestors and the project', () => {
    const projects = [project('P1', 'G1', 5, '2026-03-01')];
    const tasks = [
      task('P', 'P1', { estHours: undefined, dueDate: '2026-02-01' }),
      task('C', 'P1', { parentTaskId: 'P', dueDate: '2026-12-01' }),
    ];
    const index = createTaskIndex(tasks);
    const projectsById = new Map(projects.map((p) => [p.id, p]));
    expect(getEffectiveDueDate(index, tasks[1], projectsById)).toBe('2026-02-01');
  });

  it('counts a deadline as met when the work finishes on the due day', () => {
    const goals = [goal('G1', 5)];
    const projects = [project('P1', 'G1', 5)];
    const tasks = [task('T1', 'P1', { estHours: 2, dueDate: day(0) })];
    const schedule = buildSchedule(tasks, goals, projects, settings(), TODAY);
    expect(schedule.queue[0].slackDays).toBe(0);
    expect(schedule.queue[0].status).toBe('tight');
  });
});

describe('capacity arithmetic', () => {
  it('fits several short tasks into one day', () => {
    const goals = [goal('G1', 5)];
    const projects = [project('P1', 'G1', 5)];
    const tasks = [
      task('T1', 'P1', { estHours: 1 }),
      task('T2', 'P1', { estHours: 1 }),
      task('T3', 'P1', { estHours: 1 }),
    ];
    const schedule = buildSchedule(tasks, goals, projects, settings({ dailyCadence: 2 }), TODAY);
    const finishDays = schedule.queue.map((e) => e.finishDay);
    expect(finishDays).toEqual([0, 0, 1]);
  });

  it('spreads a long task over several days', () => {
    const goals = [goal('G1', 5)];
    const projects = [project('P1', 'G1', 5)];
    const tasks = [task('T1', 'P1', { estHours: 5 })];
    const schedule = buildSchedule(tasks, goals, projects, settings({ dailyCadence: 2 }), TODAY);
    expect(schedule.queue[0]).toMatchObject({ startDay: 0, finishDay: 2 });
  });
});

describe('sequencing', () => {
  it('keeps equal-value siblings in sortOrder', () => {
    const goals = [goal('G1', 5)];
    const projects = [project('P1', 'G1', 5)];
    const tasks = [
      task('T3', 'P1', { sortOrder: 3 }),
      task('T1', 'P1', { sortOrder: 1 }),
      task('T2', 'P1', { sortOrder: 2 }),
    ];
    expect(order(tasks, goals, projects)).toEqual(['T1', 'T2', 'T3']);
  });

  it('respects tree order across nesting levels', () => {
    const goals = [goal('G1', 5)];
    const projects = [project('P1', 'G1', 5)];
    const tasks = [
      task('A', 'P1', { sortOrder: 1, estHours: undefined }),
      task('A2', 'P1', { parentTaskId: 'A', sortOrder: 2 }),
      task('A1', 'P1', { parentTaskId: 'A', sortOrder: 1 }),
      task('B', 'P1', { sortOrder: 2 }),
    ];
    expect(order(tasks, goals, projects)).toEqual(['A1', 'A2', 'B']);
  });

  it('reorders across sequence in soft mode, but not in strict mode', () => {
    const goals = [goal('G1', 5)];
    const projects = [project('P1', 'G1', 5)];
    // T2 comes second in the user's sequence but is the only one with a deadline.
    const tasks = [
      task('T1', 'P1', { sortOrder: 1, estHours: 4 }),
      task('T2', 'P1', { sortOrder: 2, estHours: 2, dueDate: day(0) }),
    ];
    expect(order(tasks, goals, projects)).toEqual(['T2', 'T1']);
    expect(order(tasks, goals, projects, settings({ sequenceMode: 'strict' }))).toEqual([
      'T1',
      'T2',
    ]);
  });
});

describe('rollups', () => {
  it('rolls group start/finish up from its leaves', () => {
    const goals = [goal('G1', 5)];
    const projects = [project('P1', 'G1', 5)];
    const tasks = [
      task('P', 'P1', { estHours: undefined }),
      task('C1', 'P1', { parentTaskId: 'P', estHours: 2 }),
      task('C2', 'P1', { parentTaskId: 'P', estHours: 2 }),
    ];
    const schedule = buildSchedule(tasks, goals, projects, settings(), TODAY);
    const group = schedule.byTaskId.get('P')!;
    expect(group.isLeaf).toBe(false);
    expect(group.hours).toBe(4);
    expect(group.startDay).toBe(0);
    expect(group.finishDay).toBe(1);
  });

  it('marks a group done once every leaf is done', () => {
    const goals = [goal('G1', 5)];
    const projects = [project('P1', 'G1', 5)];
    const tasks = [
      task('P', 'P1', { estHours: undefined }),
      task('C1', 'P1', { parentTaskId: 'P', done: true }),
    ];
    const schedule = buildSchedule(tasks, goals, projects, settings(), TODAY);
    expect(schedule.byTaskId.get('P')!.status).toBe('done');
    expect(schedule.queue).toHaveLength(0);
  });
});

describe('robustness', () => {
  it('ignores tasks whose project or goal is missing', () => {
    const goals = [goal('G1', 5)];
    const projects = [project('P1', 'G1', 5)];
    const tasks = [task('T1', 'P1'), task('T2', 'P-gone')];
    const schedule = buildSchedule(tasks, goals, projects, settings(), TODAY);
    expect(schedule.queue.map((e) => e.taskId)).toEqual(['T1']);
    expect(schedule.orphanTaskIds).toEqual(['T2']);
  });

  it('survives a parent cycle in imported data', () => {
    const goals = [goal('G1', 5)];
    const projects = [project('P1', 'G1', 5)];
    const tasks = [
      task('A', 'P1', { parentTaskId: 'B' }),
      task('B', 'P1', { parentTaskId: 'A' }),
    ];
    expect(() => buildSchedule(tasks, goals, projects, settings(), TODAY)).not.toThrow();
  });

  it('survives a zero cadence', () => {
    const goals = [goal('G1', 5)];
    const projects = [project('P1', 'G1', 5)];
    const tasks = [task('T1', 'P1')];
    const schedule = buildSchedule(tasks, goals, projects, settings({ dailyCadence: 0 }), TODAY);
    expect(Number.isFinite(schedule.queue[0].finishDay)).toBe(true);
  });
});
