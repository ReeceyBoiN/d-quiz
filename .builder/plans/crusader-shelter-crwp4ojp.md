# Map Buzz-In Correct/Wrong Sounds to Test Buttons & Gameplay

## Problem
The buzz-in correct/wrong sound files exist at `resorces/sounds/Misc/buzz in - correct.wav` and `resorces/sounds/Misc/buzz in - wrong.wav`, but:
1. The "Demo and Test Sounds" green tick / red X buttons in both `BuzzInInterface.tsx` and `QuizPackDisplay.tsx` have empty `onClick` handlers — they don't play any sound.
2. During buzz-in gameplay, `playApplauseSound()` (random applause) is used for correct answers and `playFailSound()` (random fail sound) is used for wrong answers. The dedicated buzz-in sounds are never played.

## Solution

### 1. Add `playBuzzCorrectSound()` and `playBuzzWrongSound()` to `src/utils/audioUtils.ts`
Following the exact same pattern as `playApplauseSound()` and `playFailSound()`:
```ts
export async function playBuzzCorrectSound(): Promise<void> {
  const soundsPath = await getSoundsPath();
  playAudioFile(`${soundsPath}/Misc/buzz in - correct.wav`, 1);
}

export async function playBuzzWrongSound(): Promise<void> {
  const soundsPath = await getSoundsPath();
  playAudioFile(`${soundsPath}/Misc/buzz in - wrong.wav`, 1);
}
```
Note: These are specific single files (not random from a folder), so we use `playAudioFile` directly instead of `playRandomSound`. Need to also export `playAudioFile` or call it inline within the new functions (it's currently a private function — we'll just call it directly since the new functions are in the same file).

### 2. Wire up "Demo and Test Sounds" buttons in `BuzzInInterface.tsx`
- Import `playBuzzCorrectSound, playBuzzWrongSound` from `../utils/audioUtils`
- Green tick button `onClick`: call `playBuzzCorrectSound()`
- Red X button `onClick`: call `playBuzzWrongSound()`

### 3. Wire up "Demo and Test Sounds" buttons in `QuizPackDisplay.tsx`
- Import `playBuzzCorrectSound, playBuzzWrongSound` from `../utils/audioUtils`
- Green tick button `onClick`: call `playBuzzCorrectSound()`
- Red X button `onClick`: call `playBuzzWrongSound()`

### 4. Add buzz-in sounds to gameplay flow in `BuzzInDisplay.tsx` (On The Spot mode)
- Import `playBuzzCorrectSound, playBuzzWrongSound`
- In `handleCorrectAnswer`: add `playBuzzCorrectSound()` call (alongside existing `playApplauseSound()`)
- In `handleWrongAnswer`: add `playBuzzWrongSound()` call (alongside existing `playFailSound()`)

### 5. Add buzz-in sounds to gameplay flow in `QuizHost.tsx` (Quiz Pack buzz-in mode)
- Import `playBuzzCorrectSound, playBuzzWrongSound`
- In `handleBuzzCorrect` (~line 6106): add `playBuzzCorrectSound()` call (alongside existing `playApplauseSound()`)
- In `handleBuzzWrong` (~line 6136): add `playBuzzWrongSound()` call (alongside existing `playFailSound()`)

## Files to Modify
1. `src/utils/audioUtils.ts` — Add two new exported functions
2. `src/components/BuzzInInterface.tsx` — Wire test sound buttons
3. `src/components/QuizPackDisplay.tsx` — Wire test sound buttons
4. `src/components/BuzzInDisplay.tsx` — Add buzz sounds to gameplay
5. `src/components/QuizHost.tsx` — Add buzz sounds to quiz pack buzz-in gameplay

## Sound Files (already ship with the app)
The files at `resorces/sounds/Misc/` are already inside the repo and ship with the app via the existing `getSoundsPath()` mechanism (Electron IPC resolves to the user's Documents/PopQuiz/Resources/Sounds folder). No additional copy/packaging step is needed — these files are already in the correct location.
