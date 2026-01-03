import { useStore } from '../store';
import { generateTodaysList } from '../utils/prioritization';
import { format, addDays } from 'date-fns';

export default function TodaysListTab() {
  const { goals, projects, tasks, settings, toggleTaskDone } = useStore();

  const todaysList = generateTodaysList(tasks, goals, projects, settings.dailyCadence);

  // Calculate cumulative finish dates
  // Each task finishes after the previous task plus its own hours
  let cumulativeDate = new Date();
  const todaysListWithCumulativeDates = todaysList.map((item) => {
    const hoursForThisTask = item.task.estHours || 0;
    const daysForThisTask = Math.ceil(hoursForThisTask / settings.dailyCadence);
    const finishDate = addDays(cumulativeDate, daysForThisTask);

    // Update cumulative date for next task
    cumulativeDate = finishDate;

    return {
      ...item,
      cumulativeFinishDate: finishDate,
    };
  });

  if (todaysListWithCumulativeDates.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No tasks to work on right now. All done!
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Today's Prioritized Task List
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Work from top to bottom. The most important task is always at the top.
        </p>
      </div>

      <div className="space-y-2">
        {todaysListWithCumulativeDates.map((item, index) => (
          <div
            key={item.task.id}
            className={`
              p-4 border rounded-lg hover:shadow-md transition-shadow
              ${index === 0 ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-white'}
              ${item.statusIndicator === '🔴' ? 'border-red-300' : ''}
              ${item.statusIndicator === '🟡' ? 'border-yellow-300' : ''}
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <input
                  type="checkbox"
                  checked={item.task.done}
                  onChange={() => toggleTaskDone(item.task.id)}
                  className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />

                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{item.statusIndicator}</span>
                    {index === 0 && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded">
                        DO THIS NEXT
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-medium text-gray-900 mt-1">
                    {item.task.name}
                  </h3>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                    {item.parentName && (
                      <span>
                        <span className="font-medium">Parent:</span> {item.parentName}
                      </span>
                    )}
                    <span>
                      <span className="font-medium">Project:</span> {item.projectName}
                    </span>
                    <span>
                      <span className="font-medium">Goal:</span> {item.goalName}
                    </span>
                    {item.task.estHours && (
                      <span>
                        <span className="font-medium">Est:</span> {item.task.estHours}h
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {item.task.dueDate && (
                      <span className={item.statusIndicator === '🔴' ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        <span className="font-medium">Due:</span>{' '}
                        {format(new Date(item.task.dueDate), 'MMM d, yyyy')}
                        {item.slack !== undefined && (
                          <span className="ml-1">
                            ({item.slack < 0 ? 'OVERDUE' : `${item.slack} day${item.slack !== 1 ? 's' : ''} slack`})
                          </span>
                        )}
                      </span>
                    )}
                    <span className="text-gray-600">
                      <span className="font-medium">Will finish:</span>{' '}
                      {format(item.cumulativeFinishDate, 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="ml-4 text-right">
                <div className="text-xs text-gray-500">Score</div>
                <div className="text-lg font-semibold text-gray-700">
                  {Math.round(item.urgencyScore)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Status Indicators</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
          <div>🔴 At Risk (overdue)</div>
          <div>🟡 Tight (≤2 days slack)</div>
          <div>🟢 On Track</div>
          <div>⚪ No Deadline</div>
        </div>
      </div>
    </div>
  );
}
