# Data model and design rationale

The current specification. Scheduling lives in [SCHEDULING.md](SCHEDULING.md);
the unresolved value question lives in [PHILOSOPHY.md](PHILOSOPHY.md). The
original v1 spec is preserved verbatim in [archive/spec-v1.md](archive/spec-v1.md).

---

## What problem this solves

Project management tools fail solo users in predictable ways: work is scattered
across per-project views, status fields and workflow states cost more than they
return, and manual High/Medium/Low priorities ignore deadlines entirely — so
they generate false urgency around low-value work.

What's actually needed: see everything in one place, know what's next, don't
miss deadlines, respect priorities when nothing is due, and spend almost no time
maintaining any of it.

## Entities

### Goal

| Field | Required | Notes |
|---|---|---|
| `id` | yes | `G1`, `G2`, … |
| `name` | yes | |
| `priority` | yes | ≥ 0. Fibonacci by convention. **0 pauses the goal and everything under it.** |
| `targetDate` | no | Aspiration, not a constraint — it does not drive scheduling |
| `notes` | no | Why this matters |

Fibonacci forces meaningful gaps instead of debates about 7 vs. 8. There is no
status field: priority 0 is the pause button. Target dates are optional because
some goals are ongoing ("keep the house clean").

Goals conflate ends and means, and `priority` is an ordinal number used as if it
were a ratio. Both are known problems — PHILOSOPHY.md §2.

### Project

| Field | Required | Notes |
|---|---|---|
| `id` | yes | `P1`, `P2`, … |
| `name` | yes | |
| `goalId` | yes | Exactly one goal |
| `priority` | yes | Weight **within** its goal. 0 pauses the project. |
| `dueDate` | no | A real deadline. Inherited by every task beneath it. |

The two-level priority exists so you can rank work inside a goal without
inflating the goal itself. Because project priority is a within-goal weight, it
*multiplies* the goal's priority rather than adding to it (SCHEDULING.md §5).

### Task

| Field | Required | Notes |
|---|---|---|
| `id` | yes | `T1`, `T2`, … |
| `name` | yes | |
| `projectId` | yes | |
| `parentTaskId` | no | Nesting, unlimited depth |
| `sortOrder` | yes | Position among siblings |
| `estHours` | no | Leaf tasks only. Aim for 1–2h. |
| `dueDate` | no | Only where a real deadline exists |
| `done` | yes | Leaf tasks only |

**Leaves and groups.** A task with children is a *group*: it has no hours of its
own and no checkbox, and its hours, dates and progress roll up from its leaves.
A group is done when all its leaves are.

**Deadline inheritance.** A task's effective deadline is the **earliest** of its
own, any ancestor's, and its project's. (v1 used the task's own date whenever it
had one, so a subtask due after its parent looked safe.)

**Position.** `sortOrder` is documented as sequence — task 2 after task 1. How
strictly the scheduler honours that is the `sequenceMode` setting; the default
treats it as a strong preference rather than a hard prerequisite
(SCHEDULING.md §6).

### Settings

| Field | Default | Notes |
|---|---|---|
| `dailyCadence` | 2 | Hours per day available for this work |
| `priorityModel` | `multiplicative` | `goal × project`, or v1's `(goal + project) × 10` |
| `sequenceMode` | `soft` | Whether position is a hard prerequisite |
| `tightSlackDays` | 2 | Slack at or below this shows 🟡 |

## Views

| Tab | Purpose |
|---|---|
| Today's List | The queue, in work order, with an over-commitment banner |
| Goals | Create and prioritise goals |
| Projects | Projects grouped by goal, each holding its task tree |
| Gantt Chart | The same schedule on a timeline, 2 weeks to 3 months |
| Settings | Cadence, scheduling model, sample data, backup/restore |

Status indicators: 🔴 at risk (deadline unreachable in any ordering) · 🟡 tight ·
🟢 on track · ⚪ no deadline · ✅ done.

## Design principles

**Minimalism.** Every field justifies itself. Optional by default. Nothing added
"just in case".

**Automation over manual work.** You never sort a list or update a priority to
reflect the passage of time. The system computes what can be computed.

**Transparency.** The algorithm fits in a paragraph and its guarantee is
provable. No black boxes, no tuned magic constants — the previous design's
`1000` and `100/(1+slack)` were exactly the kind of thing this rules out.

**Single source of truth.** One schedule, computed once
([`useSchedule`](../ppm-app/src/hooks/useSchedule.ts)), read by every view.
Views cannot disagree about a task's status because there is only one answer.

## Data integrity

Enforced on import and on load from local storage
([`normalizeState`](../ppm-app/src/defaults.ts)):

- Projects referencing a missing goal, and tasks referencing a missing project,
  are dropped.
- Dangling `parentTaskId`s are cleared; the task becomes a root.
- Priorities and hours are coerced to non-negative finite numbers.
- Cadence is clamped to 0.25–24h.

Enforced in the scheduler ([`createTaskIndex`](../ppm-app/src/utils/taskTree.ts)):

- Parent cycles are broken rather than causing infinite recursion.
- Tasks whose goal or project can't be resolved are skipped and reported.

Deleting a goal deletes its projects and their tasks; deleting a task deletes
its subtrees. Both are confirmed first.

## Storage

Local storage under `ppm-storage`, schema version 2, migrated through
`normalizeState`. Export/import JSON from Settings. There is no server, no sync,
and no account. Clearing site data destroys everything — export regularly.

## Explicitly out of scope

Team collaboration, approval workflows, external integrations, notifications.

## Not yet built

See [ROADMAP.md](ROADMAP.md).
