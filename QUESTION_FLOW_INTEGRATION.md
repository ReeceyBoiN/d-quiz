# Question Flow System Integration Guide

## Overview

This document describes the new question flow system that has been integrated into the PopQuiz host application. It provides a robust state machine for driving quiz questions through their lifecycle: **Ready → Picture → Question → Timer → Reveal → Fastest Team → Complete**.

## Architecture

### Core Components

#### 1. **Flow State Machine** (`src/state/flowState.ts`)
Defines the question lifecycle states and helper functions:
- **States:**
  - `idle`: No question active
  - `ready`: Question loaded, nothing sent yet
  - `sent-picture`: Picture broadcasted to external display and players
  - `sent-question`: Question text/options broadcasted
  - `running`: Timer counting down
  - `timeup`: Timer hit zero; submissions locked
  - `revealed`: Correct answer revealed
  - `fastest`: Fastest team view shown
  - `complete`: All questions done

- **Key Functions:**
  - `getTotalTimeForQuestion()`: Maps question type to timer duration from settings
  - `hasQuestionImage()`: Checks if question has an image
  - `getQuestionTypeLabel()`: Converts type to display string

#### 2. **Timer Hook** (`src/hooks/useTimer.ts`)
Manages countdown timer with smooth animation:
- Methods: `start()`, `stop()`, `pause()`, `resume()`, `reset()`
- Callbacks: `onEnd()`, `onTick()`
- Exposes: `timeRemaining`, `totalTime`, `isRunning`, `progress` (0-100)
- Tick interval: 100ms (configurable) for smooth bar animation

#### 3. **Networking Scaffold** (`src/network/wsHost.ts`)
Broadcasting system for quiz state (ready for future player app):
- Singleton instance with `broadcast()`, `sendPicture()`, `sendQuestion()`, etc.
- Message types: `PICTURE`, `QUESTION`, `TIMER`, `TIMER_START`, `TIMEUP`, `LOCK`, `REVEAL`, `FASTEST`, `NEXT`, `END_ROUND`, `SCORES`
- Currently logs to console; later will use WebSocket on port 8787 for LAN communication
- Prepared for incoming `ANSWER` messages from player devices

#### 4. **Question Panel** (`src/components/QuestionPanel.tsx`)
Main display area showing:
- Question text (large, centered)
- Fixed-size image area (right side, if present)
- Dynamic options for Multiple Choice / Letters / Sequence
- Answer display (when `showAnswer` is true)

#### 5. **Primary Controls** (`src/components/PrimaryControls.tsx`)
Bottom-right fixed controls:
- **Primary Blue Button:** Label changes per flow state
  - `ready`: "Send Picture" or "Send Question"
  - `sent-picture`: "Send Question"
  - `sent-question`: "Start Timer"
  - `running`/`timeup`: "Reveal Answer"
  - `revealed`: "Fastest Team"
  - `fastest`: "Next Question" or "End Round"
  - Triggered by spacebar or mouse click
- **Start Silent Timer:** Secondary button visible when `flow === 'sent-question' || 'running'`

#### 6. **Timer Progress Bar** (existing `src/components/TimerProgressBar.tsx`)
Slim bar at top that drains linearly from 100% to 0% as time counts down. Only visible during active question flow.

### Integration Points in QuizHost

#### State Management
```typescript
const [flowState, setFlowState] = useState<HostFlow>({
  isQuestionMode: boolean,      // false for wheel/bingo modes
  flow: QuestionFlowState,      // current step in lifecycle
  totalTime: number,            // initial time for question
  timeRemaining: number,        // countdown value
  currentQuestionIndex: number, // which question
  currentQuestion: any,         // question data
  pictureSent: boolean,        // has picture been broadcast?
  questionSent: boolean,       // has question been broadcast?
  answerSubmitted?: string,    // for on-the-spot questions (future)
});
```

#### Effects
1. **Flow State Initialization** (when quiz pack loads):
   - Sets `isQuestionMode = true`, `flow = 'ready'`
   - Derives `totalTime` from question type and settings
   - Resets `pictureSent` and `questionSent` flags

2. **Timer Control** (when flow changes to 'running'):
   - Starts countdown via `useTimer` hook
   - On `onEnd()`, sets `flow = 'timeup'`
   - Updates `timeRemaining` on each tick

#### Action Handlers
- `handlePrimaryAction()`: Main flow progression
  - Orchestrates: Send Picture → Send Question → Start Timer → Reveal Answer → Fastest Team → Next/End
  - Broadcasts to external display via `externalWindow.postMessage()`
  - Calls network functions (e.g., `sendPictureToPlayers()`, `sendTimerToPlayers()`)
  
