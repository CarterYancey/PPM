# Scheduling

How PPM decides what you work on next, why the first design couldn't be made to
work, and what the current one still doesn't handle.

Implementation: [`ppm-app/src/utils/schedule.ts`](../ppm-app/src/utils/schedule.ts).
Tests: [`schedule.test.ts`](../ppm-app/src/utils/schedule.test.ts).

---

## 1. The problem

You have a set of tasks. Each has an hour estimate, a value, and possibly a
deadline. You have a fixed budget of hours per day (the *cadence*). Produce one
ordering such that working straight down it:

1. meets every deadline that can be met;
2. subject to that, does the most valuable work first;
3. is stable — it only changes when the data changes;
4. is explainable in one sentence.

This is single-machine scheduling with release time zero and deadlines. The
literature is old and settled, which is worth knowing before inventing anything.

## 2. Why v1 didn't work

v1 computed a score per task and sorted by it:

```
score = (goal.priority + project.priority) x 10
      + (slack < 0 ? 1000 : 100 / (1 + slack))
```

The failure isn't a tuning problem. It's structural:

**Adding a deadline term to a value term compares things that aren't
commensurable.** There is no exchange rate between "how much I care" and "how
soon this is due". Whatever constant you pick, someone's real situation inverts
it. The `1000` for at-risk work exists precisely because no smooth function
worked, and it flattens *all* at-risk tasks into one undifferentiated block.

**Slack is defined per task, but capacity is shared.** `slack = daysUntilDue -
daysNeeded` asks "could I finish this if it were the only thing I had?" — and
every task gets to assume that simultaneously. Twenty tasks can each report
comfortable slack while collectively needing three times the available hours.
v1 patched this with `getCumulativeHoursForDeadline`, which summed hours over
*siblings sharing a parent* — an arbitrary subset of the work competing for the
same hours.

**The feedback loop was circular.** The status light came from a greedy schedule
built by walking the sorted list, but the sort didn't know about that schedule.
So a task went red because *other work had been sorted ahead of it* — and the
sort had no mechanism to respond. Red meant "the sort function did something
you won't like", not "you're over-committed". That's the bug you actually felt.

**The last patch had already given up.** By the final commit both branches of
the comparator sorted by `basePriority`, and `urgencyScore` — the entire point
of the algorithm — was computed, displayed, and never used for ordering.

Some smaller errors compounded it: each task rounded up to a whole day
independently (four 30-minute tasks consumed four days at a 2h/day cadence);
`differenceInDays` on a timestamp truncated toward zero, so "due tomorrow" often
read as zero days away; due dates were parsed as UTC midnight but compared to a
local `new Date()`, costing another day west of Greenwich; and a subtask's own
due date overrode an *earlier* one on its parent.

## 3. The current algorithm

Keep value and deadlines completely separate, and never compare them
numerically. Instead, let them play different roles:

> **Deadlines decide what is *allowed* to be deferred. Value decides what
> actually *gets* deferred.**

Build the queue **from the back**:

```
T ← total hours of all outstanding work
while work remains:
    eligible ← work that can go last: no unplaced prerequisite,
               and enough capacity exists to finish it by hour T
    if eligible is empty:                       # genuinely over-committed
        eligible ← all remaining work
        choose the one with the latest deadline    # minimises the worst miss
    else:
        choose the least valuable                  # defer what costs least
    place it at position T; T ← T − its hours
```

Then walk forward once to turn cumulative hours into dates: with a cadence of
`c` hours/day, the work between cumulative hour `H` and `H'` falls on days
`floor(H/c)` through `ceil(H'/c) − 1`, counting today as day 0. A task with a
deadline `d` days out is therefore feasible at cumulative hour `H` exactly when
`H ≤ (d + 1) · c`. That single inequality is the whole capacity model, and it
is what "eligible" tests.

### What this guarantees

**The schedule misses a deadline only if every possible ordering does.**

*Proof.* Suppose some feasible ordering `S` of the remaining work exists, and
`x` is any task that fits in the last slot (`capacity(x) ≥ T`). Move `x` to the
end of `S`; everything that followed `x` shifts *earlier* by `x`'s hours, so
those deadlines still hold, and `x` now finishes at `T ≤ capacity(x)`, so its
deadline holds too. The result is still feasible. Therefore choosing *any*
eligible task — including the least valuable one — can never turn a feasible
instance into an infeasible one. Induct. ∎

So a red task now carries real information: **no ordering of your work meets
that deadline at this cadence.** Reshuffling won't help. Cut scope, move the
date, or raise the cadence. That is a fact about your commitments, not about the
software.

This is Lawler's backward-greedy rule for `1|prec|f_max`, with value as the
selection criterion among feasible candidates. The overload branch falls back to
Jackson's rule (latest deadline last), which minimises the *worst* miss when
misses are unavoidable.

### Tie-breaking

Equal value, then most capacity (defer whatever has the most room), then later
in the user's sequence, then id. The sequence tie-break is what keeps
"Chapter 3, Chapter 4, Chapter 5" in order without any special-casing, and it
makes the queue deterministic — requirement 3.

