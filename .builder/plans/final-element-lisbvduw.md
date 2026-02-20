# Backend URL Resolution + Listener Loop Infinite Loop Fix

## Critical Issue Fixed
After implementing the backend URL resolution fix, a new issue was discovered: an infinite loop of listener registration/unregistration causing app crashes every few milliseconds. The logs showed continuous "Unregistered listener for PLAYER_JOIN" and "Unregistered listener for TEAM_PHOTO_UPDATED" messages.

## Root Cause
The admin command handler's useEffect at `src/components/QuizHost.tsx:3380` included `debouncedSaveGameState` in its dependency array. This caused:
1. `debouncedSaveGameState` depends on `quizzes` (which changes frequently)
2. When `quizzes` changes → `debouncedSaveGameState` is recreated
3. When `debouncedSaveGameState` is recreated → the useEffect re-runs
4. Each time the effect runs → it unregisters the old listener and registers a new one
5. Result: Rapid unregister/register cycles every few milliseconds → memory exhaustion → crash

## Solution Implemented

### Fixed `src/components/QuizHost.tsx` - Line 3380
**Removed `debouncedSaveGameState` from dependency array**

Changed from:
```typescript
}, [authenticatedControllerId, hostControllerEnabled, hostControllerCode, debouncedSaveGameState, hostInfo?.baseUrl]);
```

To:
```typescript
}, [authenticatedControllerId, hostControllerEnabled, hostControllerCode, hostInfo?.baseUrl]);
```

### Why This Works
- JavaScript closures allow `handleAdminCommand` to access and call `debouncedSaveGameState` even though it's not in the dependency array
- The handler will always call the latest version of `debouncedSaveGameState` through closure
- The listener is only registered/unregistered when the truly critical dependencies change (auth status, enabled flag, controller code)
- This eliminates the listener loop while maintaining proper functionality

## Files Modified
1. **src/components/QuizHost.tsx**
   - Line 3380: Removed `debouncedSaveGameState` from useEffect dependency array

## Expected Results
After this fix, the app should:
- ✅ No longer crash from memory exhaustion
- ✅ No longer log continuous "Unregistered listener" messages
- ✅ Maintain proper admin command handling
- ✅ Still properly call debouncedSaveGameState when needed
- ✅ Run smoothly without performance degradation

## Testing Checklist
- [ ] App no longer crashes after a few seconds
- [ ] No continuous "Unregistered listener" messages in logs
- [ ] Admin commands still work properly
- [ ] Score adjustments still trigger auto-save
- [ ] Team removal still triggers auto-save
- [ ] CPU and memory usage remain stable
- [ ] Remote controller still functions correctly

