# Upgrading to Expo SDK 52

This document outlines the steps taken to upgrade the Buzo AI app from Expo SDK 49 to Expo SDK 52.

## Changes Made

1. **Updated Dependencies**
   - Updated Expo SDK from 49.0.8 to 52.0.0
   - Updated React Native from 0.72.4 to 0.73.4
   - Updated all Expo modules to their SDK 52 compatible versions
   - Updated React Navigation and other dependencies

2. **Configuration Updates**
   - Added `jsEngine: "hermes"` to app.json
   - Added bundle identifiers for iOS and Android
   - Updated tsconfig.json with additional compiler options
   - Created metro.config.js for better asset handling

3. **Code Changes**
   - Updated offlineStorage.ts to properly support generic types
   - Fixed type issues in service files

## Post-Upgrade Steps

After pulling these changes, follow these steps:

1. **Clean the project**
   ```bash
   npx expo install --fix
   ```

2. **Clear cache**
   ```bash
   npx expo start --clear
   ```

3. **Update EAS configuration (if using EAS)**
   ```bash
   eas update
   ```

## Potential Issues

- If you encounter any TypeScript errors, run `npx tsc --noEmit` to check for type issues
- If you have issues with React Native Reanimated, try reinstalling it with `npx expo install react-native-reanimated`
- For iOS build issues, try cleaning the iOS build folder with `npx pod-install`

## New Features in Expo SDK 52

- Improved performance with Hermes JavaScript engine
- Better TypeScript support
- Enhanced debugging tools
- Improved error messages
- Support for the latest React Native features

## References

- [Expo SDK 52 Release Notes](https://docs.expo.dev/versions/v52.0.0/introduction/changelog/)
- [React Native 0.73 Release Notes](https://reactnative.dev/blog/2023/12/06/0.73-stable-released)
- [Upgrading Expo SDK Guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/) 