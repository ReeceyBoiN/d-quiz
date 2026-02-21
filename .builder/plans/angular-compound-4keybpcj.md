# Fix FLOW_STATE Delivery to Host Remote Controller

## Root Cause Analysis

From the logs, we identified **TWO critical failures**:

### Issue 1: Wrong Request Format (400 Bad Request)
**Host logs show:**
```
[wsHost] ❌ HTTP API error: 400 Bad Request
[wsHost] Error response body: {"ok":false,"error":"Missing deviceId or messageType"}
```

**Problem:** 
- The `/api/send-to-player` endpoint expects format: `{deviceId, messageType, data}`
- We're sending format: `{deviceId, message: {type, data, ...}}`
- The endpoint cannot find `messageType` field

**Location:** `src/network/wsHost.ts` line 525-531

### Issue 2: Payload Too Large (413 Error)
**Host logs show:**
```
[wsHost] ❌ HTTP API error: 413 Payload Too Large
```

**Problem:**
- FLOW_STATE payload includes the entire `loadedQuizQuestions` array
- Remote player logs: `teamPhoto: '<base64 data: 66626 bytes>'` already included in team data
- Full quiz questions array can be megabytes of JSON
- Express body-parser has default 100KB limit
- Payload sent via HTTP API far exceeds this limit

**Solution:** Don't send the full `loadedQuizQuestions` array over HTTP API

### Remote Side - What's NOT Happening
**Remote logs show:**
```
[GameControlsPanel] 📊 Component rendering with: {flowState: null, ...}
```

The remote never receives FLOW_STATE because the HTTP API calls fail at the host level (before reaching remote).

---

## Solution

### Fix 1: Correct HTTP API Payload Format
**File:** `src/network/wsHost.ts` line 512-520

Change from:
```javascript
const response = await fetch(`${resolvedBackendUrl}/api/send-to-player`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceId,
    message: payload
  })
});
```

To:
```javascript
const response = await fetch(`${resolvedBackendUrl}/api/send-to-player`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceId,
    messageType: 'FLOW_STATE',
    data: {
      flow: payload.data.flow,
      isQuestionMode: payload.data.isQuestionMode,
      currentQuestion: payload.data.currentQuestion,
      currentLoadedQuestionIndex: payload.data.currentLoadedQuestionIndex,
      isQuizPackMode: payload.data.isQuizPackMode,
      // EXCLUDED: loadedQuizQuestions - too large for HTTP API
    }
  })
});
```

**Why:** 
- Matches backend endpoint expectations: `{deviceId, messageType, data}`
- Excludes `loadedQuizQuestions` array which causes 413 errors
- Keeps essential flow control data that remote needs for button rendering

### Fix 2: Update sendControllerAuthToPlayer Similarly
**File:** `src/components/QuizHost.tsx` line 430-445

The controller auth also uses the HTTP API and needs the same format fix for consistency.

---

## Expected Results After Fix

**Host console should show:**
```
[wsHost] 🚀 sendFlowStateToController called {...}
[wsHost] 📦 FLOW_STATE payload ready {...}
[wsHost] 📤 Attempting to send FLOW_STATE via HTTP API...
[wsHost] ✅ FLOW_STATE sent via HTTP API successfully: {...}
```

**Remote console should show:**
```
[Player] ✅ Successfully parsed message type: FLOW_STATE
[Player] 🎯 FLOW_STATE MESSAGE RECEIVED ON WEBSOCKET: {flow: "ready", isQuestionMode: true, ...}
[Player] 📥 FLOW_STATE message received! {flow: "ready", ...}
[Player] ✅ FLOW_STATE conditions met, updating local state
[Player] ✨ flowState updated, GameControlsPanel should re-render
[GameControlsPanel] 📊 Component rendering with: {flowState: {flow: "ready", ...}, buttonLayout: "question-choice", ...}
```

**Then buttons appear on host remote:**
- When quiz starts: "Send Picture" or "Send Question" + "Hide Question"
- When question sent: "Normal Timer" + "Silent Timer"
- When timer running: "Reveal Answer"
- After reveal: "Show Fastest Team"
- After fastest: "Next Question"

---

## Files to Modify

1. **src/network/wsHost.ts** - Fix FLOW_STATE HTTP API format (line 512-520)
2. **src/components/QuizHost.tsx** - Fix controller auth HTTP API format (line 430-445)

## Implementation Order

1. Update `wsHost.ts` sendFlowStateToController() HTTP payload format
2. Update `QuizHost.tsx` sendControllerAuthToPlayer() HTTP payload format  
3. Test: Start quiz → remote should show correct buttons for current flow state
4. Verify all flow transitions show correct buttons
