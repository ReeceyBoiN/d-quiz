# Crash Protection & Auto-Session Persistence

## Problem Statement
The quiz host application currently has no automatic session recovery. If the host app crashes or the laptop battery dies, all team data (names, photos, points, buzzers, colors, etc.) is lost. Users must manually recreate the entire lobby.

## Current State
- **Persistence infrastructure exists**: `src/utils/gameStatePersistence.ts` has `saveGameState()`, `loadGameState()`, and `clearGameState()` functions fully implemented using Electron IPC
- **Clear function works**: `handleEmptyLobby()` in QuizHost correctly calls `clearGameState()` to wipe saved state
- **No auto-save**: The codebase never calls `saveGameState()` or `loadGameState()` except for the clear operation
- **No auto-load on startup**: QuizHost component mount does not restore from saved state

## Team Data Structure (Quiz interface)
Properties that need to persist:
- `id` - unique team identifier
- `name` - team name
- `score` - current team points
- `photoUrl` - team photo (base64 or file path)
- `buzzerSound` - selected buzzer audio identifier
- `backgroundColor` - team display color
- `location` - optional grid position {x, y}
- `scrambled` - keypad scrambled status (boolean)
- `blocked` - team blocked from earning points (boolean)

Additional round state to restore:
- Round-specific scores (currentRoundPoints, currentRoundSpeedBonus, currentRoundWinnerPoints)
- Game mode settings (evilModeEnabled, punishmentEnabled, goWideEnabled, staggeredEnabled)
- Current question index (if mid-quiz)
- Question history with response data

## Recommended Implementation Approach

### Phase 1: Auto-Load on Startup (QuizHost Mount)
**File**: `src/components/QuizHost.tsx`

On component mount, before any other initialization:
1. Call `loadGameState()` to retrieve saved state (if it exists)
2. Validate the saved state:
   - Check timestamp to avoid loading stale sessions (e.g., sessions older than 7 days)
   - Verify schema version matches current app version
3. If valid:
   - Restore `quizzes` array from saved team data
   - Restore round settings (currentRoundPoints, currentRoundSpeedBonus, currentRoundWinnerPoints)
   - Restore currentQuestionIndex if mid-quiz
4. If invalid or missing:
   - Start with empty quizzes array (normal behavior)

**Implementation pattern**:
- Add a new `useEffect` hook that runs once on mount (empty dependency array)
- Place this effect early in the component, before WebSocket connection setup
- Load state asynchronously and update quizzes/round settings via setState
- Add console logging for debugging

### Phase 2: Periodic Auto-Save (Every 30 Seconds)
**File**: `src/components/QuizHost.tsx`

Implement efficient auto-save with debouncing:
1. Create a debounced save function that:
   - Calls `createGameStateSnapshot(quizzes, roundSettings, questionHistory, currentQuestionIndex)`
   - Calls `saveGameState(snapshot)` to persist to disk
   - Logs success/error for debugging
2. Trigger saves at two points:
   - **After team roster changes**: Add debounced save (2-3 second delay) after any `setQuizzes()` call (team added, deleted, score updated, buzzer assigned, photo uploaded, name changed)
   - **Periodic saves**: Use `setInterval` to save state every 30 seconds continuously (whether idle or active)
3. Restore scope (simplified):
   - Only restore team roster data (id, name, score, photoUrl, buzzerSound, backgroundColor)
   - Do NOT restore per-team question responses, answer counts, or response times
   - Clear question-specific transient state on load; let fresh question start fresh
4. Always restore without age checks:
   - No timestamp validation; restore any saved state that exists
   - Simpler recovery flow

**Why this is efficient**:
- Debouncing coalesces rapid team mutations into single saves
- Periodic saves ensure data is written even during active gameplay
- Saves are incremental (only snapshot current state, not whole game history)
- File size remains small (~50-100KB for typical quiz with 20 teams)

### Phase 3: Clear Saved State on Empty Lobby
**File**: `src/components/QuizHost.tsx` - `handleEmptyLobby()` function

**Status**: Already implemented correctly
- `handleEmptyLobby()` already calls `clearGameState()` which wipes the saved file
- When user clicks "Empty Lobby", the save file is deleted and app starts fresh
- No changes needed here

### Phase 4: Extend SavedGameState (Optional Enhancement)
**File**: `src/utils/gameStatePersistence.ts`

**Status**: No changes required for current scope

Current SavedTeamData already includes: id, name, score, photoUrl, buzzSound, backgroundColor

**Future enhancement possibilities** (not in current scope):
- `location` (team grid position if using spatial display)
- `scrambled` (keypad scramble status)
- `blocked` (team blocking status)

