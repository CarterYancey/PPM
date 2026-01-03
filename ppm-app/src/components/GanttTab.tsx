import { useMemo } from 'react';
import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { useStore } from '../store';
import { isLeaf } from '../utils/taskTree';
import { generateTodaysList } from '../utils/prioritization';

const TIMELINE_DAYS = 30;

type ScheduledTask = {
  id: string;
  name: string;
  start: Date;
  end: Date;
  done: boolean;
  estHours?: number;
  priorityRank: number;
};

type ProjectSchedule = {
  id: string;
  name: string;
  tasks: ScheduledTask[];
  completedTasks: number;
  totalTasks: number;
};

export default function GanttTab() {
  const { goals, projects, tasks, settings } = useStore();
  const timelineStart = startOfDay(new Date());
  const timelineEnd = addDays(timelineStart, TIMELINE_DAYS);

  const timelineDates = useMemo(
    () => Array.from({ length: TIMELINE_DAYS }, (_, index) => addDays(timelineStart, index)),
    [timelineStart]
  );

  const projectSchedules = useMemo<ProjectSchedule[]>(() => {
    const todaysList = generateTodaysList(tasks, goals, projects, settings.dailyCadence);
    const scheduleMap = new Map<string, ScheduledTask[]>();
    let cursor = timelineStart;

    todaysList.forEach((item, index) => {
      const hoursForTask = item.task.estHours || 0;
      const durationDays = Math.ceil(hoursForTask / settings.dailyCadence);
      const start = cursor;
      const end = addDays(start, durationDays);
      cursor = end;

      const scheduledTask: ScheduledTask = {
        id: item.task.id,
        name: item.task.name,
        start,
        end,
        done: item.task.done,
        estHours: item.task.estHours,
        priorityRank: index,
      };

      const bucket = scheduleMap.get(item.task.projectId) ?? [];
      bucket.push(scheduledTask);
      scheduleMap.set(item.task.projectId, bucket);
    });

    return projects.map((project) => {
      const projectTasks = tasks
        .filter((task) => task.projectId === project.id)
        .filter((task) => isLeaf(task.id, tasks));

      return {
        id: project.id,
        name: project.name,
        tasks: (scheduleMap.get(project.id) ?? []).toSorted(
          (a, b) => a.priorityRank - b.priorityRank
        ),
        completedTasks: projectTasks.filter((task) => task.done).length,
        totalTasks: projectTasks.length,
      };
    });
  }, [goals, projects, tasks, settings.dailyCadence, timelineStart]);

  const renderBar = (task: ScheduledTask) => {
    if (task.end <= timelineStart || task.start >= timelineEnd) {
      return null;
    }

    const clampedStart = task.start < timelineStart ? timelineStart : task.start;
    const clampedEnd = task.end > timelineEnd ? timelineEnd : task.end;
    const offsetDays = differenceInCalendarDays(clampedStart, timelineStart);
    const spanDays = Math.max(1, differenceInCalendarDays(clampedEnd, clampedStart));
    const leftPercent = (offsetDays / TIMELINE_DAYS) * 100;
    const widthPercent = (spanDays / TIMELINE_DAYS) * 100;

    return (
      <div
        key={task.id}
        className={`absolute top-2 h-6 rounded-md px-2 text-xs font-medium text-white shadow-sm ${
          task.done ? 'bg-emerald-500' : 'bg-blue-500'
        }`}
        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
        title={`${task.name} (${format(task.start, 'MMM d')} - ${format(addDays(task.end, -1), 'MMM d')})`}
      >
        <div className="truncate">
          {task.name}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Gantt Schedule</h2>
        <p className="text-sm text-gray-600 mt-1">
          Timeline view of work across all projects for the next {TIMELINE_DAYS} days.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">
              {format(timelineStart, 'MMM d')} - {format(addDays(timelineEnd, -1), 'MMM d, yyyy')}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                In progress
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Completed
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-[160px_1fr] items-center gap-4 text-[11px] text-gray-500">
            <div className="uppercase tracking-wide">Projects</div>
            <div className="grid grid-cols-6 gap-2">
              {timelineDates.filter((_, index) => index % 5 === 0).map((date) => (
                <div key={date.toISOString()} className="text-right">
                  {format(date, 'MMM d')}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {projectSchedules.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-500">
              No projects yet. Add projects and tasks to see them on the Gantt chart.
            </div>
          )}

          {projectSchedules.map((project) => (
            <div key={project.id} className="px-4 py-4">
              <div className="grid grid-cols-[160px_1fr] gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{project.name}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {project.completedTasks}/{project.totalTasks} tasks complete
                  </div>
                </div>
                <div className="relative h-10 rounded-lg bg-gray-50">
                  <div className="absolute inset-0 grid grid-cols-10 gap-0">
                    {Array.from({ length: 10 }).map((_, index) => (
                      <div
                        key={index}
                        className={
                          index === 9
                            ? 'border-none'
                            : 'border-r border-dashed border-gray-200'
                        }
                      />
                    ))}
                  </div>
                  {project.tasks.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                      Add tasks to populate the timeline
                    </div>
                  )}
                  {project.tasks.map((task) => renderBar(task))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
