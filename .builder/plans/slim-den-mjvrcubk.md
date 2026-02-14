# Buzzer Selection Flow Fix

## Problem Identified
- Buzzers successfully load (Array(68) found)
- BuzzerSelectionModal appears briefly but disappears immediately
- Root cause: TEAM_APPROVED message received from host immediately after team name submission
- TEAM_APPROVED handler changes `currentScreen` from 'buzzer-selection' to 'approval', preventing buzzer selection

## Current Flow (Broken)
1. User enters team name → `currentScreen = 'buzzer-selection'`
2. BuzzerSelectionModal renders and loads buzzers
3. Host receives PLAYER_JOIN, sends back TEAM_APPROVED
4. TEAM_APPROVED handler sets `currentScreen = 'approval'` (overrides buzzer-selection)
5. 2-second timer fires → `currentScreen = 'display'`
6. User never sees buzzer selection UI

## Desired Flow (Fixed)
1. User enters team name → `currentScreen = 'buzzer-selection'`
2. BuzzerSelectionModal renders, user sees and selects a buzzer
3. User confirms buzzer selection → PLAYER_BUZZER_SELECT sent to host
4. Only then allow TEAM_APPROVED to transition to approval/display screens

## Solution Approach

### Strategy: Prevent Screen Override During Buzzer Selection
Modify the TEAM_APPROVED handler in `App.tsx` to:
- Check if `currentScreen === 'buzzer-selection'`
- If yes, do NOT change the screen yet
- Store the approval data (displayMode, etc.) but keep showing buzzer selection
- Only transition to approval screen after user confirms buzzer selection in `handleBuzzerConfirm()`

### Key Changes Needed

#### 1. App.tsx - Modify TEAM_APPROVED Handler
- Add check: `if (currentScreen === 'buzzer-selection') { ...save data but don't change screen... }`
- Save the approval data (displayMode, slideshow images, scores) to state for later use
- Create a ref or state to track if approval data is pending

#### 2. App.tsx - Modify handleBuzzerConfirm()
- After buzzer is confirmed and settings updated
- Check if approval data is pending
- If yes, transition to approval screen with the saved data
- If no, transition as normal

#### 3. State Management
- Add new state: `const [pendingApprovalData, setPendingApprovalData] = useState(null)`
- When TEAM_APPROVED received during buzzer-selection: save data to pendingApprovalData
- When handleBuzzerConfirm() called: apply pendingApprovalData and transition

## Files to Modify
- `src-player/src/App.tsx` - Only file needing changes

## Implementation Steps
1. Add `pendingApprovalData` state to track approval data received during buzzer selection
2. Modify TEAM_APPROVED case to check `currentScreen === 'buzzer-selection'`
3. If in buzzer-selection: save data without changing screen
4. If not in buzzer-selection: proceed normally
5. Modify `handleBuzzerConfirm()` to apply pending approval data before transitioning
6. Test with fresh player connection to verify flow works

## Success Criteria
- Buzzer selection modal stays visible until user confirms selection
- User can see all buzzers, preview them, and select one
- After confirmation, smooth transition to approval screen
- Buzzer is properly saved and unavailable for other players
- Console shows no unexpected screen transitions during buzzer selection
