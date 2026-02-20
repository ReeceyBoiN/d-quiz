# Quick Start: Enable Code Signing for PopQuiz 🔐

## What You Need to Do

The code-signing infrastructure is now in place. To enable it and fix the Windows Firewall dialog issue, follow these steps:

---

## Step 1: Create a Self-Signed Certificate

Run the PowerShell script to create and set up the certificate:

**On Windows:**

1. **Open PowerShell as Administrator**
   - Press `Win + X`
   - Select "Windows PowerShell (Admin)" or "Terminal (Admin)"

2. **Navigate to the PopQuiz project folder:**
   ```powershell
   cd C:\path\to\your\popquiz\project
   ```

3. **Run the certificate creation script:**
   ```powershell
   .\CREATE_SELF_SIGNED_CERT.ps1
   ```

4. **You'll be prompted for a certificate password:**
   - Enter a password (example: `PopQuiz2025!`)
   - This password will be used during the build process
   - **IMPORTANT:** Save this password somewhere safe!

5. **Wait for completion:**
   ```
   ✅ Certificate created successfully!
   ✅ Certificate exported to: C:\Users\YourUsername\PopQuiz_Certificate.pfx
   ✅ Environment variables set
   ```

6. **⚠️ CLOSE THE POWERSHELL WINDOW**
   - You MUST close and reopen PowerShell for environment variables to take effect

---

## Step 2: Rebuild the Executable

After closing and reopening PowerShell:

```powershell
cd C:\path\to\your\popquiz\project
npm run build:exe
```

**What happens during the build:**
- Detects `WIN_CSC_KEY` environment variable (certificate path)
- Detects `WIN_CSC_KEY_PASSWORD` environment variable
- Automatically signs PopQuiz.exe with your certificate
- Embeds publisher information

**Expected output:**
```
... building ...
✅ PopQuiz.exe created and signed!
```

---

## Step 3: Verify Code Signing

1. **Navigate to the built exe:**
   - Look for `PopQuiz.exe` in the project root directory

2. **Check if it's signed:**
   - Right-click `PopQuiz.exe` → **Properties**
   - Click the **"Digital Signatures"** tab
   - You should see **"PopQuiz Development"** in the list
   - Click it and verify the certificate details

3. **Expected result:**
   - ✅ Shows "PopQuiz Development" certificate
   - ✅ Thumbprint algorithm: sha256
   - ✅ No "Unknown Publisher" errors

---

## Step 4: Test Firewall Prompts

1. **Clear old firewall rules** (important!):
   - Press `Win + R`
   - Type: `wf.msc`
   - Look for any rules with "PopQuiz" → Delete them
   - This forces Windows to re-evaluate the new signed exe

2. **Run the signed PopQuiz.exe:**
   - Double-click `PopQuiz.exe`
   - Windows should prompt: **"Allow PopQuiz to access your network?"**
   - Click **"Allow"** to enable local player connections

3. **Success indicators:**
   - ✅ Firewall dialog appeared
   - ✅ App is running
   - ✅ Local network players can connect
   - ✅ No more missing permission prompts!

---

## Troubleshooting

### "Access is denied" when running PowerShell script
- Right-click PowerShell → "Run as Administrator"
- Make sure your user account is an admin

### "Certificate password required" error during build
- Environment variables weren't picked up
- **Close ALL PowerShell windows** and reopen one
- Run: `echo $env:WIN_CSC_KEY` to verify it's set
- If empty, run the script again

### "Unknown Publisher" still appears on exe
- This is **normal for self-signed certificates** ✅
- Self-signed certs aren't trusted by Windows by default
- Firewall prompts should still appear
- For production builds, you'll need a purchased certificate from DigiCert/GlobalSign

### Exe still doesn't prompt for firewall
1. Check if exe is actually signed:
   - Right-click exe → Properties → Digital Signatures tab
2. Clear firewall rules (see Step 4 above)
3. Delete the exe and rebuild fresh: `npm run build:exe`
4. Run fresh exe

### Password was lost
- You can create a new certificate:
  ```powershell
  .\CREATE_SELF_SIGNED_CERT.ps1
  ```
- It will overwrite the old one

---

## What Happens Next?

### Option A: Continue Development with This Certificate
- You're all set! ✅
- Future builds will be signed automatically
- Windows will recognize the signed executable
- Firewall prompts will appear consistently

### Option B: Get a Production Certificate Later
When you're ready to distribute PopQuiz to users:

1. **Purchase a code-signing certificate**
   - Recommended: DigiCert or GlobalSign EV Certificate
   - Cost: $100-500/year
   - Business verification required: 3-5 days

2. **Replace the environment variables:**
   ```powershell
   [Environment]::SetEnvironmentVariable("WIN_CSC_KEY", "C:\path\to\your\purchased.pfx", "User")
   [Environment]::SetEnvironmentVariable("WIN_CSC_KEY_PASSWORD", "your-new-password", "User")
   ```

3. **Rebuild:**
   ```powershell
   npm run build:exe
   ```

4. **Your exe will now show a trusted publisher** ✅

---

## Summary

**What we did:**
1. ✅ Added code-signing configuration to package.json
2. ✅ Created a self-signed certificate
3. ✅ Set up environment variables for automatic signing
4. ✅ Ready for signed builds

**What you do:**
1. Run `CREATE_SELF_SIGNED_CERT.ps1`
2. Restart PowerShell
3. Run `npm run build:exe`
4. Test the exe - firewall prompts should now appear!

**The Result:**
- ✅ Windows Firewall prompts appear consistently
- ✅ No more silent blocking by Windows security
- ✅ Professional, signed executable
- ✅ Stable network connectivity for players

---

## Need Help?

See **CODE_SIGNING_SETUP.md** for:
- Detailed technical explanation
- More troubleshooting options
- Information about purchased certificates
- CI/CD pipeline integration

---

**Ready? Let's go!** 🚀

```powershell
# 1. Run the script (Administrator)
.\CREATE_SELF_SIGNED_CERT.ps1

# 2. Close and reopen PowerShell

# 3. Build the exe
npm run build:exe

# 4. Run it and check properties - Done! ✅
```
