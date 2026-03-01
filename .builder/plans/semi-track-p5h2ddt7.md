# Plan: Display Fastest Team Photo on Player Devices

## Overview
Implement the display of the fastest team's photo on all player devices (phones) when a team answers a question correctly and fastest. The photo should display for 5 seconds with smooth animations, matching the style of the external display. All player devices should see this celebration, regardless of which team they're on.

## Current State
- The host (QuizHost.tsx) already has logic to detect the fastest team and send data via `broadcastFastest()`
- The backend (electron/backend/server.js) has infrastructure to broadcast messages to player WebSocket connections
- The player app (src-player/src/App.tsx) has message handlers and a FastestTeamOverlay component
- **Issue**: The feature is not currently working on player devices - needs debugging and completion

## Recommended Approach

### Phase 1: Verify & Debug Current Implementation
**Goal**: Identify why the broadcast isn't reaching player devices

1. **Check QuizHost.tsx fastest team detection**
   - Verify `fastestTeam` is being correctly identified when answers are revealed
   - Confirm the host is calling `window.api.network.broadcastFastest()` with correct data (teamName, teamPhoto, questionNumber)
   - Check that `teamPhoto` URL is being passed (not null/undefined)

2. **Verify backend broadcast function**
   - Check electron/backend/server.js `broadcastFastest()` function
   - Ensure it's correctly forming the FASTEST message with teamName, teamPhoto, and questionNumber
   - Verify it's iterating through networkPlayers and sending to all approved player connections
   - Check WebSocket readyState is 1 (open) before sending

3. **Verify player WebSocket connection**
   - Check src-player/src/App.tsx message handler for 'FASTEST' case
   - Ensure the handler is correctly destructuring teamName and teamPhoto from message.data
   - Verify state setters (setFastestTeamName, setFastestTeamPhoto, setShowFastestTeam) are being called

### Phase 2: Ensure Complete Implementation
**Goal**: Make sure all pieces are connected end-to-end

1. **Verify FastestTeamOverlay component exists and is imported**
   - Check src-player/src/components/FastestTeamOverlay.tsx exists and renders when showFastestTeam is true
   - Verify it's properly mounted in the player app's main render
   - Ensure the overlay is positioned correctly (fixed positioning, full screen background)

2. **Check auto-hide timer logic**
   - Verify the 5-second useEffect is properly clearing timeouts
   - Ensure state cleanup happens after timeout (setShowFastestTeam(false), clear teamName and teamPhoto)

3. **Verify styling matches external display**
   - Compare FastestTeamOverlay.tsx styling with FastestTeamOverlaySimplified.tsx (used on external display)
   - Ensure consistent visual presentation: team photo, team name, "FASTEST TEAM" label
   - Ensure animations are smooth (scale-in, fade-in on appearance, scale-out fade-out on disappearance)

### Phase 3: Enhance if Needed
**Goal**: Add polish and ensure smooth operation

1. **Animation polish**
   - Verify scale and opacity transitions use smooth easing (e.g., ease-out for entrance, ease-in for exit)
   - Ensure duration is appropriate (typically 300ms for transitions)
   - Consider adding a slight delay before overlay becomes visible (50ms is standard in current code)

2. **Photo loading**
   - Handle broken image URLs gracefully (fallback to placeholder or team name only)
   - Add loading state if needed
   - Ensure images are properly sized for mobile screens

3. **Race conditions**
   - If a new FASTEST message arrives while overlay is showing, restart the 5-second timer
   - Clear any pending timers when component unmounts

## Key Files to Modify/Check

### Host Side (Main App)
- **src/components/QuizHost.tsx** - Verify fastest team is detected and `broadcastFastest()` is called
- **src/network/wsHost.ts** - Check broadcast helper if being used

### Backend
- **electron/backend/server.js** - Verify `broadcastFastest()` implementation sends to all player WebSockets

### Player Side  
- **src-player/src/App.tsx** - Verify FASTEST message handler and timer logic
- **src-player/src/components/FastestTeamOverlay.tsx** - Component that renders the overlay
- **src-player/src/types/network.ts** - Ensure FASTEST message type is defined

## Success Criteria
1. When the host's fastest team is determined, all connected player devices receive the broadcast
2. Player devices display the fastest team's photo + name for exactly 5 seconds
3. Overlay uses smooth animations (scale/fade in and out)
4. Styling is consistent with the external display version
5. Photo loads correctly or gracefully falls back if broken
6. Multiple rapid broadcasts don't break the timer (timer resets correctly)
7. Feature works smoothly across all player devices simultaneously

## Implementation Strategy
- Start by reading the actual code to verify the current state
- Check for bugs in the broadcast chain (host → backend → players)
- Fix any missing pieces or broken connections
- Polish animations and styling for consistency
- Test with multiple player devices to ensure simultaneous display works
