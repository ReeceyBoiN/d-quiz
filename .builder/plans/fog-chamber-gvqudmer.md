# Picture Not Showing on Players Screen - Solution Plan

## Root Cause Identified
Pictures are not reaching remote players because the transmission path is incomplete:

1. **Host Side**: `sendPictureToPlayers()` only triggers local `hostNetwork.broadcast()` 
2. **Backend**: No `broadcastPicture()` function exists
3. **IPC Layer**: No `network/broadcast-picture` IPC endpoint exists
4. **Result**: Remote players connected via WebSocket never receive the PICTURE message

**Why Questions Work But Pictures Don't:**
- Questions use TWO paths:
  1. `sendQuestionToPlayers()` → local broadcast
  2. `broadcastQuestionToPlayers()` → IPC call to backend → WebSocket to players
  
- Pictures only use ONE path:
  1. `sendPictureToPlayers()` → local broadcast only (incomplete!)
  2. Missing IPC call to backend

## Solution: Complete the Picture Transmission Path

### Files to Modify

#### 1. **electron/backend/server.js** 
Add `broadcastPicture()` function (following same pattern as `broadcastQuestion`)
- Create message with type: 'PICTURE'
- Include image data in message.data.image
- Iterate through approved networkPlayers
- Send via player.ws.send()
- Add logging for success/failure

#### 2. **electron/main/main.js**
Add IPC endpoint `network/broadcast-picture` 
- Handle the IPC request
- Call `backend.broadcastPicture(imageDataUrl)`
- Add proper logging and error handling
- Follow same pattern as `network/broadcast-question`

#### 3. **src/components/QuizHost.tsx**
Create `broadcastPictureToPlayers()` function
- Mirror the `broadcastQuestionToPlayers()` pattern
- Call `window.api.network.broadcastPicture()` IPC
- Handle success/error with logging

Then update the picture sending logic in `handlePrimaryAction()`:
- When `flow === 'ready'` and `hasQuestionImage()`
- After calling `sendPictureToPlayers()`, also call `broadcastPictureToPlayers()`
- This ensures both local (external display) and remote players get the picture

## Implementation Pattern

**Example from existing code (broadcastQuestionToPlayers):**
```javascript
const broadcastQuestionToPlayers = async (questionData: any) => {
  try {
    if ((window as any).api?.network?.broadcastQuestion) {
      console.log('[QuizHost] Broadcasting question to players via IPC:', questionData);
      await (window as any).api.network.broadcastQuestion({
        question: questionData
      });
      console.log('[QuizHost] Question broadcasted to players');
    } else {
      console.warn('[QuizHost] api.network.broadcastQuestion not available');
    }
  } catch (err) {
    console.error('[QuizHost] Error broadcasting question:', err);
  }
};
```

**Will create similar function for pictures:**
```javascript
const broadcastPictureToPlayers = async (imageDataUrl: string) => {
  try {
    if ((window as any).api?.network?.broadcastPicture) {
      console.log('[QuizHost] Broadcasting picture to players via IPC:', { imageSize: imageDataUrl.length });
      await (window as any).api.network.broadcastPicture({
        image: imageDataUrl
      });
      console.log('[QuizHost] Picture broadcasted to players');
    } else {
      console.warn('[QuizHost] api.network.broadcastPicture not available');
    }
  } catch (err) {
    console.error('[QuizHost] Error broadcasting picture:', err);
  }
};
```

## Expected Behavior After Fix

1. Host loads question with image
2. Host clicks "Send Picture" button
3. Broadcast sends:
   - Local message to external display window (via `sendPictureToPlayers`)
   - IPC message to backend (via `broadcastPictureToPlayers`)
4. Backend sends PICTURE message to all approved players
5. Player apps receive PICTURE message and display the image
6. Host clicks "Send Question" button to send the actual question

## Player App (No Changes Needed)
Player app already has correct PICTURE message handler in `src-player/src/App.tsx`:
```javascript
case 'PICTURE':
  setCurrentScreen('display');
  setShowAnswerFeedback(false);
  setIsAnswerCorrect(undefined);
  if (message.data?.image) {
    setCurrentQuestion((prev: any) => ({
      ...prev,
      imageUrl: message.data.image,
    }));
  }
  break;
```

## Testing Approach
1. Load quiz with image questions
2. Click "Send Picture" button
3. Verify in console logs: "[QuizHost] Broadcasting picture to players via IPC"
4. Verify on backend logs: "Broadcast PICTURE to X approved players"
5. Verify on player devices: Image appears on screen after "Send Picture" click
6. Test with multiple players to confirm all receive the image
