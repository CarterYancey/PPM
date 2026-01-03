import { useState } from 'react';
import GoalsTab from './components/GoalsTab';
import ProjectsTab from './components/ProjectsTab';
import TodaysListTab from './components/TodaysListTab';
import SettingsTab from './components/SettingsTab';

type Tab = 'today' | 'goals' | 'projects' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('today');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'today', label: "Today's List" },
    { id: 'goals', label: 'Goals' },
    { id: 'projects', label: 'Projects' },
    { id: 'settings', label: 'Settings' },
  ];

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
          {activeTab === 'today' && <TodaysListTab />}
          {activeTab === 'goals' && <GoalsTab />}
          {activeTab === 'projects' && <ProjectsTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}

export default App;
