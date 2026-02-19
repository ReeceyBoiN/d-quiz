# Plan: Enhance External Display Styling (Vibrant Background + Dark Bubble)

## Vision
Transform the external display to feature vibrant, dynamic backgrounds with bold dark rounded bubble containers that make content pop. Each new question triggers a new random vibrant background color.

## Key Requirements
✅ **Background:** Dynamic random vibrant colors - changes once per question (use existing dynamicColors array)
✅ **Scope:** Apply to ALL display modes (question-with-timer, question-only, resultsSummary, timer, picture, etc.)
✅ **Bubble Style:** Bold - large borderRadius (28px) + prominent drop shadow
✅ **Color Palette:** Use existing dynamicColors array from component (20 vibrant colors)

## Implementation Strategy

### 1. Background Color Management
**Challenge:** Background currently changes with mode transitions, but we need it to change per question (when new question data arrives)

**Solution:**
- Track background color in displayData state (already exists as `displayData.borderColor`)
- Add new state variable for background color: `displayData.backgroundColor`
- When new question arrives in message handlers (lines ~151-205), generate new random vibrant background
- Use same randomization as current `getRandomBorderColor()` helper function
- Apply this background to the mode-level container instead of fixed `#1f2937` or `#111827`

### 2. Dark Bubble Container Styling
Apply to all question containers (headers and option areas):

**Changes to implement:**
- **Question containers** (question-with-timer left area, question-only header, resultsSummary header)
  - Change from: minimal 3px colored border on transparent/dark background
  - Change to: 
    - backgroundColor: `'rgba(31, 41, 55, 0.95)'` (dark semi-transparent overlay)
    - borderRadius: `'28px'` (large rounded corners)
    - boxShadow: `'0 10px 40px rgba(0, 0, 0, 0.5)'` (prominent shadow for depth)
    - padding: `'16px'` (increased for breathing room)
    - Remove or soften color border effect

- **Option buttons** (in all question modes)
  - borderRadius: `'16px'` (increase from 8-12px for better bubble appearance)
  - boxShadow: `'0 4px 12px rgba(0, 0, 0, 0.3)'` (subtle shadow)
  - Keep color borders for visual definition

### 3. Results Summary Cards
- Increase borderRadius from 16px to 20-24px
- Enhance boxShadow: `'0 8px 24px rgba(0, 0, 0, 0.4)'`
- Keep vibrant colored backgrounds (green/red/grey) - they complement the dynamic background

## Exact File Changes
**File:** `src/components/ExternalDisplayWindow.tsx`

### Change Points:

1. **State initialization** (line ~35-56)
   - Add to displayData state: `backgroundColor: '#ff6b6b'` (initial random color)

2. **Random color generation** (after line ~76)
   - Create dedicated function for background colors OR reuse getRandomBorderColor logic

3. **Message handlers** (lines ~151-205)
   - When new question mode arrives, also set: `backgroundColor: getRandomColor()`
   - This triggers on EVERY mode change for question-related modes

4. **Mode container backgrounds** (lines ~331, ~483, ~730, ~788, ~850+ in all cases)
   - Replace fixed backgroundColor from `'#1f2937'`, `'#111827'`, etc.
   - With: `backgroundColor: displayData.backgroundColor`

5. **Question container styling** (lines ~486-497, ~731-743, ~790-805)
   - Update inline styles with bold bubble styling (borderRadius 28px, shadow, semi-transparent dark bg)

6. **Option buttons** (lines ~531-545, ~763-777)
   - Increase borderRadius to 16px
   - Add boxShadow

7. **Results summary cards** (lines ~811-844)
   - Increase borderRadius to 20-24px
   - Enhance boxShadow

## Safety Checks
- ✅ Changes ONLY to ExternalDisplayWindow.tsx (isolated from host app)
- ✅ Text scaling compatibility - all changes use fixed/relative sizing, work with text multipliers
- ✅ Border color system maintained - vibrant background complements colored borders on content
- ✅ Responsive design preserved - bubble styling scales on mobile and desktop
- ✅ No DOM structure changes - only inline style updates

## Visual Result
- Vibrant, eye-catching external display
- Modern bold aesthetic with dark rounded bubble containers
- Content clearly stands out against dynamic background
- Fresh look with variety (new color per question)
- Professional, polished appearance
