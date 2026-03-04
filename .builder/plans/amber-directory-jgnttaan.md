# Waiting Room PIN Access & Welcome Message Feature

## Overview

Add a 4-digit PIN gate to the player connection flow. When enabled by the host, players must enter the PIN **after** submitting their team name and **before** choosing their buzzer. A custom welcome message is always shown on the PIN/waiting screen regardless of whether PIN is enabled.

Devices that have already entered the PIN correctly in the current session bypass it on reconnect. The "Empty Lobby" function resets the authorized device list so a fresh session starts clean.

## Player Flow (with PIN enabled)

```
Team Name Entry → PLAYER_JOIN sent → Host responds with PIN_REQUIRED → Player sees PIN screen → Player sends PIN_SUBMIT → Host validates → PIN_RESULT (success/fail)
  → On success: proceed to Buzzer Selection (normal flow continues)
  → On fail: stay on PIN screen, show error, allow retry
```

**Without PIN enabled:** Flow unchanged, but the welcome message is still displayed on the WaitingScreen.

## Security Model

- PIN validation happens **only on the host side** — the player never receives the correct PIN
- Host responds with a simple success/fail result — no hints
- The player app never stores the PIN itself, only a "this device was authorized" flag from the host
- Authorized device tracking lives in host memory (not localStorage) so it's inherently session-scoped
- Empty Lobby clears the authorized device set

## Files to Modify

### 1. Host Settings UI — `src/components/Settings.tsx`

In `renderWaitingRoomSettings()` (line ~1139), add below the existing "Waiting Room Message" textarea:

- **Checkbox**: "Require PIN to Join" → maps to `settings.waitingRoomPinEnabled` (boolean)
- **4-digit PIN input**: Only visible when checkbox is checked → maps to `settings.waitingRoomPin` (string, 4 digits)
  - Input with `maxLength={4}`, `pattern="[0-9]*"`, numeric-only validation
  - Default: `"0000"` when first enabled

These settings are persisted via the existing `updateSetting()` → `localStorage('quizHostSettings')` mechanism (no new SettingsContext methods needed since these are read directly from settings state in QuizHost).

### 2. Network Message Types

**Host-side** — `src/network/types.ts`:
- Add to `HostMessageType`: `'PIN_REQUIRED'`, `'PIN_RESULT'`

**Player-side** — `src-player/src/types/network.ts`:
- Add to `HostMessageType`: `'PIN_REQUIRED'`, `'PIN_RESULT'`
- Add new interface `PinSubmitMessage` and add to `ClientMessage` union:
  ```ts
  interface PinSubmitMessage {
    type: 'PIN_SUBMIT';
    playerId: string;
    deviceId: string;
    teamName: string;
    pin: string;
    timestamp: number;
  }
  ```

**Host-side** — `src/network/types.ts`:
- Add `'PIN_SUBMIT'` to `PlayerMessageType`

### 3. Host Connection Handler — `src/components/QuizHost.tsx`

**New state:**
- `const [authorizedDeviceIds, setAuthorizedDeviceIds] = useState<Set<string>>(new Set());`
- A ref `authorizedDeviceIdsRef` to access latest value in callbacks

**Modify `handleNetworkPlayerJoin`** (line ~3297):
After the controller PIN check (line ~3359) and before the reconnection/new-team logic, add:

```
// Check if waiting room PIN is required
if (settings.waitingRoomPinEnabled && settings.waitingRoomPin) {
  // Skip PIN for already-authorized devices
  if (!authorizedDeviceIdsRef.current.has(deviceId)) {
    // Send PIN_REQUIRED to this player (with welcome message)
    sendMessageToPlayer(deviceId, 'PIN_REQUIRED', {
      message: settings.waitingRoomMessage || '',
    });
    return; // Don't process join until PIN is verified
  }
}
```

This uses the existing `sendControllerAuthToPlayer`-style pattern (IPC → HTTP fallback) via a new generic `sendMessageToPlayer` helper, or by reusing the existing send-to-player infrastructure.

**New handler for `PIN_SUBMIT`:**
Register a listener via `onNetworkMessage('PIN_SUBMIT', handlePinSubmit)`:

```
handlePinSubmit(data):
  - Extract { deviceId, pin, teamName, playerId }
  - If pin === settings.waitingRoomPin:
    - Add deviceId to authorizedDeviceIds set
    - Send PIN_RESULT { success: true } to player
    - Re-invoke handleNetworkPlayerJoin(data) to continue normal join flow
      (or directly process the join inline — team creation, auto-approve, etc.)
  - Else:
    - Send PIN_RESULT { success: false, message: "Incorrect PIN" } to player
```

