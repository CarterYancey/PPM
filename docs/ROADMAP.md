# Roadmap and open questions

Everything known to be missing or undecided, roughly in priority order. Items
marked **decision** need a call from you before anyone can implement them.

---

## Decisions waiting on you

**1. Should deferral use value, or value per hour?** — *decision*
Smith's rule says value density is the theoretically correct criterion, and it
would make short high-value work jump ahead of long low-value work. It is not
implemented because value is currently uniform within a project, so dividing by
hours would silently reorder every project shortest-first and override the
sequence you typed. It becomes clearly correct once tasks can carry their own
value. Analysis in SCHEDULING.md §7.7.

**2. Is task position a preference or a prerequisite?** — *decision*
`sequenceMode` currently defaults to `soft` (preference). The original spec says
prerequisite, which argues for `strict`, but strict will report deadlines as
unreachable when the ordering is the only obstacle. Both work today; the default
is a judgement call. SCHEDULING.md §6.

**3. How far to take the value model?** — *decision*
PHILOSOPHY.md §3 sketches a value graph with intrinsic/instrumental separation
and normalised shares. It's a real increase in conceptual weight for a
single-user tool. The suggested first steps (§5) are cheap and reversible; the
full graph is not.

## Value model

Detail in [PHILOSOPHY.md](PHILOSOPHY.md).

- `kind: intrinsic | instrumental` on Goal. One field, no maths, immediately
  clarifying. **Start here.**
- 100-point budget allocation over intrinsic values, replacing free-text
  priority — turns ordinal guesses into genuine ratio-scale weights.
- Multi-parent edges (project → several values) with normalised shares.
- Hours-per-intrinsic-value review: *what you claim to value vs. where your
  hours actually went.* The most valuable view this system could have.
- Multi-parent tasks (one task serving several projects). Most invasive; do the
  value model first.
- Unhandled even by the sketch: satiation/diminishing returns, complementary
  projects, probability of success, time discounting, value drift over time.

## Scheduling

Detail in [SCHEDULING.md](SCHEDULING.md) §7.

- **Time tracking (actual vs. estimated hours).** Highest-value addition. The
  plan currently trusts every estimate absolutely; a per-project correction
  factor learned from history would fix the largest source of error.
- **Non-uniform calendar.** Weekends, holidays, per-day cadence. Today every day
  is identical, which nobody's week is.
- **Preemption.** Tasks occupy contiguous hours and can't be split around a
  deadline.
- **Cross-project dependencies.** Prerequisites only exist inside one project's
  tree.
- **Repeating tasks.** "Weekly 10k run" has to be retyped or reopened by hand.
- **Estimate uncertainty.** Ranges instead of point estimates, and a schedule
  that reports confidence rather than a single date.
- **Midnight rollover.** "Today" is captured when the schedule is computed;
  an open tab goes stale overnight.

## Application

- **No component tests.** The scheduler has 20; the React layer has none. Add
  `@testing-library/react` and cover the task-tree interactions.
- **No accessibility pass.** ARIA labels were added to controls, but keyboard
  navigation and focus management are untested.
- **Local storage only.** No sync, no versioned backups, no undo. Deleting a
  goal destroys its whole subtree behind one `confirm()`.
- **No drag-and-drop reordering.** Position is a number you type.
- **No mobile layout.** The Gantt in particular assumes a wide screen.
- **No filtering or focus mode.** The queue shows everything; the original spec
  wanted a "top N for today" view.
- **Task creation friction.** Every task requires opening a form. Quick-add with
  inline parsing ("read chapter 3 2h due friday") would help.

## Done in this pass

- Scheduler rewritten with a provable feasibility guarantee, replacing the
  score-and-sort design.
- Fixed: whole-day rounding per task, UTC/local date mismatch, `differenceInDays`
  truncation, subtask deadlines overriding tighter parent deadlines.
- Over-commitment surfaced explicitly instead of shown as unexplained red lights.
- One memoised schedule shared by all views; previously each tab recomputed its
  own and Today's List did it twice per render.
- `O(n²)`–`O(n³)` tree traversals replaced with a precomputed index.
- Fixed: zustand state mutated during render; collapse state wiped whenever a
  task was added; `NaN` from cleared number inputs reaching the store.
- Import validation, storage migration, and corrupt-data tolerance (dangling
  references, parent cycles).
- Removed dead code: `TasksTab`, `prioritization.ts`, `scheduling.ts`, Vite
  boilerplate. Deduplicated three copies of the task form.
- 20 scheduler tests; README cut from 886 lines to ~70.
