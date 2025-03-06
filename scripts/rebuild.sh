#!/bin/bash

echo "Step 1: Cleaning up build artifacts"
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData/*

echo "Step 2: Reinstalling pods"
cd ios
rm -rf Pods
pod install

echo "Step 3: Applying fixes"
cd ..
./final_fix.sh

echo "Step 4: Starting the build"
cd ios
xcodebuild -workspace BuzoAI.xcworkspace -scheme BuzoAI -configuration Debug -sdk iphonesimulator 