import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useStore } from '../store';
import { getChildren, getLeaves, isLeaf } from '../utils/taskTree';
import { completionPercentage, STATUS_EMOJI, type ScheduleStatus } from '../utils/schedule';
import { calendarDaysBetween, dateForDayOffset, parseCalendarDate } from '../utils/dates';
import { useSchedule } from '../hooks/useSchedule';

type ViewMode = '2weeks' | '1month' | '3months';
const DAYS_SHOWN: Record<ViewMode, number> = { '2weeks': 14, '1month': 30, '3months': 90 };

interface GanttItem {
  key: string;
  name: string;
  type: 'goal' | 'project' | 'task';
  level: number;
  /** Day offsets from today. */
  startDay: number;
  finishDay: number;
  dueDay?: number;
  completionPercentage: number;
  status: ScheduleStatus;
  hoursRemaining: number;
  collapsibleId?: string;
}

export default function GanttChartTab() {
  const goals = useStore((s) => s.goals);
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const schedule = useSchedule();

  const [collapsedGoals, setCollapsedGoals] = useState<Set<string>>(new Set());
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('1month');

  const daysShown = DAYS_SHOWN[viewMode];
  const { index, today } = schedule;

  const ganttItems = useMemo(() => {
    const items: GanttItem[] = [];
    const dueDayOf = (iso?: string) =>
      iso ? calendarDaysBetween(today, parseCalendarDate(iso)) : undefined;

    const sortedGoals = [...goals].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

    for (const goal of sortedGoals) {
      const goalProjects = projects
        .filter((p) => p.goalId === goal.id)
        .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
      if (goalProjects.length === 0) continue;

      const projectIds = new Set(goalProjects.map((p) => p.id));
      const goalLeaves = tasks.filter((t) => projectIds.has(t.projectId) && isLeaf(index, t.id));
      const goalActive = goalLeaves
        .filter((t) => !t.done)
        .map((t) => schedule.byTaskId.get(t.id))
        .filter((e) => e !== undefined);

      items.push({
        key: goal.id,
        name: goal.name,
        type: 'goal',
        level: 0,
        startDay: goalActive.length ? Math.min(...goalActive.map((e) => e.startDay)) : 0,
        finishDay: goalActive.length ? Math.max(...goalActive.map((e) => e.finishDay)) : 0,
        dueDay: dueDayOf(goal.targetDate),
        completionPercentage: completionPercentage(goalLeaves),
        status: 'nodeadline',
        hoursRemaining: goalActive.reduce((sum, e) => sum + e.hours, 0),
        collapsibleId: goal.id,
      });

      if (collapsedGoals.has(goal.id)) continue;

      for (const project of goalProjects) {
        const projectTasks = tasks.filter((t) => t.projectId === project.id);
        const projectLeaves = projectTasks.filter((t) => isLeaf(index, t.id));
        const projectActive = projectLeaves
          .filter((t) => !t.done)
          .map((t) => schedule.byTaskId.get(t.id))
          .filter((e) => e !== undefined);

        items.push({
          key: project.id,
          name: project.name,
          type: 'project',
          level: 1,
          startDay: projectActive.length ? Math.min(...projectActive.map((e) => e.startDay)) : 0,
          finishDay: projectActive.length ? Math.max(...projectActive.map((e) => e.finishDay)) : 0,
          dueDay: dueDayOf(project.dueDate),
          completionPercentage: completionPercentage(projectLeaves),
          status: 'nodeadline',
          hoursRemaining: projectActive.reduce((sum, e) => sum + e.hours, 0),
          collapsibleId: project.id,
        });

        if (collapsedProjects.has(project.id)) continue;

        const walk = (taskId: string, level: number) => {
          const task = index.byId.get(taskId);
          const entry = schedule.byTaskId.get(taskId);
          if (!task || !entry || entry.status === 'done') return;

          items.push({
            key: task.id,
            name: task.name,
            type: 'task',
            level: level + 2,
            startDay: entry.startDay,
            finishDay: entry.finishDay,
            dueDay: entry.dueDay,
            completionPercentage: entry.isLeaf ? 0 : completionPercentage(getLeaves(index, task.id)),
            status: entry.status,
            hoursRemaining: entry.hours,
          });

          for (const child of getChildren(index, task.id)) walk(child.id, level + 1);
        };

        for (const root of projectTasks.filter((t) => !index.parentOf.get(t.id))) {
          walk(root.id, 0);
        }
      }
    }

    return items;
  }, [goals, projects, tasks, schedule, index, today, collapsedGoals, collapsedProjects]);

  /** Position a day-offset span within the visible window, or null if it falls outside. */
  const spanStyle = (startDay: number, finishDay: number) => {
    if (finishDay < 0 || startDay > daysShown) return null;
    const clampedStart = Math.max(startDay, 0);
    const clampedEnd = Math.min(finishDay + 1, daysShown); // bars cover whole days
    const left = (clampedStart / daysShown) * 100;
    const width = Math.max(((clampedEnd - clampedStart) / daysShown) * 100, 0.75);
    return { left: `${left}%`, width: `${width}%` };
  };

  const markerStyle = (day: number) =>
    day < 0 || day > daysShown ? null : { left: `${(day / daysShown) * 100}%` };

  const timelineHeaders = useMemo(() => {
    const step = viewMode === '3months' ? 7 : viewMode === '1month' ? 3 : 1;
    const headers: { day: number; label: string }[] = [];
    for (let day = 0; day < daysShown; day += step) {
      headers.push({ day, label: format(dateForDayOffset(day, today), 'MMM d') });
    }
    return headers;
  }, [viewMode, daysShown, today]);

  const barColor = (item: GanttItem) => {
    if (item.type === 'goal') return 'bg-indigo-500';
    if (item.type === 'project') return 'bg-blue-500';
    switch (item.status) {
      case 'late':
        return 'bg-red-500';
      case 'tight':
        return 'bg-yellow-500';
      case 'ontrack':
        return 'bg-green-500';
      default:
        return 'bg-gray-400';
    }
  };

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  if (goals.length === 0) {
    return (
      <div className="p-6 text-center py-12 text-gray-500">
        <p className="text-lg mb-2">No goals yet</p>
        <p className="text-sm">Create goals and projects to see your Gantt chart</p>
      </div>
    );
  }

  const minColumnWidth = viewMode === '3months' ? '60px' : '40px';

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Gantt Chart</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            {[
              ['bg-indigo-500', 'Goal'],
              ['bg-blue-500', 'Project'],
              ['bg-green-500', 'On Track'],
              ['bg-yellow-500', 'Tight'],
              ['bg-red-500', 'At Risk'],
            ].map(([cls, label]) => (
              <div key={label} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${cls}`} />
                <span>{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <div className="w-1 h-4 bg-orange-500" />
              <span>Due Date</span>
            </div>
          </div>

          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as ViewMode)}
            aria-label="Timeline range"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="2weeks">2 Weeks</option>
            <option value="1month">1 Month</option>
            <option value="3months">3 Months</option>
          </select>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="flex border-b border-gray-200 bg-gray-50">
          <div className="w-72 flex-shrink-0 px-4 py-3 font-semibold text-gray-700 border-r border-gray-200">
            Task / Project / Goal
          </div>
          <div className="flex-1 flex">
            {timelineHeaders.map((header) => (
              <div
                key={header.day}
                className="flex-1 px-2 py-3 text-xs text-gray-500 text-center border-r border-gray-100 last:border-r-0"
                style={{ minWidth: minColumnWidth }}
              >
                {header.label}
              </div>
            ))}
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {ganttItems.map((item) => {
            const bar = spanStyle(item.startDay, item.finishDay);
            const due = item.dueDay === undefined ? null : markerStyle(item.dueDay);
            const isGoal = item.type === 'goal';
            const isProject = item.type === 'project';
            const collapsed = isGoal
              ? collapsedGoals.has(item.key)
              : collapsedProjects.has(item.key);

            return (
              <div
                key={item.key}
                className={`flex border-b border-gray-100 hover:bg-gray-50 ${
                  isGoal ? 'bg-indigo-50' : isProject ? 'bg-blue-50' : ''
                }`}
              >
                <div
                  className="w-72 flex-shrink-0 px-4 py-2 border-r border-gray-200 flex items-center"
                  style={{ paddingLeft: `${item.level * 16 + 16}px` }}
                >
                  {(isGoal || isProject) && (
                    <button
                      onClick={() =>
                        isGoal
                          ? setCollapsedGoals((prev) => toggle(prev, item.key))
                          : setCollapsedProjects((prev) => toggle(prev, item.key))
                      }
                      aria-expanded={!collapsed}
                      aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${item.name}`}
                      className="mr-2 text-gray-400 hover:text-gray-600 w-4 h-4 flex items-center justify-center"
                    >
                      {collapsed ? '▶' : '▼'}
                    </button>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.type === 'task' && <span className="text-sm">{STATUS_EMOJI[item.status]}</span>}
                      <span
                        className={`truncate ${
                          isGoal
                            ? 'font-bold text-indigo-900'
                            : isProject
                              ? 'font-semibold text-blue-900'
                              : 'text-gray-900'
                        }`}
                        title={item.name}
                      >
                        {item.name}
                      </span>
                    </div>
                    {item.hoursRemaining > 0 && (
                      <div className="text-xs text-gray-500">
                        {item.hoursRemaining}h remaining
                        {item.completionPercentage > 0 && ` • ${item.completionPercentage}% done`}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 relative h-12">
                  <div className="absolute inset-0 flex">
                    {timelineHeaders.map((header) => (
                      <div
                        key={header.day}
                        className="flex-1 border-r border-gray-100 last:border-r-0"
                        style={{ minWidth: minColumnWidth }}
                      />
                    ))}
                  </div>

                  <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400 z-10" style={{ left: '0%' }} />

                  {bar && (
                    <div
                      className={`absolute top-2 h-8 ${barColor(item)} rounded opacity-80 hover:opacity-100 transition-opacity overflow-hidden`}
                      style={bar}
                      title={`${format(dateForDayOffset(item.startDay, today), 'MMM d')} – ${format(
                        dateForDayOffset(item.finishDay, today),
                        'MMM d'
                      )}`}
                    >
                      {item.completionPercentage > 0 && item.completionPercentage < 100 && (
                        <div
                          className="absolute inset-y-0 right-0 bg-white opacity-40"
                          style={{ width: `${100 - item.completionPercentage}%` }}
                        />
                      )}
                    </div>
                  )}

                  {due && (
                    <div
                      className="absolute top-1 w-1 h-10 bg-orange-500 z-20"
                      style={due}
                      title={`Due: ${format(dateForDayOffset(item.dueDay!, today), 'MMM d, yyyy')}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Total Goals', String(goals.length)],
          ['Total Projects', String(projects.length)],
          ['Active Tasks', String(schedule.queue.length)],
          ['Hours Remaining', `${schedule.totalHours}h`],
        ].map(([label, value]) => (
          <div key={label} className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500">{label}</div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
