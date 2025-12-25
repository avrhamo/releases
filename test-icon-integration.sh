#!/bin/bash

echo "🧪 Testing Icon Integration..."
echo "================================="

# Check if icon source exists
if [ ! -f "icon-source.png" ]; then
    echo "❌ icon-source.png not found!"
    echo "   Please save your icon as 'icon-source.png' in the project root"
    exit 1
fi

echo "✅ icon-source.png found"

# Check if web icons were created
echo ""
echo "🌐 Checking web icons..."
for size in 32 128 192 512; do
    if [ -f "public/icon-${size}.png" ]; then
        echo "✅ icon-${size}.png found"
    else
        echo "❌ icon-${size}.png missing"
    fi
done

# Check if build icons were created
echo ""
echo "🔨 Checking build icons..."
if [ -f "build/icon.ico" ]; then
    echo "✅ Windows icon (ico) found"
else
    echo "❌ Windows icon (ico) missing"
fi

if [ -f "build/icon.icns" ]; then
    echo "✅ macOS icon (icns) found"
else
    echo "❌ macOS icon (icns) missing"
fi

if [ -f "build/icon.png" ]; then
    echo "✅ Linux icon (png) found"
else
    echo "❌ Linux icon (png) missing"
fi

# Check if PWA manifest exists
echo ""
echo "📱 Checking PWA setup..."
if [ -f "public/manifest.json" ]; then
    echo "✅ PWA manifest found"
else
    echo "❌ PWA manifest missing"
fi

# Check HTML integration
echo ""
echo "🌐 Checking HTML integration..."
if grep -q "icon-128.png" index.html; then
    echo "✅ Loading screen icon reference found"
else
    echo "❌ Loading screen icon reference missing"
fi

if grep -q "app-loading" index.html; then
    echo "✅ Loading screen HTML found"
else
    echo "❌ Loading screen HTML missing"
fi

if grep -q "manifest.json" index.html; then
    echo "✅ PWA manifest link found"
else
    echo "❌ PWA manifest link missing"
fi

# Check React integration
echo ""
echo "⚛️ Checking React integration..."
if [ -f "src/hooks/useLoadingScreen.ts" ]; then
    echo "✅ Loading screen hook found"
else
    echo "❌ Loading screen hook missing"
fi

if grep -q "useLoadingScreen" src/App.tsx; then
    echo "✅ Loading screen hook integrated in App.tsx"
else
    echo "❌ Loading screen hook not integrated in App.tsx"
fi

echo ""
echo "🎯 Integration Test Complete!"
echo "================================="

# Count successes and failures
total_checks=12
passed_checks=$(grep -c "✅" <<< "$( (
    [ -f "icon-source.png" ] && echo "✅"
    [ -f "public/icon-32.png" ] && echo "✅"
    [ -f "public/icon-128.png" ] && echo "✅"  
    [ -f "public/icon-192.png" ] && echo "✅"
    [ -f "public/icon-512.png" ] && echo "✅"
    [ -f "build/icon.ico" ] && echo "✅"
    [ -f "build/icon.icns" ] && echo "✅"
    [ -f "build/icon.png" ] && echo "✅"
    [ -f "public/manifest.json" ] && echo "✅"
    grep -q "icon-128.png" index.html && echo "✅"
    grep -q "app-loading" index.html && echo "✅"
    grep -q "useLoadingScreen" src/App.tsx && echo "✅"
) )")

echo ""
echo "📊 Results: $passed_checks/$total_checks checks passed"

if [ $passed_checks -eq $total_checks ]; then
    echo "🎉 All checks passed! Icon integration is ready!"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Run: npm run electron:dev"
    echo "   2. Look for loading screen with your icon"
    echo "   3. Check browser tab for favicon"
    echo "   4. Test building: npm run build:win"
else
    echo "⚠️  Some checks failed. Please run ./setup-icon.sh first"
fi

echo ""
echo "✨ Your hexagonal icon looks amazing! ✨" 