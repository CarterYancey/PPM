import { useRef, useState } from 'react';
import { useStore } from '../store';
import type { PriorityModel, SequenceMode } from '../types';
import { useSchedule } from '../hooks/useSchedule';

export default function SettingsTab() {
  const settings = useStore((s) => s.settings);
  const goals = useStore((s) => s.goals);
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const updateSettings = useStore((s) => s.updateSettings);
  const loadSampleData = useStore((s) => s.loadSampleData);
  const clearAllData = useStore((s) => s.clearAllData);
  const exportData = useStore((s) => s.exportData);
  const importData = useStore((s) => s.importData);
  const schedule = useSchedule();

  const [cadenceInput, setCadenceInput] = useState(String(settings.dailyCadence));
  const [importMessage, setImportMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cadenceValue = Number(cadenceInput);
  const cadenceValid = Number.isFinite(cadenceValue) && cadenceValue >= 0.25 && cadenceValue <= 24;

  const handleExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ppm-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        importData(String(e.target?.result ?? ''));
        setImportMessage({ ok: true, text: 'Data imported successfully.' });
      } catch (error) {
        setImportMessage({
          ok: false,
          text: error instanceof Error ? error.message : 'Failed to import data.',
        });
      }
    };
    reader.onerror = () => setImportMessage({ ok: false, text: "Couldn't read that file." });
    reader.readAsText(file);

    // Allow re-importing the same file.
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Settings</h2>

      {/* Scheduling */}
      <div className="bg-white border rounded-lg p-6 space-y-6">
        <h3 className="text-lg font-medium text-gray-900">Scheduling</h3>

        <div className="max-w-md">
          <label htmlFor="cadence" className="block text-sm font-medium text-gray-700 mb-2">
            Daily cadence (hours per day)
          </label>
          <p className="text-sm text-gray-600 mb-3">
            How many hours a day you actually spend on this work. Every projected date and every
            deadline warning comes from this number, so an honest value beats an aspirational one.
          </p>
          <div className="flex items-center space-x-4">
            <input
              id="cadence"
              type="number"
              min="0.25"
              max="24"
              step="0.25"
              value={cadenceInput}
              onChange={(e) => setCadenceInput(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 w-24"
            />
            <button
              onClick={() => updateSettings({ dailyCadence: cadenceValue })}
              disabled={!cadenceValid}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Save
            </button>
          </div>
          {!cadenceValid && (
            <p className="mt-2 text-sm text-red-600">Enter a number between 0.25 and 24.</p>
          )}
        </div>

        <div className="max-w-xl">
          <label htmlFor="priority-model" className="block text-sm font-medium text-gray-700 mb-2">
            Priority model
          </label>
          <select
            id="priority-model"
            value={settings.priorityModel}
            onChange={(e) => updateSettings({ priorityModel: e.target.value as PriorityModel })}
            className="px-3 py-2 border border-gray-300 rounded w-full"
          >
            <option value="multiplicative">Multiplicative — goal x project</option>
            <option value="additive">Additive — (goal + project) x 10 (v1 behaviour)</option>
          </select>
          <p className="mt-2 text-sm text-gray-600">
            Project priority is meant to be a weight <em>within</em> its goal, which is what
            multiplying expresses: pausing a goal (priority 0) pauses everything under it. Adding
            the two lets a high-priority project under a trivial goal outrank real work.
          </p>
        </div>

        <div className="max-w-xl">
          <label htmlFor="sequence-mode" className="block text-sm font-medium text-gray-700 mb-2">
            Task order
          </label>
          <select
            id="sequence-mode"
            value={settings.sequenceMode}
            onChange={(e) => updateSettings({ sequenceMode: e.target.value as SequenceMode })}
            className="px-3 py-2 border border-gray-300 rounded w-full"
          >
            <option value="soft">Soft — position is a preference; deadlines may reorder work</option>
            <option value="strict">Strict — a task never runs before the one above it</option>
          </select>
          <p className="mt-2 text-sm text-gray-600">
            Strict treats position as a real prerequisite. It is honest about dependencies but can
            report deadlines as unreachable when the ordering itself is the obstacle.
          </p>
        </div>
      </div>

      {/* Data Statistics */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Data</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ['Goals', goals.length, 'text-blue-600 bg-blue-50'],
            ['Projects', projects.length, 'text-green-600 bg-green-50'],
            ['Tasks', tasks.length, 'text-purple-600 bg-purple-50'],
            ['Completed', tasks.filter((t) => t.done).length, 'text-orange-600 bg-orange-50'],
          ].map(([label, value, classes]) => {
            const [text, bg] = String(classes).split(' ');
            return (
              <div key={String(label)} className={`${bg} p-4 rounded`}>
                <div className={`text-2xl font-bold ${text}`}>{value}</div>
                <div className="text-sm text-gray-600">{label}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-gray-600">
          {schedule.queue.length} task{schedule.queue.length === 1 ? '' : 's'} queued,{' '}
          {schedule.totalHours}h of work
          {schedule.overcommitted
            ? ` — ${schedule.lateTaskIds.length} cannot meet their deadline at this cadence.`
            : ' — every deadline is reachable.'}
        </p>
      </div>

      {/* Sample Data */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Sample Data</h3>
        <p className="text-sm text-gray-600 mb-4">
          Load an example set of goals, projects and tasks, dated relative to today. This replaces
          all existing data.
        </p>
        <button
          onClick={() => {
            if (confirm('This will replace all existing data with sample data. Continue?')) {
              loadSampleData();
            }
          }}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Load Sample Data
        </button>
      </div>

      {/* Export/Import */}
      <div className="bg-white border rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Backup &amp; Restore</h3>
        <p className="text-sm text-gray-600">
          Everything lives in this browser's local storage. Clearing site data deletes it, so export
          regularly.
        </p>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Export to JSON
        </button>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Import Data</h4>
          <p className="text-sm text-gray-600 mb-3">
            Restore from an exported file. This replaces all current data.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            aria-label="Import backup file"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {importMessage && (
            <p className={`mt-2 text-sm ${importMessage.ok ? 'text-green-600' : 'text-red-600'}`}>
              {importMessage.text}
            </p>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-red-900 mb-4">Danger Zone</h3>
        <p className="text-sm text-red-700 mb-4">
          Permanently delete all data. Export first — this cannot be undone.
        </p>
        <button
          onClick={() => {
            if (
              confirm('This permanently deletes ALL goals, projects and tasks. Are you sure?') &&
              confirm('Really sure? This cannot be undone.')
            ) {
              clearAllData();
            }
          }}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Clear All Data
        </button>
      </div>
    </div>
  );
}