These are optional and can be added in a future update if needed. The current SavedTeamData structure is sufficient for full team roster recovery.

## Key Files to Modify

1. **`src/components/QuizHost.tsx`** (PRIMARY - 100% of work)
   - Add `useEffect` hook for auto-load on mount (early in effect list)
   - Create debounced save function using `useCallback` + `useRef` for debounce timer
   - Trigger debounced save after every `setQuizzes()` call (team added, deleted, score changed, buzzer/photo/name updated)
   - Add periodic save interval via `setInterval` in a separate `useEffect` (30-second saves)
   - Proper cleanup of intervals and debounce timers on unmount
   - Console logging for debugging (auto-load success, periodic save success, errors)

2. **`src/utils/gameStatePersistence.ts`** (NO CHANGES)
   - Already has all needed functionality
   - Verify existing schema version logic is present (should be already)

## Recovery Behavior

**On App Launch**:
- If saved state exists:
  - All teams, scores, team photos, buzzers, background colors are restored
  - Lobby looks exactly as it was before crash
  - Question-specific data (current question, team responses) is NOT restored; fresh quiz start
- If no saved state exists:
  - Normal fresh start with empty lobby

**During Normal Operation**:
- Every team change (add, delete, edit name/color/buzzer, upload photo, assign points) automatically saves within 2-3 seconds (debounced)
- Additionally, every 30 seconds the app saves the current state automatically (whether idle or active)
- User sees no UI changes - save is silent/automatic
- File size stays efficient (~50-100KB for typical 20-team lobby)

**On Empty Lobby**:
- Saved state file is cleared via `clearGameState()`
- Fresh quiz begins with no teams
- No saved data to restore on next launch (until new teams join)

## Safety & Edge Cases

1. **No age validation**: All saved states are restored regardless of age (simpler recovery)
2. **Schema versioning**: Check SavedGameState version matches app expectations; fall back to empty lobby if version mismatch
3. **Corrupted saves**: Gracefully fall back to empty lobby if load fails (try/catch block)
4. **Team photo recovery**: photoUrl is saved as data URL; ensure images can be decoded on restore
5. **Buzzer sound recovery**: buzzerSound saved as identifier; if buzzer no longer exists in system, buzzer resets to undefined
6. **Network reconnection**: After restore, WebSocket connection is re-established and players can rejoin with restored team names
7. **Question state**: Since question responses and timings are NOT restored, quiz can resume fresh from any question without stale data

## Implementation Complexity
- **Low to Medium**: The persistence API is already fully implemented; this is mainly wiring it into the QuizHost component lifecycle
- No new external dependencies needed
- Works in both Electron and browser modes (Electron IPC handles platform differences)

## Additional Requirements (Related to Crash Protection)

### Issue 1: External Display Window Not Closing with Host App
**Status**: Previous implementation (close event listener on main window) appears not working in practice
**Action needed**:
- Investigate why external window still stays open when host app closes
- May need to check if `externalWindow.isDestroyed()` check is working properly
- May need to ensure externalWindow reference is properly maintained in global scope
- Test both Electron and browser modes

### Requirement 2: Close Confirmation Dialog
**Context**: When user clicks X to close the host app, add a confirmation dialog
**Implementation**:
- Add BeforeUnload confirmation in `src/components/QuizHost.tsx` (browser mode)
- Add close event handler to mainWindow in `electron/main/windows.js` with dialog (Electron mode)
- Dialog should ask: "Are you sure you want to close the application?"
- If user confirms, close normally and trigger external display close
- If user cancels, app remains open
- This provides safety against accidental app closure and ensures data is saved before exit

## Verification Checklist
- [ ] Load QuizHost with teams, assign scores, upload photos
- [ ] Force close app (kill process or crash simulation)
- [ ] Relaunch app → verify all teams, photos, scores, buzzers are restored
- [ ] Continue quiz from restored state → verify gameplay works
- [ ] Click Empty Lobby → verify saved state is cleared
- [ ] Relaunch after Empty Lobby → verify starts with empty lobby
- [ ] Monitor file size of save file → confirm it stays reasonable (~50-100KB)
- [ ] Test auto-save during rapid team additions → verify debounce works (single save, not multiple)
- [ ] TEST: Close host app by clicking X → external display window should close automatically
- [ ] TEST: Close host app by clicking X → confirmation dialog appears before closing
- [ ] TEST: Cancel confirmation dialog → app stays open and external display remains open
- [ ] TEST: Confirm close → both host and external display windows close