- `handleSilentTimer()`: Starts timer without audio
  - Same countdown as audible, but flag `answerSubmitted = 'silent'` tracks it
  - Broadcasts timer to external display for animations

- `handleStartQuiz()`: Triggered by "START QUIZ" button in config
  - Transitions from config screen to question mode
  - Sets `isQuestionMode = true`, `flow = 'ready'`

### Rendering

In `renderTabContent()`:
1. If `showQuizPackDisplay && flowState.isQuestionMode`:
   - Show new flow system (QuestionPanel + PrimaryControls)
   - Display timer bar at top
2. Else if `showQuizPackDisplay && !flowState.isQuestionMode`:
   - Show old config screen (user selects points, speed bonus, etc.)

## Workflow: Quiz Pack Loaded

1. **User loads quiz pack** (.sqq or .pop file)
   - `currentQuiz` is set via `useQuizData`
   - Effect initializes `loadedQuizQuestions` and shows `QuizPackDisplay` (config mode)

2. **Config Screen (OLD SYSTEM)**
   - User sees: Points slider, Speed Bonus slider, Go Wide toggle, Evil Mode toggle
   - User clicks "START QUIZ"
   - `onStartQuiz` callback fires → `handleStartQuiz()` → `flowState.isQuestionMode = true`

3. **Question Flow (NEW SYSTEM)**
   - Effect re-initializes flow state: `flow = 'ready'`, resets counters
   - **Host sees: Question Panel with large text, options, image (if present)**
   - **Primary control shows: "Send Picture" or "Send Question"**

4. **Send Picture** (if image present)
   - Broadcasts to players and external display
   - Flow: `ready` → `sent-picture`

5. **Send Question**
   - Broadcasts question text and options to players and external display
   - Flow: `sent-picture` → `sent-question` (or `ready` → `sent-question` if no image)
   - **Primary control now shows: "Start Timer"**

6. **Start Timer** (or Start Silent Timer)
   - `useTimer.start()` begins countdown
   - Broadcasts timer to external display for animations
   - Flow: `sent-question` → `running`
   - **Primary control now shows: "Reveal Answer"**
   - Top progress bar drains as time counts down

7. **Timer Ends or Reveal Button Clicked**
   - If timer ends naturally: `flow = 'timeup'`
   - Host clicks "Reveal Answer" (or spacebar)
   - Broadcasts answer to players and external display
   - Flow: `running`/`timeup` → `revealed`
   - **Question Panel now displays the answer**
   - **Primary control now shows: "Fastest Team"**

8. **Show Fastest Team**
   - Broadcasts fastest team info to external display
   - Flow: `revealed` → `fastest`
   - **Primary control now shows: "Next Question" or "End Round"**

9. **Next Question or End Round**
   - If more questions: increment index, effect resets flow to `ready`
   - If last question: `flow = 'complete'`, returns to home screen

## Keyboard Shortcuts

- **Spacebar**: Triggers the primary blue action button
- A–F (optional): Can highlight MCQ options locally (not yet implemented; for future)
- Esc (optional): Cancel/pause timer (not yet implemented; for future)

## Networking & Future Player App

### Message Protocol (Prepared but Not Yet Live)

When the player phone app is built, it will connect via:
```javascript
const ws = new WebSocket('ws://host-ip:8787');
```

Messages broadcast FROM host TO players and external:
```typescript
{
  type: 'PICTURE',
  data: { image: base64_or_url },
  timestamp: unix_ms
}
{
  type: 'QUESTION',
  data: { text, options, type },
  timestamp: unix_ms
}
{
  type: 'TIMER_START',
  data: { seconds, silent },
  timestamp: unix_ms
}
{
  type: 'TIMER',  // for external display animations
  data: { seconds },
  timestamp: unix_ms
}
{
  type: 'TIMEUP',  // time hit zero
  timestamp: unix_ms
}
{
  type: 'LOCK',  // submissions locked
  timestamp: unix_ms
}
{
  type: 'REVEAL',
  data: { answer, correctIndex, type },
  timestamp: unix_ms
}
{
  type: 'FASTEST',
  data: { teamName, questionNumber },
  timestamp: unix_ms
}
{
  type: 'NEXT',  // move to next question
  timestamp: unix_ms
}
{
  type: 'END_ROUND',
  timestamp: unix_ms
}
{
  type: 'SCORES',
  data: { scores: [{ teamId, teamName, score }] },
  timestamp: unix_ms
}
```

Players SEND back TO host:
```typescript
{
  type: 'ANSWER',
  data: {
    teamId,
    questionIndex,
    value,  // free text or number
    optionIndex,  // for MCQ
    order  // for sequence (array of indices)
  },
  timestamp: unix_ms
}
```

### Current State (No Live WebSocket Yet)

