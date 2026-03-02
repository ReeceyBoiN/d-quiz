# Plan: Move Confirm Button Right + Fix Results Summary Parity

## Problem 1: Confirm Button Position (On-the-Spot Nearest Wins)

### Current State
- In NearestWinsInterface.tsx and KeypadInterface.tsx numbers-game screen
- Confirm button is rendered below the keypad using "flex justify-center mt-6"
- Keypad and button are stacked vertically

### Desired State
- Confirm button positioned directly to the right of the keypad
- Both keypad and button vertically centered together
- Side-by-side layout (flex row)

### Implementation Details
**Files to modify:**
1. **src/components/NearestWinsInterface.tsx** (lines ~905-977)
   - Change container from vertical stack to horizontal flex row
   - Wrap keypad + confirm button in a flex row container
   - Vertically center both elements
   - Add gap between keypad and button

2. **src/components/KeypadInterface.tsx** (lines ~2099-2183 for numbers-game)
   - Apply same layout changes to the numbers-game screen
   - Ensure consistency between both implementations

### Tailwind Changes
- Replace vertical "flex justify-center mt-6" wrapper with horizontal flex row
- Change from:
  ```
  <div className="flex justify-center mt-6">
    <Button>CONFIRM ANSWER</Button>
  </div>
  ```
- To (conceptually):
  ```
  <div className="flex items-center justify-center gap-6">
    <div className="keypad-container">...</div>
    <Button>CONFIRM ANSWER</Button>
  </div>
  ```
- Keep keypad centered with: `mx-auto` (remove after moving to flex row)
- Vertically center both with flex items-center

---

## Problem 2: Results Summary Parity (Quiz Pack vs On-the-Spot)

### Current State - Differences Found
**On-the-Spot Mode (KeypadInterface)** has:
- ✅ Results Summary heading
- ✅ Three stat boxes (Correct / Wrong / No Answer)
- ✅ Correct Answer display box
- ✅ Fastest Team inline (team name + response time)

**Quiz Pack Mode** has gaps:
- External Display resultsSummary has:
  - ✅ Three stat boxes (if counts are provided)
  - ✅ Correct Answer display
  - ❌ **Fastest Team is NOT shown** (handled separately as a different display mode)
- Host UI:
  - KeypadInterface mode: suppresses inline fastest team (defers to parent FastestTeamDisplay overlay)
  - QuestionPanel mode: uses separate overlay without showing fastest in results

### Key Issue
Fastest Team is displayed inline in on-the-spot results but NOT in quiz pack resultsSummary. The fastest team info needs to be:
1. Captured and passed from QuizHost to ExternalDisplayWindow resultsSummary
2. Rendered inline within the resultsSummary on external display

### Implementation Details

**File 1: src/components/QuizHost.tsx** (line ~4749 where resultsSummary is sent)
- When sending 'resultsSummary' mode to external display in quiz pack mode
- Include fastestTeam data in the payload:
  ```javascript
  fastestTeam: {
    teamName: fastestTeam?.team.name,
    responseTime: fastestTeam?.responseTime  // already calculated
  }
  ```
- This data should be available from the response time tracking already in place

**File 2: src/components/ExternalDisplayWindow.tsx** (resultsSummary case rendering)
- Add a new section to render the Fastest Team block
- Position it below the three stat boxes (like in KeypadInterface results)
- Display: team name + response time formatted as "{time.toFixed(2)}s"
- Use matching styling to on-the-spot version (orange/gold border: "border-[#f39c12]")

### Expected Result
- Quiz pack external display resultsSummary will show all elements present in on-the-spot:
  - Results Summary heading (already there)
  - Three stat boxes (already there, but ensure counts are always sent)
  - Correct Answer display (already there)
  - Fastest Team block (NEW - to be added)

---

## Summary of Changes

### Change 1: Button Layout (2 files)
- NearestWinsInterface.tsx: Change confirm button wrapper to horizontal flex with keypad
- KeypadInterface.tsx: Change numbers-game confirm button layout for consistency

### Change 2: Results Summary Parity (2 files)
- QuizHost.tsx: Include fastestTeam data in resultsSummary external display message
- ExternalDisplayWindow.tsx: Render fastest team block in resultsSummary mode

## Files to Modify
1. src/components/NearestWinsInterface.tsx
2. src/components/KeypadInterface.tsx
3. src/components/QuizHost.tsx
4. src/components/ExternalDisplayWindow.tsx

## Testing Points
- Nearest wins mode: confirm button is right of keypad, vertically centered
- Quiz pack mode external display: results summary shows fastest team with response time
- On-the-spot mode: continues to work as before
