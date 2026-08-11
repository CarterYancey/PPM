import type { Task } from '../types';

/**
 * A precomputed view of the task forest.
 *
 * The old helpers each rescanned the whole task array (`isLeaf` alone was an
 * O(n) scan called from inside O(n) loops), so a few hundred tasks meant tens of
 * thousands of array walks per render. Build the index once and every lookup is
 * O(1). It is also the only place that has to worry about corrupt data —
 * dangling `parentTaskId`s and parent cycles are neutralised here so the rest of
 * the codebase can assume a well-formed forest.
 */
export interface TaskIndex {
  /** All tasks, keyed by id. */
  byId: Map<string, Task>;
  /** Direct children, sorted by sortOrder. Keyed by parent id. */
  childrenOf: Map<string, Task[]>;
  /** Tasks with no (valid) parent, sorted by sortOrder. */
  roots: Task[];
  /** Effective parent id, with dangling references and cycles removed. */
  parentOf: Map<string, string | undefined>;
  /** Depth in the hierarchy (0 = root). */
  levelOf: Map<string, number>;
  /** Tasks with no children. */
  leafIds: Set<string>;
  /** Leaf descendants of every task (a leaf's list contains only itself). */
  leavesOf: Map<string, Task[]>;
}

const bySortOrder = (a: Task, b: Task) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);

/**
 * Build the index. Tolerates dangling parent references (treated as roots) and
 * parent cycles (the back-edge is dropped, making the entry point a root).
 */
export function createTaskIndex(tasks: Task[]): TaskIndex {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const parentOf = new Map<string, string | undefined>();

  // Resolve each task's real parent: drop references to tasks that don't exist,
  // and drop any edge that would close a cycle.
  for (const task of tasks) {
    let parentId = task.parentTaskId;
    if (parentId && byId.has(parentId)) {
      const seen = new Set<string>([task.id]);
      let cursor: string | undefined = parentId;
      while (cursor) {
        if (seen.has(cursor)) {
          parentId = undefined; // cycle — treat this task as a root
          break;
        }
        seen.add(cursor);
        cursor = byId.get(cursor)?.parentTaskId;
      }
    } else {
      parentId = undefined;
    }
    parentOf.set(task.id, parentId);
  }

  const childrenOf = new Map<string, Task[]>();
  const roots: Task[] = [];
  for (const task of tasks) {
    const parentId = parentOf.get(task.id);
    if (parentId) {
      const siblings = childrenOf.get(parentId);
      if (siblings) siblings.push(task);
      else childrenOf.set(parentId, [task]);
    } else {
      roots.push(task);
    }
  }
  roots.sort(bySortOrder);
  for (const siblings of childrenOf.values()) siblings.sort(bySortOrder);

  const leafIds = new Set<string>();
  for (const task of tasks) {
    if (!childrenOf.has(task.id)) leafIds.add(task.id);
  }

  const levelOf = new Map<string, number>();
  const leavesOf = new Map<string, Task[]>();
  const walk = (task: Task, level: number): Task[] => {
    levelOf.set(task.id, level);
    const children = childrenOf.get(task.id);
    if (!children) {
      const self = [task];
      leavesOf.set(task.id, self);
      return self;
    }
    const leaves: Task[] = [];
    for (const child of children) leaves.push(...walk(child, level + 1));
    leavesOf.set(task.id, leaves);
    return leaves;
  };
  for (const root of roots) walk(root, 0);

  return { byId, childrenOf, roots, parentOf, levelOf, leafIds, leavesOf };
}

export function getChildren(index: TaskIndex, taskId: string): Task[] {
  return index.childrenOf.get(taskId) ?? [];
}

export function isLeaf(index: TaskIndex, taskId: string): boolean {
  return index.leafIds.has(taskId);
}

/** Leaf descendants of a task. For a leaf, this is the task itself. */
export function getLeaves(index: TaskIndex, taskId: string): Task[] {
  return index.leavesOf.get(taskId) ?? [];
}

/** Ancestors, nearest first. */
export function getAncestors(index: TaskIndex, taskId: string): Task[] {
  const ancestors: Task[] = [];
  let cursor = index.parentOf.get(taskId);
  while (cursor) {
    const parent = index.byId.get(cursor);
    if (!parent) break;
    ancestors.push(parent);
    cursor = index.parentOf.get(parent.id);
  }
  return ancestors;
}

export function getLevel(index: TaskIndex, taskId: string): number {
  return index.levelOf.get(taskId) ?? 0;
}

/** Root tasks of a single project, sorted by sortOrder. */
export function getProjectRoots(index: TaskIndex, projectId: string): Task[] {
  return index.roots.filter((t) => t.projectId === projectId);
}

/**
 * The user-defined sequence position of a task, as the path of sortOrders from
 * its project root down to the task. Comparing these lexicographically gives the
 * depth-first order the user sees in the tree, which is what `sortOrder` is
 * documented to mean ("task 2 happens after task 1").
 */
export function getSequenceKey(index: TaskIndex, taskId: string): number[] {
  const task = index.byId.get(taskId);
  if (!task) return [];
  const key = [task.sortOrder];
  for (const ancestor of getAncestors(index, taskId)) key.unshift(ancestor.sortOrder);
  return key;
}

export function compareSequenceKeys(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? -Infinity;
    const bv = b[i] ?? -Infinity;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export interface TaskNode extends Task {
  children: TaskNode[];
  level: number;
}

/** Build a nested tree for display. */
export function buildTaskTree(index: TaskIndex, tasks: Task[]): TaskNode[] {
  const wanted = new Set(tasks.map((t) => t.id));
  const build = (task: Task): TaskNode => ({
    ...task,
    level: getLevel(index, task.id),
    children: getChildren(index, task.id)
      .filter((c) => wanted.has(c.id))
      .map(build),
  });
  return tasks
    .filter((t) => {
      const parentId = index.parentOf.get(t.id);
      return !parentId || !wanted.has(parentId);
    })
    .sort(bySortOrder)
    .map(build);
}
