# Player Visibility Detection and Away State Implementation

## Objective
Detect when players switch away from the browser tab/window and notify the host app in real-time, so the host can mark teams as "away" (using the same grey color as disconnected).

## Current State
- **Player App**: No visibility/focus detection implemented
  - No `document.visibilitychange`, `blur`, or `focus` event listeners
  - No logging for tab switches or window minimize/restore
  - WebSocket manages connection state only
  
- **Host App**: Already has disconnect detection (greyed out teams)
  - Uses `disconnected` flag in team state (QuizHost.tsx)
  - LeftSidebar already styled for disconnected teams (grey color #6b7280)
  - PLAYER_DISCONNECT handler exists

## Recommended Approach

### Two-Part Implementation

#### Part 1: Player App (src-player/src/App.tsx)
Add visibility change detection that:
1. Listens for `document.visibilitychange` events (browser tab hidden/visible)
2. Listens for `window.focus` and `window.blur` events (window focus lost/regained)
3. Logs visibility state changes with timestamps
4. Sends `PLAYER_AWAY` message when visibility changes to hidden OR blur occurs
5. Sends `PLAYER_ACTIVE` message when visibility changes to visible AND focus is regained

**Details:**
- Add event listeners in useEffect hook (similar to how WebSocket is managed)
- Debounce/throttle messages to prevent flooding (100ms debounce on blur/focus, none needed on visibilitychange since it's already batched)
- Log format: `[Player Visibility] Tab HIDDEN | Event: ${event.type} | Timestamp: ${Date.now()}`
- Only send messages if WebSocket is open (isConnected)
- Clean up event listeners on unmount
- Track visibility state in a ref to avoid duplicate messages

**New Message Types:**
- `PLAYER_AWAY`: { type, deviceId, playerId, teamName, timestamp, reason: 'tab_hidden' | 'focus_lost' }
- `PLAYER_ACTIVE`: { type, deviceId, playerId, teamName, timestamp, reason: 'tab_visible' | 'focus_gained' }

#### Part 2: Host App (src/components/QuizHost.tsx)
Update disconnect detection to handle away state:
1. Add handlers for `PLAYER_AWAY` messages
2. Add handlers for `PLAYER_ACTIVE` messages
3. Reuse existing `disconnected` flag for away state (same styling)
4. Log visibility changes on host side

**Details:**
- When `PLAYER_AWAY` received: Set `disconnected: true` (marks team as grey)
- When `PLAYER_ACTIVE` received: Set `disconnected: false` (restores normal team color/state)
- Both messages preserve all team data (name, score, etc.) - no data loss
- Log format: `[QuizHost] Player ${teamName} is AWAY | Reason: ${reason}`

### Key Design Decisions

1. **Reuse `disconnected` flag** instead of creating new `away` state
   - Simplifies UI (already styled for grey appearance)
   - Semantically "away" players look the same as disconnected (as requested)
   - No need to modify LeftSidebar component
   - Teams automatically go grey on tab switch

2. **Message flow:**
   ```
   Player switches tab
   → document.visibilitychange fires
   → Player sends PLAYER_AWAY
   → Host receives PLAYER_AWAY
   → Host sets disconnected: true
   → Team appears grey in LeftSidebar
   ```

3. **Recovery flow:**
   ```
   Player returns to tab
   → document.visibilitychange fires
   → Player sends PLAYER_ACTIVE
   → Host receives PLAYER_ACTIVE
   → Host sets disconnected: false
   → Team returns to normal appearance
   → UI state restores (color, points, etc.)
   ```

4. **Logging Strategy (Basic level)**
   - Player app: Log visibility changes with event type and timestamp
   - Host app: Log away/active state changes with reason
   - No accumulated idle time tracking (just binary on/off)
   - No extra network overhead (only 1-2 small messages per visibility change)

## Files to Modify

### 1. src-player/src/App.tsx (PRIMARY)
**What to add:**
- `useEffect` hook for visibility/focus detection (add near WebSocket useEffect)
- Event listeners: `visibilitychange`, `focus`, `blur`
- Debounce logic for focus/blur events
- New `sendMessage` calls with `PLAYER_AWAY`/`PLAYER_ACTIVE` types
- Logging for visibility changes
- Cleanup event listeners

**Estimated changes:** ~40-60 lines

### 2. src/components/QuizHost.tsx (SECONDARY)
**What to add:**
- New `useEffect` hook for `PLAYER_AWAY` message handling
- New `useEffect` hook for `PLAYER_ACTIVE` message handling
- Handler functions that set `disconnected: true/false`
- Logging for away state changes
- Reuse existing `onNetworkMessage` pattern

**Estimated changes:** ~30-40 lines

### 3. LeftSidebar.tsx (NO CHANGES NEEDED)
- Already handles `disconnected` flag and shows grey color
- No modifications required

## Implementation Notes

- **No backend changes needed** - Server just forwards PLAYER_AWAY/PLAYER_ACTIVE messages to other clients
- **No database/persistence needed** - Away state is transient (resets on page reload)
- **Low network overhead** - Only 1-2 messages per tab switch event (rare)
- **Backward compatible** - Teams without visibility messages work as before
- **Graceful degradation** - If player doesn't send visibility messages, host sees team as normally active (no false positives)

## Testing Checklist

1. Player app logging appears when:
   - Tab is hidden (alt+tab away)
   - Tab is made visible again
   - Window loses focus
   - Window regains focus
   - Browser is minimized/restored

2. Host app receives messages and:
   - Team turns grey when PLAYER_AWAY received
   - Team color restores when PLAYER_ACTIVE received
   - Score/points preserved through away/active cycles
   - Multiple away/active transitions work correctly

3. Log output format is consistent and readable

## Expected Outcome

- Players switching tabs immediately causes their team to grey out on host
- Players returning to tab immediately causes team to restore to normal state
- All data (name, score, points) is preserved during away periods
- Clear logging on both player and host showing when visibility changes occur
- No impact on existing disconnect detection (both mechanisms coexist)
