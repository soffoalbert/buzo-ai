#!/bin/bash

# A helper script for running Fastlane commands
# Usage: ./fastlane.sh [command]
# Example: ./fastlane.sh ios_beta

# Use Homebrew Ruby instead of system Ruby
export PATH="/usr/local/opt/ruby/bin:$PATH"
export LDFLAGS="-L/usr/local/opt/ruby/lib"
export CPPFLAGS="-I/usr/local/opt/ruby/include"
export PKG_CONFIG_PATH="/usr/local/opt/ruby/lib/pkgconfig"

# Check if the command is provided
if [ -z "$1" ]; then
  echo "Usage: ./fastlane.sh [command]"
  echo "Available commands:"
  echo "  ios_beta - Deploy to TestFlight"
  echo "  ios_release - Deploy to App Store"
  echo "  android_internal - Deploy to Google Play internal testing"
  echo "  android_production - Deploy to Google Play production"
  echo "  increment_ios_version [version] - Increment iOS version"
  echo "  increment_android_version [version] - Increment Android version"
  echo "  beta_all - Deploy to both platforms (beta/internal)"
  echo "  release_all - Deploy to both platforms (production)"
  echo "  increment_version_all [version] - Increment version on both platforms"
  exit 1
fi

# Check if bundle is installed
if ! command -v bundle &> /dev/null; then
  echo "Bundle is not installed. Installing bundler..."
  gem install bundler
fi

# Check if bundler is up to date
bundle check || bundle install

# Load environment variables if .env exists
if [ -f .env ]; then
  export $(cat .env | grep -v "#" | xargs)
fi

# Execute the fastlane command
if [[ "$1" == "increment_ios_version" || "$1" == "increment_android_version" || "$1" == "increment_version_all" ]]; then
  if [ -z "$2" ]; then
    echo "Error: Version parameter is required for $1"
    echo "Usage: ./fastlane.sh $1 [version]"
    echo "Example: ./fastlane.sh $1 1.0.0"
    exit 1
  fi
  bundle exec fastlane $1 version:$2
else
  bundle exec fastlane $1
fi 