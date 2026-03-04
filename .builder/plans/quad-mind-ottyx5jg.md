# Fix: Team Window Should Preserve Quiz State (Overlay Approach)

## Audit Result: Already Fully Implemented

After a thorough review of `src/components/QuizHost.tsx`, **all elements of the overlay approach are already in place**. No code changes are needed.

### What was checked:

#### 1. `renderTabContent()` (lines 6169-6526) ✅
- **No early return for `selectedTeamForWindow`** — the function goes straight to checking game mode flags (`showBuzzInMode`, `showQuizPackDisplay`, `showKeypadInterface`, etc.)
- Game mode components are always rendered based on their own flags, regardless of team window state

#### 2. JSX Layout — Overlay Structure (lines 6633-6667) ✅
- Content area has `relative` positioning on parent div (line 6633)
- Tab content wrapped with `invisible` CSS class when team window is open (line 6635) — uses `visibility: hidden` so components stay mounted and maintain layout/state
- TeamWindow rendered as an absolute overlay with `z-40`, `inset-0`, and `bg-background` (lines 6640-6666)
- TeamWindow finds team data inline via `quizzes.find()` (line 6641)

#### 3. `handleCloseTeamWindow()` (lines 5824-5832) ✅
- Only clears `selectedTeamForWindow` to `null` and closes bottom nav popups
- **No game state resets** — no flowState changes, no timer resets, no screen position changes

#### 4. No side-effect hooks on `selectedTeamForWindow` ✅
- Grep confirmed no `useEffect` hooks depend on `selectedTeamForWindow`
- No dependency arrays include it
- Closing team window triggers no cascading state changes

#### 5. `handleTeamDoubleClick()` (line 5819-5821) ✅
- Simply sets `setSelectedTeamForWindow(teamId)` — no other state mutations

### Summary
All five aspects of the overlay approach are correctly implemented:
1. No early return in `renderTabContent()` for team window
2. `invisible` class hides content visually while keeping components mounted
3. TeamWindow renders as absolute overlay on top
4. Close handler only clears team window state, no game resets
5. No useEffect side-effects tied to `selectedTeamForWindow`

**No changes required.**
