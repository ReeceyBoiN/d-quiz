# Waiting Room PIN Feature — Stability Audit & Fixes

## Audit Summary

Three areas were investigated in depth: host-side state management & crash recovery, backend networking & message ordering, and player-side screen transitions & reconnection. Below are the issues found, ranked by severity, followed by the implementation plan to fix them.

---

## Issues Found

### 1. CRITICAL — `pin-entry` screen not protected from host message transitions

**Problem:** The player's `shouldIgnoreScreenTransition()` only protects the `buzzer-selection` screen. While a player is on the `pin-entry` screen, any host message (QUESTION, NEXT, END_ROUND, TIMER_START, DISPLAY_MODE, FLOW_STATE, PICTURE) can yank the player away to a different screen — before they've entered the PIN. This completely breaks the PIN gate.

**Fix:** Add `'pin-entry'` to the protected screens in `shouldIgnoreScreenTransition()` and ensure pending messages are buffered the same way they are for `buzzer-selection`.

**File:** `src-player/src/App.tsx` — `shouldIgnoreScreenTransition` function (~line 114)

---

### 2. CRITICAL — Buzzer selection skipped after PIN approval

**Problem:** When TEAM_APPROVED arrives while the player is on `pin-entry`, the TEAM_APPROVED handler transitions them to `approval` → `display`, completely skipping buzzer selection. The handler has special logic for `buzzer-selection` (stay on that screen), but no equivalent for `pin-entry`.

**Fix:** In the TEAM_APPROVED handler, when `currentScreen === 'pin-entry'`, transition to `buzzer-selection` instead of `approval`. This matches the intended flow: Team Name → PIN → Buzzer → Waiting/Display.

**File:** `src-player/src/App.tsx` — TEAM_APPROVED case (~line 566)

---

### 3. MEDIUM — WiFi drop during PIN entry leaves player stuck

**Problem:** The auto-rejoin effect only fires when `isApproved === true`. A player on `pin-entry` (not yet approved) who loses WiFi will reconnect (WebSocket hook auto-reconnects) but won't re-send PLAYER_JOIN. They'll be stuck on the `pin-entry` screen with a dead session — the host doesn't know they reconnected.

**Fix:** Extend the auto-rejoin effect to also handle `currentScreen === 'pin-entry'`: re-send PLAYER_JOIN so the host can re-send PIN_REQUIRED. The player stays on pin-entry and can re-enter the PIN.

**File:** `src-player/src/App.tsx` — auto-rejoin useEffect (~line 1039)

---

### 4. MEDIUM — `sendMessageToPlayer` stale closure risk

**Problem:** `sendMessageToPlayer` is defined as a regular function in the component body (not memoized). `handleNetworkPlayerJoin` is created with `useCallback([], ...)` (stable, never re-created), so it captures the very first render's `sendMessageToPlayer`. While this works in Electron (IPC path doesn't need hostInfo), the HTTP fallback reads `hostInfo?.baseUrl` from a potentially stale closure.

**Fix:** Convert `sendMessageToPlayer` to use a ref for the base URL (the existing `hostInfoBaseUrlRef` pattern already used for other handlers), and wrap it in `useCallback` to make it stable.

**File:** `src/components/QuizHost.tsx` — `sendMessageToPlayer` definition (~line 544)

---

### 5. MEDIUM — No feedback to player when put in pending approval after PIN

**Problem:** When a quiz is in progress and a new team passes the PIN check, the host puts them into `pendingTeams` for manual approval. However, no `APPROVAL_PENDING` message is sent to the player — they stay on `pin-entry` with no indication that they're waiting for host approval. (Note: `APPROVAL_PENDING` is defined in player types and handled in App.tsx, but never sent by the host.)

**Fix:** After adding a team to `pendingTeams` in `handleNetworkPlayerJoin`, send an `APPROVAL_PENDING` message to the player device so they see the waiting screen.

**File:** `src/components/QuizHost.tsx` — pending teams branch in `handleNetworkPlayerJoin` (~line 3480)

---

### 6. LOW — pinError/welcomeMessage state not cleared on screen transitions

**Problem:** `pinError` and `welcomeMessage` persist in state even after the player leaves `pin-entry`. If they return to `pin-entry` later (unlikely but possible), stale error/message could show.

**Fix:** Add a small useEffect that clears both when `currentScreen` changes away from `pin-entry`.

**File:** `src-player/src/App.tsx`

---

### 7. LOW — authorizedDeviceIds grows unbounded

**Problem:** The `authorizedDeviceIds` Set only grows (on PIN success) and only clears on Empty Lobby. In long-running installations with many sessions, this could accumulate device IDs. Not a real-world concern for typical quiz sessions.

**Fix:** No code change needed. Document that Empty Lobby is the reset mechanism. Optionally prune on team removal.

---

## Implementation Plan

### Step 1: Protect `pin-entry` from screen transitions (CRITICAL)

In `src-player/src/App.tsx`:

- Update `shouldIgnoreScreenTransition` to also return `true` when `currentScreenState === 'pin-entry'`
- This automatically protects pin-entry from QUESTION, NEXT, END_ROUND, PICTURE, DISPLAY_MODE, FLOW_STATE, and APPROVAL_PENDING messages (they all call this function before transitioning)
- Buffered messages will be processed after PIN success when the screen transitions to buzzer-selection/approval

