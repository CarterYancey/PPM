// Fibonacci priority values: 0, 1, 2, 3, 5, 8, 13, 21, 34, etc.
export type FibonacciPriority = 0 | 1 | 2 | 3 | 5 | 8 | 13 | 21 | 34 | 55 | 89;

export interface Goal {
  id: string; // G1, G2, G3...
  name: string;
  priority: FibonacciPriority;
  targetDate?: string; // ISO date string
  notes?: string;
}

export interface Project {
  id: string; // P1, P2, P3...
  name: string;
  goalId: string; // Reference to Goal.id
  priority: FibonacciPriority;
  dueDate?: string; // ISO date string
}

export interface Task {
  id: string; // T1, T2, T3...
  name: string;
  projectId: string; // Reference to Project.id
  parentTaskId?: string; // Reference to another Task.id
  sortOrder: number; // 1, 2, 3... defines sequence within parent
  estHours?: number; // Only for leaf tasks (tasks without children)
  dueDate?: string; // ISO date string
  done: boolean; // Only meaningful for leaf tasks
}

export interface Settings {
  dailyCadence: number; // Hours per day user works on tasks (default: 2)
}

// Calculated/derived fields for tasks
export interface TaskCalculations {
  taskId: string;
  level: number; // Depth in hierarchy (0 = root, 1 = child, etc.)
  isLeaf: boolean; // TRUE if task has no subtasks
  totalHoursRemaining: number; // For parent tasks, sum of incomplete descendant hours
  completionPercentage: number; // Hours completed / total hours (0-100)
  expectedCompletionDate?: string; // Today + (hours remaining / daily cadence)
  daysUntilDue?: number; // Due date - today (if applicable)
  daysNeeded: number; // Hours remaining / daily cadence
  slack?: number; // Days until due - days needed
  urgencyScore: number; // Final priority score for sorting
  basePriority: number; // (Goal.Priority + Project.Priority) × 10
  urgencyBoost: number; // Deadline-based boost
}

// Extended task with calculations for display
export interface TaskWithCalculations extends Task {
  calculations: TaskCalculations;
  goal?: Goal;
  project?: Project;
  parent?: Task;
  children?: TaskWithCalculations[];
}

// For the "Today's List" view
export interface TodayListItem {
  task: Task;
  parentName?: string;
  projectName: string;
  goalName: string;
  urgencyScore: number;
  statusIndicator: '🔴' | '🟡' | '🟢' | '⚪'; // at risk, tight, on track, no deadline
  slack?: number;
  expectedCompletion?: string;
}

// Main application state
export interface AppState {
  goals: Goal[];
  projects: Project[];
  tasks: Task[];
  settings: Settings;
}
