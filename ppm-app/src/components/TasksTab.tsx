import { useState } from 'react';
import { useStore } from '../store';
import type { Task } from '../types';
import { buildTaskTree, type TaskNode, isLeaf } from '../utils/taskTree';
import { format } from 'date-fns';

export default function TasksTab() {
  const { projects, tasks, addTask, updateTask, deleteTask, toggleTaskDone } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const [formData, setFormData] = useState<Omit<Task, 'id'>>({
    name: '',
    projectId: '',
    parentTaskId: undefined,
    sortOrder: 1,
    estHours: undefined,
    dueDate: undefined,
    done: false,
  });

  const generateNextId = () => {
    const maxId = tasks.reduce((max, t) => {
      const num = parseInt(t.id.substring(1));
      return num > max ? num : max;
    }, 0);
    return `T${maxId + 1}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateTask(editingId, formData);
      setEditingId(null);
    } else {
      addTask({ id: generateNextId(), ...formData });
      setIsAdding(false);
    }
    setFormData({
      name: '',
      projectId: '',
      parentTaskId: undefined,
      sortOrder: 1,
      estHours: undefined,
      dueDate: undefined,
      done: false,
    });
  };

  const handleEdit = (task: Task) => {
    setEditingId(task.id);
    setFormData({
      name: task.name,
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      sortOrder: task.sortOrder,
      estHours: task.estHours,
      dueDate: task.dueDate,
      done: task.done,
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: '',
      projectId: '',
      parentTaskId: undefined,
      sortOrder: 1,
      estHours: undefined,
      dueDate: undefined,
      done: false,
    });
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

  const renderTaskNode = (node: TaskNode) => {
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsedNodes.has(node.id);
    const taskIsLeaf = isLeaf(node.id, tasks);

    return (
      <div key={node.id}>
        <div
          className="flex items-start p-3 border rounded-lg bg-white hover:bg-gray-50"
          style={{ marginLeft: `${node.level * 24}px` }}
        >
          {hasChildren && (
            <button
              onClick={() => toggleCollapse(node.id)}
              className="mr-2 text-gray-500 hover:text-gray-700"
            >
              {isCollapsed ? '▶' : '▼'}
            </button>
          )}

          {!hasChildren && <div className="w-6 mr-2" />}

          {taskIsLeaf && (
            <input
              type="checkbox"
              checked={node.done}
              onChange={() => toggleTaskDone(node.id)}
              className="mt-1 mr-3 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-gray-500">{node.id}</span>
              <h4 className={`font-medium ${node.done ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                {node.name}
              </h4>
              {!taskIsLeaf && (
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                  Parent
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
              <span>Sort: {node.sortOrder}</span>
              {node.estHours && <span>Est: {node.estHours}h</span>}
              {node.dueDate && (
                <span>Due: {format(new Date(node.dueDate), 'MMM d, yyyy')}</span>
              )}
            </div>
          </div>

          <div className="ml-4 flex space-x-1">
            <button
              onClick={() => handleEdit(node)}
              className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete task "${node.name}"?${hasChildren ? ' This will also delete all subtasks.' : ''}`)) {
                  deleteTask(node.id);
                }
              }}
              className="px-2 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100"
            >
              Delete
            </button>
          </div>
        </div>

        {hasChildren && !isCollapsed && (
          <div className="mt-1 space-y-1">
            {node.children.map(renderTaskNode)}
          </div>
        )}
      </div>
    );
  };

  const filteredTasks = selectedProjectId
    ? tasks.filter((t) => t.projectId === selectedProjectId)
    : tasks;

  const taskTree = buildTaskTree(filteredTasks);

  // Get potential parent tasks for the form
  const potentialParents = formData.projectId
    ? tasks.filter((t) => t.projectId === formData.projectId && t.id !== editingId)
    : [];

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tasks</h2>
          <p className="text-sm text-gray-600 mt-1">
            Hierarchical task tree with dependencies
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={projects.length === 0}
          >
            + Add Task
          </button>
        )}
      </div>

      {projects.length === 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
          Create a project first before adding tasks.
        </div>
      )}

      {/* Project Filter */}
      {projects.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Project:
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.id} - {project.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {(isAdding || editingId) && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Learn EC2 fundamentals"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project *
              </label>
              <select
                required
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value, parentTaskId: undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.id} - {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent Task
              </label>
              <select
                value={formData.parentTaskId || ''}
                onChange={(e) => setFormData({ ...formData, parentTaskId: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                disabled={!formData.projectId}
              >
                <option value="">None (root task)</option>
                {potentialParents.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.id} - {task.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort Order *
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Hours
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={formData.estHours || ''}
                onChange={(e) => setFormData({ ...formData, estHours: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="Only for leaf tasks"
              />
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
              {editingId ? 'Update' : 'Add'} Task
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

      <div className="space-y-1">
        {taskTree.map(renderTaskNode)}
      </div>

      {tasks.length === 0 && !isAdding && projects.length > 0 && (
        <div className="text-center py-12 text-gray-500">
          No tasks yet. Click "Add Task" to create your first task.
        </div>
      )}
    </div>
  );
}
