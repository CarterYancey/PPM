# Goal Management System - Complete Specification

## Executive Summary

A minimalist, single-user task management system designed to manage multiple concurrent goals and projects without the complexity of traditional project management tools. The system automatically prioritizes tasks to ensure all deadlines are met while respecting user-defined goal priorities and task sequences.

**Core Philosophy:**
- Simplicity over features
- Function over process
- Automatic prioritization over manual shuffling
- One place to see everything
- Minimal required fields

## Problem Statement

Traditional project management tools fail individual users in several ways:

1. **Multi-project paralysis:** Difficult to see tasks across all projects in a unified view. Users must context-switch between projects to understand priorities.

2. **Feature bloat:** Fields like status (To Do, In Progress, In Review, Blocked, etc.), story points, t-shirt sizes, assignees, and complex workflows add overhead without value for solo users.

3. **Process over progress:** More time spent maintaining the system (updating statuses, attending to methodology) than doing actual work.

4. **Team-centric design:** Built for collaboration and tracking accountability, not personal productivity.

5. **Priority confusion:** Manual priority systems (High/Medium/Low or P1/P2/P3) don't account for deadlines, creating false urgency around low-value work.

**What users actually need:**
- See all their tasks in one place
- Know what to work on next
- Ensure deadlines are met
- Respect goal priorities when no deadlines loom
- Break big goals into manageable work
- Spend minimal time managing the system

## Solution Overview

A spreadsheet-based system with three core components:
1. **Goals** - High-level objectives with priorities
2. **Projects** - Collections of related tasks supporting a goal
3. **Tasks** - Hierarchical work items with optional deadlines

The system uses an automatic prioritization algorithm to generate a sorted task list where the top item is always the most important thing to work on right now.

## System Components

### 1. Goals

**Purpose:** Define what you're working toward and their relative importance.

**Fields:**
- **ID** (required): Unique identifier (G1, G2, G3...)
- **Name** (required): Clear, specific goal name
  - Examples: "Read 12 classic novels in 2025", "Earn AWS certification", "Keep house cleaner"
- **Priority** (required): Fibonacci number (0, 1, 2, 3, 5, 8, 13, 21, 34...)
  - 0 = Paused/someday
  - 1-3 = Low priority
  - 5-8 = Medium priority
  - 13-21 = High priority
  - 34+ = Critical/urgent
- **Target Date** (optional): When you aim to complete this goal
- **Notes** (optional): Why this matters, context, motivations

**Design rationale:**
- Goals are lightweight containers for organizing work
- Priority uses Fibonacci to force meaningful distinctions (no debating 7 vs 8)
- No status field - priority of 0 effectively pauses a goal
- Target dates are optional because some goals are ongoing ("Keep house cleaner")

**Example goals:**
```
G1 | Read 12 novels in 2025  | Priority: 5  | Target: 2025-12-31 | Personal enrichment
G2 | Keep house cleaner      | Priority: 8  | Target: -          | Quality of life
G3 | Earn AWS certification  | Priority: 13 | Target: 2025-06-30 | Career advancement
```

### 2. Projects

**Purpose:** Group related tasks that support a goal.

**Fields:**
- **ID** (required): Unique identifier (P1, P2, P3...)
- **Name** (required): Descriptive project name
- **Goal_ID** (required): Which goal this project supports
- **Priority** (required): Fibonacci number (0, 1, 2, 3, 5, 8, 13, 21, 34...)
  - Relative to other projects within the same goal
- **Due_Date** (optional): If project has a hard deadline

**Design rationale:**
- Projects allow prioritization within a goal (certification prep more urgent than networking)
- Some projects are time-bounded ("Trip to Japan"), others ongoing ("Housekeeping")
- No status field - priority of 0 effectively pauses a project
- Combined priority (Goal + Project) allows fine-grained control

**Example projects:**
```
P1 | Novel reading list      | Goal: G1 | Priority: 5  | Due: -
P2 | Daily housekeeping      | Goal: G2 | Priority: 8  | Due: -
P3 | Weekly deep cleaning    | Goal: G2 | Priority: 3  | Due: -
P4 | AWS study plan          | Goal: G3 | Priority: 13 | Due: 2025-06-15
P5 | Practice exam prep      | Goal: G3 | Priority: 8  | Due: 2025-06-01
```

### 3. Tasks

**Purpose:** Actual work items, organized hierarchically.

