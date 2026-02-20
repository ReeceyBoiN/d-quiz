# Plan: Fix Hardcoded Teams Display in Host Remote Leaderboard

## Problem Statement
The Host Remote Leaderboard is still showing hardcoded "Team A" (450 pts), "Team B" (380 pts), "Team C" (320 pts) even after:
- Code changes to LeaderboardPanel to fetch from backend
- Dev server restart
- Player successfully connected (console shows team "6691" joined)

Expected behavior: Should show either "Loading leaderboard..." or "No teams connected yet" OR real team data from backend.

## Root Cause - CONFIRMED

The code changes are **NOT loaded in the browser**:

### Evidence
1. ❌ ℹ️ Info button NOT visible (was added to header)
2. ❌ No `[LeaderboardPanel]` logs in console (new logging was added)
3. ✅ BUT `[HostTerminal] Refreshing leaderboard...` appears (from OLD code version)

### What This Means
- src-player build was NOT recompiled after my changes
- Browser is serving stale bundle from previous build
- User hard-refreshed (confirmed), but old bundle is cached somewhere

### Likely Causes
1. **Dev server didn't recompile** - Files changed but Vite didn't detect/recompile them
2. **Multiple build systems fighting** - Both `npm run dev` and `npm run rebuild` running, causing conflicts
3. **Dist folder served instead of dev server** - Prod build being served instead of dev build
4. **Network connection to dev server broken** - Browser can't reach dev server, falls back to cached old build

## Root Cause: Dev Server Build Issue

### The Problem
- Files were edited in src-player/src/components/HostTerminal/
- Dev server did NOT recompile these changes into the bundle
- Browser still serving old v1 bundle (without ℹ️ button, without LeaderboardPanel logs)

### Why This Happened
The dev server command is: `npm run dev:builder` which runs both:
```
npm run dev       // Vite dev server
npm run rebuild   // Electron rebuild (for backend)
```

This dual-build setup can cause:
1. Vite may not watch the right directories
2. File changes may not trigger recompilation
3. Old bundle may be cached in dist-player folder

## Solution Strategy

### Option A: Force Full Rebuild (Recommended for Stability)
1. **Kill dev server** (Ctrl+C)
2. **Delete build artifacts**
   - Remove: `dist-player/` folder
   - Remove: `node_modules/.vite` cache (if exists)
3. **Clear browser cache completely**
   - DevTools > Application > Clear Storage > Clear all
   - OR use new incognito/private window
4. **Restart dev server**
   - `npm run dev:builder` (or individual `npm run dev`)
5. **Verify bundle compiled**
   - Check dev server logs for "ready in X ms"
   - Should show file compilation output
6. **Reload browser**
   - Full page reload (F5)
   - Check for ℹ️ button and [LeaderboardPanel] logs

### Option B: Force Vite Recompile Only (Faster)
1. **Edit a file that Vite watches** (e.g., src-player/src/App.tsx)
2. **Add a comment and save**
3. **Vite should detect change and rebuild**
4. **Revert the comment**
5. **Reload browser**

### Option C: Check Dev Server Logs
1. Look at the dev server terminal output
2. Search for error messages after file edits
3. If files aren't listed in "changed files", Vite isn't watching them
4. May need to restart dev server with different config

## Files That Need to Load (for verification)
When changes compile correctly, browser should have:
- ✅ `src-player/src/components/HostTerminal/index.tsx` - with ℹ️ button
- ✅ `src-player/src/components/HostTerminal/LeaderboardPanel.tsx` - with [LeaderboardPanel] logging
- ✅ Console shows: `[LeaderboardPanel] Component mounted...` on load
- ✅ Info button visible in header

## Expected Behavior After Fix
Once the dev server properly compiles and serves the new code:

### On Initial Load (No Players Connected)
- Page shows "Loading leaderboard..." with 📊 icon
- After 2-3 seconds transitions to "No teams connected yet"
- Console shows `[LeaderboardPanel]` logs like:
  ```
  [LeaderboardPanel] Component mounted, fetching initial leaderboard
  [LeaderboardPanel] ✅ Sent GET_CONNECTED_TEAMS request to backend
  [LeaderboardPanel] ✅ Received team list from backend: []
  [LeaderboardPanel] Periodic refresh triggered
  ```

### When Players Connect
- Real team name appears (e.g., "Team 1946")
- Shows their actual score (e.g., 0 at start)
- ℹ️ button is clickable and shows purpose reference
- Console logs show each refresh and update

### Hardcoded Teams No Longer Appear
- Team A, Team B, Team C will NOT show (they were from old code)
- Only real connected players appear
