# PopQuiz Self-Signed Code-Signing Certificate Generator
# Run this script in PowerShell as Administrator

$ErrorActionPreference = "Stop"

Write-Host "=== PopQuiz Self-Signed Certificate Generator ===" -ForegroundColor Cyan
Write-Host ""

# Certificate details
$CertName = "PopQuiz Development"
$CertPassword = Read-Host "Enter a password for the certificate (this will be used for signing)"
$CertPasswordSecure = ConvertTo-SecureString -String $CertPassword -Force -AsPlainText

$CertPath = "$env:USERPROFILE\PopQuiz_Certificate.pfx"

Write-Host ""
Write-Host "Creating self-signed certificate..." -ForegroundColor Yellow

# Create self-signed certificate in the user's certificate store
$Cert = New-SelfSignedCertificate `
    -Subject "CN=$CertName" `
    -Type CodeSigningCert `
    -KeyUsage DigitalSignature `
    -FriendlyName "PopQuiz Code Signing" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(10)

Write-Host "✅ Certificate created successfully!" -ForegroundColor Green
Write-Host "   Subject: $($Cert.Subject)"
Write-Host "   Thumbprint: $($Cert.Thumbprint)"
Write-Host ""

Write-Host "Exporting certificate to .pfx file..." -ForegroundColor Yellow

# Export to PFX file
Export-PfxCertificate `
    -Cert "Cert:\CurrentUser\My\$($Cert.Thumbprint)" `
    -FilePath $CertPath `
    -Password $CertPasswordSecure | Out-Null

Write-Host "✅ Certificate exported to: $CertPath" -ForegroundColor Green
Write-Host ""

# Set environment variables
Write-Host "Setting environment variables..." -ForegroundColor Yellow

[Environment]::SetEnvironmentVariable("WIN_CSC_KEY", $CertPath, "User")
[Environment]::SetEnvironmentVariable("WIN_CSC_KEY_PASSWORD", $CertPassword, "User")

Write-Host "✅ Environment variables set:" -ForegroundColor Green
Write-Host "   WIN_CSC_KEY=$CertPath"
Write-Host "   WIN_CSC_KEY_PASSWORD=(set)"
Write-Host ""

Write-Host "=== SETUP COMPLETE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  IMPORTANT: Please restart your terminal/PowerShell for the environment variables to take effect!"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Close this PowerShell window"
Write-Host "2. Open a new PowerShell/Command Prompt window"
Write-Host "3. Run: npm run build:exe"
Write-Host "4. The exe will now be code-signed!"
Write-Host ""
Write-Host "To verify the certificate:"
Write-Host "- Right-click PopQuiz.exe → Properties"
Write-Host "- Click 'Digital Signatures' tab"
Write-Host "- You should see the 'PopQuiz Development' certificate"
Write-Host ""
Write-Host "Note: This is a self-signed certificate (development only)"
Write-Host "For production, purchase a proper code-signing certificate from DigiCert or GlobalSign"
Write-Host ""
