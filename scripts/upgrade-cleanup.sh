#!/bin/bash

# Upgrade cleanup script for Buzo AI app
# This script helps clean up the project after upgrading to Expo SDK 52

echo "🧹 Starting Buzo AI upgrade cleanup..."

# Remove node_modules and yarn.lock/package-lock.json
echo "📦 Removing node_modules and lock files..."
rm -rf node_modules
rm -f yarn.lock
rm -f package-lock.json

# Clear metro and expo caches
echo "🗑️  Clearing caches..."
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-map-*
rm -rf .expo

# Reinstall dependencies
echo "📥 Reinstalling dependencies..."
npm install

# Run expo doctor to fix any issues
echo "🩺 Running expo doctor..."
npx expo install --fix

# Check for TypeScript errors
echo "🔍 Checking for TypeScript errors..."
npx tsc --noEmit

echo "✅ Cleanup complete! You can now run 'npx expo start --clear' to start the app."
echo "📝 See UPGRADE.md for more information about the upgrade process." 