- Network functions log to console
- External display integration uses `externalWindow.postMessage()` (current approach)
- When player app is built:
  1. Enable WebSocket server in Electron main process (or Node.js dev server)
  2. Update `src/network/wsHost.ts` to actually connect clients
  3. Add IPC bridges for Electron if needed
  4. Player app connects and subscribes to message types

## Type 1 vs Type 2 Questions

### Type 1: Quiz Pack Questions (This System)
- **Source**: .sqq or .pop files loaded via quizLoader
- **Answer**: Pre-defined in the quiz file (`question.answerText`, `question.correctIndex`)
- **Host UI**: Shows question, options, answer (when revealed)
- **Players**: Receive question via network; submit their answer via player devices (later)
- **Flow**: Uses this new state machine

### Type 2: On-the-Spot Questions (Future)
- **Source**: Host manually creates via UI (not yet built)
- **Answer**: Host inputs answer after typing the question
- **Host UI**: Question composer, answer input field
- **Players**: Receive question type (letters, multi, numbers, etc.); respond on devices
- **Flow**: Will also use this state machine
- **Note**: `flowState.answerSubmitted` field is prepared for this

## Extending the System

### Adding Support for On-the-Spot Questions
1. Create a `OnTheSpoQuestionInterface` component
2. Let host:
   - Type the question text
   - Select response type (letters, multi, numbers, sequence, buzzin)
   - Input the correct answer
   - Optionally upload an image
3. When host clicks "Start", initialize flow state with the host-created question
4. Rest of the flow is identical to Type 1

### Adding Real Player Devices
1. Build player phone app (web or native)
2. Implement WebSocket connection logic in player app
3. Listen for: `PICTURE`, `QUESTION`, `TIMER_START`, `TIMEUP`, `LOCK`, `REVEAL`, `FASTEST`, `NEXT`, `END_ROUND`
4. Send: `ANSWER` messages back to host
5. Enable WebSocket server in `src/network/wsHost.ts`
6. Hook up player answer processing in QuizHost

### Customizing Timer Lengths
Edit `useSettings()` context:
- `gameModeTimers.keypad`: default 30s for letters, multi, sequence
- `gameModeTimers.nearestwins`: default 10s for numbers/nearest
- `gameModeTimers.buzzin`: default 30s for free-text buzzin

Or override per question via metadata (not yet implemented).

## Debugging

### Logs
- Flow state changes: Check browser console
- Timer ticks: `useTimer` logs on `onTick`
- Network broadcasts: `wsHost.ts` logs each broadcast
- External display messages: Check `externalWindow.postMessage()` calls

### Common Issues
1. **Timer bar not visible**: Check `flowState.flow` in dev tools; bar only shows when `flow === 'sent-question' || 'running' || 'timeup'`
2. **Primary button not responding**: Ensure `flowState.isQuestionMode === true`
3. **Spacebar not working**: Check if window has focus; global keydown listener attached in `PrimaryControls`
4. **External display not updating**: Verify `externalWindow` is not null/closed before calling `postMessage()`

## Future Roadmap

1. **Implement On-the-Spot Mode**
   - `OnTheSpoQuestionInterface` component
   - Host answer entry
   - Reuse flow state system

2. **Enable WebSocket Server**
   - Move server to Electron main or Node.js
   - Connect player devices
   - Receive and process `ANSWER` messages

3. **Player Device Integration**
   - Build mobile web app for players
   - Real-time answer submission
   - Team response tracking
   - Visual feedback (correct/incorrect)

4. **Enhanced External Display**
   - Tie all new broadcasts into existing external display animations
   - Show fastestteam stats
   - Real-time scoreboard updates

5. **Keyboard Enhancements**
   - A–F for MCQ selection (host-side only, for demo)
   - Esc to cancel/pause timer
   - Enter to manually submit (for testing)

## File Structure

```
src/
├── components/
│   ├── QuestionPanel.tsx          (NEW: main question display)
│   ├── PrimaryControls.tsx        (NEW: bottom-right controls)
│   ├── TimerProgressBar.tsx       (EXISTING: top draining bar)
│   ├── QuizPackDisplay.tsx        (UPDATED: added onStartQuiz callback)
│   └── QuizHost.tsx               (UPDATED: integrated flow system)
├── hooks/
│   └── useTimer.ts                (NEW: countdown timer)
├── state/
│   └── flowState.ts               (NEW: state machine definitions)
├── network/
│   └── wsHost.ts                  (NEW: networking scaffold)
└── ...
```

## Summary

The question flow system provides a clean, extensible framework for driving quiz questions through their lifecycle. It integrates with the existing QuizHost architecture and is prepared for future player device connectivity via WebSocket. The state machine ensures a predictable, reliable progression through each step, while the networking scaffold is ready for integration with player devices and the external display system.
