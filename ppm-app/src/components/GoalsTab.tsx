import { useState } from 'react';
import { nextId, useStore } from '../store';
import type { Goal } from '../types';
import { format } from 'date-fns';
import { parseCalendarDate } from '../utils/dates';

function getPriorityColor(priority: number): string {
  if (priority === 0) return 'bg-gray-100 text-gray-800';
  if (priority <= 5) return 'bg-white text-gray-800';
  if (priority <= 13) return 'bg-blue-50 text-blue-800';
  return 'bg-red-50 text-red-800';
}

export default function GoalsTab() {
  const { goals, addGoal, updateGoal, deleteGoal } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<Goal, 'id'>>({
    name: '',
    priority: 5,
    targetDate: undefined,
    notes: undefined,
  });

  const sortedGoals = [...goals].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateGoal(editingId, formData);
      setEditingId(null);
    } else {
      addGoal({ id: nextId(goals, 'G'), ...formData });
      setIsAdding(false);
    }
    setFormData({ name: '', priority: 5, targetDate: undefined, notes: undefined });
  };

  const handleEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setFormData({
      name: goal.name,
      priority: goal.priority,
      targetDate: goal.targetDate,
      notes: goal.notes,
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', priority: 5, targetDate: undefined, notes: undefined });
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Goals</h2>
          <p className="text-sm text-gray-600 mt-1">
What you are working toward, and how much each one is worth
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            + Add Goal
          </button>
        )}
      </div>

      {(isAdding || editingId) && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Goal Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Read 12 classic novels in 2025"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 0, 1, 2, 3, 5, 8, 13, 21, 34..."
              />
              <p className="text-xs text-gray-500 mt-1">
Fibonacci scale. 0 pauses the goal and everything under it.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Date
              </label>
              <input
                type="date"
                value={formData.targetDate || ''}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optional context or motivation"
              />
            </div>
          </div>

          <div className="mt-4 flex space-x-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {editingId ? 'Update' : 'Add'} Goal
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

      <div className="space-y-2">
        {sortedGoals.map((goal) => (
          <div
            key={goal.id}
            className={`p-4 border rounded-lg ${getPriorityColor(goal.priority)}`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-mono text-gray-500">{goal.id}</span>
                  <h3 className="text-lg font-medium">{goal.name}</h3>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-200">
                    Priority: {goal.priority}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {goal.targetDate && (
                    <span>
                      <span className="font-medium">Target:</span>{' '}
                      {format(parseCalendarDate(goal.targetDate), 'MMM d, yyyy')}
                    </span>
                  )}
                  {goal.notes && (
                    <span>
                      <span className="font-medium">Notes:</span> {goal.notes}
                    </span>
                  )}
                </div>
              </div>

              <div className="ml-4 flex space-x-2">
                <button
                  onClick={() => handleEdit(goal)}
                  className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete goal "${goal.name}"? This will also delete all related projects and tasks.`)) {
                      deleteGoal(goal.id);
                    }
                  }}
                  className="px-3 py-1 text-sm bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sortedGoals.length === 0 && !isAdding && (
        <div className="text-center py-12 text-gray-500">
          No goals yet. Click "Add Goal" to create your first goal.
        </div>
      )}
    </div>
  );
}
