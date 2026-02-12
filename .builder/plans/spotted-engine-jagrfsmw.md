# Team Automatic Disconnect Status Indicator

## Objective
Implement automatic marking of teams as disconnected when they lose connection to the host app via the player portal, while preserving all team data (points, info) for potential reconnection. Teams should visually appear greyed out when disconnected and return to normal when reconnected.

## Current State
- Teams list is rendered in LeftSidebar.tsx with team name, score, and connection status icons
- Team state is managed in QuizHost.tsx as `quizzes[]` array with a `disconnected: boolean` field
- LeftSidebar already displays grey background and WifiOff icon when `quiz.disconnected === true`
- Manual disconnect/reconnect functionality exists via TeamWindow.tsx buttons
- Teams are NOT removed from the list when disconnected - they're preserved with their data
- **Gap**: PLAYER_DISCONNECT events from the backend are broadcast by hostNetwork but NOT automatically handled in QuizHost to mark teams as disconnected

## Recommended Approach

### 1. Add PLAYER_DISCONNECT Event Handler in QuizHost
- Add a new `onNetworkMessage('PLAYER_DISCONNECT', ...)` listener in the existing useEffect that handles network messages
- When a team with matching deviceId receives a PLAYER_DISCONNECT event, automatically set `quiz.disconnected = true`
- This mirrors the existing PLAYER_JOIN handler logic but sets disconnected flag instead of clearing it
- Keep all other team data intact (name, score, points, icon, photoUrl)

### Key Changes Required

**File: src/components/QuizHost.tsx**
- Locate the existing `onNetworkMessage` listener for `PLAYER_JOIN`
- Add a new listener for `PLAYER_DISCONNECT` that:
  - Searches for the team with matching `deviceId` (matches payload.playerId or similar)
  - Updates that team's state: `setQuizzes(prev => prev.map(q => q.id === deviceId ? { ...q, disconnected: true } : q))`
  - Maintains all other team data unchanged

**File: src/components/LeftSidebar.tsx**
- No changes needed - already displays grey background when `quiz.disconnected === true`
- Already shows WifiOff icon when disconnected
- Current styling and visual indicators will automatically work

**File: src/network/wsHost.ts**
- No changes needed - already broadcasts PLAYER_DISCONNECT events

## Implementation Details

### Event Flow
1. Player app loses connection to backend WebSocket
2. Backend detects disconnect and broadcasts PLAYER_DISCONNECT event
3. Frontend WebSocket receives the event
4. QuizHost's onNetworkMessage listener receives the event
5. Team is automatically marked as disconnected in quizzes state
6. LeftSidebar re-renders showing greyed out team with WifiOff icon

### Team Data Preservation
- No team data is deleted when disconnected
- Reconnection: If the same device reconnects (PLAYER_JOIN with same deviceId), the team will:
  - Set `disconnected: false` 
  - Preserve all existing data (points, name, icon, etc)
  - Automatically rejoin the game

### Manual Controls
- Keep existing manual Disconnect/Reconnect buttons in TeamWindow.tsx
- Gives host the ability to manually manage connections when needed
- Provides redundancy for network event handling gaps

## Files to Modify
1. **src/components/QuizHost.tsx** - Add PLAYER_DISCONNECT handler (main change)
2. **src/components/LeftSidebar.tsx** - Verify existing styling works (no changes needed)

## Testing Scenarios
1. Team connects normally → appears in normal state
2. Team loses network connection → automatically appears greyed out
3. Team reconnects with same device → returns to normal state, retains all points/data
4. Host manually disconnects a team → appears greyed out
5. Team data persists across disconnect/reconnect cycles
