# Music Round Gameplay Flow Rework

## Summary of Issues Found

After thorough review of the current implementation, here are the problems that need fixing:

### Critical Flow Issues
1. **Playback doesn't stop after target clip plays** - Currently all clips play through to the end. The playlist should stop automatically after the target clip finishes playing.
2. **No "Reveal Answer" step** - After playback stops, the host should see a "Reveal Answer" button. Currently it jumps straight to results.
3. **No applause sound on reveal** - Other modes play `playApplauseSound()` when the answer is revealed. Music round skips this entirely.
4. **No separate "Fastest Team" step** - After reveal, the host should click a button to show the fastest team (with their photo and buzzer sound on external display + player devices). Currently this is bundled into results.
5. **No "Next" step to return to playlist editing** - After fastest team, the host should be able to go back to edit the playlist order, remove the target clip (if elimination enabled), pick a new target, shuffle, and press "Play Music" again.
6. **FastestTeamDisplay rendering conflict** - In QuizHost.tsx, `showFastestTeamDisplay` check (line ~6668) renders BEFORE `showMusicRoundInterface` (line ~6787), so if both are true, the music round UI disappears and only FastestTeamDisplay shows. It needs to render as an overlay ON TOP of MusicRoundInterface instead.
7. **No "now playing" clip name on player devices or external display** - Players can only see the target clip name. They don't know which clip is currently playing (by design for the game, but the target reminder should persist).
8. **No reverse audio option** - User wants a "play backwards" toggle in round setup.

### Memory / Cleanup Issues
9. **AudioContext leak in `loadAudioFile`** - Each call creates a new AudioContext to decode, which is fine since it closes it. But if 18 clips are loaded simultaneously, many contexts could be open.
10. **Preview clip doesn't clear ref on natural end** - `previewHandleRef` stays set after preview finishes naturally, so next click tries to `stop()` an already-stopped source.
11. **`setInterval` for progress not cleared on skip** - When skipping clips, the interval from the previous clip continues until the new one starts.

---

## Implementation Plan

### Step 1: Add "Reverse Audio" option to setup

**File: `src/utils/musicRoundAudio.ts`**
- Add `reverseAudioBuffer(buffer: AudioBuffer): AudioBuffer` function
  - Creates a new AudioBuffer with same properties
  - Copies each channel's Float32Array data and reverses it using `Array.prototype.reverse()`
  - This is fully supported by Web Audio API
- Add optional `reversed` parameter to `loadClips()` - when true, reverses each buffer after loading
- Add optional `reversed` parameter to `previewClip()` - reverses the buffer before playing

**File: `src/utils/SettingsContext.tsx`**
- Add `musicRoundReversed: boolean` (default: false)
- Add `updateMusicRoundReversed` function

**File: `src/components/Settings.tsx`**
- Add "Play Backwards" toggle in Music Round section

**File: `src/components/MusicRoundInterface.tsx`**
- Add `[reversedEnabled, setReversedEnabled]` state, loaded from settings default
- Add toggle in Round Configuration section
- Pass `reversed` flag to `loadClips()` and `previewClip()`

### Step 2: Rework audio engine - stop after target clip

