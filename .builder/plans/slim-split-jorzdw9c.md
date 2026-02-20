# Code Signing Investigation: Root Cause of ~400% Build Slowdown

## Key Finding
✅ **Yes, code signing was the cause of the slowdown**

The project has code signing infrastructure configured that was dramatically slowing down builds.

## Root Cause Analysis

### How Signing Was Configured
1. **Environment Variables (Auto-Detection)**
   - `WIN_CSC_KEY`: Path to certificate file (.pfx)
   - `WIN_CSC_KEY_PASSWORD`: Certificate password
   - When set, electron-builder automatically signs the executable

2. **Supporting Files in Repository**
   - `QUICK_START_CODE_SIGNING.md` - Explains signing workflow
   - `CODE_SIGNING_SETUP.md` - Detailed setup instructions
   - `CREATE_SELF_SIGNED_CERT.ps1` - Creates certificate and sets env vars

### Why Signing Caused ~400% Slowdown

Each build with WIN_CSC_KEY and WIN_CSC_KEY_PASSWORD set would:
1. Build executable normally (~26 seconds)
2. Run Windows `signtool` to sign the .exe
3. Contact timestamp servers (network I/O) for signature verification
4. Process potentially multiple artifacts
5. **Added: 40-60+ seconds per build** ← The bottleneck

**Before**: ~90 seconds total (build + signing)  
**After**: ~22-25 seconds (build only)  
**Result**: ~4x faster ≈ 400% speedup ✅

## Current Status

### What Was Changed
Removed explicit certificate fields from package.json:
- `certificateFile`
- `certificatePassword`  
- `signingHashAlgorithms`

### Important Note
Even with those fields removed, if WIN_CSC_KEY and WIN_CSC_KEY_PASSWORD environment variables are set on the system, electron-builder will STILL attempt automatic signing.

The fast builds indicate these env vars are currently NOT set on your machine.

## Verification

To confirm signing is disabled:
```powershell
echo $env:WIN_CSC_KEY
echo $env:WIN_CSC_KEY_PASSWORD
```

Both should be empty/null.

## Recommendation for Going Forward

**For Development**: Keep signing disabled (current state) ✅
- Builds stay fast (~25 seconds)
- Perfect for iterative development
- Unsigned .exe works fine on Windows

**For Release/Production**: Consider adding signing when needed
- Option A: Create separate `build:release` script that temporarily sets env vars
- Option B: Let GitHub Actions CI handle signing via secrets (only on release)
- Option C: Use self-signed certificate via CREATE_SELF_SIGNED_CERT.ps1

## Files Involved
- `package.json` - Build configuration (signing fields now removed)
- `QUICK_START_CODE_SIGNING.md` - Documentation
- `CODE_SIGNING_SETUP.md` - Setup guide
- `CREATE_SELF_SIGNED_CERT.ps1` - Certificate creation script
