# External Display Enhancement Plan

## Overview
Improve the external display (livescreen) visibility by:
1. Increasing question text size on the left side
2. Adding a full-width progress bar at the bottom (keep layout proportions at 50/50)
3. Hiding the circular timer at bottom-right when progress-bar style is used

## Current State
- Question text sizes: 28px/40px (mobile/desktop) for main question, 24px/36px for header
- Layout: 50/50 split between question (left) and image (right)
- Timer: Circular countdown at bottom-right (scaled down to 42.5%) or other countdown styles
- Progress bars: Thin bar at top (12px) already implemented

## User Requirements
- Make question text visibly bigger for easier reading on audience screens
- Keep layout proportions at 50/50 (equal space for text and image)
- Replace bottom-right circular timer with progress bars at both top and bottom
- Apply to all question display modes

## Implementation Approach

### File: `src/components/ExternalDisplayWindow.tsx`

#### Change 1: Increase Question Text Sizes (Lines ~412-417)
**Location:** `question-with-timer` mode font size variables

**Current:**
```javascript
const questionFontSize = isMobileSize ? '28px' : '40px';
const headerFontSize = isMobileSize ? '24px' : '36px';
const optionFontSize = isMobileSize ? '14px' : '20px';
```

**New:**
```javascript
const questionFontSize = isMobileSize ? '40px' : '56px';  // +12px increase
const headerFontSize = isMobileSize ? '32px' : '48px';    // +8px increase
const optionFontSize = isMobileSize ? '18px' : '24px';    // +4px increase
```

Also adjust line-height in the question h2 markup:
- Change from `lineHeight: '1.3'` to `lineHeight: '1.2'` for better proportions with larger text

#### Change 2: Add Full-Width Progress Bar at Bottom (Lines ~520+)
**Location:** After the bottom-right timer wrapper in `question-with-timer` mode

Add this code block to render a bottom progress bar:
```javascript
{/* Bottom progress bar */}
{timeRemaining > 0 && (
  <div style={{
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '12px',
    backgroundColor: '#1f2937',
    overflow: 'hidden'
  }}>
    <div style={{
      height: '100%',
      backgroundColor: getProgressBarColor(timeRemaining, displayData.data?.totalTime || 30),
      width: `${progressPercentage}%`,
      transition: 'width 0.1s linear'
    }} />
  </div>
)}
```

#### Change 3: Hide Circular Timer When Using Progress-Bar Style (Lines ~520)
**Location:** Bottom-right timer wrapper condition in `question-with-timer` mode

**Current:**
```javascript
{timeRemaining > 0 && (
  <div style={{ position: 'absolute', bottom: '40px', right: '40px', transform: 'scale(0.425)' }}>
    {renderCountdownTimer(...)}
  </div>
)}
```

**New:**
```javascript
{timeRemaining > 0 && (displayData.countdownStyle || displayData.data?.countdownStyle || 'circular') !== 'progress-bar' && (
  <div style={{ position: 'absolute', bottom: '40px', right: '40px', transform: 'scale(0.425)' }}>
    {renderCountdownTimer(...)}
  </div>
)}
```

#### Change 4: Repeat Timer Updates for 'timer' Mode (Lines ~586-602)
Apply the same conditional hide logic to the bottom-right timer wrapper in `timer` mode:

**Current:**
```javascript
{timeRemaining > 0 && (
  <div style={{ position: 'absolute', bottom: '20px', right: '20px', transform: 'scale(0.425)' }}>
    {renderCountdownTimer(...)}
  </div>
)}
```

**New:**
```javascript
{timeRemaining > 0 && (displayData.countdownStyle || displayData.data?.countdownStyle || 'circular') !== 'progress-bar' && (
  <div style={{ position: 'absolute', bottom: '20px', right: '20px', transform: 'scale(0.425)' }}>
    {renderCountdownTimer(...)}
  </div>
)}
```

And add the bottom progress bar to `timer` mode as well (same as Change 2).

## Expected Result
1. Question text will be 30-40% larger on audience screens
2. Layout remains 50/50 split - both text and image have equal space
3. Timer displays as:
   - Thin progress bar at top (already present)
   - Full-width progress bar at bottom (new)
   - Circular/custom timer at bottom-right hidden when countdown style is 'progress-bar'
4. All question types (question-with-timer, timer mode) will have these improvements

## Technical Notes
- Text size increases are responsive (different sizes for mobile vs desktop)
- Progress bar uses `getProgressBarColor()` function already defined in the component
- The `progressPercentage` variable is already calculated from `timeRemaining / totalTime`
- Conditional hiding of circular timer prevents duplicate timer displays
- Bottom progress bar height (12px) matches top progress bar for consistency

## Files to Modify
1. `src/components/ExternalDisplayWindow.tsx` - only file requiring changes
   - Lines ~412-417: Font size variables
   - Lines ~453-464: Question markup (lineHeight adjustment)
   - Lines ~520-536: Bottom-right timer conditional + bottom progress bar (2 places)
   - Lines ~586-602: Timer mode bottom-right timer conditional + bottom progress bar
