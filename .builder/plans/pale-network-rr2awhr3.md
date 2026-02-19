# Plan: Simplify & Style Question Display in Keypad On-The-Spot External Display

## User Request
Remove "X of 3" text from question display in keypad on-the-spot mode, showing only "Question 1" etc. Add a dark bubble background to make it professional and consistent with app theme.

## Problem
Currently in external display "questionWaiting" mode:
- Shows "Question 1" on one line
- Shows "of 3" on a second line below it
- Plain background without styling

## Root Cause
In `src/components/ExternalDisplayWindow.tsx`, the 'questionWaiting' case renders question info as:
- H1 with question number
- H2 with "of {total}" text
- Simple text display with no background container

## Solution Approach

### File: src/components/ExternalDisplayWindow.tsx
**Location**: 'questionWaiting' case (around line 1300-1320)

**Changes**:
1. Remove the H2 element that displays "of {questionInfo.total}"
2. Keep only the question number display
3. Wrap the question display in a dark bubble background container using:
   - Dark background color from existing theme (bg-[#2c3e50] or similar dark hex)
   - Rounded borders (borderRadius: '28px' to match other question bubbles)
   - Padding for proper spacing (padding: '20px')
   - Border styling with dynamic border color from displayData.borderColor (matches random color scheme)
   - Box shadow for depth
   - Text alignment center

**Styling reference**:
Use the same dark bubble styling pattern already applied elsewhere in ExternalDisplayWindow for consistency:
- Example from 'question-with-timer' case: `backgroundColor: 'rgba(31, 41, 55, 0.95)', border: 3px solid ${displayData.borderColor}, borderRadius: '28px', padding: '20px', boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'`

## Implementation Detail
Replace the current questionWaiting rendering with:
```
<div style={{ 
  textAlign: 'center', 
  backgroundColor: 'rgba(31, 41, 55, 0.95)', 
  border: `3px solid ${displayData.borderColor}`, 
  borderRadius: '28px', 
  padding: '20px', 
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)' 
}}>
  <h1 style={{ 
    fontSize: scaleFontSize('72px', textSizeMultiplier), 
    fontWeight: 'bold', 
    color: '#f97316', 
    marginBottom: '0', 
    margin: '0' 
  }}>
    Question {questionInfo.number || 1}
  </h1>
</div>
```

This removes the "of" text entirely and wraps the display in a professional dark bubble that matches the app's design theme.

## Impact
- **External Display**: Cleaner, more professional question display with consistent styling
- **Host App**: No changes needed
- **Text Sizing**: Text size scaling from settings still applies via `scaleFontSize()`
- **Theme**: Dynamic border colors still apply from `displayData.borderColor`

## Testing Checklist
- [ ] External display shows "Question 1" (no "of 3")
- [ ] Dark bubble background visible and matches theme
- [ ] Border color changes randomly as expected
- [ ] Text sizing (small/medium/large) still works
- [ ] Appears in keypad on-the-spot mode
