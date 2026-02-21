# Host Remote Button Visibility & Question Display Fix

## Problem Statement
The host remote (displayed on a separate small-screen device) is not showing the correct clickable buttons when a round is active. Currently, buttons become disabled/hidden at certain flow stages even though they should be available. Additionally, the host remote should display the question text so the host can read it without looking at the main laptop screen.

## Desired Behavior
The host remote should intelligently show **only the relevant, clickable buttons** for each stage of the quiz flow:
- **Stage 1 (ready)**: Send Question OR Send Picture + Hide Question
- **Stage 2 (sent-picture)**: Send Question + Hide Question  
- **Stage 3 (sent-question)**: Start Timer OR Start Silent Timer (host should have both options)
- **Stage 4 (running/timeup)**: Reveal Answer
- **Stage 5 (revealed)**: Show Fastest Team
- **Stage 6 (fastest)**: Next Question
- **All stages**: Navigation arrows (previous/next question) and question display

## Key Insight
The problem is in `GameControlsPanel.getButtonLayout()` - it's likely marking buttons as `disabled: true` when they should either be hidden or the button set should change entirely. The remote should show **active actions only**, not grayed-out disabled buttons.

## Implementation Plan

### Phase 1: Investigate Current State
1. **Read `src-player/src/components/HostTerminal/GameControlsPanel.tsx`**
   - Examine `getButtonLayout(flowState)` function
   - Identify all current button states and disabled flags
   - Check if buttons are hidden vs disabled
   - Identify any issues with button progression logic

2. **Check data flow to GameControlsPanel**
   - Verify what flowState data is being passed from `src-player/src/App.tsx`
   - Check if flowState includes all necessary fields (flow, isQuestionMode, isQuizPackMode, etc.)
   - Verify picture/question data availability

3. **Examine related components**
   - `src-player/src/components/HostTerminal/index.tsx` - wrapper component
   - `src-player/src/components/HostTerminal/useHostTerminalAPI.ts` - command sending logic
   - `src-player/src/components/HostTerminal/HostTerminalNav.tsx` - navigation components

### Phase 2: Fix Button Logic
1. **Refactor `GameControlsPanel.getButtonLayout()`**
   - Change logic from "show all buttons, disable some" → "show only available buttons"
   - Ensure buttons are removed/hidden (not disabled) when not applicable to current flow
   - Add clear mapping: flowState.flow → button configuration

2. **Fix timer button choice (Start Timer vs Start Silent Timer)**
   - Currently may not show both options
   - Modify layout to show dual-button option when in 'sent-question' state
   - Ensure both buttons can be clicked independently

3. **Fix flow state transitions**
   - Verify button changes occur correctly when flowState transitions
   - Test each flow state: ready → sent-picture → sent-question → running → revealed → fastest

### Phase 3: Add Question Display
1. **Add question text area to GameControlsPanel**
   - Display the current question from flowState.currentQuestion
   - Make it readable on small screen (appropriate font size, wrapping)
   - Show question number and picture (if available)

2. **Integrate question navigation**
   - Add previous/next question buttons (arrow equivalents)
   - Map to existing keyboard navigation handlers
   - Ensure host can skip forward/backward through questions

### Phase 4: Network & State Verification  
1. **Verify flow state broadcasting**
   - Check `src/network/wsHost.ts` - confirm FLOW_STATE is sent with all necessary data
   - Check `src/components/QuizHost.tsx` - verify sendFlowStateToController calls
   - Ensure picture presence is communicated

2. **Verify command handling**
   - Check that ADMIN_COMMAND messages are properly received and processed
   - Verify host accepts commands during all appropriate flow states
   - Test button clicks actually trigger actions on host

## Key Files to Modify
- **`src-player/src/components/HostTerminal/GameControlsPanel.tsx`** - Primary fix (button logic)
- **`src-player/src/components/HostTerminal/index.tsx`** - May need layout adjustments
- Possibly: `src-player/src/App.tsx` - If flowState is missing needed data

## Testing Plan
1. Test each flow progression: ready → sent-question → running → revealed → fastest → idle
2. Test in all modes: Quiz Pack, Keypad, Buzz-in, Nearest Wins
3. Verify:
   - Buttons change at correct transitions (no disabled buttons)
   - Question text displays and updates
   - Navigation buttons work
   - Each button action triggers correctly on host app

## Success Criteria
- ✅ Host remote shows only relevant, clickable buttons at each stage
- ✅ No disabled/grayed-out buttons (hidden instead)
- ✅ Question text visible on remote screen
- ✅ Button clicks successfully control quiz progression
- ✅ Works in all quiz modes
- ✅ Host can navigate forward/back through questions
