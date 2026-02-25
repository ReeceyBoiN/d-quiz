# Memory Leak Fix: Listener Re-registration in QuizHost

## Problem
When clicking the keypad button to enter on-the-spot mode, the browser console fills with thousands of repeated messages:
```
[HostNetwork] Unregistered listener for PLAYER_JOIN
[HostNetwork] Unregistered listener for TEAM_PHOTO_UPDATED
```

This occurs even without a host remote connected, indicating a listener management issue in the host app.

## Root Cause Analysis

### Issue Location 1: PLAYER_JOIN Listener (src/components/QuizHost.tsx:3150-3154)
```typescript
const unsubscribe = onNetworkMessage('PLAYER_JOIN', handleNetworkPlayerJoin);
return unsubscribe;
}, [hostControllerEnabled, hostControllerCode, flowState, setAuthenticatedControllerId, handleApproveTeam, debouncedSaveGameState]);
```

**Problem**: The dependency array includes `flowState` which changes frequently (every question, state update, etc.). When flowState changes:
1. The old listener is unsubscribed (logs "Unregistered listener for PLAYER_JOIN")
2. A new listener is registered
3. This repeats continuously, causing console spam and potential memory waste

### Issue Location 2: TEAM_PHOTO_UPDATED Listener (src/components/QuizHost.tsx:3977-3981)
```typescript
const unsubscribe = onNetworkMessage('TEAM_PHOTO_UPDATED', handleNetworkTeamPhotoUpdated);
return unsubscribe;
}, [teamPhotosAutoApprove, handleApproveTeam]);
```

**Problem**: `handleApproveTeam` dependency changes when its closure captures updated state. Re-registering listeners unnecessarily.

### Issue Location 3: PLAYER_DISCONNECT Listener (src/components/QuizHost.tsx:3196-3200)
```typescript
const unsubscribe = onNetworkMessage('PLAYER_DISCONNECT', handleNetworkPlayerDisconnect);
return unsubscribe;
}, [authenticatedControllerId]);
```

**Problem**: Re-registers when `authenticatedControllerId` changes (e.g., when controller connects/disconnects).

## Solution Approach

The fix uses two strategies:

### Strategy 1: Stabilize Handler References with useCallback
Wrap handlers in `useCallback` with minimal dependencies. This ensures the handler reference doesn't change unless truly necessary.

### Strategy 2: Remove Unnecessary Dependencies
Some listeners don't need to re-register when state changes. They can access current state via refs or closures.

### Strategy 3: Keep Empty Dependency Arrays Where Appropriate
For listeners that don't need dynamic updates (like those accessing refs), use `[]` to register once.

## Files to Modify

### 1. src/components/QuizHost.tsx

**Change 1**: PLAYER_JOIN listener (lines 3124-3154)
- Wrap `handleNetworkPlayerJoin` in `useCallback` with minimal dependencies
- Remove unnecessary dependencies from useEffect: keep only `handleApproveTeam` if needed for team approval
- Actually, this handler only logs and approves teams - approval logic could use a ref to latest state

**Change 2**: TEAM_PHOTO_UPDATED listener (lines 3828-3981)
- Wrap `handleNetworkTeamPhotoUpdated` in `useCallback` 
- Remove `handleApproveTeam` from dependencies if possible, use ref instead

**Change 3**: PLAYER_DISCONNECT listener (lines 3157-3200)
- Keep minimal dependencies or use `[]` with ref-based state access
- The only action is clearing controller if it matches - could be a simple ref check

### 2. Consider Creating a Custom Hook (Optional Future Improvement)
Create `useNetworkListener` hook to abstract listener registration with safe dependency management.

## Implementation Details

### Pattern to Follow:
```typescript
// 1. Create stable handler with useCallback
const handlePlayerJoin = useCallback((data: any) => {
  // Use refs for latest state instead of dependencies
  const currentAuthenticatedControllerId = authenticatedControllerIdRef.current;
  // Handler logic here
}, []); // No dependencies - use refs instead

// 2. Register listener with stable handler
useEffect(() => {
  const unsubscribe = onNetworkMessage('PLAYER_JOIN', handlePlayerJoin);
  return unsubscribe;
}, [handlePlayerJoin]); // Only depends on stable handler
```

## Expected Outcome
- Console spam eliminated
- No more repeated "Unregistered listener" messages
- Memory usage stabilized (no accumulating listener registrations)
- Network functionality preserved
