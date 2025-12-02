# PopQuiz Player App

The PopQuiz Player App is a React-based client that runs on player devices to submit answers and receive real-time quiz updates from the host.

## Features

- **Team Registration**: Players enter their team name and are instantly added to the host's team list
- **Real-time Question Delivery**: Questions appear on player devices synchronized with the host
- **Answer Submission**: Multiple choice and buzz-in answer modes with visual feedback
- **Timer Sync**: Real-time countdown timer displayed on player devices
- **Reveal Notifications**: Instant notification when correct answers are revealed

## Development

### Prerequisites

- Node.js 16+
- npm or yarn

### Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The app will open at `http://localhost:3001` by default.

### Building

```bash
npm run build
```

The built files will be output to `../dist-player/`

## Connecting to Host

1. Make sure your device is on the same network as the host computer
2. In your browser, navigate to one of these:
   - Direct IP: `http://<host-ip>:4310` (e.g., `http://192.168.1.100:4310`)
   - mDNS (if supported): `http://popquiz.local` (on macOS/Linux)
3. Enter your team name and click "Join Game"
4. Wait for the host to start the quiz

## Architecture

- **Network**: WebSocket-based real-time communication with Express backend
- **State Management**: React hooks (useState, useEffect)
- **Styling**: Tailwind CSS for responsive design
- **UI Components**: Custom components matching the host design

## Component Structure

- `App.tsx` - Main application container and state management
- `components/TeamNameEntry.tsx` - Initial team registration screen
- `components/WaitingScreen.tsx` - Screen shown while waiting for quiz to start
- `components/QuestionDisplay.tsx` - Question display with answer options
- `hooks/useNetworkConnection.ts` - WebSocket connection management
- `context/NetworkContext.tsx` - Shared network state context

## Message Protocol

The app communicates with the host using JSON messages over WebSocket:

### Incoming (Host → Player)

- `QUESTION` - New question to display
- `TIMER_START` - Start countdown timer
- `TIMER` - Update remaining time
- `TIMEUP` - Time is up
- `REVEAL` - Show correct answer
- `PICTURE` - Display image
- `NEXT` - Move to next question
- `END_ROUND` - End of round

### Outgoing (Player → Host)

- `PLAYER_JOIN` - Register team name
- `PLAYER_ANSWER` - Submit answer to question
