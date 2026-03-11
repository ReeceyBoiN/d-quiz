# Fix: Music Round should only show target song, not currently playing song

## Problem
During the Music Round, both the **external display** and **player app** show which song is currently playing. This defeats the purpose of the game — players are supposed to listen and buzz when they *hear* the target song, not read which song is playing on screen.

## What needs to change

### 1. `src/components/MusicRoundInterface.tsx` — Stop sending "Now Playing" info

**Line ~499-504**: The external display update during playback currently shows both "Now Playing: {songName}" and "Buzz when you hear: {target}". Change it to only show the target song instruction.

```
// Before (line 500-503):
onExternalDisplayUpdate('question', {
  text: `Now Playing: ${playingClip?.name || 'Unknown'}\n\nBuzz when you hear: ${targetClip?.name}`,
  type: 'music-buzz',
});

// After:
onExternalDisplayUpdate('question', {
  text: `Buzz when you hear: ${targetClip?.name}`,
  type: 'music-buzz',
});
```

**Line ~491-496**: Remove or stop the `MUSIC_ROUND_NOW_PLAYING` broadcast to player devices entirely, since players should not see which clip is currently playing.

```
// Remove these lines:
broadcastToPlayers('MUSIC_ROUND_NOW_PLAYING' as any, {
  clipName: playingClip?.name || 'Unknown',
  clipIndex: clipIndex,
  totalClips: playbackSequence.length,
});
```

### 2. `src-player/src/components/MusicBuzzScreen.tsx` — Remove "Now Playing" display

**Lines ~158-163**: Remove the "Now Playing" UI section that shows the current song name to players. This is the `{nowPlayingClipName && (...)}` block.

The `nowPlayingClipName` prop can be removed from the component interface entirely since it will no longer be used.

### 3. `src-player/src/App.tsx` — Clean up unused state/handler

**Line ~1187-1193**: The `MUSIC_ROUND_NOW_PLAYING` case handler can be removed since we're no longer broadcasting that message.

**Line ~1873**: Remove `nowPlayingClipName={musicNowPlayingClip}` prop from the `MusicBuzzScreen` usage.

The `musicNowPlayingClip` state and `setMusicNowPlayingClip` can be removed, though the reset calls in `MUSIC_ROUND_RESET` and `MUSIC_ROUND_END` handlers should also be cleaned up.

## Files to modify

| File | Change |
|------|--------|
| `src/components/MusicRoundInterface.tsx` | Remove "Now Playing" from external display text; remove `MUSIC_ROUND_NOW_PLAYING` broadcast |
| `src-player/src/components/MusicBuzzScreen.tsx` | Remove `nowPlayingClipName` prop and "Now Playing" UI section |
| `src-player/src/App.tsx` | Remove `MUSIC_ROUND_NOW_PLAYING` handler, `musicNowPlayingClip` state, and prop passing |

## Optional cleanup (low priority)

- Remove `MUSIC_ROUND_NOW_PLAYING` from the `HostMessageType` union in `src/network/wsHost.ts` and `src-player/src/types/network.ts`
- Remove `currentPlayingClipNameRef` from MusicRoundInterface if it's only used for broadcasting (needs verification)
