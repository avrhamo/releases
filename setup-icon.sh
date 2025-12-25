#!/bin/bash

# 🎨 API Workspace Icon Setup Script
# This script helps you quickly set up icons for your Electron app

echo "🎨 API Workspace Icon Setup"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from your project root."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Environment check passed!"
echo ""

# Create build directory if it doesn't exist
if [ ! -d "build" ]; then
    echo "📁 Creating build directory..."
    mkdir build
fi

# Check if icon-source.png exists
if [ ! -f "icon-source.png" ]; then
    echo "🔍 Looking for icon source file..."
    
    # Check common locations
    if [ -f "build/icon-source.png" ]; then
        echo "✅ Found icon-source.png in build directory"
        cp build/icon-source.png ./icon-source.png
    elif [ -f "assets/icon.png" ]; then
        echo "✅ Found icon.png in assets directory"
        cp assets/icon.png ./icon-source.png
    elif [ -f "src/assets/icon.png" ]; then
        echo "✅ Found icon.png in src/assets directory"
        cp src/assets/icon.png ./icon-source.png
    else
        echo "❌ No icon source file found!"
        echo ""
        echo "Please create an icon first using one of these methods:"
        echo "1. 🤖 AI Generator: Open 'create-simple-icon.html' in your browser"
        echo "2. 🎨 Online Tool: Visit https://www.bing.com/images/create"
        echo "3. 📚 Icon Library: Search https://www.flaticon.com for 'API developer'"
        echo "4. 🛠️ DIY: Use Canva or Figma to create a 1024x1024 icon"
        echo ""
        echo "Save your icon as 'icon-source.png' (1024x1024 pixels) in the project root and run this script again."
        echo ""
        
        # Open the icon creator if on macOS
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "🚀 Opening icon creator in your browser..."
            open create-simple-icon.html
        else
            echo "💡 To use the built-in icon creator, open 'create-simple-icon.html' in your browser"
        fi
        
        exit 1
    fi
fi

echo "✅ Icon source file found: icon-source.png"
echo ""

# Check if electron-icon-builder is installed
if ! command -v electron-icon-builder &> /dev/null; then
    echo "📦 Installing electron-icon-builder globally..."
    npm install -g electron-icon-builder
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install electron-icon-builder. Trying local installation..."
        npm install electron-icon-builder --save-dev
        
        if [ $? -ne 0 ]; then
            echo "❌ Failed to install electron-icon-builder. Please install it manually:"
            echo "npm install -g electron-icon-builder"
            exit 1
        else
            echo "✅ electron-icon-builder installed locally"
            ICON_BUILDER="npx electron-icon-builder"
        fi
    else
        echo "✅ electron-icon-builder installed globally"
        ICON_BUILDER="electron-icon-builder"
    fi
else
    echo "✅ electron-icon-builder already installed"
    ICON_BUILDER="electron-icon-builder"
fi

echo ""
echo "🔧 Generating icons for all platforms..."
echo "This may take a moment..."
echo ""

# Generate all icon formats
$ICON_BUILDER --input=icon-source.png --output=build --flatten

# Generate web-friendly versions for HTML
echo "🌐 Creating web-friendly icon versions..."
if command -v convert &> /dev/null; then
    # Use ImageMagick if available
    convert icon-source.png -resize 32x32 public/icon-32.png
    convert icon-source.png -resize 128x128 public/icon-128.png
    convert icon-source.png -resize 192x192 public/icon-192.png
    convert icon-source.png -resize 512x512 public/icon-512.png
    convert icon-source.png -resize 16x16 public/favicon.ico
elif command -v sips &> /dev/null; then
    # Use sips on macOS
    sips -z 32 32 icon-source.png --out public/icon-32.png
    sips -z 128 128 icon-source.png --out public/icon-128.png
    sips -z 192 192 icon-source.png --out public/icon-192.png
    sips -z 512 512 icon-source.png --out public/icon-512.png
    sips -z 16 16 icon-source.png --out public/favicon.ico
else
    echo "⚠️ ImageMagick or sips not found. Web icons will be created manually."
    echo "Please install ImageMagick: brew install imagemagick"
    # Copy the main icon as fallbacks
    cp icon-source.png public/icon-128.png
    cp icon-source.png public/icon-192.png
    cp icon-source.png public/icon-512.png
fi

if [ $? -eq 0 ]; then
    echo "✅ Icons generated successfully!"
    echo ""
    echo "📁 Generated files:"
    ls -la build/ | grep -E '\.(ico|icns|png)$'
    echo ""
    
    # Test if we can build the app
    echo "🧪 Testing build process..."
    
    # Try to build for current platform
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "🍎 Building for macOS..."
        npm run build:mac
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "🐧 Building for Linux..."
        npm run build:linux
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]]; then
        echo "🪟 Building for Windows..."
        npm run build:win
    else
        echo "Building for all platforms..."
        npm run build:all
    fi
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 SUCCESS! Your app has been built with the new icon!"
        echo ""
        echo "📦 Build files are in the 'dist-electron' directory"
        echo "🚀 Your app is ready for distribution!"
        echo ""
        echo "Next steps:"
        echo "1. Test your built application"
        echo "2. Check the icon appears correctly"
        echo "3. Create a release: git tag v1.0.0 && git push origin v1.0.0"
        echo "4. Your GitHub Actions will automatically create a release"
        echo ""
    else
        echo "⚠️ Icons generated but build failed. Check the error messages above."
        echo "Your icons are ready in the 'build' directory."
    fi
else
    echo "❌ Failed to generate icons. Please check:"
    echo "1. icon-source.png is a valid PNG file"
    echo "2. The file is at least 256x256 pixels"
    echo "3. You have write permissions to the build directory"
    echo ""
    echo "Manual generation command:"
    echo "$ICON_BUILDER --input=icon-source.png --output=build --flatten"
fi

echo ""
echo "🎯 Icon Setup Complete!"
echo "================================" 