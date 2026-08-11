# PPM — Personal Project Management

A single-user planner that answers one question: **what should I work on right now?**

You enter goals, projects under them, and tasks under those. You give goals and
projects a priority, give tasks an hour estimate, and give deadlines only where
a real one exists. The app orders every outstanding task into one queue. Work
from the top.

No status fields, no assignees, no workflow. No backend — data lives in your
browser's local storage.

## Run it

```bash
cd ppm-app
npm install
npm run dev      # http://localhost:5173
```

`npm run build` for a production bundle, `npm test` for the scheduler tests.

## The model

| Entity | Holds | Key fields |
|---|---|---|
| **Goal** | What you're working toward | priority (0 = paused) |
| **Project** | Work that serves one goal | priority *within* that goal, optional due date |
| **Task** | The actual work, nested to any depth | position, estimated hours, optional due date |

Only leaf tasks carry hours and get checked off. Parents ("groups") roll up from
their children. A task inherits the tightest deadline that applies to it — its
own, any ancestor's, or its project's.

## How the ordering works

Two independent inputs:

- **Value** — how much you lose if this slips. From goal and project priority.
- **Deadline** — when it must be finished by, given your daily cadence.

The queue is built from the back. At each step: of the work that could go last
*and still meet its own deadline there*, the least valuable piece goes last.
Deadlines decide what is **allowed** to be deferred; value decides what actually
**gets** deferred.

This guarantees the queue misses a deadline only when *every* possible ordering
would. So a red task means you are genuinely over-committed — cut scope, move a
date, or raise your cadence. It never means the sort function guessed badly.

Full rationale, worked examples, and the tuning knobs: **[docs/SCHEDULING.md](docs/SCHEDULING.md)**.

## Tabs

- **Today's List** — the queue. Work top to bottom.
- **Goals** / **Projects** — entry and editing; projects hold the task tree.
- **Gantt Chart** — the same plan on a timeline.
- **Settings** — daily cadence, priority model, backup/restore.

## Docs

- **[docs/SCHEDULING.md](docs/SCHEDULING.md)** — the algorithm, its guarantees, and what it still can't do.
- **[docs/PHILOSOPHY.md](docs/PHILOSOPHY.md)** — what priority numbers are supposed to *mean*, and the unsolved
  problem of tying work to values. The most important open thread in the project.
- **[docs/SPEC.md](docs/SPEC.md)** — data model and design rationale.
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — known gaps, in rough priority order.
