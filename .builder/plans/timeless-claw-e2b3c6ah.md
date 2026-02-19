# Plan: Tighten Question Container Layout for Better Border Visibility

## Problem Identified
The colored borders are hard to see because the question container has excessive padding, pushing the colored border far from the actual text. The large grey background diminishes the visual impact.

## Solution: Reduce Container Padding to Moderate Levels (8-12px)

### Implementation Details

**1. Question-with-Timer Mode Container (Line ~486-497)**
- Reduce padding from `16px` to `10px`
- Left question container padding: `10px` (moderate reduction)
- Border remains `3px solid ${displayData.borderColor}`
- Result: Border sits much closer to question text and options

**2. Question Header Section (Line ~498-510)**
- Reduce marginBottom: from `30px` to `15-20px` 
- Brings options closer to question text
- Question number letter color: use `displayData.borderColor`

**3. Options Grid (Line ~514-544)**
- Maintain gap between options but reduce top margin if excessive
- Individual option buttons padding: keep responsive but consider slight reduction
- Ensures options are snug within container

**4. Question-Only Mode (Line ~732-742)**
- Question header container padding: reduce from `20px` to `10px`
- Apply same principle to option buttons padding
- Tighter layout brings borders closer to content

**5. Results Summary Section (Line ~790-841)**
- Result header padding: reduce from `20px` to `10px`
- Stat cards: maintain larger padding (30px) for visual distinction
- Heading colors: use `displayData.borderColor` for consistency

## Key Metrics
- Container padding: 16px → 10px (moderate reduction)
- Maintains responsive design (mobile/desktop)
- Compatible with all text size settings
- No animations or complex changes

## Expected Outcome
- Colored borders are prominently visible and close to content
- Less wasted grey background space
- Dynamic color selection is immediately noticeable
- Clean, professional appearance
- Proper visual hierarchy maintained

## Files to Modify
- `src/components/ExternalDisplayWindow.tsx` - Targeted padding/margin adjustments

## Safety Checks
- ONLY affects external display styling
- No changes to host app or player components
- Responsive design preserved
- Text scaling (Small/Medium/Large) unaffected
