# Fix External Display Picture Visibility on Question Send

## Problem Summary
When a user sends a question after sending a picture on the external display (livescreen), the picture disappears from the right half of the screen. The expected behavior is:
- Picture should display on the right half when "send picture" is triggered
- When "send question" is triggered afterward, the question should show on the left half WITH the picture still showing on the right half (if that question has an image)
- If a question is sent without a picture, or if that question has no associated image, the right side should be empty

## Root Cause
In `src/components/QuizHost.tsx`, when moving from the 'sent-picture' flow state to sending a question, the host explicitly sends a `DISPLAY_UPDATE` message with `imageDataUrl: null`, which causes the `ExternalDisplayWindow` component to hide the image.

**Problematic code location**: QuizHost.tsx - handlePrimaryAction function, in the 'sent-picture' case when sending the question. The DISPLAY_UPDATE payload sets `imageDataUrl: null`.

## Current Behavior Flow
1. User clicks "send picture" → Host sends DISPLAY_UPDATE with mode: 'picture' and image URL
2. Picture displays on right half of external display ✓
3. User clicks "send question" → Host sends DISPLAY_UPDATE with mode: 'question-with-timer' but `imageDataUrl: null`
4. Question displays on left, but **picture disappears from right** ✗

## Desired Behavior Flow
1. User clicks "send picture" → Image shows on right half ✓
2. User clicks "send question" → Question shows on left, picture persists on right if that question has an image ✓
3. OR: User clicks "send question" directly (no picture first) → Question shows on left, right side is empty ✓

## Solution Approach

### Key Changes Required
1. **QuizHost.tsx - 'ready' flow state (send picture)**: Ensure consistency in payload key naming - use `imageDataUrl` instead of `image`
2. **QuizHost.tsx - 'sent-picture' flow state (send question)**: Instead of setting `imageDataUrl: null`, set it to `currentQuestion.imageDataUrl` so the image from that question displays (if it has one)
3. **QuizHost.tsx - other question send paths**: Verify that when questions are sent in other flow states, the `imageDataUrl` is correctly included from the current question

### Files to Modify
- **src/components/QuizHost.tsx** (primary file)
  - Locate: handlePrimaryAction function
  - Locate: All sendToExternalDisplay calls that send question DISPLAY_UPDATE messages
  - Change: Remove the `imageDataUrl: null` line and replace with `imageDataUrl: currentQuestion.imageDataUrl`
  - Change: Ensure 'ready' flow (send picture) uses consistent key name `imageDataUrl` in data object

### What Won't Change
- The ExternalDisplayWindow component is correctly reading `displayData.data.imageDataUrl` - no changes needed there
- The display modes and layouts are working as designed
- Network/broadcast messages to players (separate concern from this fix)

## Implementation Steps
1. Open src/components/QuizHost.tsx
2. Find the handlePrimaryAction function and the 'sent-picture' case
3. Locate the sendToExternalDisplay call that builds the DISPLAY_UPDATE for question mode
4. Change `imageDataUrl: null` to `imageDataUrl: currentQuestion.imageDataUrl`
5. Also verify the 'ready' case sends picture with consistent key naming (`imageDataUrl` not `image`)
6. Test the flow: send picture → verify it shows on right → send question → verify question on left AND picture still on right

## Expected Result
- External display will show question text on left, image on right
- When moving between "send picture" and "send question", the image persists if the question has one
- If a question has no image, right side remains empty (no visual artifacts)
