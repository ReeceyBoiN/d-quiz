# Music Round Implementation Plan

## Overview
Build a full music round game mode: the host loads a folder of up to 18 audio clips, configures round settings, then runs a reaction-based audio identification game where players buzz in when they hear the target clip playing in a shuffled sequence.

---

## Existing Code That Will Be Extended

| File | Role |
|------|------|
| `src/components/MusicRoundInterface.tsx` | Currently just a folder browser — will become the full music round UI (setup + gameplay) |
| `src/components/QuizHost.tsx` | Already has `showMusicRoundInterface` state and wiring to RightPanel button |
| `src/utils/SettingsContext.tsx` | Add music round default settings (clip length, base points, volume, elimination toggle) |
| `src/components/Settings.tsx` | Add Music Round defaults section |
| `src/utils/scoringEngine.ts` | Reuse existing `calculateTeamPoints` + `rankCorrectTeams` for scoring |
| `src/network/wsHost.ts` | Add `MUSIC_ROUND_*` message types for host↔player communication |
| `src-player/src/types/network.ts` | Add music round message types |
| `src-player/src/App.tsx` | Handle music round question type, show buzz button UI |
| `src-player/src/components/QuestionDisplay.tsx` | Add music-buzz mode rendering |
| `src/utils/fileBrowser.ts` | Already provides `getMusicRoundsPath()` and `listDirectory()` |
| `src/utils/audioUtils.ts` | Reference for audio playback patterns — new music round audio engine will be separate |

---

## Implementation Steps

### 1. Settings — Music Round Defaults

**File: `src/utils/SettingsContext.tsx`**
- Add to `SettingsContextType` and state:
  - `musicRoundDefaultClipLength: number` (default: 10, range 2–25)
  - `musicRoundDefaultPoints: number` (default: 4)
  - `musicRoundDefaultSpeedBonus: number` (default: 4)
  - `musicRoundDefaultVolume: number` (default: 80, range 0–100)
  - `musicRoundElimination: boolean` (default: true)
- Add corresponding `update*` functions following the existing pattern (localStorage + event dispatch)

**File: `src/components/Settings.tsx`**
- Add a "Music Round" section (under Sounds tab or General)
- Slider for default clip length (2–25s, default 10)
- Slider for default base points
- Slider for default speed bonus
- Slider for default master volume
- Checkbox for elimination mode default

### 2. Network Message Types

**File: `src/network/wsHost.ts`**
- Add message types to `NetworkMessageType`:
  - `MUSIC_ROUND_START` — tells players a music round is starting, shows buzz button
  - `MUSIC_ROUND_TARGET` — announces the target clip name to players, enables buzzer
  - `MUSIC_ROUND_BUZZ_RESULT` — tells a player if their buzz was correct/wrong/too-late
  - `MUSIC_ROUND_RESET` — resets player buzzer for next target clip selection
  - `MUSIC_ROUND_END` — round is over, return to normal display
- Add convenience export functions following existing patterns

**File: `src-player/src/types/network.ts`**
- Add `MUSIC_ROUND_START | MUSIC_ROUND_TARGET | MUSIC_ROUND_BUZZ_RESULT | MUSIC_ROUND_RESET | MUSIC_ROUND_END` to `HostMessageType`
- Add `MusicBuzzMessage` client message type: `{ type: 'MUSIC_BUZZ', playerId, deviceId, teamName, timestamp }`

### 3. Audio Engine — `src/utils/musicRoundAudio.ts` (new file)

Core audio playback engine for the music round:

- **`MusicClip` interface**: `{ id, name, filePath, duration, regionStart, regionEnd }`
- **`loadAudioFile(filePath)`**: Creates an `AudioContext`, fetches/decodes the audio file, returns `AudioBuffer` + duration
- **`autoSelectRegion(duration, clipLength)`**: Picks a random region avoiding first 20s and last 20s of the track. If track is shorter than `clipLength + 40s`, relaxes the margin proportionally.
- **`playClipRegion(buffer, regionStart, regionEnd, masterVolume)`**: Plays the specified region with:
  - 1s fade-in at start
  - 1s fade-out before end
  - 0.2s silence gap after clip ends before next clip starts
  - Returns a handle with `stop()`, `onEnded` callback, and timing info
