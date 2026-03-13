# Fix: "Infinitys" Text Appearing on External Display

## Problem

The text "Infinitys" appears on the external display screen (and potentially other places) where a response time should be shown. This happens during buzz-in mode when a team buzzes in.

## Root Cause

The bug originates from a fallback pattern used when looking up response times:

**`src/components/QuizHost.tsx` line 1416:**
```ts
.map(([teamId]) => ({ teamId, time: teamResponseTimes[teamId] || Infinity }))
```

When a team buzzes in but their response time hasn't been recorded yet (e.g., `gameTimerStartTime` is null, or the timestamp wasn't provided), `teamResponseTimes[teamId]` is `undefined`, so it falls back to JavaScript's `Infinity` value.

This `Infinity` value then gets sent to the external display at line 1452:
```ts
responseTime: validBuzzes[0].time,  // could be Infinity
```

The external display formats it at line 1553:
```ts
{(responseTime / 1000).toFixed(2)}s
// Infinity / 1000 = Infinity
// Infinity.toFixed(2) = "Infinity"  
// + "s" = "Infinitys"
```

## All Affected Locations

### Places that use `|| Infinity` fallback (source of bad values):
1. **`src/components/QuizHost.tsx:1416`** — Buzz detection: `teamResponseTimes[teamId] || Infinity`
2. **`src/components/QuizHost.tsx:2748-2749`** — Fastest team calculation: `teamResponseTimes[current.id] || Infinity`
3. **`src/components/QuizHost.tsx:5292`** — Score computation: `teamResponseTimes[teamId] || Infinity`
4. **`src/components/KeypadInterface.tsx:469,472`** — Fastest team: `teamResponseTimes[...] || Infinity`
5. **`src/utils/answerStats.ts:108,111`** — Answer stats: `teamResponseTimes[...] || Infinity`
6. **`src/components/QuizPackDisplay.tsx:871`** — Quiz pack: `teamResponseTimes?.[teamId] || Infinity`

### Places that render response time without guarding against Infinity:
1. **`src/components/ExternalDisplayWindow.tsx:1553`** — Buzz-in team view: `{(responseTime / 1000).toFixed(2)}s`
2. **`src/components/ExternalDisplayWindow.tsx:899`** — Fastest team view: `{(displayData.data.fastestTeam.responseTime / 1000).toFixed(2)}s`
3. **`src/components/LeftSidebar.tsx:268`** — Team response time: `{(teamResponseTimes[quiz.id] / 1000).toFixed(2)}s`
4. **`src/components/FastestTeamDisplay.tsx:92`** — `formatResponseTime`: `${(timeMs / 1000).toFixed(2)}s`

## Solution

Two-pronged approach: fix the source AND guard the display.

### 1. Fix the source — Don't send Infinity to display

In `QuizHost.tsx` buzz detection (line 1446-1453), only include `responseTime` if it's a valid finite number:

```ts
const rawTime = validBuzzes[0].time;
const responseTime = Number.isFinite(rawTime) ? rawTime : undefined;

sendToExternalDisplay({
  type: 'DISPLAY_UPDATE',
  mode: 'buzzin-team',
  data: {
    teamName: team?.name || `Team ${firstTeamId}`,
    teamColor: team?.backgroundColor,
    responseTime,  // undefined if not finite
  },
});
```

Note: The `|| Infinity` pattern used for **sorting** (lines 2748, 5292, KeypadInterface, answerStats) is actually correct — it ensures teams without response times sort to the end. These should NOT be changed because they're only used for comparison, not display. The fix is only needed where the value leaks to the UI.

### 2. Guard the display — Protect all rendering locations

**`src/components/ExternalDisplayWindow.tsx:1551-1554`** — Guard the buzz-in response time display:
```ts
{responseTime && Number.isFinite(responseTime) && (
  <p ...>{(responseTime / 1000).toFixed(2)}s</p>
)}
```

**`src/components/ExternalDisplayWindow.tsx:899`** — Guard the fastest team response time:
```ts
{Number.isFinite(displayData.data.fastestTeam.responseTime) && (
  <div ...>{(displayData.data.fastestTeam.responseTime / 1000).toFixed(2)}s</div>
)}
```

**`src/components/LeftSidebar.tsx:265-270`** — Guard team response time display:
```ts
{responseTimesEnabled && teamResponseTimes[quiz.id] !== undefined && Number.isFinite(teamResponseTimes[quiz.id]) && (
```

**`src/components/FastestTeamDisplay.tsx:91-93`** — Guard formatResponseTime:
```ts
const formatResponseTime = (timeMs: number) => {
  if (!Number.isFinite(timeMs)) return '—';
  return `${(timeMs / 1000).toFixed(2)}s`;
};
```

## Files to Modify

1. `src/components/QuizHost.tsx` — Sanitize responseTime before sending to external display
2. `src/components/ExternalDisplayWindow.tsx` — Guard 2 render locations against Infinity
3. `src/components/LeftSidebar.tsx` — Guard response time render
4. `src/components/FastestTeamDisplay.tsx` — Guard formatResponseTime helper