**Modify `handleEmptyLobby`** (line ~5891):
Add: `setAuthorizedDeviceIds(new Set());` to clear the authorized device list.

**Include welcome message in join response:**
When PIN is NOT required, we still want the welcome message shown. Modify the existing flow so that when a team joins and `settings.waitingRoomMessage` exists, include it in the TEAM_APPROVED or a new message. However, since the WaitingScreen currently shows during buzzer selection and approval anyway, the simpler approach is:
- Send the welcome message as part of the PIN_REQUIRED response (when PIN enabled)
- When PIN is NOT enabled, the welcome message is already configurable via `settings.waitingRoomMessage` — we'll send it as part of a `WELCOME_MESSAGE` notification to newly joined players so the player app can display it on the WaitingScreen.

### 4. Player App — `src-player/src/App.tsx`

**New screen type:**
Add `'pin-entry'` to the `currentScreen` union type (line 45).

**New state:**
- `const [welcomeMessage, setWelcomeMessage] = useState<string>('');`

**Handle `PIN_REQUIRED` message:**
In the message handler switch:
```
case 'PIN_REQUIRED':
  setWelcomeMessage(message.data?.message || '');
  setCurrentScreen('pin-entry');
  break;
```

**Handle `PIN_RESULT` message:**
```
case 'PIN_RESULT':
  if (message.data?.success) {
    // PIN accepted — proceed to buzzer selection
    setCurrentScreen('buzzer-selection');
  } else {
    // PIN rejected — stay on pin-entry, show error
    setPinError(message.data?.message || 'Incorrect PIN');
  }
  break;
```

**Render the PIN entry screen:**
```jsx
{isConnected && currentScreen === 'pin-entry' && (
  <PinEntryScreen
    teamName={teamName}
    welcomeMessage={welcomeMessage}
    onSubmit={handlePinSubmit}
    error={pinError}
  />
)}
```

**`handlePinSubmit` (player side):**
Sends `PIN_SUBMIT` message via WebSocket:
```js
wsRef.current.send(JSON.stringify({
  type: 'PIN_SUBMIT',
  playerId,
  deviceId,
  teamName,
  pin: enteredPin,
  timestamp: Date.now(),
}));
```

**Welcome message for non-PIN flow:**
Handle a `WELCOME_MESSAGE` type (or include in existing flow) to set `welcomeMessage` state, then pass it to `WaitingScreen`.

### 5. New Component — `src-player/src/components/PinEntryScreen.tsx`

A simple full-screen component:
- Shows the team name at top
- Displays the host's custom welcome message
- 4-digit PIN input (numeric keypad style, or 4 individual digit boxes)
- Submit button
- Error message display area
- Styled consistently with existing player app (dark theme, similar to TeamNameEntry)

### 6. Update WaitingScreen — `src-player/src/components/WaitingScreen.tsx`

Add optional `welcomeMessage` prop. When provided, display it below the "Waiting for Quiz Host" text. This ensures the custom message shows during buzzer selection and approval screens too.

### 7. Reconnection Handling

The existing reconnection logic in `handleNetworkPlayerJoin` already checks `existingTeam` by deviceId (line ~3368). For PIN bypass on reconnect:
- If the device exists in `quizzesRef.current` (reconnecting player), the PIN check is skipped because the reconnection branch runs before the new-team branch
- If the device was previously authorized (in `authorizedDeviceIds` set) but disconnected and the team was removed, the set check handles it
- Empty Lobby clears both `quizzes` and `authorizedDeviceIds`, so no stale authorizations persist

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/Settings.tsx` | Add PIN enabled checkbox + PIN input to waiting room settings |
| `src/network/types.ts` | Add `PIN_REQUIRED`, `PIN_RESULT` to host types; `PIN_SUBMIT` to player types |
| `src-player/src/types/network.ts` | Add `PIN_REQUIRED`, `PIN_RESULT` to host types; add `PinSubmitMessage` |
| `src/components/QuizHost.tsx` | Add `authorizedDeviceIds` state, PIN gate in join handler, `PIN_SUBMIT` listener, clear on Empty Lobby |
| `src-player/src/App.tsx` | Add `pin-entry` screen, handle `PIN_REQUIRED`/`PIN_RESULT` messages, render PinEntryScreen |
| `src-player/src/components/PinEntryScreen.tsx` | **New file** — PIN entry UI |
| `src-player/src/components/WaitingScreen.tsx` | Add optional `welcomeMessage` prop |