**File: `src/utils/musicRoundAudio.ts`**
- Add `targetClipId` parameter to `playClipSequence()`
- Modify `playNextClip()`:  After the target clip finishes playing (detected via `source.onended` when `currentClipId === targetClipId`), stop the sequence instead of continuing to the next clip
- Add a new callback parameter: `onTargetClipFinished?: () => void` - called when the target clip has finished playing
- The existing `onPlaybackEnd` should only fire if ALL clips finish (which won't happen in normal flow since we stop after target)

### Step 3: Rework gameplay flow - multi-step reveal process

**File: `src/components/MusicRoundInterface.tsx`**

Replace the current single `showResults` state with a step-based flow:

```
gameplayStep: 'target-selection' | 'playlist-ready' | 'playing' | 'reveal-answer' | 'fastest-team' | 'next-round'
```

**Step-by-step flow:**

1. **`target-selection`** - Host picks or randomizes target clip. Broadcasts target name to players/external display. Player buzzers enabled.
2. **`playlist-ready`** - Target is selected, playlist is shown. Host can drag-reorder, re-shuffle. "Play Music" button visible. Host can also change target.
3. **`playing`** - Music is playing. Skip/Stop buttons visible. Buzzes tracked. When target clip finishes → auto-stop playback → transition to `reveal-answer`.
4. **`reveal-answer`** - Music has stopped. Host sees "Reveal Answer" button. Shows target clip name (hidden/blurred until reveal). When clicked:
   - Plays `playApplauseSound()` (from `audioUtils.ts`)
   - Sends reveal to external display showing the answer: the target clip name
   - Sends reveal to player devices
   - Awards scores to valid buzz teams
   - Transitions to `fastest-team`
5. **`fastest-team`** - Shows "Show Fastest Team" button. When clicked:
   - Triggers `onShowFastestTeam()` → shows FastestTeamDisplay overlay on host, sends to external display + player devices
   - Team's buzzer sound plays
   - After a few seconds or host click, transitions to `next-round`
6. **`next-round`** - Shows playlist editor again:
   - If elimination enabled, target clip is removed from remaining clips
   - Host can drag-reorder remaining clips
   - Host can re-shuffle playlist order
   - Host picks new target clip
   - "Play Music" button to start next run
   - If only 1 clip remains → auto-end round

### Step 4: Fix FastestTeamDisplay overlay conflict

**File: `src/components/QuizHost.tsx`**
- Move the `showFastestTeamDisplay` overlay rendering to be INSIDE the `showMusicRoundInterface` block (like how keypad mode does it at line ~6646)
- Wrap MusicRoundInterface in a relative container with the FastestTeamDisplay as an absolute overlay on top

### Step 5: Add new props to MusicRoundInterface for applause and reveal

**File: `src/components/MusicRoundInterface.tsx`**
- Import `playApplauseSound` from `audioUtils.ts`
- Add `onPlayApplause` prop or call `playApplauseSound()` directly during reveal step
- Add `MUSIC_ROUND_REVEAL` message type to broadcast reveal to players
- Add `MUSIC_ROUND_CLIP_PLAYING` message type to broadcast currently-playing clip name to external display (so it shows on the big screen)

**File: `src/network/wsHost.ts`**
- Add `MUSIC_ROUND_REVEAL` message type

**File: `src-player/src/types/network.ts`**
- Add `MUSIC_ROUND_REVEAL` to HostMessageType

**File: `src-player/src/App.tsx`**
- Handle `MUSIC_ROUND_REVEAL` - show the answer/correct clip name on player screen

**File: `src-player/src/components/MusicBuzzScreen.tsx`**
- Add `revealedAnswer` prop to show the correct answer after reveal
- Add visual state for "reveal" mode - show the answer prominently

### Step 6: Broadcast "now playing" clip name to external display

**File: `src/components/MusicRoundInterface.tsx`**
- In the `onClipChange` callback of `playClipSequence`, broadcast the current clip name to the external display via `broadcastQuestion`
- The external display will show "Now Playing: [clip name]" while music plays
- The target clip name should always remain visible at the top of player devices (already working via `musicTargetClip` state)

### Step 7: Fix memory leaks and cleanup

**File: `src/utils/musicRoundAudio.ts`**
- Fix preview ref cleanup: add `onended` handler that nullifies the ref
- Ensure `setInterval` is always cleared on skip/stop before new one starts
- Add safety check in `cleanupPlayback` for pending setTimeout callbacks

**File: `src/components/MusicRoundInterface.tsx`**
- Clear `previewHandleRef` on natural preview end
- Add proper cleanup in the buzz listener effect - use a ref for handleBuzz to avoid stale closure + effect dependency churn
- Ensure all IPC calls have error handling (already done)

---

## Files Modified

| File | Changes |
|------|---------|
| `src/utils/musicRoundAudio.ts` | Add `reverseAudioBuffer()`, add `targetClipId` + `onTargetClipFinished` to `playClipSequence`, fix memory cleanup |
| `src/components/MusicRoundInterface.tsx` | Complete gameplay flow rework with step-based states, reverse toggle, reveal/fastest/next flow, applause sound, broadcast "now playing" |
| `src/components/QuizHost.tsx` | Fix FastestTeamDisplay overlay to render inside music round block |
| `src/utils/SettingsContext.tsx` | Add `musicRoundReversed` setting |
| `src/components/Settings.tsx` | Add "Play Backwards" toggle |
| `src/network/wsHost.ts` | Add `MUSIC_ROUND_REVEAL` message type |
| `src-player/src/types/network.ts` | Add `MUSIC_ROUND_REVEAL` type |
| `src-player/src/App.tsx` | Handle `MUSIC_ROUND_REVEAL` message |
| `src-player/src/components/MusicBuzzScreen.tsx` | Add reveal answer display state |
| `electron/backend/server.js` | No changes needed (broadcastMusicRound already handles all types) |

---

## Key Design Decisions

1. **Playback stops after target clip** - This matches the user's description: "after the selected clip is played, the playlist needs to stop." The host then manually reveals the answer.

2. **Step-based flow (not single button)** - Reveal Answer → Show Fastest Team → Next Round. Each step is a deliberate host action, matching other game modes.

3. **Reverse audio via buffer manipulation** - Web Audio API's `AudioBuffer.getChannelData()` returns a `Float32Array`. We reverse the samples in-place to play backwards. This is efficient and doesn't require re-encoding.

4. **FastestTeamDisplay as overlay** - Matches the pattern used for keypad mode (absolute positioned overlay), preventing the music round UI from being replaced entirely.

5. **Applause on reveal** - Uses existing `playApplauseSound()` from `audioUtils.ts`, consistent with keypad and nearest wins modes.
