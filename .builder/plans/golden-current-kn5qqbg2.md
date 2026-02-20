# Fix Windows Firewall Dialog Missing on PopQuiz.exe Builds

## Problem Summary
PopQuiz.exe is not prompting for Windows Firewall permissions on recent builds. Normally, when the app starts the backend server on port 4310 and attempts to listen on network-accessible interfaces, Windows should prompt the user to allow network access. This firewall dialog is not appearing.

## Root Cause
The exe is being built **without code signing**. Analysis of `package.json` shows the `build.win` configuration lacks any signing/certificate configuration:

```json
"win": {
  "target": [{"target": "portable", "arch": ["x64"]}],
  "icon": "build/icon.ico",
  "artifactName": "PopQuiz.exe"
  // ❌ MISSING: certificateFile, signingHashAlgorithms, or signature config
}
```

**Why this matters for stability:**
- Unsigned executables trigger different Windows security policies
- Windows may silently block/restrict network access instead of prompting
- Firewall rules from previous builds may cause caching issues
- SmartScreen and other Windows security features treat unsigned exes with suspicion
- Inconsistent behavior across rebuilds reduces reliability

## Code Review Findings

**Server Startup (electron/main/main.js)**: ✅ Correct
- Port 4310 binding implemented correctly (line 48)
- Network interface detection working (line 45)
- WebSocket server setup proper (which normally triggers firewall prompt)

**Security Configuration (security.js)**: ✅ Correct
- CSP allows local network connections (192.168.*, 10.*)
- LAN player connectivity properly permitted

**Build Configuration (package.json)**: ❌ Missing signing
- No certificate configuration
- No signing hash algorithms specified
- No manifest configuration

## Recommended Solution: Two-Phase Approach

### Phase 1: Immediate Stabilization (Current Build Cycle)
**Goal**: Restore firewall prompt behavior while we prepare proper signing

**Action**: Clear Windows Firewall Rules + Rebuild
1. User clears all PopQuiz firewall rules from Windows Defender Firewall Advanced Settings
2. Rebuild exe: `npm run build:exe`
3. Run fresh exe - firewall dialog should reappear
4. This works because Windows will re-evaluate the unsigned exe and prompt again

**Why this works**: Windows caches firewall rules; clearing them forces a fresh evaluation.

**Risk level**: Low - reversible, doesn't modify code

### Phase 2: Permanent Stabilization (Next Build Cycle)
**Goal**: Implement proper code signing to ensure reliable firewall prompts on all future builds

**Options (in order of preference for stability):**

#### Option A: Proper Code Signing (Recommended)
- Acquire code-signing certificate (EV certificate for best stability)
- Add to `package.json` build config:
  ```json
  "win": {
    "certificateFile": "path/to/certificate.pfx",
    "certificatePassword": "env:CERT_PASSWORD",
    "signingHashAlgorithms": ["sha256"],
    // ... rest of config
  }
  ```
- Store certificate password in environment variable for CI/CD
- All future builds will be properly signed, eliminating firewall issues

**Pros**: Permanent fix, enterprise-grade, prevents all future Windows security issues
**Cons**: Requires purchasing certificate (~$100-500/year)

#### Option B: Self-Signed Certificate for Development (If Cost Is Issue)
- Generate self-signed certificate for testing
- Add same config as Option A
- Works for local testing but won't eliminate Windows security warnings for end users
- User would need to install cert on their machine

**Pros**: Free, tests the signing pipeline
**Cons**: Still shows "Unknown Publisher" warnings, not suitable for release builds

#### Option C: Manifest-Based Elevation (Fallback Only)
- Add `requestedExecutionLevel="requireAdministrator"` to exe manifest
- User would see UAC prompt instead of firewall dialog
- **NOT RECOMMENDED**: Requires admin escalation which changes permission model

**Cons**: Changes app permission model, may confuse users, less transparent than firewall prompt

## Implementation Plan

### Immediate (Before Next Rebuild)
1. **User Actions** (must be done manually):
   - [ ] Right-click PopQuiz.exe → Properties → Digital Signatures (verify no signature)
   - [ ] Open Windows Defender Firewall → Advanced Settings
   - [ ] Find and delete all rules containing "PopQuiz" or the exe path
   - [ ] Close all running PopQuiz instances
   - [ ] Run fresh PopQuiz.exe build and verify firewall dialog appears

2. **Verification**:
   - [ ] Firewall dialog appeared on first run after cleanup
   - [ ] Can select "Allow" in the dialog
   - [ ] App successfully binds to network port 4310
   - [ ] Local network players can connect

### Next Build Cycle (Permanent Fix)
1. **Acquire Code-Signing Certificate** (3-5 business days)
   - Recommend: DigiCert or GlobalSign EV certificate
   - Cost: $100-300/year
   - Requirement: Business verification

2. **Update `package.json`**:
   ```json
   "build": {
     "appId": "com.reeceyboin.popquiz",
     "productName": "PopQuiz",
     "win": {
       "target": [{"target": "portable", "arch": ["x64"]}],
       "icon": "build/icon.ico",
       "artifactName": "PopQuiz.exe",
       "certificateFile": "certs/popquiz-certificate.pfx",
       "certificatePassword": "${env.WIN_CSC_KEY_PASSWORD}",
       "signingHashAlgorithms": ["sha256"]
     }
   }
   ```

3. **Set Environment Variable**:
   - On local machine: `setx WIN_CSC_KEY_PASSWORD "your-password"`
   - For CI/CD: Add as secure secret in your build pipeline

4. **Test Signed Build**:
   - Rebuild exe: `npm run build:exe`
   - Right-click .exe → Properties → Digital Signatures
   - Should show certificate details
   - Run exe - firewall dialog should appear consistently

5. **Document Process**:
   - Add instructions to README for managing certificate password
   - Document certificate renewal schedule

## Files Involved
- `package.json` (lines 92-119): Build configuration - will need update in Phase 2
- `electron/main/main.js` (lines 29-73): Backend server startup - NO CHANGES NEEDED (already correct)
- `electron/main/security.js` (lines 21-36): CSP configuration - NO CHANGES NEEDED (already correct)

## Expected Outcome

**After Phase 1 (Immediate)**:
- Windows Firewall dialog reappears on fresh exe run
- User can grant network access
- Quiz hosting functionality restored

**After Phase 2 (Permanent)**:
- All future exe builds are properly code-signed
- No more firewall dialog inconsistencies
- Windows security systems recognize PopQuiz as legitimate
- Reduced risk of silent blocking by Windows Defender SmartScreen
- Professional appearance with proper publisher information

## Stability Considerations

1. **No Code Changes Required**: This is a build/signing issue, not a logic issue. The app code is working correctly.

2. **Firewall Rules Caching**: Windows caches firewall rules by exe hash/path. Each rebuild with different code creates a new hash, forcing re-evaluation.

3. **Self-Signed vs. Purchased**: Purchased certificates from trusted CAs are far more reliable because Windows trusts the CA. Self-signed certificates still trigger security warnings.

4. **Long-Term Stability**: Code signing is the only permanent, stable solution. It prevents all future firewall and SmartScreen issues.

## Success Metrics
- [ ] Firewall dialog appears consistently on first exe run
- [ ] User can successfully allow network access through firewall dialog
- [ ] Local network players can connect and communicate
- [ ] No silent blocking by Windows Defender
- [ ] Digital signature present when viewing exe properties

## Notes for Future
- Keep certificate password secure (use environment variables, not committed to repo)
- Renewal reminder: Set calendar for 30 days before certificate expiration
- Consider EV (Extended Validation) certificate for maximum user trust
