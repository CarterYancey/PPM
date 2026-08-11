export interface Goal {
  id: string; // G1, G2, G3...
  name: string;
  priority: number; // Non-negative; commonly Fibonacci (0, 1, 2, 3, 5, 8, 13, 21, 34...). 0 = paused.
  targetDate?: string; // ISO calendar date
  notes?: string;
}

export interface Project {
  id: string; // P1, P2, P3...
  name: string;
  goalId: string; // Reference to Goal.id
  priority: number; // Weight of this project *within* its goal. 0 = paused.
  dueDate?: string; // ISO calendar date
}

export interface Task {
  id: string; // T1, T2, T3...
  name: string;
  projectId: string; // Reference to Project.id
  parentTaskId?: string; // Reference to another Task.id
  sortOrder: number; // 1, 2, 3... defines sequence within parent
  estHours?: number; // Only meaningful for leaf tasks (tasks without children)
  dueDate?: string; // ISO calendar date
  done: boolean; // Only meaningful for leaf tasks
}

/**
 * How a task's value is derived from its goal and project priority.
 * - `multiplicative`: goal.priority x project.priority. Project priority is a
 *   weight *within* the goal, which is how the spec describes it, and a paused
 *   (0) goal correctly zeroes out everything under it.
 * - `additive`: (goal.priority + project.priority) x 10. The original v1 rule,
 *   kept so old lists can be reproduced.
 */
export type PriorityModel = 'multiplicative' | 'additive';

/**
 * How `sortOrder` is interpreted.
 * - `strict`: a hard prerequisite. Within a project, work happens in tree order.
 * - `soft`: a tie-break only. The scheduler may reorder siblings freely.
 */
export type SequenceMode = 'strict' | 'soft';

export interface Settings {
  dailyCadence: number; // Hours per day available for task work
  priorityModel: PriorityModel;
  sequenceMode: SequenceMode;
  tightSlackDays: number; // Slack at or below this many days shows as "tight"
}

// Main application state
export interface AppState {
  goals: Goal[];
  projects: Project[];
  tasks: Task[];
  settings: Settings;
}
