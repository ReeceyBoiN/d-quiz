# Flashing Speaker Icon for Teams Without Buzzer Selected

## Goal
Show a flashing speaker icon next to a team's name in the host app's teams list when the team has connected but has not yet selected a buzzer sound.

## Approach

### File: `src/components/LeftSidebar.tsx`

1. **Add `buzzerSound` to the local `Quiz` interface** — add `buzzerSound?: string` so the component can read the property from the passed-in quiz objects (QuizHost already passes this data).

2. **Import the `Volume2` icon** from `lucide-react` (speaker icon).

3. **Add a flashing speaker icon** next to the team name, shown when:
   - The team is NOT disconnected (`!quiz.disconnected`)
   - The team has no buzzer selected (`!quiz.buzzerSound`)
   
   This icon will be placed alongside the existing status icons (WifiOff, ShieldOff, Pause, etc.) in the team name button area.

4. **Add a CSS animation** for the flashing effect using Tailwind's `animate-pulse` or a custom keyframe animation for a more visible flash. A custom `@keyframes` blink animation (toggling opacity) will be added via a `<style>` tag or Tailwind config for a distinct flashing effect.

### No changes needed in `QuizHost.tsx`
The `buzzerSound` property is already on the quiz objects passed to LeftSidebar — we just need to type it in LeftSidebar's interface.
