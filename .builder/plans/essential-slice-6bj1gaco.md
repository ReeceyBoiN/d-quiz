# QuestionDisplay Component - Variable Initialization Order Bug Fix

## Problem

The player devices show a blank screen with error: `ReferenceError: Cannot access 'de' before initialization` (minified variable name for `options`).

### Root Cause

**Variable Definition Order Issue:**
- Lines 109-146: `useEffect` hook tries to use `options.length` in its dependency array
- Line 278: `options` variable is actually defined as `const options = question?.options || []`

React attempts to access `options.length` for the dependency array **before** the variable is defined, causing a temporal dead zone error.

### Component Code Structure Problem

Current order:
1. State declarations (lines 84-93)
2. **useEffect that depends on `options.length`** (lines 109-146) ❌ ERROR HERE
3. Other useEffect hooks
4. Event handlers
5. **Variable definitions like `options`, `questionType`, etc.** (lines 276-299)

This is backwards - derived variables and useEffect dependencies must be defined BEFORE they're used in effect dependency arrays.

## Solution

**Reorganize component code to follow React best practices:**

### Step 1: Move All Variable Definitions to Top
After state declarations and before any useEffect hooks:
- Move `questionText` and `options` definitions (currently line 277-278)
- Move `rawType` and `questionType` definitions (currently line 281-282)
- Move `isShowingPlaceholder` definition (currently line 290)
- Move all `isMultipleChoice`, `isLetters`, `isNumbers`, `isSequence`, `isBuzzIn` definitions (currently lines 295-299)
- Move `hideAnswers` definition (currently line 302)

**Target Location:** Lines 83-84 (right after state declarations, before useEffect hooks)

### Step 2: Keep useEffect Hook Order
Once variables are defined above, useEffect hooks can safely reference them in dependency arrays:
1. Reset state on question change (line 96-104) ✓ Keep as is
2. Handle keypad shuffling when scrambled changes (line 109-146) ✓ Will work after variable definitions
3. Timer tracking (line 149-157) ✓ Keep as is
4. Logging interface render info (line 305-317) ✓ Keep as is

### Step 3: Keep Remaining Code After useEffect Hooks
Event handlers and utility functions (`handleAnswerSelect`, `handleNumberDigit`, etc.) stay where they are - they don't need to be reordered.

## Files to Modify

**src-player/src/components/QuestionDisplay.tsx:**
- Move variable declarations (lines 276-302) to top of component (after state, before useEffect)
- Update line numbers after reordering

## Expected Result

- Player devices will render questions without blank screen error
- Keypad shuffling will work correctly with proper variable initialization
- All useEffect dependencies will be valid

## Technical Details

**Why This Happens:**
- JavaScript's temporal dead zone (TDZ) prevents accessing variables before they're declared
- React's dependency array processing happens during render, before the variable assignments execute
- Moving declarations above effect hooks ensures all dependencies exist before React evaluates them
