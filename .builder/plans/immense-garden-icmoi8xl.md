# Player Blank Screen & React Hooks Error - Complete Fix Plan

## Root Cause: React Hooks Rules Violation

**Location**: `src-player/src/App.tsx` ~line 672–696

**Issue**: `useRef()` declarations inside `useEffect` callback violates React's Rules of Hooks. When approval timer triggers a re-render, hook ordering mismatches cause React error #321.

## Implementation Plan

### Phase 1: Fix Hooks Rule Violation in Visibility Detection Effect

**File**: `src-player/src/App.tsx`

**Changes**:
1. Move 5 useRef declarations from inside useEffect to top of component (alongside existing refs like `wsRef`, `displayModeTimerRef`)
   - `visibilityStateRef` 
   - `lastSentStateRef`
   - `messageQueueRef`
   - `visibilityDebounceTimerRef`
   - `focusDebounceTimerRef`

2. Initialize each ref with appropriate default values at top level

3. Remove useRef calls from inside the effect - use refs directly

4. Keep the conditional early return in the effect (this is fine)

### Phase 2: Fix handleMessage Stale Closure

**File**: `src-player/src/App.tsx`

**Issue**: `handleMessage` is created with `useCallback(..., [])` (empty deps) but closes over multiple state variables that change:
- `teamName`
- `currentScreen`
- `currentQuestion`
- `flowState`
- `displayMode`
- `settings`
- etc.

This means the handler always reads stale values from initial render.

**Solution**: Add all state dependencies to the useCallback deps array.

**Impact**: The `onMessage` callback passed to `useNetworkConnection` will be recreated when any of those state values change, causing the connection hook to re-register. This is safe and necessary for correctness.

### Phase 3: Verify Implementation

**Testing**:
1. Player connects to host
2. Player enters team name and submits
3. Host auto-approves 
4. Player receives TEAM_APPROVED message
5. Player shows approval screen (no React error)
6. After 2 seconds, approval screen transitions to display screen
7. Connection stable - no unexpected disconnects
8. Browser console clean (no React errors)

## Key Implementation Details

### useRef Declarations to Move (top of component, around line 56-65)

```typescript
// Visibility and focus detection refs
const visibilityStateRef = useRef<{ isVisible: boolean; isFocused: boolean }>({
  isVisible: !document.hidden,
  isFocused: document.hasFocus(),
});
const lastSentStateRef = useRef<{ away: boolean; timestamp: number } | null>(null);
const messageQueueRef = useRef<Array<{ away: boolean; reason: string }>>([]);
const visibilityDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const focusDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

### handleMessage useCallback Dependencies

Change from:
```typescript
const handleMessage = useCallback((message: HostMessage) => {
  // ...
}, []);
```

To:
```typescript
const handleMessage = useCallback((message: HostMessage) => {
  // ... existing code
}, [teamName, currentScreen, currentQuestion, flowState, displayMode, settings, ...other dependencies]);
```

## Files Modified

- **`src-player/src/App.tsx`**
  - Move 5 useRef declarations to top level
  - Update useCallback deps array for handleMessage
  - Remove useRef calls from visibility effect

## Expected Outcome

✅ React error #321 eliminated
✅ Player can successfully transition from team entry → approval screen → display screen
✅ Connection remains stable with no unexpected disconnects
✅ handleMessage always has current state values (no stale closures)
✅ Blank screen issue resolved

## Rationale

- **Moving useRef to top level**: Ensures hooks are always called in same order on every render, per React rules
- **Adding deps to handleMessage**: Ensures handler has access to latest state values needed for correct message handling
- **Keeping early return in effect**: This is fine - early returns prevent code execution but don't change hook declaration order
