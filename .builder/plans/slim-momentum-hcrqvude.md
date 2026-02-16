# Build Error Fix Plan

## Issue Identified
**Error**: `src/components/BottomNavigation.tsx (716:27): await isn't allowed in non-async function`

**Root Cause**: 
- Function `handleNetworkTeamPhotoUpdated` at line 697 is NOT declared as async
- However, it contains `await` at line 716 for validation check
- Build system is now catching this syntax error

**Location**: `src/components/BottomNavigation.tsx`, lines 697-750

## Problem Details

```typescript
// Current (BROKEN):
const handleNetworkTeamPhotoUpdated = (data: any) => {
  try {
    // ... code ...
    const result = await (window as any).api?.ipc?.invoke?.('network/all-players'); // ❌ await in non-async!
```

## Recommended Solution

### Fix: Add `async` keyword to function declaration
Change line 697 from:
```typescript
const handleNetworkTeamPhotoUpdated = (data: any) => {
```

To:
```typescript
const handleNetworkTeamPhotoUpdated = async (data: any) => {
```

**Why this works**: 
- Makes the function an async function, allowing use of `await` keyword
- No other changes needed - existing error handling is in place
- Function is called within useEffect listener, which doesn't need to await the result
- All await calls within the function will execute properly

## Files to Modify
1. **src/components/BottomNavigation.tsx** (Line 697)
   - Change function signature to add `async` keyword

## Verification
- Build should complete without syntax errors
- No logic changes - only declaration fix
- Auto-approval validation will work as intended
