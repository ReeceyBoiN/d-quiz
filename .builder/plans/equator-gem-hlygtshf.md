# Implementation Plan for Fastest Team Buzzer Sound

## Goal
Play the assigned buzzer sound of the "fastest team" on the host machine whenever the fastest team is revealed at the end of a question. This must work in both "Quiz Pack Mode" and "On the Spot Mode".

## Analysis
The fastest team is determined and revealed in two primary ways in `QuizHost.tsx`:
1. **Quiz Pack Mode / Keypad Fastest Reveal:** The central `handleFastestTeamReveal` function is called. It shows the `FastestTeamDisplay` overlay on the host and switches the active tab. This is the ideal place to put the central audio playback logic.
2. **On the Spot Mode (Automatic):** When the timer ends and the answer is revealed, `QuizHost` automatically calculates the fastest team and broadcasts it to the external display and players. However, it bypasses `handleFastestTeamReveal` so that it doesn't interrupt the `KeypadInterface` host UI. We must also insert audio playback into this code path to ensure the buzzer plays here as well.

## Planned Changes

### 1. File `src/components/QuizHost.tsx`

**Imports:**
- Add `getBuzzerFilePath` and `getBuzzerUrl` from `../utils/api` to resolve the audio URL properly (using IPC with a fallback to HTTP).

**Refs & Helpers:**
- Add `const buzzerAudioRef = useRef<HTMLAudioElement>(null);` near the other refs.
- Create a `playFastestTeamBuzzer` helper function:
  ```tsx
  const playFastestTeamBuzzer = useCallback(async (buzzerSound?: string) => {
    if (!buzzerSound) return;
    try {
      let audioUrl: string | null = null;
      try {
        audioUrl = await getBuzzerFilePath(buzzerSound);
      } catch (e) {
        if (hostInfo) audioUrl = getBuzzerUrl(hostInfo, buzzerSound);
      }
      if (!audioUrl) return;
      
      if (buzzerAudioRef.current) {
        buzzerAudioRef.current.src = audioUrl;
        await buzzerAudioRef.current.play().catch(err => console.error(err));
      }
    } catch (err) {
      console.error(err);
    }
  }, [hostInfo]);
  ```

**Update Call Sites:**
- Inside `handleFastestTeamReveal`, call `playFastestTeamBuzzer(teamToUse.buzzerSound)` if a team is found.
- Inside the `case 'timeup':` section (around line 2416), within the `isOnTheSpotMode` block, call `playFastestTeamBuzzer(fastestTeam.buzzerSound)` when `fastestTeam` is identified and broadcasted.

**JSX Output:**
- Add `<audio ref={buzzerAudioRef} />` at the bottom of the component's render output (before the final closing `</div>`) so the audio can be played.

## Rationale
Using an `<audio>` tag attached via a React ref and the pre-existing IPC logic for buzzer files (`getBuzzerFilePath`) ensures we safely bypass browser CSP or local path resolution issues. Hooking into both `handleFastestTeamReveal` and the on-the-spot fastest logic covers all edge cases seamlessly.