- **Audio normalization**: Use `AudioContext` + `DynamicsCompressorNode` for auto-leveling loudness across clips. All clips are played at roughly equal perceived volume automatically — no per-track volume sliders needed.
- **`stopPlayback()`**: Stops current audio with a quick 1s fade-out (used for skip)
- **`skipToNext()`**: Fades out current clip (1s), 0.2s silence, fades in next clip (1s) — same transition as natural clip changes
- Accepted formats: `.mp3`, `.wav`, `.flac`, `.m4a`, `.mp4` (audio only from video files)

### 4. MusicRoundInterface Rebuild — `src/components/MusicRoundInterface.tsx`

This component transitions through two phases: **Setup** → **Gameplay**.

#### Phase A: Setup Screen

- **Folder selection** (keep existing folder browser UI on left side)
- **Track list panel** (right side, max 18 files enforced):
  - Drag-and-drop reordering of tracks
  - **Shuffle button** to randomize track order
  - Track name display (filename without extension)
  - Play/preview button per track (quick listen)
  - Track count indicator: "12 / 18 tracks"
- **Round configuration panel** (below or beside track list):
  - Clip length slider (2–25s, loaded from settings default)
  - Base points slider (loaded from settings default)
  - Speed bonus slider (loaded from settings default)
  - Master volume slider (loaded from settings default)
  - Elimination mode checkbox (loaded from settings default) — "Remove clips after correct identification"
  - Evil mode toggle (reads from `useSettings().evilModeEnabled`, allows per-round override)
  - Punishment mode toggle (reads from `useSettings().punishmentEnabled`, allows per-round override)
- **"Start Round" button** → broadcasts `MUSIC_ROUND_START` to players, transitions to gameplay

#### Phase B: Gameplay Screen

The host controls the game flow with these sub-steps:

**Step 1 — Target Selection**
- Host sees the remaining track list and **manually picks** which clip is the target
- A **"Random Target"** button is also available to auto-pick one
- Selected target is highlighted: "Target: Sweet Child O Mine"
- Host announces the target verbally to players
- System broadcasts `MUSIC_ROUND_TARGET` with `{ clipName }` to player devices

**Step 2 — Playlist Preparation**
- System builds a shuffled playback sequence from remaining clips (target placed at a random position)
- Host can see and **override the playback order** before starting — drag tracks to rearrange
- Host can also **re-shuffle** the playlist order
- The target clip's position in the sequence is visible to the host (highlighted) but not to players

**Step 3 — Playback ("Start Music" button in bottom bar)**
- Clips play sequentially with transitions: 1s fade-out → 0.2s silence → 1s fade-in
- Host UI shows:
  - Current clip name + progress bar (with time elapsed / clip length)
  - "Now Playing: Clip 3 of 12"
  - Target indicator (green highlight when target clip is currently playing — host-only)
  - **"Skip Track" button** — fades out current clip early, transitions to next (same fade rules apply)
  - **"Stop" button** — stops playback entirely
- System tracks `clipStartTime` and `clipEndTime` for each playing clip

**Step 4 — Player Buzzing**
- Players see a large **BUZZ button** on their device (styled to their chosen `keypadColor`)
- On tap: sends `MUSIC_BUZZ` WebSocket message with `{ playerId, deviceId, teamName, timestamp }`
- **Buzz validation rules** (processed on host):
  - If buzz arrives BEFORE any clip has started → **IGNORE** (buzzer stays active)
  - If buzz arrives during a NON-target clip → **INVALID** — player's buzzer is greyed out/locked until next target round. If evil mode on, negative points applied.
  - If buzz arrives during the TARGET clip → **VALID** — record response time = `buzzTimestamp - targetClipStartTime`
  - If buzz arrives AFTER clip ends → **IGNORE** (too late, no penalty)
- Host UI shows real-time buzz tracking panel:
  - List of teams that buzzed with timestamp, valid/invalid status
  - Response time ranking for valid buzzes

**Step 5 — Scoring & Results (after target clip finishes or all players buzzed)**
- Auto-calculate scores using existing `scoringEngine.ts`:
  - `calculateTeamPoints()` with `staggeredEnabled: true` (always on for music round)
  - Base points for all teams that correctly buzzed during target clip
  - Speed bonus: 1st gets `base + speedBonus`, 2nd gets `base + speedBonus - 1`, etc.
  - Evil mode: `-pointsValue` for teams that buzzed on wrong clip
  - Punishment mode: `-pointsValue` for teams that didn't buzz at all
- Show results summary on host screen
- Award points to teams via existing `onScoreChange` callbacks
- Broadcast fastest team to external display (reuse `sendFastestToDisplay`)
- Play team's buzzer sound for fastest team
- Show fastest team overlay on player devices (reuse existing `FastestTeamOverlay`)