**Fields:**
- **ID** (required): Unique identifier (T1, T2, T3...)
- **Name** (required): Clear, actionable task description
- **Project_ID** (required): Which project this belongs to
- **Parent_Task_ID** (optional): For subtasks, ID of parent task
- **Sort_Order** (required): Sequence within parent (1, 2, 3...)
  - Defines dependency order: task 2 should happen after task 1
- **Est_Hours** (optional): Estimated hours (blank if <1 hour or if task has subtasks)
  - Target: 1-2 hours per task for optimal manageability
- **Due_Date** (optional): Hard deadline if one exists
- **Done** (checkbox): Only for leaf tasks (tasks without subtasks)

**Calculated fields:**
- **Level**: Depth in hierarchy (0 = root, 1 = child, 2 = grandchild...)
- **Is_Leaf**: TRUE if task has no subtasks
- **Total_Hours_Remaining**: For parent tasks, sum of incomplete descendant hours
- **Completion_Status**: For parent tasks, hours completed / total hours
- **Expected_Completion_Date**: Today + (hours remaining ÷ daily cadence)
- **Days_Until_Due**: Due date - today (if applicable)
- **Days_Needed**: Hours remaining ÷ daily cadence
- **Slack**: Days until due - days needed
- **Urgency_Score**: Final priority score for sorting

**Design rationale:**
- Tasks form a tree structure with unlimited depth
- A task is complete when:
  - If leaf: Done checkbox is checked
  - If parent: All subtasks are complete (recursive)
- Sort_Order encodes dependencies - no separate prerequisite field needed
- Est_Hours only on leaf tasks (parent hours are calculated from children)
- No status field - only Done/Not Done matters

**Task hierarchy example:**
```
T1  | Trip to Japan              | Project: P6  | Parent: -   | Sort: 1 | Hours: -  | Due: 2025-08-01
T2  | Plan itinerary             | Project: P6  | Parent: T1  | Sort: 1 | Hours: -  | Due: -
T3  | Research neighborhoods     | Project: P6  | Parent: T2  | Sort: 1 | Hours: 2  | Due: -
T4  | Choose dates               | Project: P6  | Parent: T2  | Sort: 2 | Hours: 1  | Due: -
T5  | Book accommodations        | Project: P6  | Parent: T2  | Sort: 3 | Hours: 2  | Due: -
T6  | Book flights               | Project: P6  | Parent: T1  | Sort: 2 | Hours: 2  | Due: 2025-06-15
T7  | Arrange pet care           | Project: P6  | Parent: T1  | Sort: 3 | Hours: -  | Due: -
T8  | Find cat sitter            | Project: P6  | Parent: T7  | Sort: 1 | Hours: 2  | Due: -
T9  | Prepare cat supplies       | Project: P6  | Parent: T7  | Sort: 2 | Hours: 1  | Due: -
```

In this example:
- T1 is the milestone (has subtasks, no checkbox)
- T3, T4, T5 must happen in order (sort order encodes dependency)
- T6 has a specific deadline (book flights before prices rise)
- T2 and T7 are intermediate groupings (optional organizational layer)

### 4. Settings

**Global configuration:**
- **Daily_Cadence** (default: 2): How many hours per day user typically works on tasks
  - Used to calculate days needed for any chunk of work
  - Examples: 1 hour/day for casual, 2 hours/day for consistent, 4 hours/day for intensive

**Future enhancements (not in v1):**
- Per-project cadence overrides
- Working days vs. off days
- Buffer percentages for estimation accuracy

## The Automatic Prioritization Algorithm

### Goal

Generate a single sorted list where:
1. All deadlines will be met if user works top-to-bottom
2. Within "on time" work, goal/project priority determines order
3. Within same priority, user-defined sequence (sort_order) is preserved
4. List is stable - only changes when data changes, not randomly

### Algorithm

```
For each task T:

1. Calculate Base_Priority:
   Base_Priority = (T.Goal.Priority + T.Project.Priority) × 10
   
   // Examples:
   // Goal priority 13 + Project priority 8 = 21 × 10 = 210
   // Goal priority 5 + Project priority 5 = 10 × 10 = 100

2. Calculate Deadline_Urgency:
   
   IF T has due_date:
     days_until_due = T.due_date - today
     days_needed = T.total_hours_remaining / daily_cadence
     slack = days_until_due - days_needed
     
     IF slack < 0:
       // Already should have started - at risk!
       urgency_boost = 1000
     ELSE:
       // On track - boost increases as deadline approaches
       urgency_boost = 100 / (1 + slack)
       // Examples:
       // 10 days slack = 100/11 = 9.1
       // 5 days slack = 100/6 = 16.7
       // 1 day slack = 100/2 = 50
       // 0 days slack (must start today) = 100/1 = 100
   
   ELSE IF any descendant of T has due_date:
     // Parent inherits urgency from most urgent child, dampened
     urgency_boost = max(child_urgency_boosts) × 0.5
   
   ELSE:
     // No deadline anywhere in this branch
     urgency_boost = 0

3. Calculate Final Score:
   Urgency_Score = Base_Priority + Urgency_Boost

4. Sort all tasks:
   Primary sort: Urgency_Score (descending)
   Secondary sort: Sort_Order (ascending)
```

