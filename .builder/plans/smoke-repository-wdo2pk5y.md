# Scramble Keypad: On-the-Spot / Keypad Mode Support

## Problem
Scramble keypad only works in quiz pack mode. In on-the-spot modes (Keypad, Nearest Wins), questions are broadcast to players via direct IPC calls (`network/broadcast-question`) **without** including `teamScrambleStates`. This means players never receive scramble info when the host uses keypad mode on-the-spot.

### Affected broadcast locations

| File | Line(s) | Mode | Issue |
|------|---------|------|-------|
| `KeypadInterface.tsx` | ~565 | On-the-spot keypad | No `teamScrambleStates` in IPC payload |
| `NearestWinsInterface.tsx` | ~406 | Nearest Wins start | No `teamScrambleStates` in IPC payload |
| `NearestWinsInterface.tsx` | ~803 | Nearest Wins next question | No `teamScrambleStates` in IPC payload |

**BuzzInInterface.tsx** also broadcasts without it (~line 73), but buzz-in is a single button press with no keypad to scramble, so no change needed there.

## Root Cause
Both `KeypadInterface` and `NearestWinsInterface` receive `teams={quizzes}` as a prop from `QuizHost`, but their TypeScript types don't include the `scrambled` field. The actual runtime data **does** contain `scrambled` since the full `Quiz` objects are passed — only the type annotation is too narrow.

## Approach
1. **Widen the `teams` prop type** in `KeypadInterface.tsx` and `NearestWinsInterface.tsx` to include `scrambled?: boolean`
2. **Build `teamScrambleStates` map** from the teams prop inside each component
3. **Include `teamScrambleStates`** in the IPC broadcast payloads

This is the simplest approach — no new props needed, no changes to QuizHost, since the data is already being passed.

## Changes

### 1. `src/components/KeypadInterface.tsx`

**Type update** (line 30):
```
teams?: Array<{id: string, name: string, score?: number}>
→ teams?: Array<{id: string, name: string, score?: number, scrambled?: boolean}>
```

**Broadcast update** (~line 565): Add `teamScrambleStates` to the question payload:
```typescript
const teamScrambleStates: Record<string, boolean> = {};
(teams || []).forEach(t => { teamScrambleStates[t.name] = t.scrambled ?? false; });

(window as any).api?.ipc?.invoke('network/broadcast-question', {
  question: {
    type: type,
    text: 'Question is ready...',
    options: placeholderOptions,
    timestamp: Date.now(),
    teamScrambleStates,  // ← ADD
  }
})
```

### 2. `src/components/NearestWinsInterface.tsx`

**Type update** (line 15):
```
teams?: Array<{id: string, name: string, score?: number}>
→ teams?: Array<{id: string, name: string, score?: number, scrambled?: boolean}>
```

**Broadcast update** (~line 406, start round): Add `teamScrambleStates` to payload.

**Broadcast update** (~line 803, next question): Add `teamScrambleStates` to payload.

Both follow same pattern: build map from `teams` prop, include in question object.

## Files Modified
- `src/components/KeypadInterface.tsx` — 1 type change + 1 broadcast update
- `src/components/NearestWinsInterface.tsx` — 1 type change + 2 broadcast updates