**Step 6 — Next Target / End Round**
- If elimination enabled: remove correctly identified clip from the pool, remaining count shrinks
- Broadcast `MUSIC_ROUND_RESET` to players → re-enables their buzz buttons
- Host picks next target → back to Step 1
- **Auto-end**: When only 1 clip remains (elimination on) → auto-trigger final scoring, show results, then:
  - Broadcast `MUSIC_ROUND_END`
  - Navigate host back to home screen
  - Players return to their current display mode (basic/slideshow/scores)
- **Manual end**: Host can click "End Round" at any time

### 5. QuizHost Integration

**File: `src/components/QuizHost.tsx`**

- Update `MusicRoundInterface` props to pass:
  - `quizzes` (teams list for scoring/display)
  - `onScoreChange` (for awarding points to teams)
  - `onEndRound` (cleanup: `closeAllGameModes()`, navigate home, send `END_ROUND`)
  - `onShowFastestTeam` (trigger `FastestTeamDisplay` + external display + buzzer sound)
- Wire up `MUSIC_BUZZ` incoming WebSocket messages:
  - In the existing `wsInstance.onmessage` handler, forward `MUSIC_BUZZ` messages via `broadcastMessage()`
  - `MusicRoundInterface` listens via `onNetworkMessage('MUSIC_BUZZ', callback)`
- On music round end:
  - Call `sendEndRound()` to notify players
  - Call `closeAllGameModes()` to reset host state
  - Set `activeTab` to "home"

### 6. Player App — Buzz Button

**File: `src-player/src/App.tsx`**
- Add new screen state: `'music-buzz'`
- Handle new message types in `onMessage`:
  - `MUSIC_ROUND_START` → set `currentScreen` to `'music-buzz'`, store round info
  - `MUSIC_ROUND_TARGET` → update displayed target clip name, enable buzz button
  - `MUSIC_ROUND_BUZZ_RESULT` → show feedback (correct ✓ / wrong ✗ / locked)
  - `MUSIC_ROUND_RESET` → re-enable buzz button, clear feedback state
  - `MUSIC_ROUND_END` → reset question state, return to display mode

**File: `src-player/src/components/MusicBuzzScreen.tsx` (new file)**

Dedicated full-screen buzz button component:

- **Layout**:
  - Top: Target clip name — "Buzz when you hear: **Sweet Child O Mine**"
  - Center: Large circular/rounded BUZZ button covering ~60% of screen
  - Bottom: Status text
- **Styling**: Uses the player's `keypadColor` setting from `usePlayerSettings()`:
  - Button background uses the player's chosen color (cyan, blue, purple, green, orange, pink)
  - Active state: bright, pulsing subtle animation
  - Pressed state: darker shade + scale animation
- **States**:
  - **Waiting** (before round starts): "Get ready..." — button disabled
  - **Active**: "TAP TO BUZZ!" — button enabled, vibrant color
  - **Buzzed**: "BUZZED!" — button shows checkmark, waiting for host result
  - **Wrong Clip**: "Wrong clip! Wait..." — button greyed out, locked until `MUSIC_ROUND_RESET`
  - **Correct**: "Correct! +X pts" — green confirmation overlay
  - **Too Late**: Grey state with "Too late!" message
- **On tap**: Send WebSocket message:
  ```json
  { "type": "MUSIC_BUZZ", "playerId": "...", "deviceId": "...", "teamName": "...", "timestamp": 1695431241200 }
  ```
- Early buzzes (before first clip plays) are ignored by host — buzzer stays active on player side

### 7. Buzz Validation Logic (in MusicRoundInterface)

```
For each incoming MUSIC_BUZZ message:

1. Get current playback state:
   - currentClipId, currentClipStartTime, currentClipEndTime
   - targetClipId

2. Validate timing:
   - If no clip is currently playing → IGNORE (early buzz, don't lock)
   - If buzz.timestamp < currentClipStartTime → IGNORE  
   - If buzz.timestamp > currentClipEndTime → IGNORE (between clips)

3. Validate clip:
   - If currentClipId === targetClipId → VALID BUZZ
     - Record responseTime = buzz.timestamp - currentClipStartTime
     - Send MUSIC_ROUND_BUZZ_RESULT { valid: true, responseTime } to player
   - If currentClipId !== targetClipId → INVALID BUZZ
     - Send MUSIC_ROUND_BUZZ_RESULT { valid: false, reason: 'wrong_clip' } to player
     - Lock player's buzzer until MUSIC_ROUND_RESET
     - If evil mode → queue negative points for this team

4. Prevent duplicate buzzes:
   - Track which teams have already buzzed in this target round
   - Ignore subsequent buzzes from the same team
```