### Algorithm Behaviors

**At-risk tasks always rise to top:**
- Any task with slack < 0 gets +1000 boost
- This overrides even the highest priority difference (max base = 680)
- Ensures deadlines are never accidentally missed

**Approaching deadlines gradually increase urgency:**
- A task due in 10 days with 2 hours of work (slack = 9) gets +10 boost
- Same task when due in 2 days (slack = 1) gets +50 boost
- As deadline approaches, task rises in list naturally

**No-deadline tasks sort purely by priority:**
- Goal priority 21 + Project priority 13 = 340 base score
- Goal priority 8 + Project priority 5 = 130 base score
- First task always appears above second (when no deadlines involved)

**Sort order provides stability:**
- When two tasks have identical urgency scores, sort_order determines order
- This means tasks from same parent stay in sequence
- List doesn't randomly shuffle - only changes when data changes

### Example Scenarios

**Scenario A: All tasks on track**
```
Today: Monday, Jan 6
Daily cadence: 2 hours

Task A: Study Chapter 3
  Goal: Career (21) + Project: Certification (13) = 340 base
  Due: Friday Jan 10 (4 days away)
  Hours: 2, Days needed: 1, Slack: 3
  Boost: 100/(1+3) = 25
  Score: 340 + 25 = 365

Task B: Clean kitchen
  Goal: Home (8) + Project: Housekeeping (5) = 130 base
  Due: none
  Boost: 0
  Score: 130

Task C: Book Japan flights
  Goal: Travel (8) + Project: Japan Trip (8) = 160 base
  Due: none
  Boost: 0
  Score: 160

Sorted list:
1. Study Chapter 3 (365) ← Do this first
2. Book Japan flights (160)
3. Clean kitchen (130)
```

**Scenario B: One task at risk**
```
Today: Thursday, Jan 9
Daily cadence: 2 hours

Task A: Study Chapter 3
  Goal: Career (21) + Project: Certification (13) = 340 base
  Due: Friday Jan 10 (1 day away)
  Hours: 2, Days needed: 1, Slack: 0
  Boost: 100/(1+0) = 100
  Score: 340 + 100 = 440

Task B: Bookclub slideshow
  Goal: Social (8) + Project: Bookclub (5) = 130 base
  Due: Friday Jan 10 (1 day away)
  Hours: 4, Days needed: 2, Slack: -1 (AT RISK!)
  Boost: 1000
  Score: 130 + 1000 = 1130

Sorted list:
1. Bookclub slideshow (1130) ← AT RISK - Do this first!
2. Study Chapter 3 (440)
```

The slideshow jumped to #1 because it's at risk, even though Career goal is much higher priority than Social. System guarantees you won't miss deadlines.

**Scenario C: Same priority, sort order matters**
```
Goal: Career (21) + Project: Certification (13) = 340 base

Task A: Study Chapter 3 (Sort: 3, no due date)
  Score: 340 + 0 = 340
  
Task B: Study Chapter 4 (Sort: 4, no due date)
  Score: 340 + 0 = 340
  
Task C: Study Chapter 5 (Sort: 5, no due date)
  Score: 340 + 0 = 340

All have identical scores, so secondary sort by sort_order:
1. Study Chapter 3 (340, sort: 3)
2. Study Chapter 4 (340, sort: 4)
3. Study Chapter 5 (340, sort: 5)

Chapters stay in order, as intended.
```

## User Interface Design

### Tab 1: Goals

Simple table showing all goals.

**Columns:**
- ID
- Goal Name
- Priority (Fibonacci selector: 0, 1, 2, 3, 5, 8, 13, 21, 34)
- Target Date (optional)
- Notes

**Features:**
- Sorted by priority descending
- Color coding: 
  - Priority 0 = gray (paused)
  - Priority 1-5 = white (low)
  - Priority 8-13 = light blue (medium)
  - Priority 21+ = light red (high)

