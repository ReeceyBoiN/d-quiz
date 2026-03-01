# Plan: Remove Irrelevant team.icon Field from Teams

## Overview
The `team.icon` field is an unused/irrelevant field that has caused confusion with invalid values appearing in team data. This field should be completely removed from the codebase to eliminate the "infinitys" issue and similar problems.

## Problem Statement
- `team.icon` field is currently assigned in team creation (hardcoded to '👤' or '📱')
- Some components attempt to validate/handle this field with fallbacks
- The field is irrelevant and causes confusion with persisted data
- Old saved game states may contain invalid "infinitys" values stored in this field
- Need to clean up all references and prevent future issues

## Files to Modify

### 1. Type Definition (Remove from Team interface)
**File**: Need to locate Team/Quiz interface definition
- Remove `icon?: string;` from Team interface
- This will cascade TypeScript errors to all affected locations

### 2. Team Creation Logic (Remove icon assignment)
**File**: `src/components/QuizHost.tsx`
- Remove `icon: '👤',` from newTeam object (~line 1550 with photo)
- Remove `icon: '📱',` from newTeam object (~line 3340 auto-approve path)
- Search for any other icon assignments in team creation

### 3. Team Restore from Saved State (Sanitize old data)
**File**: `src/utils/gameStatePersistence.ts`
- When loading saved game state, strip the `icon` field from restored teams
- Add migration logic to clean up old persisted data that contains icon field

### 4. UI Component Cleanup (Remove icon rendering)
**Files**:
- `src/components/TeamWindow.tsx` - Remove icon display and getValidIcon() helper
- `src/components/TeamSettings.tsx` - Remove icon validation and rendering
- `src/components/BuzzersManagement.tsx` - Remove getValidIcon() helper
- `src/components/FastestTeamOverlaySimplified.tsx` - Remove icon handling
- FastestTeamDisplay.tsx - Already cleaned up

### 5. Backend (if applicable)
**File**: `electron/backend/server.js`
- Check if `icon` field exists in networkPlayers or playerEntry objects
- Remove if present to prevent data contamination

## Implementation Strategy
1. First identify the exact location of Team interface definition
2. Remove icon field from interface (will cause TypeScript errors)
3. Fix all TypeScript errors by removing icon assignments
4. Remove icon rendering from all UI components
5. Add sanitization in loadGameState to strip icon from old saved data
6. Test that old saved game states load without the icon field
7. Verify no invalid values appear in Fastest Team display

## Expected Outcome
- ✅ No team.icon field anywhere in codebase
- ✅ Old saved game states load cleanly
- ✅ No more "infinitys" or invalid data in team objects
- ✅ All UI renders correctly without icon references
- ✅ Cleaner team data structure with only relevant fields
