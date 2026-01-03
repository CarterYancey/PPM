import { useState, useRef } from 'react';
import { useStore } from '../store';

export default function SettingsTab() {
  const {
    settings,
    updateSettings,
    loadSampleData,
    clearAllData,
    exportData,
    importData,
    goals,
    projects,
    tasks,
  } = useStore();

  const defaultWorkDays = settings.workDays?.length ? settings.workDays : [0, 1, 2, 3, 4, 5, 6];
  const [dailyCadence, setDailyCadence] = useState(settings.dailyCadence);
  const [workDays, setWorkDays] = useState(defaultWorkDays);
  const [vacationDates, setVacationDates] = useState(settings.vacationDates ?? []);
  const [newVacationDate, setNewVacationDate] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveSettings = () => {
    updateSettings({
      dailyCadence,
      workDays,
      vacationDates,
    });
  };

  const dayOptions = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
  ];

  const toggleWorkDay = (dayValue: number) => {
    setWorkDays((prev) => (
      prev.includes(dayValue)
        ? prev.filter((day) => day !== dayValue)
        : [...prev, dayValue].sort((a, b) => a - b)
    ));
  };

  const handleAddVacationDate = () => {
    if (!newVacationDate || vacationDates.includes(newVacationDate)) {
      return;
    }

    setVacationDates((prev) => [...prev, newVacationDate].sort());
    setNewVacationDate('');
  };

  const handleRemoveVacationDate = (date: string) => {
    setVacationDates((prev) => prev.filter((entry) => entry !== date));
  };

  const handleLoadSampleData = () => {
    if (confirm('This will replace all existing data with sample data. Continue?')) {
      loadSampleData();
    }
  };

  const handleClearData = () => {
    if (confirm('This will permanently delete ALL data (goals, projects, tasks). This cannot be undone. Are you sure?')) {
      if (confirm('Are you REALLY sure? This action is irreversible.')) {
        clearAllData();
      }
    }
  };

  const handleExport = () => {
    const jsonData = exportData();
    const blob = new Blob([jsonData], { type: 'application/json' });
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
        const jsonData = e.target?.result as string;
        importData(jsonData);
        setImportSuccess(true);
        setImportError(null);
        setTimeout(() => setImportSuccess(false), 3000);
      } catch (error) {
        setImportError('Failed to import data. Please check the file format.');
        setImportSuccess(false);
      }
    };
    reader.readAsText(file);

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const dataStats = {
    goals: goals.length,
    projects: projects.length,
    tasks: tasks.length,
    completedTasks: tasks.filter((t) => t.done).length,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Settings</h2>
      </div>

      {/* Daily Cadence */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Work Cadence</h3>
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Daily Cadence (hours per day)
          </label>
          <p className="text-sm text-gray-600 mb-3">
            How many hours per day do you typically work on tasks? Used to calculate expected completion dates.
          </p>
          <div className="flex items-center space-x-4">
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={dailyCadence}
              onChange={(e) => setDailyCadence(parseFloat(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 w-24"
            />
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Work Schedule */}
      <div className="bg-white border rounded-lg p-6 space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Work Schedule</h3>
          <p className="text-sm text-gray-600">
            Choose which days you typically work. Vacation days are excluded from scheduling.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Work Days</h4>
          <div className="flex flex-wrap gap-4">
            {dayOptions.map((day) => (
              <label key={day.value} className="flex items-center space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={workDays.includes(day.value)}
                  onChange={() => toggleWorkDay(day.value)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span>{day.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Vacation Days</h4>
          <div className="flex flex-col gap-4 max-w-md">
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={newVacationDate}
                onChange={(e) => setNewVacationDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAddVacationDate}
                className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Add
              </button>
            </div>
            {vacationDates.length > 0 ? (
              <ul className="space-y-2">
                {vacationDates.map((date) => (
                  <li key={date} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm">
                    <span className="text-gray-700">{date}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveVacationDate(date)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No vacation days added yet.</p>
            )}
          </div>
        </div>

        <div>
          <button
            onClick={handleSaveSettings}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save Settings
          </button>
        </div>
      </div>

      {/* Data Statistics */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Data Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded">
            <div className="text-2xl font-bold text-blue-600">{dataStats.goals}</div>
            <div className="text-sm text-gray-600">Goals</div>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <div className="text-2xl font-bold text-green-600">{dataStats.projects}</div>
            <div className="text-sm text-gray-600">Projects</div>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <div className="text-2xl font-bold text-purple-600">{dataStats.tasks}</div>
            <div className="text-sm text-gray-600">Total Tasks</div>
          </div>
          <div className="bg-orange-50 p-4 rounded">
            <div className="text-2xl font-bold text-orange-600">{dataStats.completedTasks}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
        </div>
      </div>

      {/* Sample Data */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Sample Data</h3>
        <p className="text-sm text-gray-600 mb-4">
          Load sample data from the specification to see how the system works. This will replace all existing data.
        </p>
        <button
          onClick={handleLoadSampleData}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Load Sample Data
        </button>
      </div>

      {/* Export/Import */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Backup & Restore</h3>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Export Data</h4>
            <p className="text-sm text-gray-600 mb-3">
              Download all your data as a JSON file. Use this to backup your data.
            </p>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Export to JSON
            </button>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Import Data</h4>
            <p className="text-sm text-gray-600 mb-3">
              Restore data from a previously exported JSON file. This will replace all current data.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {importSuccess && (
              <p className="mt-2 text-sm text-green-600">Data imported successfully!</p>
            )}
            {importError && (
              <p className="mt-2 text-sm text-red-600">{importError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-red-900 mb-4">Danger Zone</h3>
        <p className="text-sm text-red-700 mb-4">
          Permanently delete all data. This action cannot be undone. Make sure to export your data first!
        </p>
        <button
          onClick={handleClearData}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Clear All Data
        </button>
      </div>

      {/* About */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">About</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            <strong>Goal Management System</strong> - A minimalist task management system with automatic prioritization.
          </p>
          <p>
            The system automatically prioritizes tasks based on goal/project priorities and deadlines,
            ensuring you always know what to work on next.
          </p>
          <p className="pt-2">
            <strong>Priority System:</strong>
          </p>
          <ul className="list-disc list-inside pl-4 space-y-1">
            <li>0 = Paused/Someday</li>
            <li>1-5 = Low priority</li>
            <li>8-13 = Medium priority</li>
            <li>21-34 = High priority</li>
          </ul>
          <p className="pt-2">
            <strong>Status Indicators:</strong>
          </p>
          <ul className="list-disc list-inside pl-4 space-y-1">
            <li>🔴 At Risk (should have started already)</li>
            <li>🟡 Tight (2 days or less slack)</li>
            <li>🟢 On Track</li>
            <li>⚪ No Deadline</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
