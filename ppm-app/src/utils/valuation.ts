import type { Goal, PriorityModel, Project, Task } from '../types';

/**
 * How much a piece of work is worth, before any deadline reasoning.
 *
 * Deadlines answer "when must this happen"; value answers "what do I give up if
 * something has to slip". Keeping the two completely separate is the point — the
 * old code folded a deadline bonus into the priority number, which made both
 * halves impossible to reason about (see docs/SCHEDULING.md).
 */
export function valueOf(goal: Goal, project: Project, model: PriorityModel): number {
  const g = Math.max(0, goal.priority || 0);
  const p = Math.max(0, project.priority || 0);
  return model === 'additive' ? (g + p) * 10 : g * p;
}

export interface ValuationContext {
  goalsById: Map<string, Goal>;
  projectsById: Map<string, Project>;
  model: PriorityModel;
}

export function createValuationContext(
  goals: Goal[],
  projects: Project[],
  model: PriorityModel
): ValuationContext {
  return {
    goalsById: new Map(goals.map((g) => [g.id, g])),
    projectsById: new Map(projects.map((p) => [p.id, p])),
    model,
  };
}

/** Value of a task, or undefined if its project or goal is missing (orphan data). */
export function valueOfTask(task: Task, ctx: ValuationContext): number | undefined {
  const project = ctx.projectsById.get(task.projectId);
  if (!project) return undefined;
  const goal = ctx.goalsById.get(project.goalId);
  if (!goal) return undefined;
  return valueOf(goal, project, ctx.model);
}
