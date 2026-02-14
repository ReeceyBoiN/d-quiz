# Close Team Popup When Switching Navigation Tabs

## Problem
When the host clicks on a team in the teams list (opening the TeamWindow modal) and then clicks any button in the bottom navigation bar (Buzzers, Team Photos, Clear Scores, Empty Lobby, etc.) or switches top tabs, the new content opens behind the TeamWindow instead of replacing it. The host must manually close the TeamWindow to see the new content.

## Solution Overview
Auto-close the TeamWindow popup and any internal bottom navigation popups when:
1. **Bottom navigation buttons are clicked** (Buzzers, Team Photos, Clear Scores, Empty Lobby, or any other button)
2. **Top navigation tabs are switched** (Home, Leaderboard, User Status)

Game modes (Keypad, Buzz-In, Wheel Spinner) continue running in the background unaffected.

## Implementation Approach

### 1. Centralize Close Logic in QuizHost.tsx

Create a new handler function that closes all UI overlays:

```typescript
const handleCloseAllOverlays = useCallback(() => {
  // Close team window
  setSelectedTeamForWindow(null);
  
  // Close any internal BottomNavigation popups
  setBottomNavPopupStates({
    teamPhotos: false,
    clearScores: false,
    emptyLobby: false
  });
}, []);
```

This function:
- Clears `selectedTeamForWindow` (closes TeamWindow modal)
- Resets all internal BottomNavigation popup states
- **Does NOT** touch game mode flags (preserves quiz rounds in background)
- **Does NOT** change activeTab (allows new content to display)

### 2. Lift BottomNavigation Popup State to QuizHost

Move internal popup boolean states from BottomNavigation to QuizHost:
- Remove: `const [showTeamPhotosPopup, setShowTeamPhotosPopup] = useState(false);`
- Move to QuizHost as part of new state object:
  ```typescript
  const [bottomNavPopupStates, setBottomNavPopupStates] = useState({
    teamPhotos: false,
    clearScores: false,
    emptyLobby: false
  });
  ```

Pass to BottomNavigation as props:
```typescript
<StatusBar
  popupStates={bottomNavPopupStates}
  onPopupToggle={(popupName, isOpen) => {
    // Close all overlays first if opening a popup
    if (isOpen) handleCloseAllOverlays();
    
    // Then open the specific popup
    setBottomNavPopupStates(prev => ({
      ...prev,
      [popupName]: isOpen
    }));
  }}
  {...otherProps}
/>
```

### 3. Wire Bottom Navigation Buttons

In BottomNavigation.tsx, replace all popup trigger code to use the new props:

**Old pattern:**
```typescript
onClick={() => setShowTeamPhotosPopup(true)}
```

**New pattern:**
```typescript
onClick={() => onPopupToggle?.('teamPhotos', true)}
```

This ensures every button click:
1. Calls `onPopupToggle(popupName, true)`
2. Which calls `handleCloseAllOverlays()` first
3. Then opens the new popup

### 4. Wire Top Navigation Tab Changes

In TopNavigation.tsx or QuizHost's `handleTabChange`:

```typescript
const handleTabChange = (tab: string) => {
  handleCloseAllOverlays();  // Close TeamWindow and popups
  setActiveTab(tab);          // Switch to new tab
};
```

### 5. Update TeamWindow Close Handler

Ensure closing a TeamWindow also closes any internal BottomNavigation popups:

```typescript
const handleCloseTeamWindow = () => {
  setSelectedTeamForWindow(null);
  setBottomNavPopupStates({
    teamPhotos: false,
    clearScores: false,
    emptyLobby: false
  });
};
```

## Key Files to Modify

| File | Changes |
|------|---------|
| **src/components/QuizHost.tsx** | Add `bottomNavPopupStates` state, create `handleCloseAllOverlays()`, add `onPopupToggle` callback, update `handleTabChange()` and `handleCloseTeamWindow()` |
| **src/components/BottomNavigation.tsx** | Remove local popup state, accept `popupStates` and `onPopupToggle` props, update all button handlers |
| **src/components/TopNavigation.tsx** | Ensure `handleTabChange()` calls close handler |

## Preserved Behavior (Critical)
✅ Quiz rounds/game modes continue running (show* flags untouched)
✅ Quiz state is fully preserved (no data loss)
✅ Game mode interfaces work normally in background
✅ Only UI overlays/modals are closed

## Testing Checklist
1. Double-click team → TeamWindow opens
2. Click "Buzzers" button → TeamWindow auto-closes, Buzzers modal opens
3. Close Buzzers, double-click team, then click "Team Photos" → Team Photos popup opens, team modal closes
4. During active Keypad mode, open a team → close it → Keypad mode still works
5. Switch between top nav tabs while TeamWindow is open → TeamWindow closes
6. Rapid clicking of multiple buttons → state doesn't get confused
7. Close a TeamWindow using the close button → all popups also close

## Edge Cases Handled
- TeamWindow internal dialogs (Kick Confirm, Disconnect Confirm) close when TeamWindow closes
- Game modes continue uninterrupted
- Rapid state changes don't cause conflicts
- Multiple overlays don't stack unexpectedly
