# Windows Code Signing Setup Guide

## 🪟 Windows Code Signing from macOS

Yes! You can sign Windows executables from your macOS machine using electron-builder. Here's how:

## 1. Get a Windows Code Signing Certificate

### Option A: Standard Code Signing Certificate
- **Sectigo (Comodo)**: ~$75/year
- **DigiCert**: ~$200/year  
- **GlobalSign**: ~$150/year

### Option B: Extended Validation (EV) Certificate (Recommended)
- **Better trust**: No "Unknown Publisher" warnings
- **Immediate trust**: No reputation building required
- **Higher cost**: ~$300-500/year
- **Hardware requirement**: USB token or HSM

## 2. Certificate Formats
You'll receive one of these formats:
- `.p12` or `.pfx` file (most common)
- `.crt` + `.key` files (convert to .p12)

## 3. Environment Variables Setup

Create a `.env.local` file in your project root:

```bash
# Windows Code Signing
WIN_CSC_LINK=base64-encoded-certificate-here
WIN_CSC_KEY_PASSWORD=your-certificate-password

# Alternative: Use file path instead of base64
# WIN_CERTIFICATE_FILE=build/windows-certificate.p12
```

### Converting Certificate to Base64 (macOS):
```bash
# Convert .p12 to base64
base64 -i path/to/your-certificate.p12 | pbcopy

# This copies the base64 string to clipboard
# Paste it as WIN_CSC_LINK value
```

## 4. Build Commands

```bash
# Build Windows with signing (production)
NODE_ENV=production npm run build:win

# Build without signing (development)
npm run build:win

# Build all platforms
npm run build:all
```

## 5. Testing Your Setup

1. **Test build without certificate first:**
   ```bash
   npm run build:win
   ```

2. **Add certificate and test signing:**
   ```bash
   NODE_ENV=production npm run build:win
   ```

3. **Verify signature:**
   - Right-click the .exe file
   - Go to Properties → Digital Signatures
   - Should show your certificate details

## 6. Common Issues & Solutions

### Issue: "signtool not found"
**Solution**: electron-builder includes its own signing tools, but you can also install Windows SDK

### Issue: "Certificate not found"
**Solutions**:
- Check WIN_CSC_LINK is correctly base64 encoded
- Verify WIN_CSC_KEY_PASSWORD is correct
- Ensure .env.local file is in project root

### Issue: "Timestamp server unreachable"
**Solution**: Try different timestamp servers in electron-builder.json:
```json
"timestampServer": "http://timestamp.sectigo.com"
// or
"timestampServer": "http://timestamp.digicert.com"
```

## 7. Certificate Providers Comparison

| Provider | Standard | EV | Trust Level | Hardware Token |
|----------|----------|----| ------------|----------------|
| Sectigo | $75/yr | $400/yr | Good | Required for EV |
| DigiCert | $200/yr | $500/yr | Excellent | Required for EV |
| GlobalSign | $150/yr | $450/yr | Good | Required for EV |

## 8. Best Practices

1. **Use EV certificates** for production apps
2. **Test on multiple Windows versions** (10, 11)
3. **Monitor certificate expiration**
4. **Keep certificate passwords secure**
5. **Use CI/CD for automated signing**

## 9. Troubleshooting Commands

```bash
# Check electron-builder configuration
npx electron-builder --help

# Verbose build with signing details
DEBUG=electron-builder npm run build:win

# Test certificate validity (Windows only)
# signtool verify /v /pa "path/to/signed.exe"
```

## 10. Microsoft Store Preparation

If planning Microsoft Store submission:

```json
{
  "win": {
    "target": [
      {
        "target": "appx",
        "arch": ["x64", "arm64"]
      }
    ]
  }
}
```

The APPX packages for Microsoft Store don't need code signing (Microsoft handles it).

## 11. Next Steps

1. **Purchase certificate** from a trusted CA
2. **Download certificate** (.p12/.pfx format)
3. **Create `.env.local`** with certificate details
4. **Test build** with `npm run build:win`
5. **Verify signature** on Windows machine

## 🔐 Security Notes

- Never commit certificate files or passwords to git
- Use `.env.local` (already in .gitignore)
- Consider using CI/CD secrets for production builds
- Rotate certificates before expiration

---

**Need help?** The Windows code signing is now configured! Just get your certificate and add the environment variables. 