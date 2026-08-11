import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useStore, nextId } from '../store';
import type { Project } from '../types';
import { buildTaskTree, isLeaf, type TaskNode } from '../utils/taskTree';
import { completionPercentage, STATUS_EMOJI, STATUS_LABEL } from '../utils/schedule';
import { parseCalendarDate } from '../utils/dates';
import { useSchedule } from '../hooks/useSchedule';
import TaskForm, { type TaskFormValues } from './TaskForm';

const EMPTY_TASK: TaskFormValues = { name: '', sortOrder: 1, estHours: undefined, dueDate: undefined };

export default function ProjectsTab() {
  const goals = useStore((s) => s.goals);
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const addProject = useStore((s) => s.addProject);
  const updateProject = useStore((s) => s.updateProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const toggleTaskDone = useStore((s) => s.toggleTaskDone);

  const schedule = useSchedule();

  const [isAddingProject, setIsAddingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  // Groups start collapsed; we track what the user has opened rather than what
  // is closed, so adding a task can never silently re-collapse the tree.
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [addingTaskFor, setAddingTaskFor] = useState<{ projectId: string; parentTaskId?: string } | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const [projectForm, setProjectForm] = useState<Omit<Project, 'id'>>({
    name: '',
    goalId: '',
    priority: 5,
    dueDate: undefined,
  });

  const groupedProjects = useMemo(
    () =>
      [...goals]
        .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
        .map((goal) => ({
          goal,
          projects: projects
            .filter((p) => p.goalId === goal.id)
            .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)),
        }))
        .filter((group) => group.projects.length > 0),
    [goals, projects]
  );

  const resetProjectForm = () => {
    setIsAddingProject(false);
    setEditingProjectId(null);
    setProjectForm({ name: '', goalId: '', priority: 5, dueDate: undefined });
  };

  const handleProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProjectId) updateProject(editingProjectId, projectForm);
    else addProject({ id: nextId(projects, 'P'), ...projectForm });
    resetProjectForm();
  };

  const submitNewTask = (values: TaskFormValues) => {
    if (!addingTaskFor) return;
    addTask({
      id: nextId(tasks, 'T'),
      projectId: addingTaskFor.projectId,
      parentTaskId: addingTaskFor.parentTaskId,
      done: false,
      ...values,
    });
    if (addingTaskFor.parentTaskId) {
      setExpandedNodes((prev) => new Set(prev).add(addingTaskFor.parentTaskId!));
    }
    setAddingTaskFor(null);
  };

  const nextSortOrder = (projectId: string, parentTaskId?: string) => {
    const siblings = tasks.filter((t) => t.projectId === projectId && t.parentTaskId === parentTaskId);
    return siblings.reduce((max, s) => Math.max(max, s.sortOrder), 0) + 1;
  };

  const toggleExpanded = (taskId: string) =>
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });

  const renderTaskNode = (node: TaskNode, projectId: string) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const taskIsLeaf = isLeaf(schedule.index, node.id);
    const entry = schedule.byTaskId.get(node.id);

    if (editingTaskId === node.id) {
      return (
        <TaskForm
          key={node.id}
          title="Task Name"
          submitLabel="Save"
          indentLevel={node.level}
          initial={{
            name: node.name,
            sortOrder: node.sortOrder,
            estHours: node.estHours,
            dueDate: node.dueDate,
          }}
          onSubmit={(values) => {
            updateTask(node.id, values);
            setEditingTaskId(null);
          }}
          onCancel={() => setEditingTaskId(null)}
        />
      );
    }

    return (
      <div key={node.id}>
        <div
          className="flex items-start p-2 border rounded hover:bg-gray-50 mb-1"
          style={{ marginLeft: `${node.level * 24}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpanded(node.id)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
              className="mr-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <div className="w-5 mr-2" />
          )}

          {taskIsLeaf && (
            <input
              type="checkbox"
              checked={node.done}
              onChange={() => toggleTaskDone(node.id)}
              aria-label={`Mark "${node.name}" done`}
              className="mt-0.5 mr-2 h-4 w-4 rounded border-gray-300 text-blue-600"
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-gray-400">{node.id}</span>
              {entry && (
                <span className="text-base" title={STATUS_LABEL[entry.status]}>
                  {STATUS_EMOJI[entry.status]}
                </span>
              )}
              <h5
                className={`text-sm font-medium ${node.done ? 'line-through text-gray-500' : 'text-gray-900'}`}
              >
                {node.name}
              </h5>
              {!taskIsLeaf && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                  Group
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-gray-500">
              <span>#{node.sortOrder}</span>
              {entry && entry.hours > 0 && <span>{entry.hours}h</span>}
              {entry?.effectiveDueDate && (
                <span className={entry.effectiveDueDate !== node.dueDate ? 'italic' : ''}>
                  Due: {format(parseCalendarDate(entry.effectiveDueDate), 'MMM d')}
                  {entry.effectiveDueDate !== node.dueDate && ' (inherited)'}
                </span>
              )}
              {entry && entry.status !== 'done' && entry.hours > 0 && (
                <span>Planned finish: {format(entry.finishDate, 'MMM d')}</span>
              )}
            </div>
          </div>

          <div className="ml-2 flex space-x-1">
            <button
              onClick={() => {
                setEditingTaskId(null);
                setAddingTaskFor({ projectId, parentTaskId: node.id });
                setExpandedNodes((prev) => new Set(prev).add(node.id));
              }}
              className="px-2 py-0.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100"
              title="Add subtask"
            >
              + Subtask
            </button>
            <button
              onClick={() => {
                setAddingTaskFor(null);
                setEditingTaskId(node.id);
              }}
              className="px-2 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete "${node.name}"?${hasChildren ? ' This will also delete all subtasks.' : ''}`)) {
                  deleteTask(node.id);
                }
              }}
              aria-label={`Delete ${node.name}`}
              className="px-2 py-0.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100"
            >
              ×
            </button>
          </div>
        </div>

        {addingTaskFor?.parentTaskId === node.id && (
          <TaskForm
            title="Subtask Name"
            submitLabel="Add Subtask"
            indentLevel={node.level + 1}
            initial={{ ...EMPTY_TASK, sortOrder: nextSortOrder(projectId, node.id) }}
            onSubmit={submitNewTask}
            onCancel={() => setAddingTaskFor(null)}
          />
        )}

        {hasChildren && isExpanded && (
          <div className="mt-1">{node.children.map((child) => renderTaskNode(child, projectId))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Projects &amp; Tasks</h2>
          <p className="text-sm text-gray-600 mt-1">Manage projects and their tasks in one place</p>
        </div>
        {!isAddingProject && !editingProjectId && (
          <button
            onClick={() => setIsAddingProject(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
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

      {(isAddingProject || editingProjectId) && (
        <form onSubmit={handleProjectSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            {editingProjectId ? 'Edit Project' : 'New Project'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
              <input
                type="text"
                required
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Goal *</label>
              <select
                required
                value={projectForm.goalId}
                onChange={(e) => setProjectForm({ ...projectForm, goalId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
              <input
                type="number"
                required
                min="0"
                value={projectForm.priority}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, priority: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                Weight within this goal. 0 pauses the project.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={projectForm.dueDate ?? ''}
                onChange={(e) => setProjectForm({ ...projectForm, dueDate: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
          </div>
          <div className="mt-4 flex space-x-2">
            <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              {editingProjectId ? 'Update' : 'Add'} Project
            </button>
            <button
              type="button"
              onClick={resetProjectForm}
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
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {goal.name} <span className="text-sm text-gray-500">(Priority: {goal.priority})</span>
            </h3>
            <div className="space-y-4">
              {goalProjects.map((project) => {
                const projectTasks = tasks.filter((t) => t.projectId === project.id);
                const leaves = projectTasks.filter((t) => isLeaf(schedule.index, t.id));
                const totalHours = leaves.reduce((sum, t) => sum + (t.estHours || 0), 0);
                const doneHours = leaves
                  .filter((t) => t.done)
                  .reduce((sum, t) => sum + (t.estHours || 0), 0);
                const percentage = completionPercentage(leaves);
                const taskTree = buildTaskTree(schedule.index, projectTasks);
                const isAddingHere = addingTaskFor?.projectId === project.id && !addingTaskFor.parentTaskId;

                return (
                  <div key={project.id} className="border rounded-lg bg-white">
                    <div className="p-4 border-b bg-gray-50">
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
                                {format(parseCalendarDate(project.dueDate), 'MMM d, yyyy')}
                              </span>
                            )}
                            <span>
                              <span className="font-medium">Tasks:</span>{' '}
                              {leaves.filter((t) => t.done).length}/{leaves.length}
                            </span>
                            {totalHours > 0 && (
                              <>
                                <span>
                                  <span className="font-medium">Hours:</span> {doneHours}/{totalHours}
                                </span>
                                <span>
                                  <span className="font-medium">Progress:</span> {percentage}%
                                </span>
                              </>
                            )}
                          </div>
                          {totalHours > 0 && (
                            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="ml-4 flex space-x-2">
                          <button
                            onClick={() => {
                              setEditingTaskId(null);
                              setAddingTaskFor({ projectId: project.id });
                            }}
                            className="px-3 py-1 text-sm bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100"
                          >
                            + Add Task
                          </button>
                          <button
                            onClick={() => {
                              setIsAddingProject(false);
                              setEditingProjectId(project.id);
                              setProjectForm({
                                name: project.name,
                                goalId: project.goalId,
                                priority: project.priority,
                                dueDate: project.dueDate,
                              });
                            }}
                            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete "${project.name}"? This will also delete all tasks.`)) {
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

                    <div className="p-4">
                      {isAddingHere && (
                        <TaskForm
                          title="Task Name"
                          submitLabel="Add Task"
                          initial={{ ...EMPTY_TASK, sortOrder: nextSortOrder(project.id) }}
                          onSubmit={submitNewTask}
                          onCancel={() => setAddingTaskFor(null)}
                        />
                      )}

                      {taskTree.length > 0 ? (
                        <div className="space-y-1">
                          {taskTree.map((node) => renderTaskNode(node, project.id))}
                        </div>
                      ) : (
                        !isAddingHere && (
                          <div className="text-center py-4 text-gray-500 text-sm">
                            No tasks yet. Click "Add Task" to create one.
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && !isAddingProject && goals.length > 0 && (
        <div className="text-center py-12 text-gray-500">
          No projects yet. Click "Add Project" to create your first project.
        </div>
      )}
    </div>
  );
}
