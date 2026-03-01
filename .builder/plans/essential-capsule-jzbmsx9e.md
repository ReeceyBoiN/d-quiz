# Buzzer Volume Persistence & Styling Fixes (Finalized)

## Issues to Address

### 1. Performance & Buzzer Section Styling (Quick Fix)
- **Current**: Both sections have light color gradients
  - Performance: `from-blue-50 to-blue-100`
  - Buzzer: `from-amber-50 to-amber-100`
- **Goal**: Replace gradients with `bg-card` to match rest of controls
- **Files**: `src/components/FastestTeamDisplay.tsx` lines 401 and 427

### 2. Buzzer Volume Persistence & Playback (Main Feature)
- **Problem 1**: Buzzer volume slider doesn't persist (resets to 75%)
- **Problem 2**: Slider doesn't affect actual audio playback
- **Problem 3**: Volume only accessible from FastestTeamDisplay, not team settings
- **Goal**: Make buzzer volume per-file, persisted, and affecting playback across all UIs

## Implementation Approach: Per-Buzzer-File Volume System

### Core Concept
- Store volume settings indexed by buzzer filename (e.g., `{"alarm.mp3": 65, "bell.mp3": 80}`)
- When any team plays a buzzer, look up the saved volume for that file
- Display and allow editing volume in FastestTeamDisplay AND BuzzersManagement
- Persist settings to localStorage or similar

### Files to Modify

#### 1. **src/components/QuizHost.tsx**
**Changes:**
- Add buzzer volume state: `const [buzzerVolumes, setBuzzerVolumes] = useState<{[buzzerName: string]: number}>({})` (load from localStorage on mount)
- Update `playFastestTeamBuzzer()` function:
  - Extract buzzer filename from `buzzerSound` prop
  - Look up volume: `buzzerVolumes[buzzerSound] ?? 75`
  - Set audio volume before playing: `buzzerAudioRef.current.volume = volume / 100`
- Add callback function: `handleBuzzerVolumeChange(buzzerSound: string, volume: number)`
  - Update state
  - Persist to localStorage
- Pass both `buzzerVolumes` and `handleBuzzerVolumeChange` to FastestTeamDisplay as props

#### 2. **src/components/FastestTeamDisplay.tsx**
**Changes:**
- Remove prop `fastestTeam` buzzer-related code: change local `buzzerVolume` state to receive volume as prop
- Accept props:
  - `buzzerVolumes: {[key: string]: number}` - map of buzzer file -> volume
  - `onBuzzerVolumeChange: (buzzerSound: string, volume: number) => void` - callback
- Update Buzzer Slider's onValueChange:
  - Call `onBuzzerVolumeChange(fastestTeam.team.buzzerSound, newVolume)`
- Fix styling on lines 401 and 427:
  - Replace `className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-800 ..."` with `className="bg-card ..."`
  - Replace `className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-slate-700 dark:to-slate-800 ..."` with `className="bg-card ..."`

#### 3. **src/components/BuzzersManagement.tsx**
**Changes:**
- Update `playBuzzerSound()` function:
  - Extract buzzer filename
  - Look up volume from parent prop: `buzzerVolumes[buzzerSound] ?? 75`
  - Set audio volume: `audioRef.current.volume = volume / 100`
- Accept props from parent (QuizHost):
  - `buzzerVolumes: {[key: string]: number}`
  - `onBuzzerVolumeChange: (buzzerSound: string, volume: number) => void`
- Add volume slider UI for each team:
  - Next to or below the Play Buzzer button
  - Show current volume for that team's buzzer
  - Call `onBuzzerVolumeChange` when slider changes

### Data Structure
No changes to Quiz/Team interface needed. Volume mapping is stored in QuizHost state and localStorage:
```
buzzerVolumes = {
  "alarm.mp3": 65,
  "bell.mp3": 80,
  "buzzer1.wav": 100
}
```

### localStorage Key
Store under key: `quiz-buzzer-volumes` with JSON stringified object

### UI Flow
1. User opens FastestTeamDisplay or BuzzersManagement
2. Both show current team's buzzer volume (looked up from `buzzerVolumes` dict)
3. User adjusts slider
4. Callback `onBuzzerVolumeChange` is called
5. QuizHost updates state and persists to localStorage
6. Next time that buzzer is played (by any team), it uses the saved volume

### Backward Compatibility
- If no volume saved for a buzzer, default to 75% (current default)

## Summary of Changes
| File | Change | Type |
|------|--------|------|
| QuizHost.tsx | Add buzzer volume state, update playback logic, add callback | Major |
| FastestTeamDisplay.tsx | Convert slider to prop-based, remove gradients, wire callback | Major |
| BuzzersManagement.tsx | Add volume slider per team, update playback logic | Major |

## Testing Checklist
- [ ] Adjust volume in FastestTeamDisplay, hear change when buzzer plays
- [ ] Adjust volume in BuzzersManagement, hear change when buzzer plays
- [ ] Close app, reopen, volume settings persist
- [ ] Same buzzer used by different teams shows same volume
- [ ] Gradient styling removed from Performance and Buzzer sections
- [ ] All teams can still play their buzzers without errors

