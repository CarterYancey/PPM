import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, Goal, Project, Settings, Task } from './types';
import { DEFAULT_SETTINGS, buildSampleData, normalizeState } from './defaults';

export { DEFAULT_SETTINGS, buildSampleData, normalizeState, nextId } from './defaults';

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

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      goals: [],
      projects: [],
      tasks: [],
      settings: DEFAULT_SETTINGS,

      addGoal: (goal) => set((state) => ({ goals: [...state.goals, goal] })),

      updateGoal: (id, updates) =>
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        })),

      deleteGoal: (id) =>
        set((state) => {
          const projectIds = new Set(state.projects.filter((p) => p.goalId === id).map((p) => p.id));
          return {
            goals: state.goals.filter((g) => g.id !== id),
            projects: state.projects.filter((p) => p.goalId !== id),
            tasks: state.tasks.filter((t) => !projectIds.has(t.projectId)),
          };
        }),

      addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),

      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),

      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          tasks: state.tasks.filter((t) => t.projectId !== id),
        })),

      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),

      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

      deleteTask: (id) =>
        set((state) => {
          // Collect the task and every descendant, then drop them in one pass.
          const doomed = new Set([id]);
          let grew = true;
          while (grew) {
            grew = false;
            for (const task of state.tasks) {
              if (task.parentTaskId && doomed.has(task.parentTaskId) && !doomed.has(task.id)) {
                doomed.add(task.id);
                grew = true;
              }
            }
          }
          return { tasks: state.tasks.filter((t) => !doomed.has(t.id)) };
        }),

      toggleTaskDone: (id) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        })),

      updateSettings: (settings) =>
        set((state) => ({
          settings: normalizeState({ ...state, settings: { ...state.settings, ...settings } }).settings,
        })),

      loadSampleData: () => set(buildSampleData()),

      clearAllData: () => set({ goals: [], projects: [], tasks: [], settings: DEFAULT_SETTINGS }),

      exportData: () => {
        const { goals, projects, tasks, settings } = get();
        return JSON.stringify({ version: 2, goals, projects, tasks, settings }, null, 2);
      },

      importData: (jsonData) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonData);
        } catch {
          throw new Error("That file isn't valid JSON.");
        }
        if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as AppState).goals)) {
          throw new Error("That file doesn't look like a PPM backup (no goals list).");
        }
        set(normalizeState(parsed));
      },
    }),
    {
      name: 'ppm-storage',
      version: 2,
      // v1 had no priorityModel/sequenceMode and stored unvalidated numbers.
      migrate: (persisted) => normalizeState(persisted),
      merge: (persisted, current) => ({ ...current, ...normalizeState(persisted) }),
    }
  )
);
