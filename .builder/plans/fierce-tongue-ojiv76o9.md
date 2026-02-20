# Host Remote Not Receiving Flow State Updates - Diagnostic Plan

## Problem Statement
The host remote (authenticated as host controller) shows "Ready to Start" and "Waiting to start quiz" even though the host app has already loaded Question 1 of 20. The host remote should receive the flow state update and show the question preview with "Send Question" button.

## Root Cause Analysis

### What Should Happen
1. Host remote authenticates using PIN (teamName = controller PIN)
2. Host app (QuizHost) detects controller authentication and calls `sendFlowStateToController()`
3. Host app loads a question and updates flowState
4. useEffect in QuizHost watches flowState changes and calls `sendFlowStateToController()` again
5. Host remote receives FLOW_STATE message and updates its display

### Current Behavior
- Step 1: ✅ Host remote authenticates (shows "Connected")
- Step 2: ✅ Should happen (host app should send initial FLOW_STATE)
- Step 3: ✅ Question is loaded on host app
- Step 4: ❓ useEffect may not be triggering or sendFlowStateToController may not be called
- Step 5: ❌ Host remote still shows "Ready to Start" (no flow state received)

### Potential Issues to Investigate

1. **hostControllerEnabled Flag**
   - Must be true for the sendFlowStateToController effect to run
   - Check if user enabled host controller mode in settings
   - File: src/components/QuizHost.tsx (useEffect condition: `if (hostControllerEnabled && authenticatedControllerId)`)

2. **authenticatedControllerId**
   - Must be set when controller authenticates
   - Check if PLAYER_JOIN handler properly sets this when PIN matches
   - File: src/components/QuizHost.tsx (PLAYER_JOIN handler around line ~2900)

3. **sendFlowStateToController useEffect**
   - Should trigger when flowState changes, hostControllerEnabled, or authenticatedControllerId changes
   - Verify all dependencies are correct
   - File: src/components/QuizHost.tsx (around line ~3662-3672)

4. **Backend /api/send-to-player Endpoint**
   - Must be reachable and properly routing messages
   - Controller device must be registered in networkPlayers
   - File: electron/backend/server.js (/api/send-to-player handler)

5. **Network Connectivity**
   - Backend URL must be correct (device sending to correct backend instance)
   - Device must remain connected to WebSocket throughout

## Investigation Steps

### Phase 1: Check Host App Configuration
1. Verify hostControllerEnabled is actually true
2. Verify authenticatedControllerId is set when remote authenticates
3. Check if there are console logs showing sendFlowStateToController being called

### Phase 2: Verify Communication Flow
1. Check host app console for sendFlowStateToController calls
2. Check host remote console for FLOW_STATE message reception
3. Check backend logs for /api/send-to-player requests

### Phase 3: Code Review
1. Examine sendFlowStateToController implementation for bugs
2. Verify FLOW_STATE message structure is correct
3. Confirm dependencies in the useEffect are complete

## Expected Fix Location
Most likely in `src/components/QuizHost.tsx`:
- The useEffect that calls sendFlowStateToController may have missing dependencies
- The PLAYER_JOIN handler may not properly set authenticatedControllerId
- flowState updates may not trigger the effect properly

Alternative: `src/network/wsHost.ts`
- sendFlowStateToController may have a bug in message delivery or URL construction

## Next Steps (Once Approved)
1. Read QuizHost.tsx to verify hostControllerEnabled and authenticatedControllerId handling
2. Check the exact useEffect dependencies for sendFlowStateToController
3. Read wsHost.ts sendFlowStateToController implementation
4. Fix any identified issues with missing dependencies or logic errors
5. Test by connecting remote after question is loaded
