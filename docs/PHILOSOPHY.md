# Philosophy: what the numbers are supposed to mean

The scheduler is now on solid ground: given values and deadlines, it provably
does the right thing ([SCHEDULING.md](SCHEDULING.md)). But it takes those values
as input, and *where the values come from* is the unsolved part of this project.

This document states the problem precisely, records the known gaps, and sketches
a direction. It deliberately does not pick a winner. Nothing here is implemented.

---

## 1. The claim the system makes

Every task in the queue is an implicit argument:

> *Doing this, now, is the best available use of the next two hours of your
> life, because of what it eventually leads to.*

That argument only holds if there is an unbroken chain from the task to
something you actually care about for its own sake. The system's real job is not
sorting — it is **keeping that chain honest**. Sorting is the easy half.

Right now the chain is `task → project → goal`, and then it stops. A goal is
just a name and a number. Nothing asks *why* the goal matters, so nothing can
detect that it stopped mattering in March.

## 2. Three structural gaps

### 2.1 Intrinsic vs. instrumental values are conflated

Classically: **intrinsic** (or terminal) values are wanted for their own sake;
**instrumental** values are wanted because of what they produce. "Health" is
plausibly intrinsic. "Earn AWS certification" is instrumental — it is worth
something only via career, income, security, competence.

The model has one `Goal` entity and puts both in it. Three consequences:

- **Instrumental goals inherit no justification.** If "AWS certification" is a
  21, that number is asserted, not derived. Should the underlying career value
  change, nothing updates.
- **Chains collapse.** Real structure looks like
  `certification → job security → financial stability → family wellbeing`, and
  is flattened to a single node.
- **Terminal values can't be audited.** There's no view answering "what are the
  five things I actually care about, and what fraction of my hours reached
  them?" — which is the review question worth asking.

**The fix is small and worth doing early:** add a `kind: 'intrinsic' |
'instrumental'` flag, and let an instrumental goal declare its parents.
Priority becomes an *asserted* number only on intrinsic values; everywhere else
it is derived.

### 2.2 The structure is a tree, but reality is a DAG

Everything is currently one-parent. Reality is many-to-many at every level:

- **Tasks → projects.** "Set up a shared calendar" serves trip planning *and*
  household coordination. Today you duplicate it and check it off twice, or pick
  a parent and lose the other link.
- **Projects → values.** "Running program" serves health, stress management, and
  the social value of the running club.
- **Instrumental → intrinsic.** Certification serves income *and* competence
  *and* professional identity.

This is not cosmetic. It changes what a task is worth. Work that serves three
ends should outrank work that serves one, and today's model literally cannot
express the difference. It is also the case that this shared work is exactly
what you most want surfaced: its hours are paid once and its value counted
several times, so its value *density* is genuinely higher.

A DAG brings its own problems, all of them solvable but none automatic:

- **Double counting.** If a project serves two values that are themselves
  correlated, summing overstates it.
- **Credit assignment.** Does a task serving two projects get the sum of their
  values, the max, or something in between? Sum is right if the projects are
  independent, max is right if they're substitutes, and neither is right in
  general.
- **Cycles.** "Health enables productivity enables income enables health." Must
  be detected and rejected, or the propagation doesn't terminate.
- **Completion semantics.** If a shared task is done, is it done for both
  parents? Almost always yes — but the UI has to say so rather than showing it
  twice.

### 2.3 Priority numbers have no defined meaning

The most fundamental gap. What is a 13?

Fibonacci is borrowed from story-point estimation, where its purpose is to force
coarse distinctions on an **ordinal** scale. But the scheduler *multiplies* these
numbers. Multiplication requires a **ratio** scale — a real zero and meaningful
proportions, so that 21 means "worth three times as much as 7". Nobody assigns
Fibonacci priorities that way. They pick 21 to mean "very important".

So there is a live inconsistency: the numbers are elicited as ordinals and
consumed as ratios. Everything downstream inherits it. This is worth stating
plainly because it bounds how good the ordering can ever be — no scheduling
algorithm can be more meaningful than its inputs.

Two honest exits:

- **Accept ordinality.** Restrict the scheduler to comparisons only (rank-based
  deferral). Loses the ability to say "this is twice as important", which is
  what makes trade-offs computable.
- **Elicit genuine ratios.** Get cardinal weights from a procedure designed to
  produce them, not from a free-text number. §3 sketches how.

