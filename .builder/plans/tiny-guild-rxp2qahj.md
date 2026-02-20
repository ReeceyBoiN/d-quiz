# Host Remote Control Application - Purpose & Goals Reference

## 🎯 Overall Purpose
The Host Remote is a **Remote Control Terminal for the Quiz Host Application**. It allows the quiz host to manage and monitor the quiz game from any device connected over the local network (WiFi).

**Key Point**: It's NOT a standalone app - it connects to a backend server running on the host machine and communicates with player apps via WebSocket.

---

## 📋 What the Host Remote Should Do

### 1. **Leaderboard Panel** (Current Focus)
**Purpose**: Real-time display of team rankings and scores

**Behavior**:
- On first load → Show "Loading leaderboard..."
- When no teams connected → Show "No teams connected yet" with 📊 icon
- When teams connected → Show sorted list by score (highest first) with:
  - Position number (1, 2, 3...)
  - Team name
  - Team score
  - Pin button to highlight team

**Data Source**: Backend via `GET_CONNECTED_TEAMS` command

**Update Strategy**:
- Periodic fetch every 3 seconds (keep data fresh)
- Real-time WebSocket listener for `LEADERBOARD_UPDATE` messages (instant score changes)
- Manual "Refresh" button for user-triggered updates

---

### 2. **Teams Tab** (Also Visible)
**Purpose**: Manage and view connected players/teams
- List all connected players
- Show team info (name, status, photo approval, etc.)
- Update when players join/disconnect

---

### 3. **Controls Tab** (Also Visible)
**Purpose**: Game control commands
- Start/Stop quiz timer
- Advance to next question
- Show/Hide answer key
- Reset scores
- Other quiz flow controls

---

### 4. **Settings Tab** (Also Visible)
**Purpose**: Configure quiz behavior
- Timer duration
- Scoring rules
- Team management preferences
- Visual preferences

---

## 🔌 System Architecture

### Communication Flow
```
┌─────────────────────────────────────────┐
│     Player Apps (Mobile on WiFi)        │
│  - Join game                            │
│  - Answer questions                     │
│  - Submit team photos                   │
└──────────────────┬──────────────────────┘
                   │ WebSocket (players ↔ host)
┌──────────────────▼──────────────────────┐
│  Backend Server (Electron App)          │
│  - ws://192.168.X.X:4310/events        │
│  - Handles player connections           │
│  - Manages game state & scoring         │
│  - Broadcasts updates                   │
└──────────────────┬──────────────────────┘
                   │ WebSocket (host ↔ admin)
┌──────────────────▼──────────────────────┐
│  Host Remote Browser UI                 │
│  - Leaderboard, Teams, Controls, etc.  │
│  - Sends admin commands                 │
│  - Receives real-time updates           │
└─────────────────────────────────────────┘
```

---

## 📊 LeaderboardPanel Implementation Details

### Initial Load Sequence
1. Component mounts
2. Sends `ADMIN_COMMAND` with type `GET_CONNECTED_TEAMS`
3. Receives `ADMIN_RESPONSE` with array of teams
4. Converts to leaderboard format: `[{id, name, score, position}, ...]`
5. Sorts by score descending, adds position numbers
6. Displays or shows "No teams connected yet"

### Message Types Expected

**Request to Backend**:
```json
{
  "type": "ADMIN_COMMAND",
  "commandType": "GET_CONNECTED_TEAMS",
  "deviceId": "host-device-id",
  "timestamp": 1234567890
}
```

**Response from Backend**:
```json
{
  "type": "ADMIN_RESPONSE",
  "commandType": "GET_CONNECTED_TEAMS",
  "data": {
    "teams": [
      {
        "id": "team-id-1",
        "deviceId": "device-123",
        "teamName": "Real Team Name",
        "score": 450,
        "status": "connected",
        "hasPhoto": true,
        "photoApprovedAt": "2024-01-15T10:30:00Z",
        "timestamp": 1234567890
      }
    ]
  }
}
```

**Real-Time Score Update**:
```json
{
  "type": "LEADERBOARD_UPDATE",
  "data": {
    "team-id-1": 500,
    "team-id-2": 420,
    "team-id-3": 380
  }
}
```

---

## 🔍 How to Verify It's Working

### Visual Checks
1. **On Load**: Shows "Loading leaderboard..." (not hardcoded Team A/B/C)
2. **After Load**: Shows either:
   - "No teams connected yet" message (correct if no players)
   - Real team names with scores (correct if players joined)
3. **Ranking**: Teams ordered by score, highest first
4. **Updates**: When a player answers, score updates in leaderboard

### Console Checks (Press F12)
Should see logs like:
```
[LeaderboardPanel] Component mounted, fetching initial leaderboard
[LeaderboardPanel] ✅ Received team list from backend: [...]
[LeaderboardPanel] Periodic refresh triggered
[LeaderboardPanel] 📊 Received real-time leaderboard update: [...]
```

---

## ❌ What Indicates a Problem

| What You See | Problem | Solution |
|--------------|---------|----------|
| Hardcoded Team A, Team B, Team C | Dev server didn't rebuild code | Restart dev server: `npm run dev` |
| Blank leaderboard, no "Loading..." or "No teams" message | Component not rendering | Check React error in F12 console |
| "No teams connected yet" stays even after player joins | Backend not sending LEADERBOARD_UPDATE | Verify backend is connected and broadcasting |
| Console shows WebSocket errors | Connection to backend failed | Check backend is running on correct IP/port |
| Loads once but never updates | Periodic refresh or real-time listener not working | Check setInterval and addEventListener in code |

---

## 🎯 Success State After Retest

✅ Host Remote shows "Loading leaderboard..." on first load
✅ After loading: "No teams connected yet" (if no players)
✅ Console shows [LeaderboardPanel] logs
✅ Connect a player → Real team appears with correct name
✅ Player answers question → Score updates instantly
✅ Leaderboard maintains correct ranking by score
✅ Manual refresh works with "Refresh" button
✅ Every 3 seconds, periodic logs appear (even if no changes)

---

## 📚 Key Files to Reference

**Frontend**:
- `src-player/src/components/HostTerminal/LeaderboardPanel.tsx` - Leaderboard display & logic

**Backend**:
- `electron/backend/server.js` - GET_CONNECTED_TEAMS handler & data formatting

**Network**:
- Expects WebSocket at `ws://[HOST_IP]:4310/events`
- Current test using: `ws://192.168.0.103:4310/events` (from player logs)

---

## 🔧 How This Differs From What's Shown Now

### ❌ Current (Wrong - Hardcoded):
```
Team A - 450 points
Team B - 380 points
Team C - 320 points
```
(These show even if no players connected)

### ✅ Expected (Correct - Dynamic):
```
Loading leaderboard...
(briefly, then)

No teams connected yet
📊
Teams will appear here when players connect
```
(Or real team data if players actually connected)

---

**Document Purpose**: This reference explains what the Host Remote is supposed to do, how it communicates with the backend, and how to verify it's working correctly. Refer back to this when debugging or explaining the system to others.