## 4. Worked examples

*Cadence 2h/day throughout. "Value" uses the multiplicative model.*

**Deadlines win when they have to.** Goal 21 × Project 5 = value 105, no
deadline, 2h. Goal 1 × Project 1 = value 1, due today, 2h. Total work 4h. Going
backwards: can the valuable task go last? It has no deadline, so yes — and it's
*more* valuable, so we check the cheap one first: can *it* go last? It would
finish at hour 4, but its capacity is `(0+1)·2 = 2`. No. The valuable task goes
last; the cheap one goes first. **The 2-point task beats the 105-point task,
because it's the only order that works.**

**Value wins when deadlines are slack.** Same pair, but the cheap task is due in
30 days (capacity 62h ≥ 4h). Now both fit last, so the least valuable goes last.
**Order flips.** No threshold was tuned to produce either outcome.

**Over-commitment is reported, not hidden.** Three 4h tasks, all due in 2 days
(6h of capacity, 12h of work). Every backward step finds nothing eligible; the
banner says two tasks cannot meet their deadline in any order. v1 would have
shown three red lights and silently reordered them.

**Overdue work goes first.** An overdue task has negative capacity, so it is
never eligible to be placed late — everything else gets deferred past it and it
lands at the front.

## 5. Value

`value = goal.priority × project.priority` by default.

The spec has always described project priority as "relative to other projects
within the same goal" — that is the definition of a weight *within* a goal, and
multiplying is how you apply a weight. It also makes pausing work: a goal at
priority 0 zeroes everything beneath it.

The v1 rule, `(goal + project) × 10`, is available in Settings for
back-compatibility, but it adds two numbers on different scales. Under it, a
priority-13 project beneath a priority-1 goal (140) outranks a priority-3
project beneath a priority-8 goal (110) — a rounding-error goal beating a
serious one.

Neither model is *justified*, only defensible. See
[PHILOSOPHY.md](PHILOSOPHY.md) §3 — this is the open problem, not a settled
question.

## 6. Settings

| Setting | Default | Effect |
|---|---|---|
| `dailyCadence` | 2 h/day | The capacity model. Everything scales off it. |
| `priorityModel` | `multiplicative` | See §5. |
| `sequenceMode` | `soft` | `strict` makes a task's position a hard prerequisite. |
| `tightSlackDays` | 2 | Slack at or below this shows 🟡. Cosmetic only. |

**On `sequenceMode`.** The spec says position encodes dependency ("task 2 should
happen after task 1"), which argues for `strict`. But in practice position is
often just the order you typed things in, and `strict` will report a deadline as
unreachable when the *ordering* is the only obstacle. The default is therefore
`soft`: position is a tie-break, so equal-value work stays in your sequence, but
a deadline can pull a later task forward. `strict` is one setting away when you
mean it. **This is a genuine judgement call and worth revisiting** — see
ROADMAP.

## 7. What this still doesn't handle

Honest limitations, roughly by how much they'd bite:

1. **Estimates are taken as truth.** No history, no error bars, no buffer. A
   2h task that is really 6h silently breaks the plan. Tracking actual hours and
   applying a per-project fudge factor is the single highest-value addition.
2. **The calendar is uniform.** Every day has the same cadence. No weekends, no
   holidays, no "Tuesday is busy". Real capacity varies enormously.
3. **No partial-credit or preemption.** A task occupies contiguous hours and
   cannot be split around a deadline, though in reality you can do half of a 6h
   task, hit an urgent deadline, and come back.
4. **Value is static.** Nothing decays. A goal you set in January that you no
   longer care about keeps its priority until you edit it.
5. **Cross-project dependencies can't be expressed.** Prerequisites only exist
   within a project's tree via `sortOrder`.
6. **No repeating work.** "Water the plants weekly" has to be typed out, or
   modelled as one task you re-open. See ROADMAP.
7. **Deferral ignores task size — arguably wrongly.** The rule is "least
   valuable goes last". Smith's rule says that to minimise value-weighted
   completion time you should order by value *per hour* and defer the lowest
   ratio, which would put a 1h/10-point task ahead of an 8h/40-point one:
   ten points land eight days sooner and only one day of delay is paid for
   forty. Value density is the theoretically better criterion.
   It is not implemented because value is currently inherited from
   goal × project, so every task in a project has identical value, and dividing
   by hours would silently reorder every project shortest-task-first — quietly
   overriding the sequence you typed. That trade-off is worth a decision rather
   than a default; see ROADMAP.
8. **Greedy is exact for feasibility, not for value.** Maximising total
   value-weighted earliness subject to deadlines is NP-hard
   (`1|d̄ⱼ|Σwⱼ Cⱼ`), so the value criterion is a heuristic layered on an exact
   feasibility guarantee. In practice the feasibility half is what matters; if
   the value ordering ever looks wrong in a real case, that case is worth
   writing down as a test.
9. **The day doesn't roll over on its own.** "Today" is captured when the
   schedule is computed. Leave the tab open overnight and it's stale until
   something changes.
