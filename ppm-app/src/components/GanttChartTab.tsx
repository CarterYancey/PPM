import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { format, addDays, startOfDay, parseISO } from 'date-fns';
import { isLeaf, getChildren } from '../utils/taskTree';
import { getTaskScheduleData, type StatusIndicator } from '../utils/scheduling';
import type { Task, Goal, Project } from '../types';

interface GanttItem {
  id: string;
  name: string;
  type: 'goal' | 'project' | 'task';
  level: number;
  startDate: Date;
  endDate: Date;
  dueDate?: Date;
  completionPercentage: number;
  statusIndicator: StatusIndicator;
  goal?: Goal;
  project?: Project;
  task?: Task;
  isLeaf: boolean;
  hoursRemaining: number;
}

export default function GanttChartTab() {
  const { goals, projects, tasks, settings } = useStore();
  const [collapsedGoals, setCollapsedGoals] = useState<Set<string>>(new Set());
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'2weeks' | '1month' | '3months'>('1month');

  const today = startOfDay(new Date());

  // Get centralized scheduling data - single source of truth
  const taskScheduleData = useMemo(() => {
    return getTaskScheduleData(tasks, goals, projects, settings.dailyCadence);
  }, [tasks, goals, projects, settings.dailyCadence]);

  // Calculate timeline range based on view mode
  const timelineRange = useMemo(() => {
    const daysToShow = viewMode === '2weeks' ? 14 : viewMode === '1month' ? 30 : 90;
    const startDate = today;
    const endDate = addDays(today, daysToShow);
    return { startDate, endDate, daysToShow };
  }, [viewMode, today]);

  // Build Gantt items using centralized scheduling data
  const ganttItems = useMemo(() => {
    const items: GanttItem[] = [];

    // Sort goals by priority (higher priority first)
    const sortedGoals = [...goals].sort((a, b) => b.priority - a.priority);

    sortedGoals.forEach((goal) => {
      // Get projects for this goal, sorted by priority
      const goalProjects = projects
        .filter((p) => p.goalId === goal.id)
        .sort((a, b) => b.priority - a.priority);

      if (goalProjects.length === 0) return;

      // Calculate goal-level metrics from task schedules
      const goalTasks = tasks.filter((t) => goalProjects.some((p) => p.id === t.projectId));
      const goalLeafTasks = goalTasks.filter((t) => isLeaf(t.id, tasks) && !t.done);

      // Get schedule data for goal tasks
      const goalSchedules = goalLeafTasks
        .map((t) => taskScheduleData.get(t.id))
        .filter((s) => s !== undefined);

      // Calculate goal's start/end dates from its tasks
      let goalStart = today;
      let goalEnd = today;
      let goalHoursRemaining = 0;

      if (goalSchedules.length > 0) {
        const startDates = goalSchedules.map((s) => s.startDate.getTime());
        const endDates = goalSchedules.map((s) => s.finishDate.getTime());
        goalStart = new Date(Math.min(...startDates));
        goalEnd = new Date(Math.max(...endDates));
        goalHoursRemaining = goalSchedules.reduce((sum, s) => sum + s.hoursRemaining, 0);
      }

      // Goal item
      items.push({
        id: goal.id,
        name: goal.name,
        type: 'goal',
        level: 0,
        startDate: goalStart,
        endDate: goalEnd,
        dueDate: goal.targetDate ? parseISO(goal.targetDate) : undefined,
        completionPercentage: calculateGoalCompletion(goal, goalProjects, tasks),
        statusIndicator: '⚪',
        goal,
        isLeaf: false,
        hoursRemaining: goalHoursRemaining,
      });

      if (collapsedGoals.has(goal.id)) {
        return;
      }

      goalProjects.forEach((project) => {
        const projectTasks = tasks.filter((t) => t.projectId === project.id);
        const projectLeafTasks = projectTasks.filter((t) => isLeaf(t.id, tasks) && !t.done);

        // Get schedule data for project tasks
        const projectSchedules = projectLeafTasks
          .map((t) => taskScheduleData.get(t.id))
          .filter((s) => s !== undefined);

        // Calculate project's start/end dates from its tasks
        let projectStart = today;
        let projectEnd = today;
        let projectHoursRemaining = 0;

        if (projectSchedules.length > 0) {
          const startDates = projectSchedules.map((s) => s.startDate.getTime());
          const endDates = projectSchedules.map((s) => s.finishDate.getTime());
          projectStart = new Date(Math.min(...startDates));
          projectEnd = new Date(Math.max(...endDates));
          projectHoursRemaining = projectSchedules.reduce((sum, s) => sum + s.hoursRemaining, 0);
        }

        // Project item
        items.push({
          id: project.id,
          name: project.name,
          type: 'project',
          level: 1,
          startDate: projectStart,
          endDate: projectEnd,
          dueDate: project.dueDate ? parseISO(project.dueDate) : undefined,
          completionPercentage: calculateProjectCompletion(project, tasks),
          statusIndicator: '⚪',
          project,
          goal,
          isLeaf: false,
          hoursRemaining: projectHoursRemaining,
        });

        if (collapsedProjects.has(project.id)) {
          return;
        }

        // Build task tree for this project
        const projectRootTasks = projectTasks
          .filter((t) => !t.parentTaskId)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        const processTaskNode = (task: Task, level: number) => {
          const taskIsLeaf = isLeaf(task.id, tasks);

          // Skip completed leaf tasks
          if (taskIsLeaf && task.done) {
            return;
          }

          // Get scheduling data from centralized source
          const scheduleData = taskScheduleData.get(task.id);

          if (!scheduleData) {
            // Task has no schedule data (shouldn't happen for active tasks)
            return;
          }

          items.push({
            id: task.id,
            name: task.name,
            type: 'task',
            level: level + 2,
            startDate: scheduleData.startDate,
            endDate: scheduleData.finishDate,
            dueDate: scheduleData.effectiveDueDate ? parseISO(scheduleData.effectiveDueDate) : undefined,
            completionPercentage: taskIsLeaf ? (task.done ? 100 : 0) : calculateTaskCompletion(task, tasks),
            statusIndicator: scheduleData.statusIndicator,
            task,
            project,
            goal,
            isLeaf: taskIsLeaf,
            hoursRemaining: scheduleData.hoursRemaining,
          });

          // Process children
          if (!taskIsLeaf) {
            const children = getChildren(task.id, tasks);
            children.forEach((child) => processTaskNode(child, level + 1));
          }
        };

        projectRootTasks.forEach((task) => processTaskNode(task, 0));
      });
    });

    return items;
  }, [goals, projects, tasks, taskScheduleData, collapsedGoals, collapsedProjects, today]);

  // Helper functions
  function calculateGoalCompletion(_goal: Goal, goalProjects: Project[], allTasks: Task[]): number {
    const goalTasks = allTasks.filter((t) => goalProjects.some((p) => p.id === t.projectId));
    const leafTasks = goalTasks.filter((t) => isLeaf(t.id, allTasks));
    if (leafTasks.length === 0) return 0;

    const totalHours = leafTasks.reduce((sum, t) => sum + (t.estHours || 0), 0);
    if (totalHours === 0) return 0;

    const completedHours = leafTasks
      .filter((t) => t.done)
      .reduce((sum, t) => sum + (t.estHours || 0), 0);

    return Math.round((completedHours / totalHours) * 100);
  }

  function calculateProjectCompletion(project: Project, allTasks: Task[]): number {
    const projectTasks = allTasks.filter((t) => t.projectId === project.id);
    const leafTasks = projectTasks.filter((t) => isLeaf(t.id, allTasks));
    if (leafTasks.length === 0) return 0;

    const totalHours = leafTasks.reduce((sum, t) => sum + (t.estHours || 0), 0);
    if (totalHours === 0) return 0;

    const completedHours = leafTasks
      .filter((t) => t.done)
      .reduce((sum, t) => sum + (t.estHours || 0), 0);

    return Math.round((completedHours / totalHours) * 100);
  }

  function calculateTaskCompletion(task: Task, allTasks: Task[]): number {
    const getLeafDescendants = (taskId: string): Task[] => {
      const children = allTasks.filter((t) => t.parentTaskId === taskId);
      if (children.length === 0) return [];

      let leaves: Task[] = [];
      for (const child of children) {
        if (isLeaf(child.id, allTasks)) {
          leaves.push(child);
        } else {
          leaves = leaves.concat(getLeafDescendants(child.id));
        }
      }
      return leaves;
    };

    const leafDescendants = getLeafDescendants(task.id);
    if (leafDescendants.length === 0) return 0;

    const totalHours = leafDescendants.reduce((sum, t) => sum + (t.estHours || 0), 0);
    if (totalHours === 0) return 0;

    const completedHours = leafDescendants
      .filter((t) => t.done)
      .reduce((sum, t) => sum + (t.estHours || 0), 0);

    return Math.round((completedHours / totalHours) * 100);
  }

  // Calculate bar position and width
  const getBarStyle = (item: GanttItem) => {
    const { startDate, endDate } = timelineRange;
    const timelineStart = startDate.getTime();
    const timelineEnd = endDate.getTime();
    const timelineWidth = timelineEnd - timelineStart;

    const itemStart = Math.max(item.startDate.getTime(), timelineStart);
    const itemEnd = Math.min(item.endDate.getTime(), timelineEnd);

    if (itemEnd < timelineStart || itemStart > timelineEnd) {
      return null; // Item is outside visible range
    }

    const left = ((itemStart - timelineStart) / timelineWidth) * 100;
    const width = Math.max(((itemEnd - itemStart) / timelineWidth) * 100, 1);

    return { left: `${left}%`, width: `${width}%` };
  };

  // Get due date marker position
  const getDueDateStyle = (dueDate: Date) => {
    const { startDate, endDate } = timelineRange;
    const timelineStart = startDate.getTime();
    const timelineEnd = endDate.getTime();
    const timelineWidth = timelineEnd - timelineStart;

    const dueDateMs = dueDate.getTime();
    if (dueDateMs < timelineStart || dueDateMs > timelineEnd) {
      return null;
    }

    const left = ((dueDateMs - timelineStart) / timelineWidth) * 100;
    return { left: `${left}%` };
  };

  // Get today line position
  const getTodayLinePosition = () => {
    const { startDate, endDate } = timelineRange;
    const timelineStart = startDate.getTime();
    const timelineEnd = endDate.getTime();
    const timelineWidth = timelineEnd - timelineStart;

    const todayMs = today.getTime();
    if (todayMs < timelineStart || todayMs > timelineEnd) {
      return null;
    }

    const left = ((todayMs - timelineStart) / timelineWidth) * 100;
    return `${left}%`;
  };

  // Generate timeline headers
  const timelineHeaders = useMemo(() => {
    const { startDate, daysToShow } = timelineRange;
    const headers: { date: Date; label: string }[] = [];

    const step = viewMode === '3months' ? 7 : viewMode === '1month' ? 3 : 1;

    for (let i = 0; i < daysToShow; i += step) {
      const date = addDays(startDate, i);
      headers.push({
        date,
        label: format(date, viewMode === '3months' ? 'MMM d' : 'MMM d'),
      });
    }

    return headers;
  }, [timelineRange, viewMode]);

  const getBarColor = (item: GanttItem) => {
    if (item.type === 'goal') return 'bg-indigo-500';
    if (item.type === 'project') return 'bg-blue-500';

    switch (item.statusIndicator) {
      case '🔴': return 'bg-red-500';
      case '🟡': return 'bg-yellow-500';
      case '🟢': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  const toggleGoal = (goalId: string) => {
    setCollapsedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  };

  const toggleProject = (projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const todayLinePosition = getTodayLinePosition();

  if (goals.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No goals yet</p>
          <p className="text-sm">Create goals and projects to see your Gantt chart</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Gantt Chart</h2>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-indigo-500 rounded"></div>
              <span>Goal</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Project</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>On Track</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span>Tight</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>At Risk</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-4 bg-orange-500"></div>
              <span>Due Date</span>
            </div>
          </div>

          {/* View Mode Selector */}
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as '2weeks' | '1month' | '3months')}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="2weeks">2 Weeks</option>
            <option value="1month">1 Month</option>
            <option value="3months">3 Months</option>
          </select>
        </div>
      </div>

      {/* Gantt Chart Container */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        {/* Header Row */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {/* Name Column Header */}
          <div className="w-72 flex-shrink-0 px-4 py-3 font-semibold text-gray-700 border-r border-gray-200">
            Task / Project / Goal
          </div>

          {/* Timeline Headers */}
          <div className="flex-1 relative">
            <div className="flex">
              {timelineHeaders.map((header, index) => (
                <div
                  key={index}
                  className="flex-1 px-2 py-3 text-xs text-gray-500 text-center border-r border-gray-100 last:border-r-0"
                  style={{ minWidth: viewMode === '3months' ? '60px' : '40px' }}
                >
                  {header.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rows */}
        <div className="max-h-[600px] overflow-y-auto">
          {ganttItems.map((item) => {
            const barStyle = getBarStyle(item);
            const dueDateStyle = item.dueDate ? getDueDateStyle(item.dueDate) : null;
            const isGoal = item.type === 'goal';
            const isProject = item.type === 'project';

            return (
              <div
                key={item.id}
                className={`flex border-b border-gray-100 hover:bg-gray-50 ${
                  isGoal ? 'bg-indigo-50' : isProject ? 'bg-blue-50' : ''
                }`}
              >
                {/* Name Column */}
                <div
                  className="w-72 flex-shrink-0 px-4 py-2 border-r border-gray-200 flex items-center"
                  style={{ paddingLeft: `${item.level * 16 + 16}px` }}
                >
                  {/* Collapse/Expand Button */}
                  {(isGoal || isProject) && (
                    <button
                      onClick={() => isGoal ? toggleGoal(item.id) : toggleProject(item.id)}
                      className="mr-2 text-gray-400 hover:text-gray-600 w-4 h-4 flex items-center justify-center"
                    >
                      {(isGoal ? collapsedGoals.has(item.id) : collapsedProjects.has(item.id)) ? '▶' : '▼'}
                    </button>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.type === 'task' && (
                        <span className="text-sm">{item.statusIndicator}</span>
                      )}
                      <span
                        className={`truncate ${
                          isGoal ? 'font-bold text-indigo-900' :
                          isProject ? 'font-semibold text-blue-900' :
                          'text-gray-900'
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

                {/* Timeline Column */}
                <div className="flex-1 relative h-12">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex">
                    {timelineHeaders.map((_, index) => (
                      <div
                        key={index}
                        className="flex-1 border-r border-gray-100 last:border-r-0"
                        style={{ minWidth: viewMode === '3months' ? '60px' : '40px' }}
                      ></div>
                    ))}
                  </div>

                  {/* Today line */}
                  {todayLinePosition && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-blue-400 z-10"
                      style={{ left: todayLinePosition }}
                    ></div>
                  )}

                  {/* Task bar */}
                  {barStyle && (
                    <div
                      className={`absolute top-2 h-8 ${getBarColor(item)} rounded opacity-80 hover:opacity-100 transition-opacity`}
                      style={barStyle}
                    >
                      {/* Progress indicator */}
                      {item.completionPercentage > 0 && item.completionPercentage < 100 && (
                        <div
                          className="absolute inset-0 bg-white opacity-40 rounded-r"
                          style={{ left: `${item.completionPercentage}%` }}
                        ></div>
                      )}
                    </div>
                  )}

                  {/* Due date marker */}
                  {dueDateStyle && (
                    <div
                      className="absolute top-1 w-1 h-10 bg-orange-500 z-20"
                      style={dueDateStyle}
                      title={`Due: ${format(item.dueDate!, 'MMM d, yyyy')}`}
                    ></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Goals</div>
          <div className="text-2xl font-bold text-gray-900">{goals.length}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Projects</div>
          <div className="text-2xl font-bold text-gray-900">{projects.length}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-500">Active Tasks</div>
          <div className="text-2xl font-bold text-gray-900">
            {tasks.filter((t) => isLeaf(t.id, tasks) && !t.done).length}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Hours Remaining</div>
          <div className="text-2xl font-bold text-gray-900">
            {tasks
              .filter((t) => isLeaf(t.id, tasks) && !t.done)
              .reduce((sum, t) => sum + (t.estHours || 0), 0)}h
          </div>
        </div>
      </div>
    </div>
  );
}