The second is better, and cheaper than it sounds.

## 3. A direction: the value graph

Not a proposal to implement today — a target to argue with.

```
IntrinsicValue   id, name, weight        # the only asserted numbers
InstrumentalValue id, name               # derived
ValueEdge        from, to, share         # outgoing shares sum to 1
Project          id, name, [ValueEdge]
Task             id, name, [projectId], estHours, dueDate
```

**Weights only at the top.** You assign numbers to a handful of intrinsic values
— five to eight, not fifty. Everything else derives.

**Edges carry normalised shares.** Each node splits its contribution across its
parents, summing to 1. This is the mechanism that stops double counting: adding
a second parent to a project *redistributes* its claim rather than duplicating
it. Value then propagates down the DAG by summing weight × share along every
path, which is well defined and cheap on a graph this size.

**Elicit weights properly.** Three methods, in increasing cost and quality:

1. **Budget allocation.** "Distribute 100 points across your intrinsic values."
   Trivial to build; produces genuine ratios; people find it natural. This is
   the right first implementation.
2. **Pairwise comparison** (AHP-style). "Health vs. career: how much more?"
   Better for more than ~7 items, and yields a consistency ratio that flags
   incoherent inputs — a useful nudge in itself.
3. **Trade-off questions.** "Would you swap 10 hours of health work for 15 of
   career work?" Most faithful, most tedious. Probably too much friction here.

**Same trick one level down.** A project's share allocation across the values it
serves is another 100-point split. Small, concrete question; no scale invention
required.

### What this buys

- Pausing an intrinsic value correctly zeroes everything downstream of it.
- Value density falls out: `value(task) / estHours`, comparable across the whole
  system, and shared work automatically rises.
- A real review view: *hours spent per intrinsic value, last 90 days, versus the
  weights you claim to hold.* That comparison is the single most valuable thing
  this system could show you, and it is impossible in the current model.

### What it doesn't solve

Recorded because these are genuinely hard, not because they're excuses:

- **Satiation and diminishing returns.** The tenth hour on a value is worth less
  than the first. Linear weights assume otherwise, and this is the main reason
  a purely computed ranking will occasionally feel wrong. A concave transform
  (`weight × log(1 + hours)`) is the standard patch and needs history to work.
- **Complementarity.** Some projects are worthless unless another finishes. Not
  expressible as a weighted sum at all.
- **Probability of success.** A 20% shot at something enormous versus a certain
  small gain. Expected value is the textbook answer and understates the
  option value of just starting.
- **Time preference.** Value delivered in five years versus next week. Any
  discount rate you pick is arbitrary; leaving it out implies zero, which is
  also a choice.
- **Values change, and the model can't tell why.** Editing a weight is
  indistinguishable from genuinely changing your mind, drifting, or
  rationalising the work you already did. Timestamped weight history would at
  least make drift visible.
- **Scale inflation.** Everything creeps toward 21. Forced normalisation (the
  100-point budget) is the only reliable defence; it is a feature, not a
  formality.

## 4. Constraints any answer must respect

The original spec says the system fails if maintaining it becomes a task. That
survives contact with everything above:

1. **Bounded elicitation.** One 100-point split over ≤8 intrinsic values, and a
   share allocation per project. Nothing per task.
2. **Sane defaults.** A project with no declared values still works — it just
   sits at the bottom. Nothing is blocked on the ontology being finished.
3. **Incremental.** The value graph must be addable without a rewrite. It fits
   behind the existing `valueOf()` seam
   ([`valuation.ts`](../ppm-app/src/utils/valuation.ts)) — one function, one
   call site.
4. **Legible.** Every number in the UI must be traceable to something you typed.
   A derived value you can't explain is worse than a crude one you can.

## 5. Suggested order of work

1. `kind: intrinsic | instrumental` on Goal. One field, immediately clarifying,
   no maths.
2. 100-point budget allocation over intrinsic values, replacing free-text
   priority. Fixes §2.3 with genuine ratio-scale numbers.
3. Multi-parent edges for projects, with normalised shares. Fixes §2.2 at the
   level where it hurts most, and single-parent stays the default.
4. Time tracking (actual hours). Needed by anything adaptive, and independently
   the biggest win for schedule accuracy.
5. The hours-per-value review view. The payoff for steps 1–4.
6. Multi-parent tasks. The most invasive change and the least urgent — get the
   value model right first.
