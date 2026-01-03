import type { Task } from '../types';

/**
 * Get all direct children of a task
 */
export function getChildren(taskId: string, allTasks: Task[]): Task[] {
  return allTasks
    .filter((t) => t.parentTaskId === taskId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get all descendants of a task (children, grandchildren, etc.)
 */
export function getDescendants(taskId: string, allTasks: Task[]): Task[] {
  const children = getChildren(taskId, allTasks);
  const descendants: Task[] = [...children];

  children.forEach((child) => {
    descendants.push(...getDescendants(child.id, allTasks));
  });

  return descendants;
}

/**
 * Get all ancestors of a task (parent, grandparent, etc.)
 */
export function getAncestors(taskId: string, allTasks: Task[]): Task[] {
  const task = allTasks.find((t) => t.id === taskId);
  if (!task || !task.parentTaskId) {
    return [];
  }

  const parent = allTasks.find((t) => t.id === task.parentTaskId);
  if (!parent) {
    return [];
  }

  return [parent, ...getAncestors(parent.id, allTasks)];
}

/**
 * Get the depth level of a task in the hierarchy
 */
export function getLevel(taskId: string, allTasks: Task[]): number {
  const ancestors = getAncestors(taskId, allTasks);
  return ancestors.length;
}

/**
 * Check if a task is a leaf (has no children)
 */
export function isLeaf(taskId: string, allTasks: Task[]): boolean {
  return !allTasks.some((t) => t.parentTaskId === taskId);
}

/**
 * Get all leaf descendants of a task
 */
export function getLeafDescendants(taskId: string, allTasks: Task[]): Task[] {
  const descendants = getDescendants(taskId, allTasks);
  return descendants.filter((t) => isLeaf(t.id, allTasks));
}

/**
 * Get the root task (top-level parent) of a task
 */
export function getRootTask(taskId: string, allTasks: Task[]): Task {
  const ancestors = getAncestors(taskId, allTasks);
  return ancestors.length > 0 ? ancestors[ancestors.length - 1] : allTasks.find((t) => t.id === taskId)!;
}

/**
 * Get all root tasks (tasks with no parent)
 */
export function getRootTasks(allTasks: Task[]): Task[] {
  return allTasks.filter((t) => !t.parentTaskId);
}

/**
 * Build a hierarchical tree structure from flat task list
 */
export interface TaskNode extends Task {
  children: TaskNode[];
  level: number;
}

export function buildTaskTree(tasks: Task[]): TaskNode[] {
  const taskMap = new Map<string, TaskNode>();

  // First pass: create nodes
  tasks.forEach((task) => {
    taskMap.set(task.id, {
      ...task,
      children: [],
      level: 0,
    });
  });

  // Second pass: build hierarchy and calculate levels
  const rootNodes: TaskNode[] = [];

  tasks.forEach((task) => {
    const node = taskMap.get(task.id)!;

    if (task.parentTaskId) {
      const parent = taskMap.get(task.parentTaskId);
      if (parent) {
        parent.children.push(node);
        node.level = parent.level + 1;
      }
    } else {
      rootNodes.push(node);
    }
  });

  // Sort children by sortOrder
  const sortChildren = (node: TaskNode) => {
    node.children.sort((a, b) => a.sortOrder - b.sortOrder);
    node.children.forEach(sortChildren);
  };

  rootNodes.forEach(sortChildren);
  rootNodes.sort((a, b) => a.sortOrder - b.sortOrder);

  return rootNodes;
}

/**
 * Flatten a task tree back to a list (depth-first traversal)
 */
export function flattenTaskTree(tree: TaskNode[]): Task[] {
  const result: Task[] = [];

  const traverse = (node: TaskNode) => {
    const { children, level, ...task } = node;
    result.push(task);
    node.children.forEach(traverse);
  };

  tree.forEach(traverse);
  return result;
}
