# Fix Buzz-In Sound Files Not Found

## Problem
The buzz-in correct/wrong sound files exist in the repo at `resorces/sounds/Misc/` but are not present at the runtime location `Documents/PopQuiz/Resources/Sounds/Misc/`. The `ERR_FILE_NOT_FOUND` error occurs because:

1. The `resorces/` folder is **not included** in the electron-builder `files` or `extraResources` config, so it doesn't ship with the portable exe
2. The migration code in `pathInitializer.js` that copies Misc is nested inside a condition (`if hasOldCountdown || hasOldApplause || hasOldFailSounds`) that may not trigger
3. The source paths checked by migration (`process.cwd()` and a hardcoded path) may not resolve correctly in all environments

## Solution

### 1. Add `resorces` to electron-builder `extraResources` (`package.json`)
Add an `extraResources` entry so the `resorces/sounds/Misc` folder ships alongside the exe and is accessible at `process.resourcesPath` in production:

```json
"extraResources": [
  {
    "from": "resorces/sounds/Misc",
    "to": "sounds/Misc"
  }
]
```

### 2. Fix migration logic in `electron/backend/pathInitializer.js`
- Move the Misc migration **outside** the `if (hasOldCountdown || hasOldApplause || hasOldFailSounds)` block so it runs independently
- Add a **third source location**: `process.resourcesPath` (where electron-builder puts `extraResources` in production builds)
- Add a dedicated fallback that specifically ensures Misc sounds exist, similar to the existing Fail Sounds fallback

### 3. No changes needed to `audioUtils.ts` or UI components
The `playBuzzCorrectSound()` and `playBuzzWrongSound()` functions and button wiring are already correct — the only issue is that the files don't exist at the expected destination path.

## Files to Modify
1. `package.json` — Add `extraResources` to electron-builder config
2. `electron/backend/pathInitializer.js` — Fix migration logic for Misc sounds
