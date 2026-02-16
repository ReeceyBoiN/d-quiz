# Team Photo Not Saving/Displaying After Approval - Investigation & Fix Plan

## Problem Statement
When a team photo is approved in the Team Photos popup (via BottomNavigation), the photo is NOT displayed in that team's profile/info area. The team shows "No photo uploaded" even though a photo was just approved.

**Screenshot Evidence**: Team info panel shows "No photo uploaded" despite recent approval

## Root Cause Analysis

### Current Data Flow for Photo Approval
1. **Player uploads photo** → Backend saves to disk → stores file:// URL in `networkPlayers[deviceId].teamPhoto`
2. **Backend broadcasts TEAM_PHOTO_UPDATED** to host with photoPath
3. **Host (QuizHost) updates state** → `quiz.photoUrl` is set from the TEAM_PHOTO_UPDATED event
4. **User approves photo** → BottomNavigation calls `window.api.network.approveTeam({ deviceId, teamName, isPhotoApproval: true })`
5. **Backend sets approval** → `networkPlayers[deviceId].photoApprovedAt = Date.now()` and `photoApprovedHash`
6. **BottomNavigation refreshes** → calls `fetchPendingPhotos()` to update its own UI

### The Broken Link
**Issue**: After approval in step 5, the host's `QuizHost.quizzes` state is NOT updated with the approved photo's `photoUrl`.

**Why**: 
- The `BottomNavigation` component approves the photo and refreshes its own pending photos list
- The backend sets `photoApprovedAt` on the backend networkPlayer entry
- BUT there is NO mechanism to update the host's `quizzes[teamId].photoUrl` after approval
- When the user clicks on team info, it displays the quiz from the host state, which has `photoUrl = undefined` (it was never set because the photo was already approved when displayed, not from TEAM_PHOTO_UPDATED broadcast)

**Special case where it DOES work**:
- If a photo is uploaded while host is displaying the team, the TEAM_PHOTO_UPDATED event from backend updates `quiz.photoUrl`
- But this happens BEFORE approval, so after approval the flow is broken

## Solution Approach

### Option 1: Fetch photoUrl on Team Click (Recommended)
When user clicks to view team info, fetch the latest player data from backend to get current `teamPhoto` and display it.

**Pros**:
- Simple, ensures always latest data
- Works for all photo states (approved, pending)
- Decouples approval UI from team info display

**Cons**: 
- Adds IPC call on every team click

**Implementation**:
- In QuizHost or TeamWindow, add effect to fetch player photo data when team is selected
- Call `window.api.ipc.invoke('network/all-players')` and find player by deviceId
- Set `quiz.photoUrl` from `player.teamPhoto`

### Option 2: Update QuizHost State After Approval
After BottomNavigation approves a photo, it should notify QuizHost to update the quiz's photoUrl.

**Pros**:
- Immediate update, no additional IPC call

**Cons**:
- Requires passing approval callback from QuizHost to BottomNavigation
- More complex state management

**Implementation**:
- Add callback prop `onPhotoApproved?: (deviceId: string, photoUrl: string) => void`
- Pass from QuizHost to BottomNavigation
- Call it after successful approval

### Option 3: Listen for Approval Events in QuizHost
QuizHost listens for a new approval event and updates photoUrl.

**Pros**:
- Decoupled components
- Single responsibility

**Cons**:
- Need new event type from backend
- More infrastructure

## Recommended Fix: Option 1
**Rationale**: 
- Simplest to implement
- Most reliable (always fetches fresh data)
- Minimal impact on existing code
- Works for all edge cases

## Exact Issue Identified

**Component**: TeamWindow.tsx displays team info when user double-clicks a team name
- Shows `team.photoUrl` at line 543-554
- Displays "No photo uploaded" when `team.photoUrl` is undefined/null

**Data Flow**:
1. QuizHost maintains `quizzes` state (array of Quiz objects with photoUrl field)
2. When team is double-clicked, TeamWindow receives `team` from `quizzes` array (line 4380 of QuizHost)
3. TeamWindow displays `team.photoUrl` in photo preview area

**The Problem**:
- When a photo is uploaded from player app, backend broadcasts TEAM_PHOTO_UPDATED
- QuizHost listens for this event and sets `quiz.photoUrl` ✅
- But when a photo is APPROVED in BottomNavigation, no TEAM_PHOTO_UPDATED event is sent
- The backend only sets `photoApprovedAt` flag on the networkPlayer entry
- QuizHost's `quiz.photoUrl` remains undefined because it was never broadcast
- **Result**: TeamWindow displays empty even though photo is approved in backend

## Recommended Solution: Two-Part Fix

### Part 1: Fetch Photo URL After Approval (BottomNavigation)
After approving a photo, immediately fetch the latest player data from backend and trigger a refresh event that QuizHost listens for.

### Part 2: QuizHost Listens for Photo Refresh
QuizHost listens for a "PHOTO_APPROVAL_UPDATED" event (or similar) and updates the quiz's photoUrl from the fetched player data.

**Alternative (Simpler)**: Broadcast a new event from backend when photo is approved, similar to TEAM_PHOTO_UPDATED. This way QuizHost can reuse existing TEAM_PHOTO_UPDATED listener.

## Implementation Steps

1. **Modify BottomNavigation.tsx - handleApprovePhoto()**
   - After successful `approveTeam` IPC call
   - Immediately fetch updated player data via `network/all-players` IPC
   - Find the player by deviceId and extract their `teamPhoto` value
   - Broadcast a message event `broadcastMessage` to notify QuizHost

2. **Modify QuizHost.tsx - Add listener for photo approval**
   - Create a listener for the broadcast event (or extend existing TEAM_PHOTO_UPDATED to handle approval case)
   - When received, find the quiz by deviceId and update its `photoUrl` from the message data

3. **Test**
   - Approve a photo in Team Photos popup
   - The TeamWindow (if open) should immediately show the photo
   - Or close and reopen team window - photo should appear

## Key Files to Modify
1. **src/components/BottomNavigation.tsx** (PRIMARY)
   - `handleApprovePhoto()` function (line ~593-616)
   - After successful approval, fetch player data and broadcast event

2. **src/components/QuizHost.tsx** (PRIMARY)
   - Add new useEffect to listen for photo approval events
   - Update quiz.photoUrl when event arrives

3. **src/network/wsHost.ts** (OPTIONAL)
   - May need new message type if implementing broadcast approach
   - Or reuse existing event system

## Critical Implementation Detail

The simplest approach is to:
1. Have BottomNavigation fetch the updated `teamPhoto` after approval
2. Use the existing `broadcastMessage` from wsHost to send a message to QuizHost
3. Create a new message type like `PHOTO_APPROVED`
4. QuizHost listens for this message and updates quiz.photoUrl

This follows the existing pattern used for TEAM_PHOTO_UPDATED.
