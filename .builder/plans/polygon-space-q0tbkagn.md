# Implementation Plan for Fastest Team Photo Auto-Hide

## Goal
Display the team photo of the "fastest team" for 5 seconds as an overlay on both the player devices and the external display/livescreen, returning to the previous view once the 5 seconds are up.

## Discovery & Constraints
1. **Player Devices**: The player app (`src-player/src/App.tsx`) already correctly displays the `FastestTeamOverlay` with the team photo upon receiving the `FASTEST` network event. It also natively includes a `setTimeout` to hide the overlay after 5 seconds automatically. **No code changes are needed here!**
2. **External Display / Livescreen**: Currently, `QuizHost.tsx` changes the external window to `mode: 'fastestTeam'` upon revealing the fastest team. The external window itself (`ExternalDisplayWindow.tsx`) does not auto-hide this mode. Based on user preference, we will make the Quiz Host drive the 5-second auto-hide logic so that it controls reverting back to the previous screen (either `resultsSummary` or `correctAnswer`).

To accomplish this safely without destroying the complex state objects rendered on the external display, `QuizHost.tsx` will cache the previous external display state and explicitly send an update to revert after a 5-second timer.

## Planned Changes

### 1. File `src/components/QuizHost.tsx`

**Manage External Display State:**
- Add a new ref to cache the last non-fastest display state:
  ```tsx
  const lastExternalDisplayMessageRef = useRef<any>(null);
  ```
- Add a new ref for the timeout ID:
  ```tsx
  const fastestTeamTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  ```

**Update `sendToExternalDisplay` function:**
- Intercept calls to `sendToExternalDisplay`. If the `messageData.mode` is NOT `fastestTeam`, cache the payload in `lastExternalDisplayMessageRef`.
- Additionally, if a new non-fastest payload is being sent, clear `fastestTeamTimeoutRef` to prevent overriding a brand-new screen (like moving to the next question) with a stale timeout revert.

**Implement Auto-Revert Logic:**
- **On the Spot Mode:** Around line 2457, in the `isOnTheSpotMode` section where `fastestTeam` is broadcasted and sent to `externalWindow`, append the following:
  ```tsx
  fastestTeamTimeoutRef.current = setTimeout(() => {
    if (lastExternalDisplayMessageRef.current) {
      sendToExternalDisplay(lastExternalDisplayMessageRef.current);
    }
  }, 5000);
  ```
- **Quiz Pack Mode:** Around line 2526, inside the `revealed` case block where `fastestTeam` is sent to `externalWindow`, append the identical timeout logic.

## Rationale
This approach allows the Quiz Host application to remain fully in control of the external display's state lifecycle without forcing us to alter the complex data-handling logic inside `ExternalDisplayWindow.tsx`. It ensures the `teamPhoto` appears for exactly 5 seconds alongside the buzzer sound, automatically restores the results summary (or correct answer) with all its stats intact, and safely aborts the timer if the host clicks "Next Question" prematurely.
