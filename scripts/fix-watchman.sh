#!/bin/bash

echo "🔍 Checking Watchman installation..."

# Check if watchman is installed
if ! command -v watchman &> /dev/null; then
    echo "❌ Watchman is not installed."
    echo "🛠 Installing Watchman via Homebrew..."
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew is not installed. Please install Homebrew first from https://brew.sh/"
        exit 1
    fi
    
    brew install watchman
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Watchman."
        exit 1
    fi
    
    echo "✅ Watchman installed successfully!"
else
    echo "✅ Watchman is already installed."
fi

# Create .watchmanconfig file if it doesn't exist
if [ ! -f .watchmanconfig ]; then
    echo "🛠 Creating .watchmanconfig file..."
    echo '{
  "ignore_dirs": [
    "node_modules",
    ".git",
    "ios/build",
    "android/build",
    ".expo"
  ]
}' > .watchmanconfig
    echo "✅ Created .watchmanconfig file."
else
    echo "✅ .watchmanconfig file already exists."
fi

# Restart watchman
echo "🔄 Restarting Watchman service..."
watchman watch-del-all
watchman shutdown-server

echo "
🚨 IMPORTANT 🚨
If you're still seeing permission errors with Watchman, it's likely due to macOS security features.

Try the following steps:
1. Open System Preferences > Security & Privacy > Privacy > Full Disk Access
2. Click the '+' button to add an application
3. Navigate to /usr/local/bin/watchman (or where watchman is installed)
4. Restart your terminal and try again

Alternative solutions:
- Move your project out of the Downloads folder to a location with fewer restrictions
- Run: sudo chown -R $(whoami) $(pwd)
- Make sure the directory is not being scanned by Spotlight or other apps

For more information, visit: https://facebook.github.io/watchman/docs/troubleshooting
"

echo "Script completed!" 