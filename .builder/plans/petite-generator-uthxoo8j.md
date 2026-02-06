# Picture Persistence Logic - Implementation Plan

## Problem Summary

Currently, when the host sends a PICTURE message followed by a QUESTION message, the picture disappears because the QUESTION handler completely replaces the `currentQuestion` object without preserving the `imageUrl` field from the previous PICTURE message.

## Requirements

Picture should be hidden/cleared ONLY in these cases:
1. **Player clicks to hide it** (personal choice, local state)
2. **Timer ends** (TIMEUP message received)
3. **Question number/question changes** (new QUESTION arrives with different question data)
4. **Round ends** (END_ROUND message or implicit via other messages)

Picture should REMAIN visible in these cases:
1. **When PICTURE is sent alone** - show just the picture
2. **When PICTURE + QUESTION are sent together** - show question above the picture
3. **When host sends other messages** (TIMER_START, LOCK, REVEAL, etc.) - picture persists

## Root Cause Analysis

- QUESTION handler (App.tsx line ~312): `setCurrentQuestion(normalizedQuestionData)` - replaces entire object, losing `imageUrl`
- PICTURE handler (App.tsx line ~455): `setCurrentQuestion(prev => ({ ...prev, imageUrl: ... }))` - correctly merges with previous state
- QuestionDisplay has local `showImageOverlay` state that handles user click to hide
- TIMEUP handler (App.tsx line ~346): Does NOT clear `imageUrl`, only sets `timerEnded` flag
- No END_ROUND handler exists in player App.tsx to clear images

## Solution Approach

### 1. Preserve Image URL in QUESTION Handler
**File**: `src-player/src/App.tsx` (QUESTION case, line ~312)

Change from:
```javascript
setCurrentQuestion(normalizedQuestionData);
```

To:
```javascript
setCurrentQuestion((prev) => ({
  ...normalizedQuestionData,
  imageUrl: normalizedQuestionData.imageUrl ?? prev?.imageUrl
}));
```

**Effect**: 
- If new QUESTION includes an image, use it
- Otherwise, preserve the `imageUrl` from previous PICTURE
- Allows PICTURE + QUESTION combination to work correctly

### 2. Clear Image on Timer End
**File**: `src-player/src/App.tsx` (TIMEUP case, line ~346)

Add image clearing logic in TIMEUP handler:
```javascript
case 'TIMEUP':
  setShowTimer(false);
  clearTimerLockDelay();
  setCurrentQuestion((prev) => ({
    ...prev,
    imageUrl: undefined,  // Clear image when timer ends
  }));
  timerLockDelayRef.current = setTimeout(() => {
    setTimerEnded(true);
  }, 1000);
  break;
```

**Effect**: Picture disappears when timer ends (player didn't answer in time)

### 3. Clear Image on NEXT or END_ROUND
**File**: `src-player/src/App.tsx` (NEXT case, line ~418)

Image is already cleared by `setCurrentQuestion(null)` in NEXT handler, so no change needed.

### 4. Add END_ROUND Handler (if not present)
**File**: `src-player/src/App.tsx`

If no END_ROUND case exists, consider adding:
```javascript
case 'END_ROUND':
  // Clear everything for round end
  setCurrentQuestion(null);
  // ... other cleanup
  break;
```

**Effect**: Ensures round end also clears the picture

## Implementation Order

1. ✅ Preserve imageUrl in QUESTION handler (merge instead of replace)
2. ✅ Clear imageUrl in TIMEUP handler 
3. ✅ Verify NEXT and potential END_ROUND handlers clear the picture

## Testing Strategy

1. Send PICTURE → should see picture only
2. Send QUESTION after PICTURE → should see both question + picture
3. Wait for timer to end → picture should disappear
4. Send new QUESTION (different question) → old picture should disappear
5. Send NEXT → should clear everything
6. Test player clicking picture to hide it locally → should work

## Files to Modify

- `src-player/src/App.tsx` - Update QUESTION, TIMEUP handlers
