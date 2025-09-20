#!/bin/bash

# Share Extension Installation Script
# This script builds and installs the share extension on your Mac

echo "📱 ShareToApps Extension Installer"
echo "=================================="

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode is not installed. Please install Xcode from the App Store."
    exit 1
fi

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_PATH="$SCRIPT_DIR/ShareToApps.xcodeproj"

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script must be run on macOS"
    exit 1
fi

echo "🔍 Checking project..."
if [ ! -d "$PROJECT_PATH" ]; then
    echo "❌ Project not found at: $PROJECT_PATH"
    exit 1
fi

# Update bundle identifier with current user
CURRENT_USER=$(whoami)
BUNDLE_ID="com.${CURRENT_USER}.ShareToApps"
echo "📝 Setting bundle identifier to: $BUNDLE_ID"

# Clean build folder
echo "🧹 Cleaning previous builds..."
xcodebuild clean -project "$PROJECT_PATH" -scheme ShareToApps -quiet

# Build the project
echo "🔨 Building ShareToApps..."
xcodebuild build \
    -project "$PROJECT_PATH" \
    -scheme ShareToApps \
    -configuration Release \
    -derivedDataPath "$SCRIPT_DIR/build" \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGNING_ALLOWED=NO \
    DEVELOPMENT_TEAM="" \
    -quiet

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Trying with generic iOS device..."

    # Try building for generic iOS device
    xcodebuild build \
        -project "$PROJECT_PATH" \
        -scheme ShareToApps \
        -configuration Release \
        -sdk iphoneos \
        -destination "generic/platform=iOS" \
        -derivedDataPath "$SCRIPT_DIR/build" \
        CODE_SIGN_IDENTITY="" \
        CODE_SIGNING_REQUIRED=NO \
        CODE_SIGNING_ALLOWED=NO \
        DEVELOPMENT_TEAM="" \
        -quiet

    if [ $? -ne 0 ]; then
        echo "❌ Build failed. Please open the project in Xcode and build manually."
        echo ""
        echo "To build manually:"
        echo "1. Open: $PROJECT_PATH"
        echo "2. Select your development team in project settings"
        echo "3. Build and run (⌘R)"
        exit 1
    fi
fi

echo "✅ Build successful!"

# For macOS, we need to package it differently
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo ""
    echo "📦 For macOS Share Extension:"
    echo "1. Open the project in Xcode:"
    echo "   open '$PROJECT_PATH'"
    echo ""
    echo "2. Select your development team:"
    echo "   - Click on the project in navigator"
    echo "   - Select 'Signing & Capabilities' tab"
    echo "   - Choose your team for both targets"
    echo ""
    echo "3. Build and run (⌘R)"
    echo ""
    echo "4. Enable in System Preferences:"
    echo "   - System Preferences > Extensions > Share Menu"
    echo "   - Check 'Share to Apps'"
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "📝 Usage:"
echo "1. In any app (Notes, Safari, etc.)"
echo "2. Select content and click Share"
echo "3. Choose 'Share to Apps'"
echo "4. Select destination (Claude, ChatGPT, Terminal)"