#!/bin/bash

# This script is used for EAS prebuild process
# It will ignore any additional arguments passed to it (including --platform android)

echo "Starting prebuild script..."

# Install dependencies
npm install unimodules-app-loader || true

# Apply patches
npx patch-package

echo "Prebuild completed successfully"

# Exit with success
exit 0
