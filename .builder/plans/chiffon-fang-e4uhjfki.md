# Picture Transmission Timing Fix Plan

## Problem Statement
Currently, when a question with a picture is loaded, the picture is displayed on player devices immediately because the `imageUrl` is included in the QUESTION broadcast message. This prevents the host from reviewing the question and picture before deciding to send them to players.

**Expected behavior**: Picture should only be sent to players when the host clicks "Send Picture" button (or triggers with spacebar), not when the question is loaded.

## Root Cause Analysis

The issue occurs in `src/components/QuizHost.tsx` in the `handlePrimaryAction()` function:

1. When a question with an image is in 'ready' state:
   - The host sends a separate PICTURE message via `sendPictureToPlayers(imageDataUrl)` (lines 1358)
   - Flow state changes to 'sent-picture'

2. When in 'sent-picture' state and the button is clicked again:
   - The host sends the QUESTION message via `broadcastQuestionToPlayers()` (lines 1426-1433)
   - **PROBLEM**: This includes `imageUrl: currentQuestion.imageDataUrl || null` (line 1431)
   - The player app receives this QUESTION message and sets `currentQuestion` with the imageUrl (src-player/src/App.tsx lines 316-323)

3. In the player app:
   - When `currentQuestion.imageUrl` is present, the QuestionDisplay component renders the image (src-player/src/components/QuestionDisplay.tsx lines 430+)
   - This happens immediately when the QUESTION message arrives, before the PICTURE message is even processed

## Solution Overview

Remove `imageUrl` from the question payload when broadcasting to players. The image should only arrive via:
- The dedicated PICTURE message (when host clicks "Send Picture")
- NOT as part of the QUESTION message

This maintains separation of concerns:
- PICTURE message = deliver the image to players
- QUESTION message = deliver question text and options

## Implementation Steps

### 1. Fix Host App - Remove imageUrl from question broadcasts
**File**: `src/components/QuizHost.tsx`

**Changes**:
- In `handlePrimaryAction()` 'sent-picture' case (lines 1426-1433): Remove `imageUrl` field
- In `handlePrimaryAction()` 'ready' case when no picture (lines 1376-1383): Remove `imageUrl` field
- Ensure imageUrl is only sent as part of dedicated PICTURE message

**Specific locations to edit**:
1. Line 1381: Remove `imageUrl: currentQuestion.imageDataUrl || null,` from broadcastQuestionToPlayers call
2. Line 1431: Remove `imageUrl: currentQuestion.imageDataUrl || null,` from broadcastQuestionToPlayers call

### 2. Verify external display handling
**File**: `src/components/QuizHost.tsx`

**Check**: Lines 1435-1458 already set `imageDataUrl: null` in the external display message for questions, so no changes needed there. This is already correct.

### 3. Verify player app handling (should work as-is)
**File**: `src-player/src/App.tsx`

**Verify**: The PICTURE message handler (lines 454-464) correctly sets imageUrl from picture messages:
```typescript
case 'PICTURE':
  if (message.data?.image) {
    setCurrentQuestion((prev: any) => ({
      ...prev,
      imageUrl: message.data.image,
    }));
  }
```

This is correct - it sets imageUrl only when a PICTURE message arrives.

## Expected Outcome

1. Host loads a question with picture
2. Picture shows in host UI for review (already works)
3. Host clicks "Send Picture" button
   - PICTURE message sent to players (includes imageUrl)
   - Players receive image and display it
4. Host clicks "Send Question" button
   - QUESTION message sent to players (NO imageUrl)
   - Players already have the image from step 3
   - Question text and options appear
5. Players can toggle between image and answer interface as designed

## Files That Will Be Modified
- `src/components/QuizHost.tsx` - Remove imageUrl from 2 broadcastQuestionToPlayers calls

## Testing Considerations
- Verify picture-based questions: picture only shows after "Send Picture" click
- Verify questions without pictures: still work normally
- Verify external display: unchanged (already sets imageDataUrl: null for questions)
- Verify no other code depends on imageUrl being in QUESTION payload
