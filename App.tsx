// Import polyfills first
import './src/utils/polyfills';

import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, View, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AppNavigator from './src/navigation';
import deepLinkHandler from './src/utils/deepLinkHandler';
import notificationService from './src/services/notifications';
import syncService from './src/services/syncService';
import { initNetworkListeners } from './src/services/budgetService';
import NetworkManager from './src/utils/NetworkManager';
import OfflineStatusBar from './src/components/OfflineStatusBar';
// Import the API key migration function
import { migrateApiKeyToSupabase } from './src/services/apiKeyManager';
// Import ThemeProvider
import { ThemeProvider } from './src/hooks/useTheme';
// Import test user initialization
import initTestUser from './src/scripts/initTestUser';
// Import database setup function
import { initializeIAP, endIAPConnection } from './src/services/appStorePaymentService';

const AppContent = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.statusBarContainer}>
        <OfflineStatusBar />
      </View>
      <View style={styles.content}>
        <AppNavigator />
      </View>
    </View>
  );
};

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  
  // Keep references to notification subscriptions for cleanup
  const notificationReceivedListener = useRef<Notifications.Subscription>();
  const notificationResponseListener = useRef<Notifications.Subscription>();
  const syncServiceCleanup = useRef<(() => void) | null>(null);
  const networkListenerCleanup = useRef<(() => void) | null>(null);

  // Initialize app
  useEffect(() => {
    async function prepare() {
      try {
        // Initialize IAP
        await initializeIAP();
        
        // Initialize test user for development
        await initTestUser();
        
        // Migrate API keys from SecureStore to Supabase
        await migrateApiKeyToSupabase();
        console.log('API key migration check completed');
        
        // Initialize notifications
        await notificationService.initializeNotifications();
        
        // Initialize deep link handling and store the cleanup function
        const cleanupDeepLinks = deepLinkHandler.initDeepLinkHandling();
        
        // Initialize sync service
        syncServiceCleanup.current = syncService.initializeSyncService();
        
        // Initialize budget network listeners
        networkListenerCleanup.current = NetworkManager.initNetworkListener();
        
        return () => {
          // Clean up deep links
          if (cleanupDeepLinks && typeof cleanupDeepLinks === 'function') {
            cleanupDeepLinks();
          }
          
          // Clean up sync service
          if (syncServiceCleanup.current) {
            syncServiceCleanup.current();
          }
          
          // Clean up network listeners
          if (networkListenerCleanup.current) {
            networkListenerCleanup.current();
          }
        };
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
    
    // Clean up IAP connection when app is closed
    return () => {
      endIAPConnection();
    };
  }, []);

  // Initialize notifications
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        // Register for push notifications
        await notificationService.registerForPushNotifications();
        
        // Set up notification listeners
        notificationReceivedListener.current = Notifications.addNotificationReceivedListener(
          notification => {
            console.log('Notification received:', notification);
          }
        );
        
        notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener(
          response => {
            console.log('Notification response received:', response);
          }
        );
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };

    initializeNotifications();
    
    // Return a cleanup function for when the component unmounts
    return () => {
      // Clean up notification listeners
      if (notificationReceivedListener.current) {
        Notifications.removeNotificationSubscription(notificationReceivedListener.current);
      }
      
      if (notificationResponseListener.current) {
        Notifications.removeNotificationSubscription(notificationResponseListener.current);
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  statusBarContainer: {
    paddingTop: 0, // Removed padding completely
  },
  content: {
    flex: 1,
  },
});
