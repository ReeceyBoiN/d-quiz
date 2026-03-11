# Combine "Send Picture" and "Send Question" Into One Step (Quizpack Mode)

## Problem
When a quizpack question has both a picture and multiple choice options, the host currently has to press two separate buttons:
1. **"Send Picture"** — sends the image to players and external display
2. **"Send Question"** — sends the question text and options

Players have to wait for the host to press the second button before they can see the question/options after tapping the picture. Fast players find this frustrating.

## Solution
When a question has a picture (any type, not just multiple choice), send **both** the picture and the question data in a single host action. The flow skips the `sent-picture` state entirely and goes straight from `ready` → `sent-question`.

**Player experience stays the same visually:** the image overlay appears first (full screen), and when the player taps it, the question text and answer options are already loaded underneath — no delay. This already works because `hideAnswers = showImageOverlay && question?.imageUrl` hides the options while the image is displayed.

## Changes

### 1. `src/components/QuizHost.tsx` — `handlePrimaryAction` function (~line 2334)

**In the `case 'ready'` block** (when `hasQuestionImage(currentQuestion)` is true and `hideQuestionMode` is false):
- Keep the existing picture sending logic (sendPictureToPlayers, broadcastPictureToPlayers, sendToExternalDisplay for picture)
- **Add** question sending logic immediately after (sendQuestionToPlayers, broadcastQuestionToPlayers)
- **Change** the external display message from `mode: 'picture'` to `mode: 'question-with-timer'` so the external display shows the question + image together (the `question-with-timer` case already supports `imageDataUrl`)
- **Change** the flow state transition from `sent-picture` → `sent-question` (skipping `sent-picture`)
- Set both `pictureSent: true` and `questionSent: true`

**The `case 'sent-picture'` block** remains untouched for backward compatibility (e.g. if flow state is loaded from saved game state), but will no longer be reached in normal operation for new questions.

### 2. `src/components/QuestionNavigationBar.tsx` — `getFlowButton` function (~line 216)

No changes needed. The `sent-picture` case still exists but won't be reached. The button label logic in `ready` state already shows "Send Picture" when there's an image — we should change this to say something like **"Send Question"** (since it now sends both picture and question together). This way the host sees a single "Send Question" button regardless of whether there's an image.

**Change in `getFlowButton`:** In the `ready` case, remove the conditional — always show "Send Question" label (the picture is sent automatically along with the question when present).

### Files Modified
- `src/components/QuizHost.tsx` — modify `handlePrimaryAction`'s `ready` case to send both picture + question together
- `src/components/QuestionNavigationBar.tsx` — change button label from "Send Picture" to "Send Question" when a picture is present