### Step 2: Route to buzzer-selection after TEAM_APPROVED from pin-entry (CRITICAL)

In `src-player/src/App.tsx`, in the TEAM_APPROVED handler:

- Add a check: if `currentScreen === 'pin-entry'`, treat it like arriving fresh — transition to `buzzer-selection` rather than `approval`
- Store the displayData as `pendingApprovalData` so it can be applied after buzzer is selected (same pattern used for buzzer-selection)
- This restores the intended flow: Team Name → PIN → Buzzer Selection → Waiting/Display

### Step 3: Auto-rejoin on WiFi reconnect during pin-entry (MEDIUM)

In `src-player/src/App.tsx`, in the auto-rejoin useEffect:

- Add a second condition branch: if `isConnected && teamName && currentScreen === 'pin-entry'` and WebSocket is open, re-send PLAYER_JOIN
- This triggers the host to re-send PIN_REQUIRED, and the player stays on pin-entry to re-enter the PIN
- Don't require `isApproved` for this branch since the player hasn't been approved yet

### Step 4: Stabilize `sendMessageToPlayer` (MEDIUM)

In `src/components/QuizHost.tsx`:

- `hostInfoBaseUrlRef` already exists and is kept in sync. Use it inside `sendMessageToPlayer` instead of reading `hostInfo?.baseUrl` directly
- Wrap `sendMessageToPlayer` in `useCallback` with `[]` deps so it's stable across renders
- This eliminates the stale closure risk when called from stable handlers

### Step 5: Send APPROVAL_PENDING to player after pending + PIN (MEDIUM)

In `src/components/QuizHost.tsx`, in `handleNetworkPlayerJoin`:

- After adding a team to `pendingTeams` (the quiz-in-progress branch), send `APPROVAL_PENDING` to the player via `sendMessageToPlayer`
- The player's existing `APPROVAL_PENDING` handler will transition them from `pin-entry` to `approval` (waiting screen)
- Note: `shouldIgnoreScreenTransition` will now protect `pin-entry` (Step 1), so we need to ensure this specific APPROVAL_PENDING is handled — since it's sent after PIN is validated (not during), the screen will be `pin-entry` only briefly. We should send it right after the setPendingTeams call, and the player handler will transition to approval screen. Since the player has already passed PIN at this point (handlePinSubmit re-called handleNetworkPlayerJoin), pin-entry protection should not block APPROVAL_PENDING — actually it will block it because shouldIgnoreScreenTransition checks currentScreen. 

**Revised approach:** Instead of relying on APPROVAL_PENDING message, handle this in the PIN_RESULT success path on the player side. When PIN_RESULT success arrives and the host puts the team in pending (no TEAM_APPROVED comes immediately), the player should show the approval/waiting screen. We can do this by having PIN_RESULT success transition the player to `approval` screen directly, and then TEAM_APPROVED will arrive later when the host manually approves. If the host auto-approves instead, TEAM_APPROVED arrives quickly and the buzzer-selection logic from Step 2 kicks in.

**Final approach for Step 5:** On PIN_RESULT success, transition player to `approval` screen (waiting). Then:
- If auto-approved: TEAM_APPROVED arrives → Step 2 routes to buzzer-selection
- If pending: player sees the waiting screen until host manually approves
- This is simpler and doesn't require sending new messages

### Step 6: Clear pinError/welcomeMessage on screen change (LOW)

In `src-player/src/App.tsx`:

- Add a useEffect that clears `pinError` and `welcomeMessage` when `currentScreen` changes away from `pin-entry`

---

## Files Modified (Summary)

| File | Changes |
|------|---------|
| `src-player/src/App.tsx` | Protect `pin-entry` in `shouldIgnoreScreenTransition`; route TEAM_APPROVED from pin-entry to buzzer-selection; auto-rejoin during pin-entry; PIN_RESULT success → approval screen; clear stale PIN state |
| `src/components/QuizHost.tsx` | Stabilize `sendMessageToPlayer` with useCallback + hostInfoBaseUrlRef |

## Verification Checklist

After implementation, verify these scenarios work correctly:

- [ ] Player enters team name → sees PIN screen → enters correct PIN → goes to buzzer selection → selects buzzer → sees waiting/display
- [ ] Player enters wrong PIN → sees error → can retry
- [ ] Player on PIN screen when host sends QUESTION/NEXT/END_ROUND → stays on PIN screen, messages buffered
- [ ] Player on PIN screen when WiFi drops → WebSocket reconnects → re-sends PLAYER_JOIN → sees PIN screen again
- [ ] Host crashes and restarts → players with existing teams reconnect without PIN (existingTeam bypass)
- [ ] Empty Lobby clears authorized devices → all players need PIN again
- [ ] Player changes buzzer via Settings after approval → no PIN re-trigger
- [ ] Quiz in progress → new team enters PIN → goes to waiting for host approval → host approves → buzzer selection
- [ ] PIN disabled → normal flow unchanged, welcome message still shows on waiting screen
- [ ] Display mode changes (basic → slideshow → scores) while player on PIN screen → no screen change, applied later
