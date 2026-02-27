# Implementation Plan for Nearest Wins Timer Issues

## Problem Analysis
1. **Wrong Audio for Timers**: The `startTimer` and `silentTimer` buttons in the Nearest Wins "on the spot" mode both play the silent timer audio. This happens because `QuizHost.tsx` calls `gameActionHandlers.startTimer(durationToPass)` with a numeric duration (e.g., 30). However, `NearestWinsInterface` expects the argument to be a boolean `isSilent`. Since a positive number like 30 evaluates as "truthy", `NearestWinsInterface` misinterprets the duration as `isSilent=true` and plays the silent audio for both buttons.
2. **Timer Starting at 10s Instead of 30s**: The Nearest Wins UI currently pulls `nearestWinsTimer` directly from `useSettings()`. However, the settings menu specifically updates `gameModeTimers.nearestwins`. Because `nearestWinsTimer` is never updated by the UI slider, it defaults to `10` even if the settings show 30 seconds for the Nearest Wins mode. Additionally, `NearestWinsInterface` has a hardcoded initial `totalTimerLength` of 10.

## Planned Changes

### 1. `src/components/NearestWinsInterface.tsx`
- Update the `NearestWinsInterfaceProps` type signature to accept numeric durations for action handlers:
  ```typescript
  onGetActionHandlers?: (handlers: { reveal: () => void; nextQuestion: () => void; startTimer: (duration?: number) => void; silentTimer?: (duration?: number) => void }) => void;
  ```
- Change the hook destructuring to get `gameModeTimers` instead of `nearestWinsTimer`:
  ```typescript
  const { gameModeTimers, gameModePoints, voiceCountdown, keypadDesign } = useSettings();
  const nearestWinsTimer = gameModeTimers.nearestwins || 30;
  ```
- Update `totalTimerLength` initialization:
  ```typescript
  const [totalTimerLength, setTotalTimerLength] = useState<number>(30); // Will update properly on start
  ```
- Modify `handleStartTimer` to accept `duration` and `isSilentParam`, correctly distinguishing between local invocations and remote calls:
  ```typescript
  const handleStartTimer = useCallback((duration?: number | boolean, isSilentParam?: boolean) => {
    let durationToUse = nearestWinsTimer;
    let isSilent = false;
    
    if (typeof duration === 'number') {
      durationToUse = duration;
      isSilent = !!isSilentParam;
    } else if (typeof duration === 'boolean') {
      isSilent = duration;
    } else if (isSilentParam !== undefined) {
      isSilent = isSilentParam;
    }
  // ... and update rest of the function to use durationToUse
  ```
- Update `totalTimerLength` references inside the component (e.g. `onExternalDisplayUpdate` payloads) to use `totalTimerLength` consistently.
- Update `onGetActionHandlers` to register correctly with `duration`:
  ```typescript
  startTimer: (duration?: number) => handlersRef.current.startTimer(duration, false),
  silentTimer: (duration?: number) => handlersRef.current.startTimer(duration, true),
  ```

### Rationale
These changes correctly parse the duration injected by `QuizHost` without breaking local state or keyboard shortcuts that trigger the timer locally. Also, updating the `useSettings` variable to the one bound to the UI guarantees the slider accurately determines the initial/default time of the game.

## Summary
The plan strictly avoids major structural changes and instead provides targeted type, parameter mapping, and state initialization fixes to accurately sync Nearest Wins with `QuizHost` properties and UI configurations.
