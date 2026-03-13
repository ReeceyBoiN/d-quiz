# Bundle All Sounds with the Installer

## Problem
Only `resorces/sounds/Misc` is currently in `extraResources`. The other 4 sound folders (Applause, Countdown, Fail Sounds, Buzzers — totalling ~75 files) are NOT packaged with the exe. The migration logic in `pathInitializer.js` relies on paths that only exist on the developer's machine, so other hosts would have no sounds at all.

## Solution

### 1. Update `extraResources` in `package.json`
Add all sound subfolders to the electron-builder `extraResources` config so they ship alongside the exe:

```json
"extraResources": [
  { "from": "resorces/sounds/Misc", "to": "sounds/Misc" },
  { "from": "resorces/sounds/Applause", "to": "sounds/Applause" },
  { "from": "resorces/sounds/Countdown", "to": "sounds/Countdown" },
  { "from": "resorces/sounds/Fail Sounds", "to": "sounds/Fail Sounds" },
  { "from": "resorces/sounds/Buzzers", "to": "sounds/Buzzers" }
]
```

### 2. Update migration fallback in `electron/backend/pathInitializer.js`
Extend the `extraResources` fallback (currently only for Misc) to also cover Applause, Countdown, Fail Sounds, and Buzzers. For each folder:
- Check if the destination in `Documents/PopQuiz/Resources/Sounds/<folder>` is empty
- If so, copy from `process.resourcesPath/sounds/<folder>` (where electron-builder places extraResources in production)
- This ensures first-run on any machine populates all sounds automatically

### Files to Modify
1. `package.json` — expand `extraResources` array
2. `electron/backend/pathInitializer.js` — expand the extraResources fallback loop to cover all 5 sound folders

### Notes
- Buzzer files (~68 mp3s) will increase the exe size but are essential for the app to function
- Existing user files in `Documents/PopQuiz/Resources/Sounds/Buzzers` are never overwritten (the copy only runs if the destination folder is empty)
