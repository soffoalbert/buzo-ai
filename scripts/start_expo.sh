#!/bin/bash

echo "==== Starting Expo Development Environment ===="
echo ""

# Try to set local network permissions for Expo Go
echo "Setting local network permissions for Expo Go..."
xcrun simctl spawn booted defaults write com.expo.ios.client allowsLocalNetworking -bool YES

# Display manual instructions as well
echo ""
echo "If you still see permission issues in the Expo Go app, please do the following:"
echo "1. On the simulator, click 'OK' to dismiss the dialog"
echo "2. Go to the home screen (swipe up or press Command+Shift+H)"
echo "3. Open Settings app"
echo "4. Find 'Expo Go' in the app list"
echo "5. Enable 'Local Network' permission"
echo "6. Relaunch Expo Go"
echo ""

# Check if Metro is already running
echo "Checking if Metro is already running..."
METRO_PID=$(pgrep -f "metro")
if [ -n "$METRO_PID" ]; then
  echo "Metro is already running (PID: $METRO_PID)"
else
  echo "Starting Metro bundler..."
  # Start Metro in the background
  npx react-native start --reset-cache &
  METRO_PID=$!
  echo "Metro started with PID: $METRO_PID"
fi

echo ""
echo "Waiting for Metro to initialize (10 seconds)..."
sleep 10

echo ""
echo "Opening iOS simulator..."
npx react-native run-ios --simulator="iPhone 15"

echo ""
echo "==== Setup Complete ===="
echo "To stop the development server, press Ctrl+C"
echo "If you closed this terminal, run 'pkill -f metro' to stop the server later" 