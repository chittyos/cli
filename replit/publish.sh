#!/bin/bash

# ChittyApps Replit CLI Publishing Script

echo "🚀 ChittyApps Replit CLI Publishing Script"
echo "=========================================="
echo ""

# Check if logged into npm
echo "Checking npm authentication..."
npm whoami &> /dev/null
if [ $? -ne 0 ]; then
    echo "❌ Not logged into npm. Please run: npm login"
    exit 1
fi

echo "✅ Logged into npm as: $(npm whoami)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run tests if they exist
if [ -f "test.js" ] || [ -d "test" ] || [ -d "__tests__" ]; then
    echo "🧪 Running tests..."
    npm test
    if [ $? -ne 0 ]; then
        echo "❌ Tests failed. Please fix before publishing."
        exit 1
    fi
fi

# Show current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo ""
echo "📌 Current version: $CURRENT_VERSION"
echo ""

# Ask for version bump
echo "How would you like to bump the version?"
echo "1) Patch (bug fixes) - $(npm version patch --dry-run 2>/dev/null | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')"
echo "2) Minor (new features) - $(npm version minor --dry-run 2>/dev/null | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')"
echo "3) Major (breaking changes) - $(npm version major --dry-run 2>/dev/null | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')"
echo "4) Skip version bump"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
    1) npm version patch ;;
    2) npm version minor ;;
    3) npm version major ;;
    4) echo "Skipping version bump" ;;
    *) echo "Invalid choice"; exit 1 ;;
esac

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo ""
echo "📦 Publishing version: $NEW_VERSION"
echo ""

# Confirm before publishing
read -p "Ready to publish @chittyapps/replit-cli@$NEW_VERSION to npm? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Publishing cancelled"
    exit 1
fi

# Publish to npm
echo ""
echo "🚀 Publishing to npm..."
npm publish --access public

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully published @chittyapps/replit-cli@$NEW_VERSION"
    echo ""
    echo "📝 Next steps:"
    echo "  1. Create a GitHub release with tag v$NEW_VERSION"
    echo "  2. Push changes to GitHub: git push && git push --tags"
    echo "  3. Update documentation if needed"
    echo ""
    echo "🎉 Package available at: https://www.npmjs.com/package/@chittyapps/replit-cli"
else
    echo "❌ Publishing failed"
    exit 1
fi