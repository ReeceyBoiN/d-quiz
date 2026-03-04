# Fix: Team Window Should Preserve Quiz State (Overlay Approach)

## Problem
When the host opens a team's details mid-question (during keypad mode, quiz pack mode, etc.) and then closes it, the quiz resets to the question selection or points configuration screen instead of returning to exactly where they were (e.g., mid-timer, post-reveal, etc.).

## Root Cause
In `QuizHost.tsx`, `renderTabContent()` uses **early returns** — when `selectedTeamForWindow` is set, it returns the `TeamWindow` component and nothing else. This means all game mode components (`KeypadInterface`, `QuestionPanel`, `BuzzInDisplay`, etc.) are **completely unmounted** from the DOM.

When TeamWindow is closed, those components **re-mount from scratch**, losing their internal state (current screen position, local UI state, internal refs). While some state is lifted to QuizHost (like `keypadCurrentScreen`, `flowState`), the components' internal state and mounted lifecycle are lost.

## Solution
Restructure the rendering in `renderTabContent()` so that TeamWindow is rendered as an **overlay on top of** the existing content, rather than **replacing** it. The game mode components stay mounted underneath (preserving all state), and TeamWindow sits on top with absolute positioning and a z-index.

**Key principle**: No UI changes — TeamWindow looks and behaves exactly the same visually. The only difference is that game mode components remain mounted (hidden) underneath.

## Implementation

### File: `src/components/QuizHost.tsx`

**Change 1: Modify `renderTabContent()` — Remove TeamWindow from the priority chain**

Remove the early-return block for `selectedTeamForWindow` at the top of `renderTabContent()` (lines ~6170-6196). The function should go straight to checking game mode flags and rendering the appropriate content.

**Change 2: Render TeamWindow as an overlay in the JSX layout**

In the main JSX layout (around line 6661 where `renderTabContent()` is called), wrap the content area and add a conditional TeamWindow overlay:

```tsx
<div className="flex-1 bg-background min-w-0 flex flex-col relative">
  {/* Always render the normal tab content - keeps game modes mounted */}
  <div className={selectedTeamForWindow ? "flex-1 flex flex-col invisible" : "flex-1 flex flex-col"}>
    {renderTabContent()}
  </div>
  
  {/* Team window overlay - renders on top without unmounting game content */}
  {selectedTeamForWindow && (() => {
    const team = quizzes.find(q => q.id === selectedTeamForWindow);
    if (!team) return null;
    return (
      <div className="absolute inset-0 z-40 bg-background overflow-auto">
        <TeamWindow ... />
      </div>
    );
  })()}
</div>
```

Using `invisible` (CSS `visibility: hidden`) instead of `hidden` (CSS `display: none`) ensures components stay mounted and maintain their layout/state without being visible. The TeamWindow overlay covers the full content area with `absolute inset-0`.

## What This Preserves
- Timer continues running (useTimer hook stays mounted, intervals keep ticking)
- FlowState stays unchanged (no resets)
- KeypadInterface internal state preserved (current screen, game state)
- QuestionPanel stays mounted with current question
- BuzzInDisplay, NearestWinsInterface, WheelSpinnerInterface all preserved
- External display and player devices unaffected (no state changes sent)

## Files Modified
- `src/components/QuizHost.tsx` — restructure `renderTabContent()` and the content area JSX (~2 areas changed)
