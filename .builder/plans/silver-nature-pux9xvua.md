# Windows Firewall Dialog Missing on Recent Exe Builds

## Problem Statement
- The PopQuiz.exe normally prompts for Windows Firewall permissions when first run
- User reports the firewall dialog is NOT appearing on the last 2 exe builds
- This occurs during the app startup (when it tries to bind to the local network port)
- User hasn't made code changes; my recent changes (QuizHost.tsx React component fix) are unrelated to the Electron build

## Why the Firewall Dialog Normally Appears
When an Electron app starts a WebSocket/HTTP server and listens on a network-accessible port (like 4310), Windows Firewall should prompt the user to allow network access. This is a critical security checkpoint.

The dialog NOT appearing suggests Windows has silently allowed or blocked the exe - this could be a security issue.

## Root Cause Analysis: What Could Have Changed

### 1. **Exe Signing/Certificate Status** (Most Likely)
- If the exe lost its digital signature or certificate changed, Windows might be blocking it silently instead of prompting
- Unsigned or self-signed exes trigger different security policies
- **Check**: Is the exe still signed? Has the cert changed?

### 2. **Windows Firewall Rules Cached from Previous Build**
- If previous PopQuiz.exe builds created firewall rules, Windows might auto-allow the new exe
- Even if the exe path/hash changed, Windows might recognize the app name
- **Check**: Look in Windows Firewall Advanced Settings for PopQuiz rules

### 3. **App Manifest Issues**
- If the exe's embedded manifest changed (app capability declarations), Windows treats it differently
- No manifest vs. manifest with network capability can change firewall behavior
- **Check**: Does the exe have an embedded manifest? What does it declare?

### 4. **Build Process Differences**
- electron-builder might be generating exes with different manifest/signature settings
- Some recent Electron or electron-builder updates change how manifests are embedded
- **Check**: Examine the portable exe properties and manifest

### 5. **Windows Security Policy / SmartScreen**
- Windows Defender SmartScreen might be blocking the exe before firewall dialog
- Unsigned exes from unknown publishers get blocked silently on some systems
- **Check**: Event Viewer, Windows Defender logs for blocks

## Investigation Steps

### Step 1: Examine the Exe Properties
1. Right-click PopQuiz.exe → Properties → Digital Signatures
   - **Expected**: Should show a valid signature
   - **If Missing/Invalid**: This is likely the root cause
   
2. Right-click PopQuiz.exe → Properties → Details
   - Check Product Name, Company Name, Version info
   - Compare with previous working build (if available)

### Step 2: Check Windows Firewall Rules
1. Open Windows Defender Firewall → Advanced Settings
2. Look in "Inbound Rules" for "PopQuiz" or "PopQuiz.exe"
   - If rules exist, they might be auto-allowing the exe
   - Delete the rules to force a fresh prompt on next run
3. Also check "Outbound Rules"

### Step 3: Check Windows Security Event Logs
1. Open Event Viewer
2. Navigate to: Windows Logs → Security
3. Filter for events with "PopQuiz.exe" or the app's port (4310)
4. Look for blocks or denies from Windows Defender/SmartScreen

### Step 4: Check for Exe Manifest
1. Open the exe in a binary editor or use a manifest viewer tool
2. Determine if the exe has an embedded manifest
3. If manifest exists, check for `requestedExecutionLevel` (admin/user)
4. Check for any capability declarations that might affect network access

### Step 5: Run Exe with Admin Rights
1. Right-click PopQuiz.exe → Run as administrator
2. Does the firewall dialog appear now?
3. If YES: The issue is permissions elevation. The exe might need to run as admin to trigger network prompts
4. If NO: The issue is the exe itself, not elevation

## Likely Solutions (in priority order)

### Solution 1: Clear Windows Firewall Rules & Run Fresh
1. Open Windows Firewall Advanced Settings
2. Delete any existing "PopQuiz" or matching exe rules
3. Close the exe completely
4. Run PopQuiz.exe again
5. Firewall dialog should re-appear

### Solution 2: Re-Sign the Exe
- If exe is unsigned/cert-less, signing it properly will restore proper firewall prompts
- Requires a valid code-signing certificate
- May be an electron-builder configuration issue

### Solution 3: Force Admin Execution
- Add manifest to exe requiring `requestedExecutionLevel='requireAdministrator'`
- This forces the UAC prompt (which you might be seeing instead of firewall)
- Not ideal but ensures app gets network access

### Solution 4: Check electron-builder Configuration
- Verify `win` target in package.json hasn't lost signing/certificate config
- Ensure no recent updates to electron-builder changed default behavior
- Check if `certificateFile` or signing config was accidentally removed

## Files to Investigate

1. **package.json** (Lines 15-19, 92-119)
   - Build scripts and electron-builder configuration
   - Check if signing/certificate config is present

2. **electron/main/main.js** (Lines 29-73)
   - Where the backend server starts listening
   - This is what triggers the firewall prompt

3. **electron/main/security.js** (Lines 21-36)
   - CSP and security headers
   - Verify LAN connections are still permitted in CSP

4. **electron-builder.yml** (if separate file exists)
   - More detailed build configuration
   - Agent found only inline package.json config, not a separate file

## Expected Outcome

Once the root cause is identified:
- Windows Firewall dialog will appear on first exe run
- User can choose to allow network access
- Exe will bind to 4310 successfully
- LAN player connections will work

## Notes for Implementation

- The issue is likely environmental (Windows caching rules) or exe-generation related (signing/manifest)
- My recent code changes (QuizHost.tsx listener fix) do NOT affect the Electron build process
- The exe generation and firewall behavior is controlled by electron-builder + Windows OS, not React components
- Focus investigation on: exe signing, firewall rules, and electron-builder configuration
