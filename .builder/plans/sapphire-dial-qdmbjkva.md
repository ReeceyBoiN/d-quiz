# Fix Unreliable Team Disconnection Detection

## Problem Summary
When a player navigates away from the app (switches tabs, minimizes window), the PLAYER_AWAY message should be sent immediately to the host so the team appears grey. Currently, these messages are sent but unreliably, causing the host not to update the team's visual state consistently.

## Root Causes
1. **Duplicate/conflicting event handlers**: `visibilitychange` event is NOT debounced while `focus`/`blur` events are debounced. Both can fire in quick succession, causing multiple messages or message conflicts.
2. **Message loss on disconnection**: If WebSocket is not OPEN when visibility changes, the message is silently dropped with no retry or queue.
3. **Type mismatch**: `PLAYER_AWAY`/`PLAYER_ACTIVE` messages aren't defined in the `ClientMessage` type union (src-player/src/types/network.ts), creating potential contract issues.
4. **No message coalescing**: No mechanism to prevent duplicate or rapid-fire messages within a short window.

## Current Implementation (Working Parts)
- ✅ Host has visual styling ready (grey background, opacity-60, WifiOff icon)
- ✅ Host handlers for PLAYER_DISCONNECT/PLAYER_AWAY/PLAYER_ACTIVE network messages exist
- ✅ Player app detects visibility/focus changes via `visibilitychange`, `focus`, `blur` events
- ✅ Player app constructs and sends PLAYER_AWAY/PLAYER_ACTIVE messages with correct payload

## Recommended Fix Approach

### Step 1: Debounce and Coalesce Visibility Events (src-player/src/App.tsx)
- Add a centralized `sendVisibilityMessage` state tracker with `lastSentState` and `lastSentTime`
- Debounce `visibilitychange` event (add 100ms debounce similar to focus/blur)
- Add a "last state" check: only send if the away/active state differs from last sent AND sufficient time has passed (e.g., 500ms)
- This prevents duplicate PLAYER_AWAY or PLAYER_ACTIVE messages firing in rapid succession

### Step 2: Add Message Queuing for Failed Sends (src-player/src/App.tsx)
- Create a simple message queue for visibility messages
- If WebSocket is not OPEN when visibility changes, queue the message
- On WebSocket reconnect or opening, check queue and send any pending visibility messages
- Clear queue once messages are sent successfully

### Step 3: Fix Type Definitions (src-player/src/types/network.ts)
- Add `PlayerAwayMessage` and `PlayerActiveMessage` interfaces to match the actual messages being sent
- Add these types to the `ClientMessage` union type
- This ensures TypeScript type-checking works correctly and documents the protocol

### Step 4: Verify Message Delivery (src-player/src/App.tsx)
- Add console logging (if not already present) to track when messages are sent, queued, or dropped
- Log the state changes to help debug if issues persist

## Files That Need Modification
1. **src-player/src/App.tsx** (HIGH PRIORITY)
   - Lines with `sendVisibilityMessage` and event handlers
   - Add debouncing for visibilitychange
   - Add state tracking for lastSentState and lastSentTime
   - Implement message queue for visibility messages on failed sends

2. **src-player/src/types/network.ts** (MEDIUM PRIORITY)
   - Add PlayerAwayMessage and PlayerActiveMessage type definitions
   - Add to ClientMessage union

3. **src-player/src/hooks/useNetworkConnection.ts** (MEDIUM PRIORITY)
   - Ensure reconnection callback notifies App component to retry queued visibility messages
   - May already work via existing onConnect callback, but verify

## Expected Outcome
- When a player switches tabs or minimizes the window, a single PLAYER_AWAY message will be sent reliably
- Host will receive the message and immediately show the team as grey
- When player returns focus, a single PLAYER_ACTIVE message will be sent reliably
- Host will immediately restore the team's normal appearance
- No duplicate or lost messages due to event flooding or WebSocket timing issues

## Testing Strategy
1. Open player app on a device
2. Connect a team (should see in host list)
3. Switch tabs on player device (console should show PLAYER_AWAY sent)
4. Verify team appears grey on host within 1-2 seconds
5. Return focus to player tab (console should show PLAYER_ACTIVE sent)
6. Verify team returns to normal appearance on host
7. Test rapid tab switching to ensure no message flooding or duplicate states
