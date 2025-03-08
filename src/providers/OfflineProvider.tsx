import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Alert, AppState } from 'react-native';
import { isOnline } from '../services/offlineStorage';
import syncService from '../services/syncService';
import { offlineDataService, initializeOfflineService } from '../services/offlineDataService';
import { SyncStatus } from '../services/syncQueueService';
import OfflineStatusBar from '../components/OfflineStatusBar';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// Context type
interface OfflineContextType {
  isOnline: boolean;
  pendingChanges: number;
  syncStatus: SyncStatus | null;
  syncNow: () => Promise<void>;
  offlineData: typeof offlineDataService;
}

// Create context with default values
const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  pendingChanges: 0,
  syncStatus: null,
  syncNow: async () => {},
  offlineData: offlineDataService,
});

interface OfflineProviderProps {
  children: ReactNode;
}

/**
 * Provider component for offline functionality
 * Initializes sync service and provides offline status, pending changes, and methods to sync
 */
export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  const [online, setOnline] = useState<boolean>(true);
  const [pendingChanges, setPendingChanges] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Initialize sync service and set up network monitoring
  useEffect(() => {
    const initializeAndMonitor = async () => {
      try {
        // Initialize offline data service (caches user ID for offline use)
        await initializeOfflineService();
        
        // Initialize sync service
        const cleanup = syncService.initializeSyncService();
        
        // Check initial online status
        const initialOnlineStatus = await isOnline();
        setOnline(initialOnlineStatus);
        
        // Set up NetInfo listener
        const unsubscribeNetInfo = NetInfo.addEventListener(handleNetInfoChange);
        
        // Set up AppState listener to check connectivity when app comes to foreground
        const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
        
        // Listen for sync status changes
        const unsubscribeSyncStatus = syncService.addSyncStatusListener((status) => {
          setSyncStatus(status);
          
          // Update pending changes count
          if (status) {
            setPendingChanges(status.pendingCount);
          }
        });
        
        // Initial check for pending changes
        await checkPendingChanges();
        
        // Mark as initialized
        setIsInitialized(true);
        
        // Return cleanup function
        return () => {
          cleanup();
          unsubscribeNetInfo();
          appStateSubscription.remove();
          unsubscribeSyncStatus();
        };
      } catch (error) {
        console.error('Error initializing offline provider:', error);
        
        // Still mark as initialized to avoid hanging
        setIsInitialized(true);
        
        return () => {};
      }
    };
    
    // Run initialization
    const cleanupPromise = initializeAndMonitor();
    
    // Cleanup on unmount
    return () => {
      cleanupPromise.then(cleanup => cleanup());
    };
  }, []);
  
  // Handle NetInfo changes
  const handleNetInfoChange = (state: NetInfoState) => {
    const isConnected = Boolean(state.isConnected && state.isInternetReachable);
    
    // Only update if there's an actual change
    if (isConnected !== online) {
      console.log(`Network status changed: ${isConnected ? 'online' : 'offline'}`);
      setOnline(isConnected);
      
      // If coming back online, automatically sync
      if (isConnected && pendingChanges > 0) {
        syncNow();
      }
    }
  };
  
  // Handle app coming to foreground
  const handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === 'active') {
      // App came to foreground, check connectivity and pending changes
      checkStatus();
    }
  };

  // Check online status and pending changes
  const checkStatus = async () => {
    try {
      const isOnlineNow = await isOnline();
      setOnline(isOnlineNow);
      
      await checkPendingChanges();
    } catch (error) {
      console.error('Error checking offline status:', error);
    }
  };
  
  // Check for pending changes
  const checkPendingChanges = async () => {
    try {
      const count = await syncService.getPendingSyncCount();
      setPendingChanges(count);
    } catch (error) {
      console.error('Error getting pending sync count:', error);
    }
  };

  // Sync data with server
  const syncNow = async () => {
    try {
      await syncService.performFullSync({ 
        showAlert: true,
        forceSync: true 
      });
      await checkPendingChanges();
    } catch (error) {
      console.error('Error syncing data:', error);
      Alert.alert(
        'Sync Error',
        'There was a problem syncing your data. Please try again later.'
      );
    }
  };

  // Context value
  const contextValue: OfflineContextType = {
    isOnline: online,
    pendingChanges,
    syncStatus,
    syncNow,
    offlineData: offlineDataService,
  };

  // Show loading state until initialized
  if (!isInitialized) {
    return null;
  }

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
      <OfflineStatusBar />
    </OfflineContext.Provider>
  );
};

/**
 * Hook to use the offline context
 */
export const useOffline = () => useContext(OfflineContext);

export default OfflineProvider; 