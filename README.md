# Personal Project Management

## Analysis

**Key Requirements:**
1. Three-entity data model (Goals → Projects → Tasks) with hierarchical tasks
2. Automatic prioritization algorithm with urgency scoring
3. Multiple views (Goals, Projects, Tasks tree, Today's List, Timeline)
4. Real-time calculations (slack, urgency scores, completion status)
5. Single user, minimal friction, works offline

**Build Options Considered:**

| Option | Pros | Cons |
|--------|------|------|
| **Google Sheets** | Zero setup, familiar, formulas work | Complex tree traversal is painful, limited UI, formula debugging nightmare |
| **Excel + VBA** | More powerful formulas, offline | Still awkward for hierarchies, VBA is fragile |
| **React Web App** | Full control, proper tree handling, great UX | Needs hosting, more complex |
| **React + Local Storage** | No backend needed, offline-capable | Data only on one device |

**Recommendation: React Single-Page App with Local Storage**

The spec explicitly calls out spreadsheets, but the hierarchical task structure with recursive calculations (parent completion from children, urgency inheritance) is genuinely painful in spreadsheet formulas. A React app will be:
- More maintainable
- Better UX (collapsible trees, drag-drop reordering)
- Cleaner algorithm implementation
- Still simple (no backend, no auth)

---

## Implementation Plan

### Phase 1: Core Data Model & Storage
**Goal:** Working data layer with persistence

- Define TypeScript interfaces for Goal, Project, Task, Settings
- Implement local storage persistence with auto-save
- Build CRUD operations for all entities
- Implement the tree structure utilities (get children, get ancestors, get leaves)
- Add sample data from the spec's appendix

### Phase 2: Prioritization Algorithm
**Goal:** Urgency scoring that matches spec exactly

- Implement base priority calculation (Goal + Project × 10)
- Implement deadline urgency boost (100/(1+slack) or 1000 if at-risk)
- Implement parent urgency inheritance (max child × 0.5)
- Build the sorted "Today's List" generator
- Add comprehensive tests against spec examples

### Phase 3: Core UI - Task Management
**Goal:** Usable task entry and viewing

- Goals tab: Simple table with Fibonacci priority selector
- Projects tab: Table grouped by goal
- Tasks tab: Indented tree view with collapse/expand
- Task creation modal with parent selection
- Done checkbox (leaf tasks only) with parent auto-completion

### Phase 4: Today's List View
**Goal:** The primary working interface

- Auto-sorted list by urgency score
- Status indicators (🔴🟡🟢⚪)
- Quick-complete checkboxes
- Show context (parent task, project, goal)
- "Focus mode" showing top N tasks

### Phase 5: Visual Polish & Timeline
**Goal:** Make it pleasant to use

- Color coding by urgency/priority
- Progress indicators on parent tasks
- Timeline view (horizontal, deadlines as markers)
- Responsive design for mobile checking-off
- Keyboard shortcuts for power users

### Phase 6: Settings & Export
**Goal:** Customization and data safety

- Daily cadence setting
- Export to JSON (backup)
- Import from JSON (restore/migrate)
- Clear visual theme

---

## Technical Stack

```
React 18 + TypeScript
Tailwind CSS (utility styling)
Zustand (simple state management)
date-fns (date calculations)
localStorage (persistence)
```

No backend, no build complexity beyond standard Vite setup.
