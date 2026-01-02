import { useState } from 'react';
import { useStore } from '../store';
import type { Project, FibonacciPriority } from '../types';
import { format } from 'date-fns';

const FIBONACCI_PRIORITIES: FibonacciPriority[] = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

export default function ProjectsTab() {
  const { goals, projects, tasks, addProject, updateProject, deleteProject } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<Project, 'id'>>({
    name: '',
    goalId: '',
    priority: 5,
    dueDate: undefined,
  });

  const generateNextId = () => {
    const maxId = projects.reduce((max, p) => {
      const num = parseInt(p.id.substring(1));
      return num > max ? num : max;
    }, 0);
    return `P${maxId + 1}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateProject(editingId, formData);
      setEditingId(null);
    } else {
      addProject({ id: generateNextId(), ...formData });
      setIsAdding(false);
    }
    setFormData({ name: '', goalId: '', priority: 5, dueDate: undefined });
  };

  const handleEdit = (project: Project) => {
    setEditingId(project.id);
    setFormData({
      name: project.name,
      goalId: project.goalId,
      priority: project.priority,
      dueDate: project.dueDate,
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', goalId: '', priority: 5, dueDate: undefined });
  };

  // Group projects by goal and sort by priority
  const groupedProjects = goals
    .sort((a, b) => b.priority - a.priority)
    .map((goal) => ({
      goal,
      projects: projects
        .filter((p) => p.goalId === goal.id)
        .sort((a, b) => b.priority - a.priority),
    }))
    .filter((group) => group.projects.length > 0);

  const getProjectCompletionStats = (projectId: string) => {
    const projectTasks = tasks.filter((t) => t.projectId === projectId);
    const completed = projectTasks.filter((t) => t.done).length;
    return { total: projectTasks.length, completed };
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
          <p className="text-sm text-gray-600 mt-1">
            Collections of related tasks supporting a goal
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={goals.length === 0}
          >
            + Add Project
          </button>
        )}
      </div>

      {goals.length === 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
          Create a goal first before adding projects.
        </div>
      )}

      {(isAdding || editingId) && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., AWS study plan"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Goal *
              </label>
              <select
                required
                value={formData.goalId}
                onChange={(e) => setFormData({ ...formData, goalId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a goal...</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.id} - {goal.name} (Priority: {goal.priority})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority (Fibonacci) *
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) as FibonacciPriority })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              >
                {FIBONACCI_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p} {p === 0 ? '(Paused)' : p <= 5 ? '(Low)' : p <= 13 ? '(Medium)' : '(High)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate || ''}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 flex space-x-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {editingId ? 'Update' : 'Add'} Project
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {groupedProjects.map(({ goal, projects: goalProjects }) => (
          <div key={goal.id}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {goal.name} <span className="text-sm text-gray-500">(Priority: {goal.priority})</span>
            </h3>
            <div className="space-y-2">
              {goalProjects.map((project) => {
                const stats = getProjectCompletionStats(project.id);
                const completionPercentage = stats.total > 0
                  ? Math.round((stats.completed / stats.total) * 100)
                  : 0;

                return (
                  <div
                    key={project.id}
                    className="p-4 border rounded-lg bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-mono text-gray-500">{project.id}</span>
                          <h4 className="text-lg font-medium text-gray-900">{project.name}</h4>
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-200">
                            Priority: {project.priority}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                          {project.dueDate && (
                            <span>
                              <span className="font-medium">Due:</span>{' '}
                              {format(new Date(project.dueDate), 'MMM d, yyyy')}
                            </span>
                          )}
                          <span>
                            <span className="font-medium">Tasks:</span> {stats.completed}/{stats.total}
                          </span>
                          {stats.total > 0 && (
                            <span>
                              <span className="font-medium">Progress:</span> {completionPercentage}%
                            </span>
                          )}
                        </div>

                        {stats.total > 0 && (
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ width: `${completionPercentage}%` }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="ml-4 flex space-x-2">
                        <button
                          onClick={() => handleEdit(project)}
                          className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete project "${project.name}"? This will also delete all related tasks.`)) {
                              deleteProject(project.id);
                            }
                          }}
                          className="px-3 py-1 text-sm bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && !isAdding && goals.length > 0 && (
        <div className="text-center py-12 text-gray-500">
          No projects yet. Click "Add Project" to create your first project.
        </div>
      )}
    </div>
  );
}
