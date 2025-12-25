# 🎨 API Workspace Icon Setup Script (PowerShell)
# This script helps you quickly set up icons for your Electron app

Write-Host "🎨 API Workspace Icon Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Please run this script from your project root." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Node.js is not installed. Please install Node.js first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "✅ npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: npm is not installed. Please install npm first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Create build directory if it doesn't exist
if (-not (Test-Path "build")) {
    Write-Host "📁 Creating build directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "build" | Out-Null
}

# Check if icon-source.png exists
if (-not (Test-Path "icon-source.png")) {
    Write-Host "🔍 Looking for icon source file..." -ForegroundColor Yellow
    
    # Check common locations
    if (Test-Path "build\icon-source.png") {
        Write-Host "✅ Found icon-source.png in build directory" -ForegroundColor Green
        Copy-Item "build\icon-source.png" "icon-source.png"
    } elseif (Test-Path "assets\icon.png") {
        Write-Host "✅ Found icon.png in assets directory" -ForegroundColor Green
        Copy-Item "assets\icon.png" "icon-source.png"
    } elseif (Test-Path "src\assets\icon.png") {
        Write-Host "✅ Found icon.png in src/assets directory" -ForegroundColor Green
        Copy-Item "src\assets\icon.png" "icon-source.png"
    } else {
        Write-Host "❌ No icon source file found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please create an icon first using one of these methods:" -ForegroundColor Yellow
        Write-Host "1. 🤖 AI Generator: Open 'create-simple-icon.html' in your browser"
        Write-Host "2. 🎨 Online Tool: Visit https://www.bing.com/images/create"
        Write-Host "3. 📚 Icon Library: Search https://www.flaticon.com for 'API developer'"
        Write-Host "4. 🛠️ DIY: Use Canva or Figma to create a 1024x1024 icon"
        Write-Host ""
        Write-Host "Save your icon as 'icon-source.png' (1024x1024 pixels) in the project root and run this script again."
        Write-Host ""
        Write-Host "🚀 Opening icon creator in your browser..." -ForegroundColor Cyan
        Start-Process "create-simple-icon.html"
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "✅ Icon source file found: icon-source.png" -ForegroundColor Green
Write-Host ""

# Check if electron-icon-builder is installed
try {
    $builderVersion = electron-icon-builder --version
    Write-Host "✅ electron-icon-builder already installed" -ForegroundColor Green
    $iconBuilder = "electron-icon-builder"
} catch {
    Write-Host "📦 Installing electron-icon-builder globally..." -ForegroundColor Yellow
    try {
        npm install -g electron-icon-builder
        Write-Host "✅ electron-icon-builder installed globally" -ForegroundColor Green
        $iconBuilder = "electron-icon-builder"
    } catch {
        Write-Host "❌ Failed to install electron-icon-builder globally. Trying local installation..." -ForegroundColor Red
        try {
            npm install electron-icon-builder --save-dev
            Write-Host "✅ electron-icon-builder installed locally" -ForegroundColor Green
            $iconBuilder = "npx electron-icon-builder"
        } catch {
            Write-Host "❌ Failed to install electron-icon-builder. Please install it manually:" -ForegroundColor Red
            Write-Host "npm install -g electron-icon-builder"
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
}

Write-Host ""
Write-Host "🔧 Generating icons for all platforms..." -ForegroundColor Cyan
Write-Host "This may take a moment..." -ForegroundColor Yellow
Write-Host ""

# Generate all icon formats
try {
    Invoke-Expression "$iconBuilder --input=icon-source.png --output=build --flatten"
    
    Write-Host "✅ Icons generated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📁 Generated files:" -ForegroundColor Cyan
    Get-ChildItem -Path "build" -Filter "*.ico" | ForEach-Object { Write-Host "  - $($_.Name)" }
    Get-ChildItem -Path "build" -Filter "*.icns" | ForEach-Object { Write-Host "  - $($_.Name)" }
    Get-ChildItem -Path "build" -Filter "*.png" | ForEach-Object { Write-Host "  - $($_.Name)" }
    Write-Host ""
    
    # Test if we can build the app
    Write-Host "🧪 Testing build process..." -ForegroundColor Cyan
    Write-Host "🪟 Building for Windows..." -ForegroundColor Yellow
    
    try {
        npm run build:win
        Write-Host ""
        Write-Host "🎉 SUCCESS! Your app has been built with the new icon!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📦 Build files are in the 'dist-electron' directory" -ForegroundColor Cyan
        Write-Host "🚀 Your app is ready for distribution!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Test your built application"
        Write-Host "2. Check the icon appears correctly"
        Write-Host "3. Create a release: git tag v1.0.0 && git push origin v1.0.0"
        Write-Host "4. Your GitHub Actions will automatically create a release"
        Write-Host ""
    } catch {
        Write-Host "⚠️ Icons generated but build failed. Check the error messages above." -ForegroundColor Yellow
        Write-Host "Your icons are ready in the 'build' directory." -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Failed to generate icons. Please check:" -ForegroundColor Red
    Write-Host "1. icon-source.png is a valid PNG file"
    Write-Host "2. The file is at least 256x256 pixels"
    Write-Host "3. You have write permissions to the build directory"
    Write-Host ""
    Write-Host "Manual generation command:" -ForegroundColor Yellow
    Write-Host "$iconBuilder --input=icon-source.png --output=build --flatten"
}

Write-Host ""
Write-Host "🎯 Icon Setup Complete!" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Read-Host "Press Enter to exit" 