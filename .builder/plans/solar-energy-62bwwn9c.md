# Flashing Speaker Icon — Implementation Complete

## Summary
The flashing speaker icon for teams without a buzzer selected has already been implemented and reviewed.

## Changes Made (in `src/components/LeftSidebar.tsx`)

1. **Added `buzzerSound?: string`** to the local `Quiz` interface
2. **Imported `Volume2`** icon from `lucide-react`
3. **Added the flashing icon** inline with existing status icons, shown when `!quiz.disconnected && !quiz.buzzerSound`
4. **Added custom `buzzer-flash` CSS keyframes** (opacity toggle, 1s loop) via an inline `<style>` tag

## Review Findings
- Icon uses identical `w-4 h-4 flex-shrink-0` sizing as all other status icons — no layout risk
- Yellow color (`text-yellow-500`) is distinct from existing icon colors
- Animation only affects opacity — no layout reflow
- Logic correctly hides the icon for disconnected teams and once a buzzer is selected
- No additional wiring needed — `buzzerSound` is already passed from `QuizHost` via the `quizzes` prop

## Status
No further changes needed. Ready to rebuild and test.
