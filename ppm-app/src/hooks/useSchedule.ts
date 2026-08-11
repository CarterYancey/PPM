import { useMemo } from 'react';
import { useStore } from '../store';
import { buildSchedule, type Schedule } from '../utils/schedule';

/**
 * The one schedule every view reads from.
 *
 * Previously each tab called the scheduler itself — and `TodaysListTab` called
 * it twice per render, once directly and once inside the scheduling helper — so
 * the tabs could disagree about a task's status. One memoised call, one answer.
 */
export function useSchedule(): Schedule {
  const goals = useStore((s) => s.goals);
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const settings = useStore((s) => s.settings);

  return useMemo(
    () => buildSchedule(tasks, goals, projects, settings),
    [tasks, goals, projects, settings]
  );
}
