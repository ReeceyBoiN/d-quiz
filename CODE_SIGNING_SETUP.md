# PopQuiz Windows Code Signing Setup

## Why Code Signing Matters

PopQuiz.exe builds are now configured for code signing to ensure:
- ✅ Windows Firewall prompts appear consistently
- ✅ No silent blocking by Windows Defender SmartScreen
- ✅ Professional "publisher" information displayed
- ✅ User trust and credibility

## Current Status

The `package.json` build configuration now includes code-signing support. However, **a code-signing certificate is required** to use it.

## How to Enable Code Signing

### Step 1: Acquire a Code-Signing Certificate

**Recommended Option: EV (Extended Validation) Certificate**
- Purchase from: DigiCert, GlobalSign, Sectigo, or similar
- Cost: $100-500/year
- Setup time: 3-5 business days (includes business verification)
- Best for: Professional builds with maximum user trust

**Alternative Option: Self-Signed Certificate** (for testing only)
- Free
- Setup time: Minutes
- Good for: Local testing and development
- Not suitable for: Distribution to end users (shows "Unknown Publisher")

### Step 2: Prepare the Certificate

Certificates typically come as `.cer` or `.pfx` files. Electron-builder requires `.pfx` format.

**If you have a `.cer` file:**
```bash
# On Windows, you may need to convert it
# Contact your certificate provider for the .pfx version
# or use OpenSSL: openssl pkcs12 -export -in cert.cer -inkey key.pem -out cert.pfx
```

**If you have a `.pfx` file:**
- You're ready to proceed

### Step 3: Store Certificate Path

Place the certificate file in a secure location (outside the git repository):

```
C:\Certs\popquiz-certificate.pfx  (or your preferred location)
```

**IMPORTANT: Never commit certificates to git!**

### Step 4: Set Environment Variables

On your build machine, set these environment variables:

**Using PowerShell:**
```powershell
$env:WIN_CSC_KEY = "C:\Certs\popquiz-certificate.pfx"
$env:WIN_CSC_KEY_PASSWORD = "your-certificate-password"

# Verify they're set:
echo $env:WIN_CSC_KEY
echo $env:WIN_CSC_KEY_PASSWORD
```

**Permanently (Windows Settings):**
1. Press `Win + X` → Environment Variables
2. Click "Environment variables"
3. Click "New" under User variables:
   - Variable name: `WIN_CSC_KEY`
   - Variable value: `C:\Certs\popquiz-certificate.pfx`
4. Click "New" again:
   - Variable name: `WIN_CSC_KEY_PASSWORD`
   - Variable value: `your-certificate-password`
5. Click OK and restart your terminal

### Step 5: Rebuild the Executable

```bash
npm run build:exe
```

The build will now:
1. Detect the environment variables
2. Sign the PopQuiz.exe with your certificate
3. Embed the publisher information

### Step 6: Verify Code Signing

**Check if the exe is signed:**
1. Right-click `PopQuiz.exe` → Properties
2. Click the "Digital Signatures" tab
3. You should see your certificate details

**Expected result:**
- "Thumbprint algorithm:" shows sha256
- Certificate name is displayed
- No "Unknown Publisher" warnings

## Troubleshooting

### Build fails with "Certificate not found"
- Verify `WIN_CSC_KEY` points to correct .pfx file path
- Check that the path exists and is accessible
- Try using full absolute path

### Build fails with "Invalid password"
- Verify `WIN_CSC_KEY_PASSWORD` is correct
- Some special characters in passwords may need escaping
- Try wrapping password in quotes in PowerShell

### Exe still shows "Unknown Publisher"
- If using self-signed certificate: This is expected behavior. End users would need to install your certificate.
- If using purchased certificate: Rebuild and check Digital Signatures tab
- If still unsigned: Environment variables may not be set correctly, restart terminal and rebuild

### Windows Firewall still not prompting
- Clear all existing PopQuiz firewall rules from Windows Defender Firewall Advanced Settings
- Delete any previously built PopQuiz.exe files
- Run the newly signed exe fresh
- Windows should re-evaluate and prompt for permissions

## For CI/CD Pipelines (GitHub Actions, etc.)

Store certificate password as a GitHub secret:

```yaml
env:
  WIN_CSC_KEY: ${{ secrets.WIN_CSC_KEY_PATH }}
  WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
```

## Certificate Renewal Reminder

- Set a calendar reminder for 30 days before certificate expiration
- Renew the certificate before it expires
- Update the environment variable path if needed
- Rebuild all future releases with the new certificate

## Documentation References

- [Electron-Builder Windows Signing](https://www.electron.build/code-signing)
- [DigiCert Code Signing](https://www.digicert.com/code-signing)
- [GlobalSign Code Signing](https://www.globalsign.com/en/code-signing)

## Support

If you encounter issues:
1. Verify environment variables are set: `echo $env:WIN_CSC_KEY`
2. Check certificate file exists and is readable
3. Ensure certificate password is correct
4. Try rebuilding: `npm run build:exe`
5. Check electron-builder logs for specific errors

## Next Steps

1. **Acquire a code-signing certificate** (if you don't have one)
2. **Convert to .pfx format** if needed
3. **Set the environment variables** (WIN_CSC_KEY and WIN_CSC_KEY_PASSWORD)
4. **Rebuild the exe**: `npm run build:exe`
5. **Verify signing**: Check Digital Signatures in exe properties
6. **Test**: Run fresh exe and verify Windows Firewall prompts
