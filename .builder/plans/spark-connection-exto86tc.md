# Buzzer Management Display Fix - Implementation Plan

## Problem Statement
The Buzzer Management window doesn't display which buzzer a team has selected, even though:
- Players successfully select buzzers on their devices
- The host receives the PLAYER_BUZZER_SELECT message
- The team.buzzerSound value is being updated in QuizHost state

The dropdown shows "Select buzzer sound" (placeholder) instead of showing the currently selected buzzer.

## Root Causes Identified
1. **Value Mismatch**: The buzzer names stored in team.buzzerSound may not exactly match the filenames returned by `/api/buzzers/list` due to:
   - File extensions (.mp3) included in storage but stripped in display
   - Whitespace/trimming differences
   - Path information in one but not the other

2. **File Extension Inconsistency**: Buzzer filenames include `.mp3` extension, but we want to display them without the extension for cleaner UI

3. **Select Component Behavior**: Radix Select only displays a value in the trigger if it finds a matching SelectItem. If the value doesn't match any item in the list, it shows the placeholder instead

4. **No Visual Indication**: Even if a buzzer is selected, there's no visual indicator showing which one is currently active

## Required Changes

### 1. **BuzzersManagement Component** (`src/components/BuzzersManagement.tsx`)
- **Normalize buzzer names**: Remove `.mp3` extension when displaying and when comparing
- **Handle value matching**: Ensure the Select's value matches available items
- **Show selected state**: Add visual indicator (checkmark, highlight) to show which buzzer is currently selected
- **Improvements**:
  - Strip `.mp3` from buzzer filenames for display
  - Normalize team.buzzerSound value to strip extension for comparison
  - Add a SelectItem that includes the current buzzer even if not in the loaded list (safety fallback)
  - Add a checkmark or "Selected" indicator next to the currently selected buzzer in the dropdown list
  - Add debug logging to track value matching

### 2. **QuizHost Component** (`src/components/QuizHost.tsx`) 
- **Sanitize buzzer values**: When receiving PLAYER_BUZZER_SELECT, normalize the buzzerSound value
- **Consistent storage**: Ensure team.buzzerSound always stores just the filename without path/extension inconsistencies
- **Improvements**:
  - Trim whitespace from buzzerSound when updating state
  - Strip `.mp3` extension if player sends it with extension
  - Add debug logs to track what's being stored

### 3. **Backend Server** (`electron/backend/server.js`)
- **Normalize on receipt**: When receiving PLAYER_BUZZER_SELECT, sanitize the buzzerSound value
- **Store clean value**: Ensure what's stored and broadcast is normalized
- **Improvements**:
  - Trim whitespace
  - Strip `.mp3` extension on receipt
  - Add logging for debugging

## Implementation Strategy

### Phase 1: BuzzersManagement UI Improvements
1. Create helper function `getNormalizedBuzzerName(filename)` that strips `.mp3` extension
2. Update buzzer list rendering to:
   - Display normalized names (without .mp3)
   - Keep actual filenames as SelectItem values for API calls
   - Add checkmark/indicator next to currently selected buzzer
   - Ensure value attribute uses normalized name for proper matching
3. Fix the Select component:
   - Use normalized team.buzzerSound for value comparison
   - Display the normalized name in the trigger
   - Include current buzzer in list even if not in loaded list (fallback)

### Phase 2: Value Normalization in QuizHost
1. In `handleNetworkPlayerBuzzerSelect`, normalize the incoming buzzerSound:
   - Trim whitespace
   - Remove `.mp3` extension if present
2. Store normalized value in team state

### Phase 3: Backend Normalization
1. In server.js PLAYER_BUZZER_SELECT handler, normalize the buzzerSound before storing and broadcasting

### Phase 4: Testing
- Verify player can select buzzer
- Verify BuzzersManagement dropdown shows selected buzzer
- Verify checkmark/indicator shows which is selected
- Verify file extension is hidden in display
- Verify switching to different buzzer updates display correctly

## Key Files to Modify
1. `src/components/BuzzersManagement.tsx` (PRIMARY - UI fixes and display logic)
2. `src/components/QuizHost.tsx` (Value normalization on network receive)
3. `electron/backend/server.js` (Value normalization before broadcast)

## Success Criteria
✓ Buzzer Management dropdown displays the currently selected buzzer (not placeholder)
✓ File extensions (.mp3) are hidden from display
✓ Visual indicator (checkmark/highlight) shows which buzzer is selected in the list
✓ Selection persists when switching teams
✓ Player can change buzzer and host immediately reflects change
✓ Value matching works consistently across player→backend→host→UI flow

## Notes
- This fix ensures that the buzzer selection flow (player → backend → host → UI) has consistent value formats at each stage
- The normalization should happen as early as possible (at source in player or backend) to avoid cascading issues
- Display names and storage values are kept separate: display shows clean names, storage/API uses actual filenames
