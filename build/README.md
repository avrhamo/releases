# Build Assets Guide

This directory contains all the assets needed for building and distributing the API Workspace application.

## 📦 Required Icons

### Windows
- **icon.ico** - 256x256 pixels, ICO format
  - Contains multiple sizes: 16x16, 32x32, 48x48, 64x64, 128x128, 256x256
  - Used for application icon, taskbar, and installer

### macOS
- **icon.icns** - 512x512 pixels, ICNS format
  - Contains multiple sizes: 16x16, 32x32, 64x64, 128x128, 256x256, 512x512
  - Used for application icon, dock, and DMG

### Linux
- **icon.png** - 512x512 pixels, PNG format
  - High-quality PNG for AppImage, desktop entries, and package managers

## 🏪 Store Assets

### Microsoft Store
- **StoreLogo.png** - 50x50 pixels
- **Square150x150Logo.png** - 150x150 pixels
- **Square44x44Logo.png** - 44x44 pixels
- **Wide310x150Logo.png** - 310x150 pixels
- **LargeTile.png** - 310x310 pixels
- **SplashScreen.png** - 620x300 pixels

### Mac App Store
- **AppIcon.icns** - Same as icon.icns but with all required sizes
- **Screenshots** - Various sizes for store listing

## 📁 Additional Assets

### Installer
- **installer.nsh** - Custom NSIS installer script
- **license.txt** - End User License Agreement
- **banner.bmp** - Installer banner (164x314 pixels)
- **sidebar.bmp** - Installer sidebar (164x314 pixels)

### Notarization (macOS)
- **entitlements.mac.plist** - macOS entitlements file
- **notarize.js** - Notarization script

## 🎨 Design Guidelines

### Color Scheme
- Primary: #4F46E5 (Indigo)
- Secondary: #10B981 (Emerald)
- Accent: #F59E0B (Amber)
- Background: #1F2937 (Dark Gray)

### Icon Design
- Use modern, flat design principles
- Ensure visibility on both light and dark backgrounds
- Include the API Workspace logo/branding
- Test at different sizes to ensure clarity

## 🔧 Creating Icons

### Using Online Tools
1. **Icon Generator** - https://www.electron.build/icons
2. **ICO Converter** - https://convertio.co/png-ico/
3. **ICNS Converter** - https://iconverticons.com/online/

### Using Command Line
```bash
# Install electron-icon-builder
npm install -g electron-icon-builder

# Generate all icons from a 1024x1024 PNG
electron-icon-builder --input=icon-source.png --output=build --flatten
```

## 📱 Mobile App Icons (Future)
If you plan to create mobile versions:
- **iOS**: Various sizes from 20x20 to 1024x1024
- **Android**: Various sizes from 36x36 to 512x512

## 🔍 Testing Icons
- Test on different screen densities
- Check visibility in light/dark modes
- Verify alignment and spacing
- Test in actual OS environments

## 📋 Checklist
- [ ] Create icon.ico (Windows)
- [ ] Create icon.icns (macOS)
- [ ] Create icon.png (Linux)
- [ ] Create Microsoft Store assets
- [ ] Create installer assets
- [ ] Test all icons on target platforms
- [ ] Update electron-builder.json with correct paths

## 🎯 Quick Start
1. Create a high-quality 1024x1024 PNG source image
2. Use electron-icon-builder to generate all required formats
3. Place generated files in this directory
4. Update paths in electron-builder.json
5. Test builds on all target platforms

---

*Note: All icon files should be optimized for size while maintaining quality. Consider using PNG optimization tools like TinyPNG or ImageOptim.* 