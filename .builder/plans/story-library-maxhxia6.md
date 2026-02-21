# Host Remote Button Visibility - Implementation Plan

## Problem Summary
The host remote (controller) is not showing the main progression buttons (Hide Question, Send Question, etc.) when a quiz round has started in any mode (quizpack, keypad, etc.).

## Root Causes Identified

### Issue 1: HTTP Payload Format (FIXED ✅)
- **Status:** Already fixed in previous changes
- **Details:** `wsHost.ts` correctly sends FLOW_STATE via HTTP with `{deviceId, messageType, data}` format
- **Files affected:** `src/network/wsHost.ts` (lines 525-544)

### Issue 2: IPC vs HTTP Shape Mismatch ⚠️ (WILL FIX)
- **Location:** `src/network/wsHost.ts` (IPC calls) and `src/components/QuizHost.tsx` (IPC calls)
- **Problem:** 
  - IPC calls use `{deviceId, message: payload}` format
  - HTTP backend expects `{deviceId, messageType, data}` format
  - electron/preload/preload.js does NOT expose `api.network.sendToPlayer`
  - Code falls back to HTTP when IPC unavailable, but formats don't match
- **Solution:** Update all IPC calls to use consistent `{deviceId, messageType, data}` format

### Issue 3: Large Payload in IPC Channel ⚠️ (WILL FIX)
- **Location:** `src/network/wsHost.ts` line 492-495 (sendFlowStateToController)
- **Problem:** IPC call sends `message: payload` which includes `loadedQuizQuestions` (potentially 66KB+)
- **Risk:** If main process forwards this to HTTP or WebSocket, could cause 413 errors or backpressure issues
- **Solution:** Strip `loadedQuizQuestions` from both IPC and HTTP payloads (already done for HTTP)

## Implementation Tasks

### Task 1: Fix sendFlowStateToController() in wsHost.ts
**File:** `src/network/wsHost.ts` (lines 466-540)
**Current:** 
- Local payload includes loadedQuizQuestions
- IPC send uses `{deviceId, message: payload}` format (wrong)
**Changes:**
- Create clean payload without loadedQuizQuestions for IPC
- Update IPC call to use `{deviceId, messageType: 'FLOW_STATE', data: cleanPayload}`
- Keep HTTP call as-is (already correct)

### Task 2: Fix sendAdminResponse() in wsHost.ts
**File:** `src/network/wsHost.ts` (lines 662-722)
**Current:**
- IPC send uses `{deviceId, message: payload}` format (wrong)
- Payload includes redundant `type: 'ADMIN_RESPONSE'` field
**Changes:**
- Update IPC call to use `{deviceId, messageType: 'ADMIN_RESPONSE', data: {...}}`
- Remove redundant `type` field from payload
- Keep HTTP call as-is (already correct)

### Task 3: Fix sendControllerAuthSuccess() in wsHost.ts
**File:** `src/network/wsHost.ts` (lines 555-594)
**Current:**
- IPC send uses `{deviceId, message: {...}}` format (wrong)
**Changes:**
- Update IPC call to use `{deviceId, messageType: 'CONTROLLER_AUTH_SUCCESS', data: {...}}`
- Ensure message property is not nested under message key

### Task 4: Fix sendControllerAuthFailed() in wsHost.ts
**File:** `src/network/wsHost.ts` (lines 596-630)
**Current:**
- IPC send uses `{deviceId, message: {...}}` format (wrong)
**Changes:**
- Update IPC call to use `{deviceId, messageType: 'CONTROLLER_AUTH_FAILED', data: {...}}`

### Task 5: Fix sendControllerAuthToPlayer() in QuizHost.tsx
**File:** `src/components/QuizHost.tsx` (lines 380-450)
**Current:**
- IPC send uses `{deviceId, message: {...}}` format (wrong)
- HTTP send is correct but IPC fallback is broken
**Changes:**
- Update IPC call to use `{deviceId, messageType, data}` format (consistent with HTTP)

## Technical Details for Implementation

### Format Normalization Pattern
All IPC and HTTP calls should follow this pattern:

```javascript
// Correct format for both IPC and HTTP
{
  deviceId: "device-xxx",
  messageType: "FLOW_STATE" | "ADMIN_RESPONSE" | "CONTROLLER_AUTH_SUCCESS" | "CONTROLLER_AUTH_FAILED",
  data: {
    // Payload data, WITHOUT loadedQuizQuestions or other large arrays
  }
}
```

### Data to Include vs Exclude

**Include in data:**
- flow (current quiz state)
- isQuestionMode
- currentQuestion (essential for rendering)
- currentLoadedQuestionIndex
- isQuizPackMode
- commandType, success, message for admin responses
- User identifiers and necessary metadata

**Exclude from data:**
- loadedQuizQuestions (too large, remote doesn't need it)
- Raw base64 images or large binary data
- Complete quiz configuration (only send what's needed)

## Testing Strategy

### Before Changes
1. Start quiz on host with remote connected
2. Note: Remote shows "Ready to Start" but no other buttons when quiz is running

### After Changes - Phase 1: Format Verification
1. Check host console for: `[wsHost] ✅ FLOW_STATE sent via HTTP API successfully`
2. Check remote console for: `[Player] ✅ Successfully parsed message type: FLOW_STATE`
3. Verify no 400 "Missing deviceId/messageType" errors

### After Changes - Phase 2: Button Visibility
1. Quiz idle → "Ready to Start" button visible ✓
2. Start quiz → See "Send Question" + "Hide Question" buttons ✓
3. Send question → See timer buttons ✓
4. Advance through quiz states → Correct buttons appear ✓

### After Changes - Phase 3: All Quiz Modes
1. QuizPack mode → Buttons appear correctly
2. Keypad mode → Buttons appear correctly
3. Basic mode → Buttons appear correctly
4. Edge case: Quick state transitions → No missed messages

### After Changes - Phase 4: Stability
1. No 413 Payload Too Large errors
2. No message format errors in console
3. Remote stays synchronized with host state

## Success Criteria
✅ All IPC calls use `{deviceId, messageType, data}` format
✅ FLOW_STATE messages reach remote controller successfully
✅ Remote controller shows correct buttons for current quiz state
✅ No 400 "Missing deviceId/messageType" errors
✅ No 413 "Payload Too Large" errors
✅ Buttons work across all quiz modes (quizpack, keypad, basic)
✅ Works in both browser and Electron modes
✅ No regression in other remote functionality (leaderboard, team management, etc.)

## Files to Modify
1. `src/network/wsHost.ts` - Fix 4 IPC calls + HTTP payloads
2. `src/components/QuizHost.tsx` - Fix 1 IPC call (QuizHost already uses correct HTTP format)

## Risk Mitigation
- Changes only affect message format, not logic
- HTTP format already correct (no risk there)
- IPC format fix makes it consistent with HTTP
- Payload size reduction (exclude loadedQuizQuestions) is conservative/safer
- All changes preserve existing functionality, only fix delivery mechanism
