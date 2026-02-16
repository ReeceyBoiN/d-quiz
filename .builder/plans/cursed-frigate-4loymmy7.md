# Plan: Team Photos Tab Orange Flash Indicator

## Overview
Add a visual indicator (flashing orange animation) to the "Team Photos" tab in the bottom navigation bar when there are pending team photos waiting for approval.

## Current State
- **Bottom Navigation Component**: `src/components/BottomNavigation.tsx`
  - Already has Team Photos button that opens a popup
  - `fetchPendingPhotos()` function filters for pending team photos (status === 'pending' AND has teamPhoto)
  - Has `pendingPhotos` state that stores filtered pending photos
  - Listens to `TEAM_PHOTO_UPDATED` events to refresh pending photos

## Implementation Approach

### 1. Add State to Track Pending Photos Count
- Add state `hasPendingTeamPhotos` (boolean) in BottomNavigation.tsx
- Derive this from existing `pendingPhotos` state: `hasPendingTeamPhotos = pendingPhotos.length > 0`

### 2. Add Periodic/Event-Driven Check for Pending Photos
- Call `fetchPendingPhotos()` on component mount (useEffect)
- Re-check when `TEAM_PHOTO_UPDATED` event is received (already listening to this)
- Option: Poll periodically (every 5-10 seconds) OR only check on events
- This ensures the indicator updates when photos become pending

### 3. Create Flashing Orange Animation
- Add CSS animation to flash orange (opacity or background-color oscillation)
- Apply conditional className to Team Photos button based on `hasPendingTeamPhotos`
- Use Tailwind classes for quick implementation OR custom CSS for fine-tuned animation

### 4. Apply Conditional Styling to Team Photos Button
- Wrap Team Photos button styling with conditional classes
- Example structure:
  ```
  <button 
    className={`... ${hasPendingTeamPhotos ? 'animate-orange-flash' : ''}`}
  >
  ```

## Key Files to Modify
- **src/components/BottomNavigation.tsx**: 
  - Add `hasPendingTeamPhotos` state derived from `pendingPhotos`
  - Ensure `fetchPendingPhotos()` is called on mount and on TEAM_PHOTO_UPDATED
  - Add conditional className to Team Photos button
  - Add CSS animation or Tailwind animation class

## User Preferences (Confirmed)
1. **Flash Style**: Entire button flashes orange
2. **Flash Behavior**: Continuous loop while there are pending photos
3. **Checking Frequency**: Check only on events (TEAM_PHOTO_UPDATED)

## Implementation Details

### State Management
- Add `hasPendingTeamPhotos` boolean state (derived from `pendingPhotos.length > 0`)

### Event Listeners
- The component already listens to `TEAM_PHOTO_UPDATED` events
- On component mount, call `fetchPendingPhotos()` to initialize state
- When `TEAM_PHOTO_UPDATED` is received, the existing listener will trigger `fetchPendingPhotos()`

### Animation
- Create a continuous CSS keyframe animation that oscillates the orange background
- The entire Team Photos button will apply this animation when `hasPendingTeamPhotos` is true
- Animation should be smooth and noticeable (suggest 0.8-1s cycle)
- Use Tailwind's `animate-*` or custom CSS keyframes

### Conditional Application
```jsx
<button
  className={`... ${hasPendingTeamPhotos ? 'animate-orange-flash' : ''}`}
>
  <Camera className="h-4 w-4" />
  <span className="text-sm text-center">Team Photos</span>
</button>
```

## Expected Behavior
- On page load: Check for pending photos, add flash animation if found
- When new photo arrives: TEAM_PHOTO_UPDATED triggers refresh, animation applies
- When all photos approved: pendingPhotos empties, animation stops
- Flash continues looping until there are no more pending photos
