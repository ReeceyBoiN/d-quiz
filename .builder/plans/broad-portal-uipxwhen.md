# Fix Auto-Approval When Team Photos Tab is Closed

## Problem Statement
Auto-approval for team photos only works when the Team Photos tab is actively open. When the tab is closed, new photos aren't auto-approved even though the setting is enabled.

### Root Causes
1. **Component Mount Dependency**: The `TEAM_PHOTO_UPDATED` listener is registered in BottomNavigation.tsx via useEffect. If the tab isn't open, BottomNavigation isn't mounted, so the listener never registers.
2. **Type Mismatch**: The validation checks `teamPhotoPending === true` (strict equality), but the value may be the string `"true"` or another truthy value from the backend.

## Solution Approach

### Option A: Move Auto-Approval Logic to Always-Mounted Component (Recommended)
Move the auto-approval handling from BottomNavigation to **QuizHost.tsx** (which is always mounted at app level).

**Steps:**
1. In QuizHost.tsx, add a listener for `TEAM_PHOTO_UPDATED` events
2. Inside the handler, check if auto-approval is enabled (fetch from settings via IPC or state)
3. If enabled, validate the photo with loose comparison for `teamPhotoPending`
4. Call `handleApprovePhoto` or trigger approval via the backend directly
5. Keep the BottomNavigation handler for UI updates (button shows, photo display)

**Benefits:**
- Auto-approval happens regardless of whether BottomNavigation is mounted
- Photo approval completes before tab is even opened
- Cleaner separation of concerns (QuizHost handles auto-approval logic, BottomNavigation handles UI)

### Option B: Fix Type Comparison Only (Partial Fix)
Change the strict equality check in BottomNavigation to a loose comparison:
```javascript
// Instead of:
if (player?.teamPhotoPending === true) { ... }

// Use:
if (player?.teamPhotoPending == true || player?.teamPhotoPending === 'true' || player?.teamPhotoPending === 1) { ... }
```

**Limitation:** Still won't auto-approve when tab is closed because listener won't be registered.

## Implementation (Option A Selected)

### Critical Constraint
Auto-approval will **ONLY** occur when the `Team Photos Auto Approval` toggle is explicitly ENABLED.
- **If toggle is ON**: Photos are auto-approved immediately upon upload
- **If toggle is OFF**: Photos remain pending and require manual approval by the host user via Approve/Decline buttons

### Files to Modify
1. **src/components/QuizHost.tsx**:
   - Add TEAM_PHOTO_UPDATED listener (always registered, doesn't depend on tab being open)
   - Check if `teamPhotosAutoApprove === true` (read from settings/state)
   - Only if enabled: validate photo state and call `handleApproveTeam` IPC
   - Log all decisions clearly for debugging

2. **src/components/BottomNavigation.tsx**:
   - Keep the TEAM_PHOTO_UPDATED handler for UI updates and orange flash indicator
   - Remove or comment out the auto-approval logic (now handled by QuizHost)
   - Fix type comparison to handle string vs boolean values
   - Handler still refreshes pending photos list for accurate UI display

### Flow Diagram
```
TEAM_PHOTO_UPDATED event arrives
    ↓
QuizHost listener (always mounted) receives it
    ↓
Check: Is teamPhotosAutoApprove === true?
    ├─ YES → Call approveTeam IPC → Photo approved, removed from pending
    └─ NO  → Do nothing, wait for manual approval
    ↓
BottomNavigation listener (if tab open) receives same event
    ↓
Update UI: refresh pending photos list, show orange flash if still pending
```

## Expected Outcome
- New photos are auto-approved immediately when submitted, even if the Team Photos tab is closed
- No delay in approval
- User can open the tab and see the photo is already approved
- Orange flash disappears on tab without needing to open it
