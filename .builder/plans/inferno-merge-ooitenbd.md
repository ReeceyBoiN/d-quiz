# Host Remote Controller UI Fix Plan

## Problem Summary
The host remote controller has two main issues:
1. **Missing navigation buttons** - Previous/Next buttons to preview questions from loaded quiz pack are not visible
2. **Timer Controls always visible** - Timer controls section shows even when no question is active, creating unnecessary UI clutter

## Current Behavior
- GameControlsPanel shows Previous/Next buttons only when `isQuizPackMode === true` AND `totalQuestions > 0`
- Timer Controls is always visible as expandable section
- flowState.flow drives the action buttons (Send Question, Reveal Answer, etc.)

## Desired Behavior (User-Specified)
1. When quiz pack is loaded on host app:
   - Host remote should enter "preview mode"
   - Show Previous/Next navigation buttons to flip through questions
   - Show a preview of each question as user navigates
   
2. For Timer Controls:
   - Only show the Timer Controls collapsible section when flowState.flow === 'sent-question'
   - Before question is sent, hide the timer controls to reduce UI clutter

## Root Cause Analysis

### Issue 1: Missing Quiz Pack Navigation Buttons
**Root cause:** flowState.isQuizPackMode not being set to true when quiz pack is loaded
- GameControlsPanel navigation shows only if: `isQuizPackMode && totalQuestions > 0`
- Host app must send this flag in FLOW_STATE messages when quiz pack is loaded
- Without this flag, navigation buttons remain hidden

### Issue 2: Timer Controls Always Visible
**Root cause:** No conditional rendering on Timer Controls section
- Currently hard-coded to always display the collapsible timer section
- Should be hidden until 'sent-question' flow state when timing is actually needed

## Solution Implementation

### Part 1: Fix Quiz Pack Preview Mode
**File:** `src-player/src/App.tsx`
- Find: FLOW_STATE message handler (line ~650-700 range)
- Verify: flowState object is setting `isQuizPackMode`, `currentLoadedQuestionIndex`, `loadedQuizQuestions`
- Check if host app is sending these fields in FLOW_STATE payload
- If missing, communication between host and host remote needs investigation

**File:** `src-player/src/components/HostTerminal/GameControlsPanel.tsx`
- Verify: Navigation buttons already check `isQuizPackMode && totalQuestions > 0`
- Should work once isQuizPackMode is properly set from flowState

### Part 2: Conditionally Hide Timer Controls
**File:** `src-player/src/components/HostTerminal/GameControlsPanel.tsx`
- Find: Timer Controls collapsible section (search for "⏱️ Timer Controls")
- Current: Always renders the collapsible section
- Change: Wrap timer section with condition: `{flowState?.flow === 'sent-question' && (...)}`
- Effect: Hides timer controls until host sends a question

## Critical Implementation Details

1. **Location of Timer Controls code:**
   - Look for button with text "⏱️ Timer Controls"
   - The collapsible section with expandedSection state
   - Both the button and the expandable content need the condition

2. **Preserve existing functionality:**
   - Keep quick timer buttons (Normal/Silent) that appear in 'timer-dual' layout
   - Only hide the expanded collapsible section
   - All other game controls (Previous/Next, Send Question, Reveal, etc.) remain unchanged

3. **Flow state dependency:**
   - Timer section visibility depends on: `flowState?.flow === 'sent-question'`
   - This is when quick timer buttons also appear, so showing collapsible section at same time makes sense

## Files to Modify
1. **src-player/src/components/HostTerminal/GameControlsPanel.tsx** - HIGH PRIORITY
   - Conditionally hide Timer Controls section based on flowState
   
2. **src-player/src/App.tsx** - INVESTIGATION (may not need changes if host app is already sending proper flowState)
   - Verify FLOW_STATE handler is correctly mapping flowState object

## Expected Outcome
- Quiz pack loaded → Host remote shows Previous/Next buttons for question preview
- Browse questions → Can navigate through all questions in quiz pack
- Before sending question → Timer controls hidden (clean interface)
- After sending question → Timer controls appear (relevant to quiz state)
- Host can fully operate quiz from remote with appropriate, contextual UI
