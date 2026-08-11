import { useState } from 'react';
import type { Task } from '../types';

export type TaskFormValues = Pick<Task, 'name' | 'sortOrder' | 'estHours' | 'dueDate'>;

interface Props {
  title: string;
  submitLabel: string;
  initial: TaskFormValues;
  onSubmit: (values: TaskFormValues) => void;
  onCancel: () => void;
  indentLevel?: number;
}

/**
 * Add/edit form for a task. This markup used to be pasted three times in
 * ProjectsTab (new task, new subtask, edit), which is how the three copies had
 * drifted apart.
 */
export default function TaskForm({
  title,
  submitLabel,
  initial,
  onSubmit,
  onCancel,
  indentLevel = 0,
}: Props) {
  const [values, setValues] = useState<TaskFormValues>(initial);

  return (
    <div
      className="mb-2 p-3 border border-blue-300 rounded-lg bg-blue-50"
      style={{ marginLeft: `${indentLevel * 24}px` }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ ...values, name: values.name.trim() });
        }}
        className="space-y-3"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{title} *</label>
          <input
            type="text"
            required
            autoFocus
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            placeholder="e.g., Complete first draft"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Position
              <span className="ml-1 text-gray-500" title="Order within its parent (1 = first)">
                ⓘ
              </span>
            </label>
            <input
              type="number"
              required
              min="1"
              value={values.sortOrder}
              onChange={(e) =>
                setValues({ ...values, sortOrder: Math.max(1, Number(e.target.value) || 1) })
              }
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Hours</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={values.estHours ?? ''}
              onChange={(e) =>
                setValues({
                  ...values,
                  estHours: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
            <input
              type="date"
              value={values.dueDate ?? ''}
              onChange={(e) => setValues({ ...values, dueDate: e.target.value || undefined })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            type="submit"
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {submitLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
