# Picture Display Issue - Root Cause & Solution

## Problem Root Cause

The PICTURE message handler in the player app has a critical flaw:

**Current behavior (BROKEN):**
```javascript
// src-player/src/App.tsx lines 454-464
case 'PICTURE':
  setCurrentScreen('display');  // ❌ Sets screen to 'display'
  if (message.data?.image) {
    setCurrentQuestion((prev: any) => ({
      ...prev,
      imageUrl: message.data.image,  // ✅ Stores image in currentQuestion
    }));
  }
  break;
```

**Why it doesn't work:**
1. Picture is stored in `currentQuestion.imageUrl` ✅
2. QuestionDisplay component (which renders imageUrl) only mounts when `currentScreen === 'question'` 
3. PICTURE handler sets screen to `'display'`, NOT `'question'` ❌
4. Result: QuestionDisplay never mounts, image never displays
5. Instead, PlayerDisplayManager (display screen) shows BasicPlayerDisplay, which ignores the image

**Message format is correct:**
- Incoming: `{ type: 'PICTURE', data: { image: '<base64 or URL>' } }`
- Code correctly extracts `message.data.image` ✅
- QuestionDisplay correctly renders `question.imageUrl` in full-screen overlay ✅
- Just never gets mounted due to screen routing issue ❌

## Solution

Change the PICTURE handler in `src-player/src/App.tsx` to set the screen to `'question'` instead of `'display'`:

**File:** src-player/src/App.tsx (line 455)
**Change:** `setCurrentScreen('display')` → `setCurrentScreen('question')`

### Result
- PICTURE handler stores image in currentQuestion.imageUrl
- Screen switches to 'question' → QuestionDisplay mounts
- QuestionDisplay displays the full-screen image overlay (lines 430-465 in QuestionDisplay.tsx)
- Players can see the picture

## Implementation
**Single line change needed:**
- File: `src-player/src/App.tsx`
- Line: 455
- Change: `setCurrentScreen('display');` to `setCurrentScreen('question');`
- Keep everything else in the handler the same

## Testing
After the fix:
1. Host sends PICTURE message with image
2. Player should see full-screen image overlay
3. Should work same as QUESTION messages with images
