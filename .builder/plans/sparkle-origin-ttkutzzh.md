# Comprehensive Buzzer Selection Modal Protection

## Problem Identified
The initial fix only protected the TEAM_APPROVED message handler. However, the host can send multiple OTHER messages that cause screen transitions while the user is in buzzer-selection mode:

1. **APPROVAL_PENDING** → sets screen to 'approval'
2. **QUESTION** → sets screen to 'question'
3. **NEXT** → sets screen to 'ready-for-question'
4. **PICTURE** → sets screen to 'question'
5. **DISPLAY_MODE/DISPLAY_UPDATE** → sets screen to 'display'

All of these can dismiss the buzzer modal if they arrive during selection, making the implementation NOT failsafe.

## Solution Approach

### Strategy: Global Buzzer-Selection Screen Protection
Instead of individually protecting each message case, create a centralized guard that:
- Checks if `currentScreen === 'buzzer-selection'` at entry to ALL screen-transition logic
- If in buzzer-selection: save data without changing screen
- If not in buzzer-selection: proceed with normal behavior

### Implementation Steps

1. **Create Helper Function: shouldIgnoreScreenTransition()**
   - Single utility function that returns `true` if we should skip screen transitions
   - Used in all relevant message handlers
   - Reduces code duplication

2. **Create Enhanced pendingMessage State**
   - Single state holds the MOST RECENT deferred message
   - Overwrites if a new message arrives during buzzer selection
   - Stores: messageType, all relevant data fields (question, screen, images, etc.)
   - Simpler than queuing - later messages take priority

3. **Protect Each Vulnerable Message Handler**
   - **APPROVAL_PENDING**: Save state, don't change screen
   - **QUESTION**: Save question data, don't change screen
   - **NEXT**: Save state, don't change screen
   - **PICTURE**: Save image data, don't change screen
   - **DISPLAY_MODE/DISPLAY_UPDATE**: Save display data, don't change screen

4. **Update handleBuzzerConfirm()**
   - After buzzer confirmed and approval data applied
   - Process any additional pending data from other messages if needed
   - Clear all pending data
   - Perform final screen transition

5. **Add Console Logging**
   - Track when messages are deferred during buzzer selection
   - Log what data is being saved for later application
   - Helps debug any future issues

## Files to Modify
- `src-player/src/App.tsx` - Only file needing changes

## Success Criteria
- Buzzer modal remains visible and interactive regardless of host messages
- All screen-transition messages during buzzer selection are captured and queued
- After buzzer confirmation, all deferred state updates are properly applied
- Smooth transition to approval screen with correct display mode/question/etc
- Console logs show deferred messages during buzzer selection
- No screen flicker or unexpected transitions while selecting buzzer

## Implementation Details

### Key Changes:
1. Add reusable `shouldIgnoreScreenTransition()` helper
2. Keep existing `pendingApprovalData` but enhance it to hold ANY message type data
3. Rename to `pendingMessage` for clarity (holds latest deferred message)
4. Add guards to: APPROVAL_PENDING, QUESTION, NEXT, PICTURE, DISPLAY_MODE cases
5. Enhance `handleBuzzerConfirm()` to process pending message before final transition
6. Add comprehensive logging throughout

### Code Pattern for Each Handler:
```
if (currentScreen === 'buzzer-selection') {
  console.log('[Player] Deferring [MESSAGE_TYPE] during buzzer selection');
  // Save latest message data (overwrites any previous pending message)
  setPendingMessage({ type: 'MESSAGE_TYPE', data: message.data });
  return; // Skip rest of handler
}
// ... normal handler logic ...
```
