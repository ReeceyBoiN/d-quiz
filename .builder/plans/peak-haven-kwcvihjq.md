# Team Photo Approval Issue - Implementation Plan

## Problem Summary
When user enables auto-approve for team photos:
1. Photos are correctly approved on the backend ✓
2. They're removed from the Team Photos tab ✓
3. BUT they don't appear in the Team window ✗

**Root Cause**: SettingsContext approves photos but doesn't notify QuizHost to update its state

---

## Solution: Broadcast Photo Approval to QuizHost

### Implementation Steps

#### 1. Modify `src/utils/SettingsContext.tsx` (lines 256-303)
After `Promise.all(approvalPromises)` completes successfully:
- Fetch updated player data via `network/all-players` IPC
- For each successfully-approved player, extract the approved photoUrl
- Convert file path to file:// URL using `ensureFileUrl` utility
- Broadcast `PHOTO_APPROVAL_UPDATED` event to notify QuizHost
- Log the broadcast for debugging

**Changes:**
```javascript
Promise.all(approvalPromises)
  .then(async () => {
    console.log(`[SettingsContext] ✅ All ${pendingPhotos.length} pending photos auto-approved`);
    
    // NEW: Fetch updated player data and broadcast photo updates to QuizHost
    try {
      const updatedPlayersResult = await (window as any).api.ipc.invoke('network/all-players');
      const updatedPlayers = Array.isArray(updatedPlayersResult) 
        ? updatedPlayersResult 
        : updatedPlayersResult?.data || [];
      
      // Broadcast PHOTO_APPROVAL_UPDATED for each approved photo
      pendingPhotos.forEach((originalPlayer: any) => {
        const updatedPlayer = updatedPlayers.find(p => p.deviceId === originalPlayer.deviceId);
        if (updatedPlayer?.teamPhoto && updatedPlayer?.photoApprovedAt) {
          const photoUrl = ensureFileUrl(updatedPlayer.teamPhoto);
          window.dispatchEvent(new CustomEvent('PHOTO_APPROVAL_UPDATED', {
            detail: {
              deviceId: updatedPlayer.deviceId,
              teamName: updatedPlayer.teamName,
              photoUrl: photoUrl
            }
          }));
          console.log(`[SettingsContext] 📢 Broadcasted PHOTO_APPROVAL_UPDATED for ${updatedPlayer.teamName}`);
        }
      });
    } catch (err) {
      console.error('[SettingsContext] ❌ Failed to broadcast photo updates:', err);
    }
  })
```

#### 2. Verify QuizHost Listener (already exists)
- QuizHost already has `onNetworkMessage('PHOTO_APPROVAL_UPDATED', ...)` listener (line 4595)
- Handler will automatically:
  - Receive photoUrl from SettingsContext
  - Update the team's photoUrl in quizzes state
  - Display photo in Team window

---

## Files to Modify

1. **src/utils/SettingsContext.tsx**
   - Import `ensureFileUrl` from utils if not already imported
   - Add photo broadcasting logic after Promise.all completes
   - Add logging for debugging

---

## Testing Steps

1. **Setup**: Disable auto-approve, team sends photo
2. **Test**: Enable auto-approve in settings
3. **Expected**: 
   - Photo disappears from Team Photos tab (already working)
   - Photo immediately appears in Team window (NEW)
   - Console logs show `📢 Broadcasted PHOTO_APPROVAL_UPDATED`
4. **Verify**: Click on team → should see approved photo

---

## Key Considerations

- Must use `ensureFileUrl()` to convert file paths to proper file:// URLs
- Use `CustomEvent` with detail payload for broadcasting (matches existing BottomNavigation pattern)
- Include proper error handling in case updated player fetch fails
- Maintain existing logging for debugging
- The retry logic in QuizHost's listener will handle timing issues if team window hasn't loaded yet

---

## Rationale

This approach:
- ✅ Minimal changes (only SettingsContext modified)
- ✅ Reuses existing QuizHost infrastructure (listener already built)
- ✅ Provides immediate feedback (photos appear right away)
- ✅ Matches existing event-driven architecture
- ✅ Maintains separation of concerns (Settings handles approval, QuizHost handles display)
