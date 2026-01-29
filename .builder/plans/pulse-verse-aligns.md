# Fix Duplicate Teams While Preserving Team Registration

## Root Cause Analysis (COMPLETED)

The problem had TWO separate pieces:

### Architecture Overview
1. **Backend** → sends PLAYER_JOIN over WebSocket to all clients
2. **QuizHost WebSocket client** → receives the message via `wsInstance.onmessage`
3. **wsHost local pub/sub** → broadcasts messages to useEffect listeners (onNetworkMessage)
4. **useEffect listener** → processes PLAYER_JOIN and adds teams to state

### The Missing Link
- Backend is working ✅
- WebSocket receives messages ✅
- useEffect listener is registered ✅
- **BUT**: Received WebSocket messages are NOT being forwarded to wsHost! ❌

**The original WebSocket handler did two things:**
1. Parsed PLAYER_JOIN and added teams directly (BAD - caused duplicates)
2. Implicitly bridged WebSocket → wsHost so listeners get triggered (GOOD - we removed it)

## Solution: Bridge WebSocket to wsHost Without Duplicates

### Simple Fix
In the WebSocket `onmessage` handler:
1. Parse the message (already done)
2. Call `broadcastMessage()` to forward it to wsHost listeners
3. Remove old team-creation logic
4. Ensure hostNetwork is enabled

This way:
- ✅ useEffect listener receives PLAYER_JOIN via wsHost
- ✅ Only one place creates teams (the useEffect handler using quizzesRef.current)
- ✅ No duplicates (deduplication logic in useEffect)
- ✅ Phone shows teams correctly

### Implementation Details

### Step 1: Initialize hostNetwork at App Startup
**File**: `src/App.tsx` (add to a useEffect on mount)

**Code to add**:
```javascript
import { initHostNetwork } from './network/wsHost';

// In a useEffect on mount:
useEffect(() => {
  initHostNetwork({ enabled: true });
}, []);
```

This ensures hostNetwork is enabled before listeners are registered.

### Step 2: Forward WebSocket Messages to wsHost
**File**: `src/components/QuizHost.tsx`

**Import**: Add to imports at top:
```javascript
import { broadcastMessage } from '../network/wsHost';
```

**In WebSocket onmessage handler** (around line 797-804):
```javascript
wsInstance.onmessage = async (event) => {
  if (!isComponentMounted) return;
  try {
    const data = JSON.parse(event.data);
    console.log('[WebSocket Message]', data);

    // Forward message to wsHost listeners (PLAYER_JOIN, PLAYER_ANSWER, etc)
    broadcastMessage({
      type: data.type,
      data,
      timestamp: data.timestamp || Date.now()
    });
  } catch (err) {
    console.error('Failed to parse WebSocket message:', err);
  }
};
```

## Files to Modify
1. `src/App.tsx` - Call initHostNetwork({ enabled: true }) on mount
2. `src/components/QuizHost.tsx` - Add broadcastMessage() call in wsInstance.onmessage + import

## Result
- Teams appear immediately when player connects ✅
- No duplicates (deduplication in useEffect) ✅
- Phone shows team in waiting room ✅
- Single source of truth for team creation (useEffect with quizzesRef.current) ✅
