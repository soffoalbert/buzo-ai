// Import polyfills first
import './src/utils/polyfills';

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AppNavigator from './src/navigation';
import deepLinkHandler from './src/utils/deepLinkHandler';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  useEffect(() => {
    // Request notification permissions on app start
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      }
    };

    requestPermissions();
    
    // Initialize deep link handling and store the cleanup function
    const cleanupDeepLinks = deepLinkHandler.initDeepLinkHandling();
    
    // Return a cleanup function for when the component unmounts
    return () => {
      if (cleanupDeepLinks && typeof cleanupDeepLinks === 'function') {
        cleanupDeepLinks();
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