### Tab 2: Projects

Simple table showing all projects.

**Columns:**
- ID
- Project Name
- Goal (dropdown referencing Goals tab)
- Priority (Fibonacci selector)
- Due Date (optional)
- Completion (calculated: X/Y hours complete)

**Features:**
- Grouped by goal
- Sorted by goal priority, then project priority
- Show completion percentage or hours remaining

### Tab 3: Tasks

Full task tree with all details.

**Columns:**
- ID
- Name
- Project (dropdown)
- Parent Task (dropdown of tasks in same project)
- Sort Order (number)
- Est Hours (blank if parent task)
- Due Date (optional)
- Done (checkbox, only for leaf tasks)
- Level (calculated, for debugging)

**Features:**
- Indented display to show hierarchy
- Collapsible rows (click parent to hide/show children)
- Visual indicators:
  - ✓ = Task complete
  - ◐ = Partially complete (some subtasks done)
  - ○ = Not started
- Color coding by urgency score (calculated):
  - Red background = at risk (score includes +1000 boost)
  - Yellow background = approaching deadline
  - White background = on track or no deadline

### Tab 4: Today's List

**The main working view.** Auto-generated sorted list of all tasks.

**Columns:**
- Task Name
- Parent/Milestone (shows immediate parent for context)
- Project
- Hours
- Due Date
- Status indicator (🔴 at risk, 🟡 tight, 🟢 on track, ⚪ no deadline)
- Done (checkbox)

**Features:**
- Always sorted by urgency score (primary) and sort order (secondary)
- Top task is highlighted or pinned
- Can filter to show only top N tasks (e.g., "Today's 3 tasks")
- Shows calculated fields:
  - Slack days (if has deadline)
  - Expected completion date
  - Urgency score (optional, for debugging)

**Key behavior:**
- This list updates automatically as tasks are completed or dates change
- User works top to bottom, checking off tasks
- When a task is checked, it disappears and the next task rises to #1

### Tab 5: Timeline (Optional)

Visual overview of deadlines and milestones.

**Display:**
- Horizontal timeline (current week, month, or quarter)
- Vertical rows for each project
- Milestones plotted as diamonds on timeline
- Tasks with due dates shown as bars (start to due date)
- Color coding:
  - Red = at risk
  - Yellow = tight
  - Green = on track

**Purpose:**
- Quick visual check of what's coming
- Identify conflicts (two big milestones same week)
- See the big picture

### Tab 6: Settings

**Configuration values:**
- Daily Cadence (hours per day)
- Default priorities for new goals/projects
- Visual preferences (color schemes, compact vs. expanded view)

## Formulas and Calculations

### Key Calculations (in spreadsheet formulas)

**Task Completion Status:**
```
IF(Has_Subtasks, 
   COUNTIF(Children, "Done") / COUNT(Children),
   Done_Checkbox)
```

**Total Hours Remaining:**
```
IF(Has_Subtasks,
   SUMIF(All_Descendants, "Not Done", Est_Hours),
   IF(Done, 0, Est_Hours))
```

**Expected Completion Date:**
```
Today + (Total_Hours_Remaining / Daily_Cadence)
```

**Slack Days:**
```
IF(Has_Due_Date,
   Due_Date - Today - (Total_Hours_Remaining / Daily_Cadence),
   N/A)
```

**Urgency Score:**
```
Base_Priority = (Goal.Priority + Project.Priority) × 10

IF(Has_Due_Date,
   IF(Slack < 0,
      Urgency_Boost = 1000,
      Urgency_Boost = 100 / (1 + Slack)),
   IF(Any_Child_Has_Due_Date,
      Urgency_Boost = MAX(Child_Urgency) × 0.5,
      Urgency_Boost = 0))

Urgency_Score = Base_Priority + Urgency_Boost
```

### Data Integrity Rules

**Validation:**
- Priority must be Fibonacci number
- Sort_Order must be positive integer
- Est_Hours must be blank or 1-2 (warning if >2)
- Parent_Task_ID must reference task in same project
- Done checkbox only enabled for leaf tasks

**Circular reference prevention:**
- Task cannot be its own parent
- Task cannot reference descendant as parent

**Automatic updates:**
- When all subtasks are complete, parent auto-completes
- When parent is reopened, all subtasks reopen
- When task deleted, subtasks either delete or promote to parent's level

## Data Flow

### Task Creation Workflow

