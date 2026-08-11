import { format } from 'date-fns';
import { useStore } from '../store';
import { useSchedule } from '../hooks/useSchedule';
import { STATUS_EMOJI, STATUS_LABEL } from '../utils/schedule';
import { parseCalendarDate } from '../utils/dates';

export default function TodaysListTab() {
  const toggleTaskDone = useStore((s) => s.toggleTaskDone);
  const goals = useStore((s) => s.goals);
  const projects = useStore((s) => s.projects);
  const cadence = useStore((s) => s.settings.dailyCadence);
  const schedule = useSchedule();

  const goalsById = new Map(goals.map((g) => [g.id, g]));
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  if (schedule.queue.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        Nothing left in the queue. Add work on the Projects tab, or enjoy the gap.
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Today's Prioritized Task List</h2>
        <p className="text-sm text-gray-600 mt-1">
          Work from top to bottom. The order already accounts for every deadline you've set.
        </p>
      </div>

      {schedule.overcommitted && (
        <div className="mb-4 p-4 border border-red-300 bg-red-50 rounded-lg text-sm text-red-800">
          <p className="font-semibold">You are over-committed.</p>
          <p className="mt-1">
            {schedule.lateTaskIds.length} task{schedule.lateTaskIds.length === 1 ? '' : 's'} cannot
            meet {schedule.lateTaskIds.length === 1 ? 'its' : 'their'} deadline in{' '}
            <em>any</em> order at {cadence}h/day. Cut scope, move
            a deadline, or raise your cadence — reshuffling the list will not help.
          </p>
        </div>
      )}

      {schedule.orphanTaskIds.length > 0 && (
        <div className="mb-4 p-3 border border-yellow-300 bg-yellow-50 rounded text-sm text-yellow-800">
          {schedule.orphanTaskIds.length} task(s) reference a missing project or goal and were
          skipped.
        </div>
      )}

      <div className="space-y-2">
        {schedule.queue.map((entry, index) => {
          const task = schedule.index.byId.get(entry.taskId)!;
          const parent = task.parentTaskId ? schedule.index.byId.get(task.parentTaskId) : undefined;
          const project = projectsById.get(task.projectId);
          const goal = project ? goalsById.get(project.goalId) : undefined;

          return (
            <div
              key={entry.taskId}
              className={`p-4 border rounded-lg hover:shadow-md transition-shadow
                ${index === 0 ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-white'}
                ${entry.status === 'late' ? 'border-red-300' : ''}
                ${entry.status === 'tight' ? 'border-yellow-300' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTaskDone(task.id)}
                    aria-label={`Mark "${task.name}" done`}
                    className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />

                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg" title={STATUS_LABEL[entry.status]}>
                        {STATUS_EMOJI[entry.status]}
                      </span>
                      {index === 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-600 text-white rounded">
                          DO THIS NEXT
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-medium text-gray-900 mt-1">{task.name}</h3>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                      {parent && (
                        <span>
                          <span className="font-medium">Parent:</span> {parent.name}
                        </span>
                      )}
                      <span>
                        <span className="font-medium">Project:</span> {project?.name ?? '—'}
                      </span>
                      <span>
                        <span className="font-medium">Goal:</span> {goal?.name ?? '—'}
                      </span>
                      {entry.hours > 0 && (
                        <span>
                          <span className="font-medium">Est:</span> {entry.hours}h
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {entry.effectiveDueDate && (
                        <span className={entry.status === 'late' ? 'text-red-600 font-medium' : 'text-gray-600'}>
                          <span className="font-medium">Due:</span>{' '}
                          {format(parseCalendarDate(entry.effectiveDueDate), 'MMM d, yyyy')}
                          {entry.slackDays !== undefined && (
                            <span className="ml-1">
                              ({entry.slackDays < 0
                                ? `${Math.abs(entry.slackDays)} day${Math.abs(entry.slackDays) === 1 ? '' : 's'} short`
                                : `${entry.slackDays} day${entry.slackDays === 1 ? '' : 's'} slack`})
                            </span>
                          )}
                        </span>
                      )}
                      <span className="text-gray-600">
                        <span className="font-medium">Planned:</span>{' '}
                        {format(entry.startDate, 'MMM d')} – {format(entry.finishDate, 'MMM d')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="ml-4 text-right">
                  <div className="text-xs text-gray-500">Value</div>
                  <div className="text-lg font-semibold text-gray-700">{entry.value}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Status Indicators</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
          <div>🔴 At risk — deadline unreachable</div>
          <div>🟡 Tight — little slack left</div>
          <div>🟢 On track</div>
          <div>⚪ No deadline</div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Total queued work: {schedule.totalHours}h, finishing around{' '}
          {format(
            schedule.queue[schedule.queue.length - 1].finishDate,
            'MMM d, yyyy'
          )}
          .
        </p>
      </div>
    </div>
  );
}
