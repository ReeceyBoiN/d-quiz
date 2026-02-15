# Buzzer Folder Selection Feature - Comprehensive Debug & Fix Plan

## Root Cause Analysis

After thorough investigation, I've identified that both errors are caused by **backend startup failure**:

### Error Chain:
1. **Backend fails to start** during app initialization
2. **process.env.BACKEND_URL not set** - the main process catches the error but doesn't set environment variables
3. **Preload can't provide backend URL** - `window.api.backend.url()` returns `undefined`
4. **useHostInfo hook fails** with "No backend URL available from IPC"
5. **API calls that depend on host info fail** - cascading to buzzer folder selection errors

## Issues Found

### Issue 1: Import Path Verification
- **Finding**: Initial analysis suspected missing imports, but these are actually present:
  - `quizzes.js` has `import { z } from 'zod'` ✓
  - `ipcRouter.js` has `import log from 'electron-log'` ✓
- **Actual Problem**: The new buzzer folder code path may have issues:
  - `sounds.js` imports `getCurrentBuzzerFolderPath` from `buzzerFolderManager.js`
  - `sounds.js` imports `getBuzzerFolder` from `buzzerConfig.js`
  - `buzzerConfig.js` imports `getResourcePaths` from `../backend/pathInitializer.js`
  - If ANY of these fail to load, `startBackend()` throws and backend never starts

### Issue 2: Defensive Error Handling Needed
- When backend startup fails, errors are logged but process continues
- Window is created with undefined environment variables
- Preload exposes undefined backend URL, causing UI errors

## Fix Strategy

### Fix 1: Add Defensive Error Handling to Buzzer Folder Initialization
**File**: `electron/backend/endpoints/sounds.js`
**Change**: Wrap buzzer folder retrieval in defensive try-catch blocks
**Why**: Prevents endpoint loading errors from breaking backend startup

### Fix 2: Simplify Buzzer Folder Retrieval
**File**: `electron/backend/endpoints/sounds.js`
**Change**: Simplify to always fall back to default folder if custom path retrieval fails
**Why**: Ensures the endpoint can always return at least the default buzzers

### Fix 3: Add Error Logging for Backend Startup Failures
**File**: `electron/main/main.js`
**Change**: Add detailed error logging when backend fails to start
**Why**: Help identify the exact cause of startup failure

## Implementation Steps

1. **Update sounds.js** to use defensive buzzer folder retrieval:
   - Try to get custom buzzer path
   - If that fails, fall back directly to default path
   - Wrap in try-catch to prevent endpoint loading errors

2. **Test verification**:
   - Check main process console logs for backend startup
   - Confirm "✅ Backend server started successfully" message
   - Verify `window.api.backend.url()` returns valid URL in renderer console
   - Test that buzzer folder selection works

3. **Validation steps**:
   - Backend successfully starts
   - BACKEND_URL is set in process.env
   - Preload provides valid backend URL to React app
   - useHostInfo hook can retrieve host info
   - Buzzer folder selection IPC calls work

## Files to Modify

1. `electron/backend/endpoints/sounds.js` - Add defensive error handling for buzzer folder retrieval

## Critical Path Forward

The backend startup is the blocker. Once that's fixed:
- useHostInfo will work → React components can fetch APIs
- IPC handlers will be accessible → Folder selection will work
- The feature will be fully functional