Host-side timing is authoritative since the host controls playback. Player timestamps are used for **ordering** valid buzzes to determine speed rankings.

### 8. Score Calculation

Reuse `src/utils/scoringEngine.ts` — no modifications needed:

```typescript
// For each valid buzz during correct clip:
const teamData: TeamScoreData = {
  teamId: team.id,
  correctAnswer: true,
  noAnswer: false,
  answerCount: 1,
  responseTime: buzzTimestamp - targetClipStartTime,
  rank: speedRanking, // calculated by rankCorrectTeams()
};

// For teams that buzzed on wrong clip (evil mode):
const wrongBuzzTeam: TeamScoreData = {
  teamId: team.id,
  correctAnswer: false,
  noAnswer: false,
  answerCount: 1,
  responseTime: 0,
};

// For teams that didn't buzz (punishment mode):
const noBuzzTeam: TeamScoreData = {
  teamId: team.id,
  correctAnswer: false,
  noAnswer: true,
  answerCount: 0,
  responseTime: 0,
};

// Config from round settings:
const config: ScoringConfig = {
  pointsValue: roundBasePoints,
  speedBonusValue: roundSpeedBonus,
  evilModeEnabled: roundEvilMode,
  punishmentModeEnabled: roundPunishment,
  staggeredEnabled: true,  // always on for music round
  goWideEnabled: false,
};
```

Speed bonus distribution (example with 4 bonus points, 4 base points):
- 1st → 4 + 4 = **8 pts**
- 2nd → 4 + 3 = **7 pts**
- 3rd → 4 + 2 = **6 pts**
- 4th → 4 + 1 = **5 pts**
- 5th+ → 4 + 0 = **4 pts**

### 9. External Display Integration

When the music round is active:
- Broadcast target clip name to external display via existing `QUESTION` message type (text: "Buzz when you hear: [Song Name]")
- On correct buzz: Trigger `FastestTeamDisplay` with team name, photo, buzzer sound (reuse `sendFastestToDisplay`)
- Show remaining clips count on external display
- On round end: Return external display to default mode via `handleExternalDisplayUpdate('basic')`

### 10. File Structure Summary

```
Modified files:
  src/utils/SettingsContext.tsx          — Music round default settings
  src/components/Settings.tsx            — Music round settings UI section
  src/network/wsHost.ts                  — New MUSIC_ROUND_* message types
  src/components/MusicRoundInterface.tsx — Full rebuild: setup + gameplay
  src/components/QuizHost.tsx            — Pass props, wire buzz messages
  src-player/src/types/network.ts       — New message types
  src-player/src/App.tsx                — Handle music round messages, new screen

New files:
  src/utils/musicRoundAudio.ts           — Audio engine (load, decode, play regions, normalization, fades)
  src-player/src/components/MusicBuzzScreen.tsx — Player buzz button UI
```

---

## Key Design Decisions

1. **Audio normalization via DynamicsCompressorNode** — Auto-levels all clips to roughly equal perceived volume. No per-track volume sliders needed, simpler UX.

2. **Staggered speed bonus always enabled** — Speed of reaction is the core mechanic, ranking-based bonuses always apply.

3. **Region selection avoids first/last 20s** — Ensures interesting parts of songs are played. Gracefully degrades for shorter tracks.

4. **Host-side buzz validation** — Host has authoritative timing since it controls playback. Player timestamps used for speed-ranking only.

5. **Reuse existing scoring engine** — `calculateTeamPoints` and `rankCorrectTeams` handle everything including evil mode, punishment mode, and staggered bonuses.

6. **Player buzz button uses their chosen keypadColor** — Consistent with their app theme preference (cyan, blue, purple, green, orange, pink).

7. **Host can override playlist order** — Auto-random placement of target clip, but host can rearrange and re-shuffle before pressing "Start Music".

8. **Skip track with proper transitions** — When host skips, same fade-out/silence/fade-in rules apply for smooth audio transitions.

9. **Elimination is a per-round toggle** — Defaults loaded from settings but can be changed per round. When enabled, clips are removed after correct identification; round auto-ends at 1 remaining clip.
