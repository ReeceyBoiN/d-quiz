# Audit: Music Round Button Logic & Integration Fixes

## Already Fixed (Previous Work)
- Home button now properly closes music round interface (`QuizHost.tsx:3266`)
- END ROUND button removed from bottom bar during music round (`BottomNavigation.tsx:1060`)

## Issues Found

### 1. Music round doesn't reset flowState on entry
**File:** `src/components/QuizHost.tsx` — `handleMusicRoundClick` (~line 3168)

**Problem:** When entering the music round, `closeAllGameModes()` is called but the `flowState` is NOT reset. If the user was in a game mode (keypad, buzz-in, etc.) before clicking Music Round, the player devices and host remote controller may still think a game is active (`isQuestionMode: true`, `flow: 'running'`, etc.).

Every other game mode either resets or sets flowState on entry. The home button handler also resets it. Music round is the only one that doesn't.

**Fix:** Add a flowState reset to `handleMusicRoundClick`, setting flow to `'idle'` and `isQuestionMode` to `false`, plus send that state to players via `sendFlowStateToPlayers`. This mirrors what `handleEndRound` and the home button handler do.

### 2. Music round doesn't reset external display on entry
**File:** `src/components/QuizHost.tsx` — `handleMusicRoundClick` (~line 3168)

**Problem:** If the external display was showing game content (a question, timer, nearest-wins results, etc.) from a previous round, entering music round leaves that stale content on screen. Other modes like `handleNearestWinsClick` explicitly call `handleExternalDisplayUpdate('basic')` to reset the external display. Music round doesn't.

**Fix:** Add `handleExternalDisplayUpdate('basic')` to `handleMusicRoundClick` so the external display reverts to the user's default view (basic/slideshow/scores) when entering the music round.

## Files to Modify

### `src/components/QuizHost.tsx`
In `handleMusicRoundClick` (line ~3168-3173), add:
1. Reset flowState to idle (matching what the home button does)
2. Send idle flowState to players so devices update
3. Call `handleExternalDisplayUpdate('basic')` to reset the external display

## Items Verified as Correct (No Changes Needed)
- **Bottom bar behavior:** `getCurrentGameMode()` returns `null` for music round, so the bottom bar shows home controls (Buzzers, Empty Lobby, Team Photos, etc.) instead of game scoring controls. This is correct — the music round is a file browser, not a scoring round.
- **Right panel:** Correctly hidden when `showMusicRoundInterface` is true (line 7014).
- **`closeAllGameModes()`:** Already includes `setShowMusicRoundInterface(false)` (line 1892).
- **Host controller:** Will receive the idle flowState after the fix, which is correct behavior.
- **Music round Close button:** Properly wired to `handleMusicRoundClose` which sets `activeTab("home")`.
- **Top navigation Home button:** Calls `handleTabChange("home")` which closes music round.
- **All other game mode buttons (RightPanel):** Each calls `closeAllGameModes()` first, which already closes music round if active.