1. User creates goal (if needed)
2. User creates project under goal
3. User creates top-level task under project
4. User breaks task into subtasks (recursive as needed)
5. User assigns sort order to establish sequence
6. User estimates hours for leaf tasks only
7. User adds due dates only where real deadlines exist

### Daily Usage Workflow

1. Open Today's List tab
2. Look at top task
3. Work on it for estimated hours
4. Check done when complete
5. Repeat with new top task
6. End of day: review tomorrow's top tasks

### Weekly Review Workflow

1. Review all milestones due in next 2 weeks
2. Check for at-risk items (red flags)
3. Adjust priorities if goals shift
4. Break down upcoming milestones into tasks
5. Update time estimates based on actual pace

## Design Principles

### Minimalism
- Every field must justify its existence
- Default to blank (optional) rather than required
- No field exists "just in case" - only add when proven necessary

### Automation Over Manual Work
- System calculates what can be calculated
- User never manually updates priorities or sorts lists
- Visual indicators appear automatically

### Transparency
- Algorithm is simple enough to explain
- User can see urgency scores if desired
- No "black box" magic - all logic is visible

### Flexibility Without Complexity
- Unlimited task nesting without forcing it
- Optional deadlines - not all tasks need them
- Fibonacci priority forces meaningful choices without overthinking

### Single Source of Truth
- All tasks in one list, auto-sorted
- No duplicate tracking in multiple tools
- No syncing between views - one data model

## Technical Implementation Notes

### Spreadsheet Platform

**Recommended: Google Sheets or Excel**

**Why spreadsheet:**
- Zero learning curve for basic users
- Formulas provide automation without coding
- Easy to customize and extend
- No installation or deployment
- Built-in backup and version history (Google Sheets)
- Can export/import data easily

**Alternative: Custom web app**
- Consider if formulas become too complex
- Consider if multiple users need to share tasks
- Consider if mobile app is essential

### Formula Complexity Management

**Challenge:** Nested calculations and tree traversal can create complex formulas.

**Strategies:**
- Use helper columns for intermediate calculations
- Break complex formulas into steps
- Consider Apps Script (Google) or VBA (Excel) for recursion
- Document formulas with comments

### Data Structure

**Recommended: Separate tabs (sheets) for each entity**
- Goals (one row per goal)
- Projects (one row per project)
- Tasks (one row per task)
- Settings (key-value pairs)
- Today's List (filtered view of Tasks)

**Relationships via ID columns:**
- Projects.Goal_ID references Goals.ID
- Tasks.Project_ID references Projects.ID
- Tasks.Parent_Task_ID references Tasks.ID

### Future Enhancements (Not in V1)

**Phase 2 possibilities:**
- Repeating tasks (daily, weekly)
- Budget tracking per project
- Time tracking (actual vs. estimated hours)
- Mobile companion app for checking off tasks
- Sync with calendar for time blocking
- Historical analytics (velocity, accuracy)
- Per-project cadence overrides
- Working days configuration (skip weekends)

**Explicitly out of scope:**
- Team collaboration (assignments, sharing)
- Complex workflows (review, approval)
- Integration with external tools
- AI-powered suggestions
- Notifications and reminders

## Success Metrics

**The system succeeds if:**
1. User can enter a new goal and break it down in <5 minutes
2. User checks Today's List once daily and knows what to work on
3. No deadlines are missed (or user is warned in advance)
4. High-priority work happens before low-priority work
5. User spends <10 minutes per week maintaining the system

**The system fails if:**
- User avoids opening it (too complex or overwhelming)
- Tasks fall through the cracks despite being in the system
- Manual priority shuffling becomes necessary
- Required fields create friction for quick entry
- "Keeping the system updated" becomes a significant task itself

## Companion Guide

**Separate from the tool:** A document providing methodology and best practices.

**Contents:**
- How to identify meaningful goals (life categories framework)
- How to apply SMART criteria
- How to break goals into projects and tasks
- How to estimate time realistically
- How to set Fibonacci priorities (what makes something a 13 vs. 21?)
- How to identify true milestones with deadlines
- Example goal breakdowns for common patterns (learning, building, planning)
- Weekly review template
- Troubleshooting (what if everything is high priority? what if nothing has deadlines?)

**Design principle:** The guide teaches you to think clearly about your work. The tool helps you execute on that clarity.

## Appendix: Example Data Set

