# Plan: Fix Spacebar Trigger for Start Timer Button in Quiz Pack Mode

## Problem Identified
In quiz pack mode, when the flow state is `'sent-question'`, the "Start Timer" button appears but **spacebar doesn't trigger it**. However, manual clicking works fine.

## Root Cause
In `QuestionNavigationBar.tsx`, the `getSpacebarHandler()` function calls `getFlowButton()` to determine which handler to call for spacebar. However, when `flowState.flow === 'sent-question'`, `getFlowButton()` intentionally returns `null` (with comment "Timer buttons shown instead").

This causes `getSpacebarHandler()` to hit the early return `if (!currentButton) return null;` and return null, so no spacebar handler is registered for the "Start Timer" button.

## Solution
Add explicit handling in `getSpacebarHandler()` to detect the quiz pack mode + 'sent-question' state and return `onStartTimer` handler directly, without relying on `getFlowButton()`.

## Files to Modify
- `src/components/QuestionNavigationBar.tsx` - Update `getSpacebarHandler()` function (lines 267-289)

## Implementation Details
In the `getSpacebarHandler()` function:
1. Check if we're in quiz pack mode AND flowState.flow === 'sent-question'
2. If true, return `onStartTimer` (which should be passed as a prop)
3. Otherwise, follow the existing logic for other button states

The fix should be inserted at the beginning of the function, before the `getFlowButton()` call, to handle this special case.
