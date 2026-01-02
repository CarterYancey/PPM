import { useState } from 'react';
import { useStore } from './store';
import GoalsTab from './components/GoalsTab';
import ProjectsTab from './components/ProjectsTab';
import TasksTab from './components/TasksTab';
import TodaysListTab from './components/TodaysListTab';
import SettingsTab from './components/SettingsTab';

type Tab = 'today' | 'goals' | 'projects' | 'tasks' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const { goals, projects, tasks } = useStore();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'today', label: "Today's List" },
    { id: 'goals', label: 'Goals' },
    { id: 'projects', label: 'Projects' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'settings', label: 'Settings' },
  ];

  const hasData = goals.length > 0 || projects.length > 0 || tasks.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Goal Management System
          </h1>
          <p className="text-gray-600">
            Automatic prioritization for your goals, projects, and tasks
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow">
          {!hasData && activeTab !== 'settings' && (
            <div className="p-8 text-center">
              <p className="text-gray-600 mb-4">
                No data yet. Load sample data or create your first goal.
              </p>
              <button
                onClick={() => setActiveTab('settings')}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Go to Settings
              </button>
            </div>
          )}

          {(hasData || activeTab === 'settings') && (
            <>
              {activeTab === 'today' && <TodaysListTab />}
              {activeTab === 'goals' && <GoalsTab />}
              {activeTab === 'projects' && <ProjectsTab />}
              {activeTab === 'tasks' && <TasksTab />}
              {activeTab === 'settings' && <SettingsTab />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