### Goals
```
G1 | Read 12 classic novels in 2025 | Priority: 5  | Target: 2025-12-31
G2 | Maintain clean, organized home  | Priority: 8  | Target: -
G3 | Earn AWS Solutions Architect    | Priority: 21 | Target: 2025-06-30
G4 | Stay healthy and active         | Priority: 13 | Target: -
G5 | Plan amazing Japan trip         | Priority: 8  | Target: 2025-08-15
```

### Projects
```
P1  | Reading list              | Goal: G1 | Priority: 5  | Due: -
P2  | Daily housekeeping        | Goal: G2 | Priority: 8  | Due: -
P3  | Weekly deep cleaning      | Goal: G2 | Priority: 3  | Due: -
P4  | AWS study plan            | Goal: G3 | Priority: 13 | Due: 2025-06-15
P5  | Practice exam prep        | Goal: G3 | Priority: 8  | Due: 2025-06-01
P6  | Running program           | Goal: G4 | Priority: 8  | Due: -
P7  | Meal prep system          | Goal: G4 | Priority: 5  | Due: -
P8  | Japan itinerary planning  | Goal: G5 | Priority: 8  | Due: 2025-06-01
P9  | Japan logistics           | Goal: G5 | Priority: 5  | Due: -
```

### Tasks (subset showing hierarchy)
```
T1  | Read Moby Dick                | P1  | -   | Sort: 1 | 2h  | Due: 2025-02-01
T2  | Read Pride and Prejudice      | P1  | -   | Sort: 2 | 2h  | Due: 2025-03-01

T3  | Pass AWS exam                 | P4  | -   | Sort: 1 | -   | Due: 2025-06-15
T4  | Study compute services        | P4  | T3  | Sort: 1 | -   | Due: -
T5  | Learn EC2 fundamentals        | P4  | T4  | Sort: 1 | 2h  | Due: -
T6  | Learn Lambda functions        | P4  | T4  | Sort: 2 | 2h  | Due: -
T7  | Study storage services        | P4  | T3  | Sort: 2 | -   | Due: -
T8  | Learn S3 fundamentals         | P4  | T7  | Sort: 1 | 2h  | Due: -
T9  | Learn EBS and EFS             | P4  | T7  | Sort: 2 | 2h  | Due: -

T10 | Practice exam 1               | P5  | -   | Sort: 1 | 2h  | Due: 2025-05-15
T11 | Practice exam 2               | P5  | -   | Sort: 2 | 2h  | Due: 2025-06-01

T12 | Plan Japan itinerary          | P8  | -   | Sort: 1 | -   | Due: 2025-06-01
T13 | Research Tokyo neighborhoods  | P8  | T12 | Sort: 1 | 2h  | Due: -
T14 | Research Kyoto attractions    | P8  | T12 | Sort: 2 | 2h  | Due: -
T15 | Create day-by-day schedule    | P8  | T12 | Sort: 3 | 2h  | Due: -

T16 | Book Japan flights            | P9  | -   | Sort: 1 | 2h  | Due: 2025-06-15
T17 | Book hotels                   | P9  | -   | Sort: 2 | 2h  | Due: -
```

### Today's List (auto-generated, assuming today is 2025-01-06)
```
SCORE | TASK                          | PARENT              | PROJECT | HRS | DUE     | STATUS
------|-------------------------------|---------------------|---------|-----|---------|-------
360   | Learn EC2 fundamentals        | Study compute       | AWS     | 2   | -       | 🟢
360   | Learn Lambda functions        | Study compute       | AWS     | 2   | -       | 🟢
155   | Read Moby Dick                | -                   | Reading | 2   | Feb 1   | 🟢
145   | Research Tokyo neighborhoods  | Plan itinerary      | Japan   | 2   | -       | 🟢
130   | Daily housekeeping tasks      | -                   | Home    | 1   | -       | ⚪
130   | Running program               | -                   | Health  | 1   | -       | ⚪
```

User works top to bottom. AWS tasks are highest priority due to goal priority 21 + project priority 13 = 340 base. Reading is next due to approaching deadline. Everything else follows priority order.

---

## Conclusion

This system provides the minimum viable structure to manage multiple goals and projects without sacrificing clarity or adding unnecessary complexity. It automates what computers do well (sorting, calculating deadlines) while keeping human judgment where it belongs (defining goals, setting priorities, breaking down work).

The developer implementing this system should focus on:
1. Clean data model with proper relationships
2. Reliable urgency calculation formula
3. Intuitive task entry workflow
4. Clear visual hierarchy in Today's List
5. Automatic updates when tasks complete

Everything else is secondary to getting these five elements right.
