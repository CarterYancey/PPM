# ppm-app

The PPM web app. React 19 + TypeScript + Vite + Tailwind + Zustand.
See the [top-level README](../README.md) for what it does and why.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build -> dist/
npm test         # vitest
npm run lint
```

## Layout

```
src/
  types.ts            Goal / Project / Task / Settings
  defaults.ts         default settings, state validation, sample data
  store.ts            zustand store, persisted to localStorage
  hooks/useSchedule   the one memoised schedule every view reads
  utils/
    schedule.ts       the scheduler        <- start here
    schedule.test.ts
    valuation.ts      task value from goal/project priority
    taskTree.ts       precomputed task-forest index
    dates.ts          calendar-date handling (local, whole days)
  components/         one per tab, plus the shared TaskForm
```

`schedule.ts` is the only place that decides anything. Components render it;
they do not compute. Its design and guarantees are in
[docs/SCHEDULING.md](../docs/SCHEDULING.md).
