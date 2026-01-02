import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, Goal, Project, Task, Settings } from './types';

interface AppStore extends AppState {
  // Goal operations
  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;

  // Project operations
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // Task operations
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTaskDone: (id: string) => void;

  // Settings operations
  updateSettings: (settings: Partial<Settings>) => void;

  // Utility operations
  loadSampleData: () => void;
  clearAllData: () => void;
  exportData: () => string;
  importData: (jsonData: string) => void;
}

const defaultSettings: Settings = {
  dailyCadence: 2,
};

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      goals: [],
      projects: [],
      tasks: [],
      settings: defaultSettings,

      // Goal operations
      addGoal: (goal) => set((state) => ({
        goals: [...state.goals, goal],
      })),

      updateGoal: (id, updates) => set((state) => ({
        goals: state.goals.map((g) =>
          g.id === id ? { ...g, ...updates } : g
        ),
      })),

      deleteGoal: (id) => set((state) => {
        // Also delete all projects and tasks associated with this goal
        const projectIds = state.projects
          .filter((p) => p.goalId === id)
          .map((p) => p.id);

        return {
          goals: state.goals.filter((g) => g.id !== id),
          projects: state.projects.filter((p) => p.goalId !== id),
          tasks: state.tasks.filter((t) => !projectIds.includes(t.projectId)),
        };
      }),

      // Project operations
      addProject: (project) => set((state) => ({
        projects: [...state.projects, project],
      })),

      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      })),

      deleteProject: (id) => set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        tasks: state.tasks.filter((t) => t.projectId !== id),
      })),

      // Task operations
      addTask: (task) => set((state) => ({
        tasks: [...state.tasks, task],
      })),

      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      })),

      deleteTask: (id) => set((state) => {
        // Recursively delete all subtasks
        const deleteTaskAndChildren = (taskId: string, tasks: Task[]): Task[] => {
          const children = tasks.filter((t) => t.parentTaskId === taskId);
          let remainingTasks = tasks.filter((t) => t.id !== taskId);

          children.forEach((child) => {
            remainingTasks = deleteTaskAndChildren(child.id, remainingTasks);
          });

          return remainingTasks;
        };

        return {
          tasks: deleteTaskAndChildren(id, state.tasks),
        };
      }),

      toggleTaskDone: (id) => set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, done: !t.done } : t
        ),
      })),

      // Settings operations
      updateSettings: (settings) => set((state) => ({
        settings: { ...state.settings, ...settings },
      })),

      // Utility operations
      loadSampleData: () => {
        const sampleGoals: Goal[] = [
          { id: 'G1', name: 'Read 12 classic novels in 2025', priority: 5, targetDate: '2025-12-31', notes: 'Personal enrichment' },
          { id: 'G2', name: 'Maintain clean, organized home', priority: 8 },
          { id: 'G3', name: 'Earn AWS Solutions Architect', priority: 21, targetDate: '2025-06-30', notes: 'Career advancement' },
          { id: 'G4', name: 'Stay healthy and active', priority: 13 },
          { id: 'G5', name: 'Plan amazing Japan trip', priority: 8, targetDate: '2025-08-15' },
        ];

        const sampleProjects: Project[] = [
          { id: 'P1', name: 'Reading list', goalId: 'G1', priority: 5 },
          { id: 'P2', name: 'Daily housekeeping', goalId: 'G2', priority: 8 },
          { id: 'P3', name: 'Weekly deep cleaning', goalId: 'G2', priority: 3 },
          { id: 'P4', name: 'AWS study plan', goalId: 'G3', priority: 13, dueDate: '2025-06-15' },
          { id: 'P5', name: 'Practice exam prep', goalId: 'G3', priority: 8, dueDate: '2025-06-01' },
          { id: 'P6', name: 'Running program', goalId: 'G4', priority: 8 },
          { id: 'P7', name: 'Meal prep system', goalId: 'G4', priority: 5 },
          { id: 'P8', name: 'Japan itinerary planning', goalId: 'G5', priority: 8, dueDate: '2025-06-01' },
          { id: 'P9', name: 'Japan logistics', goalId: 'G5', priority: 5 },
        ];

        const sampleTasks: Task[] = [
          { id: 'T1', name: 'Read Moby Dick', projectId: 'P1', sortOrder: 1, estHours: 2, dueDate: '2025-02-01', done: false },
          { id: 'T2', name: 'Read Pride and Prejudice', projectId: 'P1', sortOrder: 2, estHours: 2, dueDate: '2025-03-01', done: false },

          { id: 'T3', name: 'Pass AWS exam', projectId: 'P4', sortOrder: 1, dueDate: '2025-06-15', done: false },
          { id: 'T4', name: 'Study compute services', projectId: 'P4', parentTaskId: 'T3', sortOrder: 1, done: false },
          { id: 'T5', name: 'Learn EC2 fundamentals', projectId: 'P4', parentTaskId: 'T4', sortOrder: 1, estHours: 2, done: false },
          { id: 'T6', name: 'Learn Lambda functions', projectId: 'P4', parentTaskId: 'T4', sortOrder: 2, estHours: 2, done: false },
          { id: 'T7', name: 'Study storage services', projectId: 'P4', parentTaskId: 'T3', sortOrder: 2, done: false },
          { id: 'T8', name: 'Learn S3 fundamentals', projectId: 'P4', parentTaskId: 'T7', sortOrder: 1, estHours: 2, done: false },
          { id: 'T9', name: 'Learn EBS and EFS', projectId: 'P4', parentTaskId: 'T7', sortOrder: 2, estHours: 2, done: false },

          { id: 'T10', name: 'Practice exam 1', projectId: 'P5', sortOrder: 1, estHours: 2, dueDate: '2025-05-15', done: false },
          { id: 'T11', name: 'Practice exam 2', projectId: 'P5', sortOrder: 2, estHours: 2, dueDate: '2025-06-01', done: false },

          { id: 'T12', name: 'Plan Japan itinerary', projectId: 'P8', sortOrder: 1, dueDate: '2025-06-01', done: false },
          { id: 'T13', name: 'Research Tokyo neighborhoods', projectId: 'P8', parentTaskId: 'T12', sortOrder: 1, estHours: 2, done: false },
          { id: 'T14', name: 'Research Kyoto attractions', projectId: 'P8', parentTaskId: 'T12', sortOrder: 2, estHours: 2, done: false },
          { id: 'T15', name: 'Create day-by-day schedule', projectId: 'P8', parentTaskId: 'T12', sortOrder: 3, estHours: 2, done: false },

          { id: 'T16', name: 'Book Japan flights', projectId: 'P9', sortOrder: 1, estHours: 2, dueDate: '2025-06-15', done: false },
          { id: 'T17', name: 'Book hotels', projectId: 'P9', sortOrder: 2, estHours: 2, done: false },
        ];

        set({
          goals: sampleGoals,
          projects: sampleProjects,
          tasks: sampleTasks,
        });
      },

      clearAllData: () => set({
        goals: [],
        projects: [],
        tasks: [],
        settings: defaultSettings,
      }),

      exportData: () => {
        const state = get();
        return JSON.stringify({
          goals: state.goals,
          projects: state.projects,
          tasks: state.tasks,
          settings: state.settings,
        }, null, 2);
      },

      importData: (jsonData) => {
        try {
          const data = JSON.parse(jsonData) as AppState;
          set({
            goals: data.goals || [],
            projects: data.projects || [],
            tasks: data.tasks || [],
            settings: data.settings || defaultSettings,
          });
        } catch (error) {
          console.error('Failed to import data:', error);
          throw new Error('Invalid JSON data');
        }
      },
    }),
    {
      name: 'ppm-storage', // localStorage key
    }
  )
);
