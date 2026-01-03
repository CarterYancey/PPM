import { useState, useEffect } from 'react';
import { useStore } from '../store';
import type { Project, Task } from '../types';
import { format } from 'date-fns';
import { buildTaskTree, type TaskNode, isLeaf } from '../utils/taskTree';
import { getEffectiveDueDate, calculateSlack, getStatusIndicator, calculateTotalHoursRemaining } from '../utils/prioritization';

export default function ProjectsTab() {
  const { goals, projects, tasks, settings, addProject, updateProject, deleteProject, addTask, updateTask, deleteTask, toggleTaskDone } = useStore();
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Initialize collapsed nodes to include all parent tasks (tasks with children) by default
  useEffect(() => {
    const parentTasks = tasks.filter(task => !isLeaf(task.id, tasks));
    setCollapsedNodes(new Set(parentTasks.map(t => t.id)));
  }, [tasks.length]); // Only re-run when number of tasks changes

  // Task form state
  const [addingTaskFor, setAddingTaskFor] = useState<{ projectId: string; parentTaskId?: string } | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const [projectFormData, setProjectFormData] = useState<Omit<Project, 'id'>>({
    name: '',
    goalId: '',
    priority: 5,
    dueDate: undefined,
  });

  const [taskFormData, setTaskFormData] = useState<Omit<Task, 'id' | 'projectId' | 'parentTaskId'>>({
    name: '',
    sortOrder: 1,
    estHours: undefined,
    dueDate: undefined,
    done: false,
  });

  const generateNextProjectId = () => {
    const maxId = projects.reduce((max, p) => {
      const num = parseInt(p.id.substring(1));
      return num > max ? num : max;
    }, 0);
    return `P${maxId + 1}`;
  };

  const generateNextTaskId = () => {
    const maxId = tasks.reduce((max, t) => {
      const num = parseInt(t.id.substring(1));
      return num > max ? num : max;
    }, 0);
    return `T${maxId + 1}`;
  };

  const handleProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProjectId) {
      updateProject(editingProjectId, projectFormData);
      setEditingProjectId(null);
    } else {
      addProject({ id: generateNextProjectId(), ...projectFormData });
      setIsAddingProject(false);
    }
    setProjectFormData({ name: '', goalId: '', priority: 5, dueDate: undefined });
  };

  const handleProjectEdit = (project: Project) => {
    setEditingProjectId(project.id);
    setProjectFormData({
      name: project.name,
      goalId: project.goalId,
      priority: project.priority,
      dueDate: project.dueDate,
    });
  };

  const handleProjectCancel = () => {
    setIsAddingProject(false);
    setEditingProjectId(null);
    setProjectFormData({ name: '', goalId: '', priority: 5, dueDate: undefined });
  };

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingTaskFor && !editingTaskId) return;

    if (editingTaskId) {
      updateTask(editingTaskId, taskFormData);
      setEditingTaskId(null);
    } else if (addingTaskFor) {
      const siblings = tasks.filter((t) =>
        t.projectId === addingTaskFor.projectId &&
        t.parentTaskId === addingTaskFor.parentTaskId
      );
      const maxSortOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.sortOrder)) : 0;

      addTask({
        id: generateNextTaskId(),
        projectId: addingTaskFor.projectId,
        parentTaskId: addingTaskFor.parentTaskId,
        ...taskFormData,
        sortOrder: maxSortOrder + 1,
      });
      setAddingTaskFor(null);
    }
    setTaskFormData({ name: '', sortOrder: 1, estHours: undefined, dueDate: undefined, done: false });
  };

  const handleTaskEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskFormData({
      name: task.name,
      sortOrder: task.sortOrder,
      estHours: task.estHours,
      dueDate: task.dueDate,
      done: task.done,
    });
  };

  const handleTaskCancel = () => {
    setAddingTaskFor(null);
    setEditingTaskId(null);
    setTaskFormData({ name: '', sortOrder: 1, estHours: undefined, dueDate: undefined, done: false });
  };

  const toggleCollapse = (taskId: string) => {
    const newCollapsed = new Set(collapsedNodes);
    if (newCollapsed.has(taskId)) {
      newCollapsed.delete(taskId);
    } else {
      newCollapsed.add(taskId);
    }
    setCollapsedNodes(newCollapsed);
  };

  const renderTaskNode = (node: TaskNode, projectId: string) => {
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsedNodes.has(node.id);
    const taskIsLeaf = isLeaf(node.id, tasks);
    const isEditing = editingTaskId === node.id;

    // Calculate status indicator
    const effectiveDueDate = getEffectiveDueDate(node, tasks);
    const hoursRemaining = calculateTotalHoursRemaining(node, tasks);
    const slack = calculateSlack(effectiveDueDate, hoursRemaining, settings.dailyCadence);
    const urgencyBoost = slack !== undefined && slack < 0 ? 1000 : 0;
    const statusIndicator = getStatusIndicator(urgencyBoost, slack);

    if (isEditing) {
      return (
        <div key={node.id} className="mb-2 p-3 border border-blue-300 rounded-lg bg-blue-50" style={{ marginLeft: `${node.level * 24}px` }}>
          <form onSubmit={handleTaskSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Name *</label>
              <input
                type="text"
                required
                value={taskFormData.name}
                onChange={(e) => setTaskFormData({ ...taskFormData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={taskFormData.sortOrder}
                  onChange={(e) => setTaskFormData({ ...taskFormData, sortOrder: parseInt(e.target.value) })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Hours</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={taskFormData.estHours || ''}
                  onChange={(e) => setTaskFormData({ ...taskFormData, estHours: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={taskFormData.dueDate || ''}
                  onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value || undefined })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <button type="submit" className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                Save
              </button>
              <button type="button" onClick={handleTaskCancel} className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">
                Cancel
              </button>
            </div>
          </form>
        </div>
      );
    }

    return (
      <div key={node.id}>
        <div
          className="flex items-start p-2 border rounded hover:bg-gray-50 mb-1"
          style={{ marginLeft: `${node.level * 24}px` }}
        >
          {hasChildren && (
            <button onClick={() => toggleCollapse(node.id)} className="mr-2 text-gray-500 hover:text-gray-700 text-sm">
              {isCollapsed ? '▶' : '▼'}
            </button>
          )}
          {!hasChildren && <div className="w-5 mr-2" />}

          {taskIsLeaf && (
            <input
              type="checkbox"
              checked={node.done}
              onChange={() => toggleTaskDone(node.id)}
              className="mt-0.5 mr-2 h-4 w-4 rounded border-gray-300 text-blue-600"
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-gray-400">{node.id}</span>
              <span className="text-base">{statusIndicator}</span>
              <h5 className={`text-sm font-medium ${node.done ? 'line-through text-gray-500' : 'text-gray-900'}`}>
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
              {node.estHours && <span>{node.estHours}h</span>}
              {node.dueDate && <span>Due: {format(new Date(node.dueDate), 'MMM d')}</span>}
              {effectiveDueDate && !node.dueDate && <span>Due: {format(new Date(effectiveDueDate), 'MMM d')} (inherited)</span>}
            </div>
          </div>

          <div className="ml-2 flex space-x-1">
            <button
              onClick={() => setAddingTaskFor({ projectId, parentTaskId: node.id })}
              className="px-2 py-0.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100"
              title="Add subtask"
            >
              + Subtask
            </button>
            <button
              onClick={() => handleTaskEdit(node)}
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
              className="px-2 py-0.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100"
            >
              ×
            </button>
          </div>
        </div>

        {/* Show subtask form if adding to this task */}
        {addingTaskFor?.parentTaskId === node.id && (
          <div className="mb-2 p-3 border border-blue-300 rounded-lg bg-blue-50" style={{ marginLeft: `${(node.level + 1) * 24}px` }}>
            <form onSubmit={handleTaskSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtask Name *</label>
                <input
                  type="text"
                  required
                  value={taskFormData.name}
                  onChange={(e) => setTaskFormData({ ...taskFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="e.g., Complete first draft"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Position
                    <span className="ml-1 text-gray-500" title="Order this task will appear (1=first, 2=second, etc.)">ⓘ</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={taskFormData.sortOrder}
                    onChange={(e) => setTaskFormData({ ...taskFormData, sortOrder: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hours</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={taskFormData.estHours || ''}
                    onChange={(e) => setTaskFormData({ ...taskFormData, estHours: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskFormData.dueDate || ''}
                    onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value || undefined })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
              <div className="flex space-x-2">
                <button type="submit" className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                  Add Subtask
                </button>
                <button type="button" onClick={handleTaskCancel} className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {hasChildren && !isCollapsed && (
          <div className="mt-1">
            {node.children.map((child) => renderTaskNode(child, projectId))}
          </div>
        )}
      </div>
    );
  };

  // Group projects by goal and sort
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

    // Only count leaf tasks (tasks without children)
    const leafTasks = projectTasks.filter((t) => isLeaf(t.id, tasks));

    // Calculate based on hours, not task count
    const totalHours = leafTasks.reduce((sum, t) => sum + (t.estHours || 0), 0);
    const completedHours = leafTasks
      .filter((t) => t.done)
      .reduce((sum, t) => sum + (t.estHours || 0), 0);

    return {
      totalTasks: leafTasks.length,
      completedTasks: leafTasks.filter((t) => t.done).length,
      totalHours,
      completedHours,
      percentage: totalHours > 0 ? Math.round((completedHours / totalHours) * 100) : 0
    };
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Projects & Tasks</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage projects and their tasks in one place
          </p>
        </div>
        {!isAddingProject && !editingProjectId && (
          <button
            onClick={() => setIsAddingProject(true)}
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
                value={projectFormData.name}
                onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Goal *</label>
              <select
                required
                value={projectFormData.goalId}
                onChange={(e) => setProjectFormData({ ...projectFormData, goalId: e.target.value })}
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
                value={projectFormData.priority}
                onChange={(e) => setProjectFormData({ ...projectFormData, priority: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="e.g., 0, 1, 2, 3, 5, 8, 13, 21, 34..."
              />
              <p className="text-xs text-gray-500 mt-1">Relative to other projects in the same goal</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={projectFormData.dueDate || ''}
                onChange={(e) => setProjectFormData({ ...projectFormData, dueDate: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              />
            </div>
          </div>
          <div className="mt-4 flex space-x-2">
            <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              {editingProjectId ? 'Update' : 'Add'} Project
            </button>
            <button type="button" onClick={handleProjectCancel} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
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
                const stats = getProjectCompletionStats(project.id);
                const projectTasks = tasks.filter((t) => t.projectId === project.id);
                const taskTree = buildTaskTree(projectTasks);
                const isAddingTaskToThisProject = addingTaskFor?.projectId === project.id && !addingTaskFor.parentTaskId;

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
                                <span className="font-medium">Due:</span> {format(new Date(project.dueDate), 'MMM d, yyyy')}
                              </span>
                            )}
                            <span>
                              <span className="font-medium">Tasks:</span> {stats.completedTasks}/{stats.totalTasks}
                            </span>
                            {stats.totalHours > 0 && (
                              <span>
                                <span className="font-medium">Hours:</span> {stats.completedHours}/{stats.totalHours}
                              </span>
                            )}
                            {stats.totalHours > 0 && (
                              <span>
                                <span className="font-medium">Progress:</span> {stats.percentage}%
                              </span>
                            )}
                          </div>
                          {stats.totalHours > 0 && (
                            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${stats.percentage}%` }} />
                            </div>
                          )}
                        </div>
                        <div className="ml-4 flex space-x-2">
                          <button
                            onClick={() => setAddingTaskFor({ projectId: project.id })}
                            className="px-3 py-1 text-sm bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100"
                          >
                            + Add Task
                          </button>
                          <button
                            onClick={() => handleProjectEdit(project)}
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
                      {isAddingTaskToThisProject && (
                        <div className="mb-3 p-3 border border-blue-300 rounded-lg bg-blue-50">
                          <form onSubmit={handleTaskSubmit} className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Task Name *</label>
                              <input
                                type="text"
                                required
                                value={taskFormData.name}
                                onChange={(e) => setTaskFormData({ ...taskFormData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                placeholder="e.g., Complete first draft"
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Position
                                  <span className="ml-1 text-gray-500" title="Order this task will appear (1=first, 2=second, etc.)">ⓘ</span>
                                </label>
                                <input
                                  type="number"
                                  required
                                  min="1"
                                  value={taskFormData.sortOrder}
                                  onChange={(e) => setTaskFormData({ ...taskFormData, sortOrder: parseInt(e.target.value) })}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Hours</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={taskFormData.estHours || ''}
                                  onChange={(e) => setTaskFormData({ ...taskFormData, estHours: e.target.value ? parseFloat(e.target.value) : undefined })}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                  placeholder="Optional"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                                <input
                                  type="date"
                                  value={taskFormData.dueDate || ''}
                                  onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value || undefined })}
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button type="submit" className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                                Add Task
                              </button>
                              <button type="button" onClick={handleTaskCancel} className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">
                                Cancel
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      {taskTree.length > 0 ? (
                        <div className="space-y-1">
                          {taskTree.map((node) => renderTaskNode(node, project.id))}
                        </div>
                      ) : (
                        !isAddingTaskToThisProject && (
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
