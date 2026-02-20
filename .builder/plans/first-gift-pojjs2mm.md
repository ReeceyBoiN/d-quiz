# Fix Backend URL Resolution for Remote Controller Synchronization

## Problem Identified

The FLOW_STATE and ADMIN_RESPONSE messages are failing to send because the backend URL is being resolved as `file://:4310` instead of `http://192.168.0.103:4310`.

**Root Cause**: In `sendFlowStateToController()` (wsHost.ts), we're using:
```typescript
const backendUrl = (window as any).__BACKEND_URL__ || `${window.location.protocol}//${window.location.hostname}:4310`;
```

When running in Electron (host app), `window.location.protocol` is `file:` and hostname is empty, causing invalid URL.

## Solution Approach

### RECOMMENDED: Minimal Fix - Pass Backend URL as Parameter

**Why**: Simplest, lowest-risk change. QuizHost.tsx already has the correct URL via `useHostInfo()`.

**Steps**:
1. Modify `sendFlowStateToController()` in wsHost.ts to accept `backendUrl` parameter
2. Update both calls in QuizHost.tsx (in PLAYER_JOIN handler and useEffect) to pass `hostInfo?.baseUrl`
3. Do the same for `sendAdminResponse()` calls
4. Remove the invalid URL fallback logic

**Pros**:
- Minimal code changes
- No new dependencies/context needed
- Clear and explicit - function receives what it needs
- Easy to debug

**Cons**:
- Requires passing URL parameter explicitly each time
- If many functions need the URL, would need multiple updates

### ALTERNATIVE: Backend URL Context (More Robust)

**Why**: Better for scalability if many functions need backend URL.

**Steps**:
1. Create `BackendUrlContext` in src/context/
2. Provider component wraps the app
3. QuizHost.tsx provides URL when loaded
4. wsHost functions consume context via custom hook
5. Future functions automatically have access

**Pros**:
- Scalable - works for any number of functions
- No prop drilling needed
- Global access to backend URL

**Cons**:
- More setup code
- Requires React Context (adds complexity)

## Recommendation

**Go with the MINIMAL FIX** because:
- Only 2 functions need the URL currently (sendFlowStateToController, sendAdminResponse)
- Can always refactor to Context later if needed
- Lower risk of breaking changes
- Clearer code flow

## Files to Modify

1. **src/network/wsHost.ts** (HIGH PRIORITY)
   - Fix `sendFlowStateToController()` backend URL resolution
   - Update `sendAdminResponse()` if needed
   - Ensure all HTTP API calls use valid backend URL

2. **src/components/QuizHost.tsx** (MEDIUM PRIORITY)
   - Extract backend URL from `hostInfo`
   - Pass to `sendFlowStateToController()` calls
   - OR set up context provider for backend URL

3. **src/context/** (if creating context)
   - Create BackendUrlContext if using context approach
   - Provider wraps app
   - wsHost functions consume context

## Implementation Order

1. Fix the immediate issue: Pass backend URL to `sendFlowStateToController()`
2. Update calls in QuizHost.tsx to pass the correct URL
3. Verify FLOW_STATE messages are being delivered
4. Test end-to-end: Button clicks → Commands executed → Host responds

## Testing Checklist

- [ ] Remote controller receives FLOW_STATE updates
- [ ] Remote controller buttons show correct labels
- [ ] Button clicks send ADMIN_COMMAND to host
- [ ] Host executes commands
- [ ] Host sends ADMIN_RESPONSE back to remote
- [ ] Full flow works: Send Question → Timer → Reveal → Fastest → Next
