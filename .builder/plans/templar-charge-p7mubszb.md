# Fix: Module Resolution Error in buzzerHandler.js

## Problem
The app failed to boot with error:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'C:\Users\windows1\AppData\Local\Temp\39h9ra5Gi9rLoR5mKpk0m1iJSh8..\buzzerConfig.js'
imported from buzzerHandler.js
```

## Root Cause
The import path in `electron/ipc/handlers/buzzerHandler.js` is incorrect:
- Current: `import { getDefaultBuzzerFolder } from '../utils/buzzerConfig.js';`
- Issue: Uses `../` (up 1 level) but buzzerHandler.js is at `electron/ipc/handlers/`, so it tries to find the module at `electron/ipc/utils/buzzerConfig.js` (which doesn't exist)

## Solution
Fix the relative import path in `electron/ipc/handlers/buzzerHandler.js`:
- Change from: `'../utils/buzzerConfig.js'`
- Change to: `'../../utils/buzzerConfig.js'`
- Reason: Need to go up 2 levels (handlers → ipc → electron) then into utils/

## Files to Modify
1. **electron/ipc/handlers/buzzerHandler.js** - Line 9
   - Fix the import path from `../utils/buzzerConfig.js` to `../../utils/buzzerConfig.js`

## Expected Result
- App will boot successfully
- Module will be correctly resolved from `electron/utils/buzzerConfig.js`
- The buzzer folder path feature will work as implemented
