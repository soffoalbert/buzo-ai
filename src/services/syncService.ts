import offlineStorage, { PendingSyncItem } from './offlineStorage';
import syncQueueService, { SyncQueueItem, SyncStatus } from './syncQueueService';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
// Import API service (to be implemented)
// import api from './api';

// Constants
const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 60000; // 1 minute
const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Define types for mock data
interface Budget { id: string; [key: string]: any }
interface Expense { id: string; [key: string]: any }
interface SavingsGoal { id: string; [key: string]: any }
interface Transaction { id: string; [key: string]: any }

// Event listeners
let syncListeners: Array<(status: SyncStatus) => void> = [];

/**
 * Register a listener for sync status updates
 * @param listener Function to call when sync status changes
 * @returns Function to unregister the listener
 */
export const addSyncStatusListener = (listener: (status: SyncStatus) => void): (() => void) => {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter(l => l !== listener);
  };
};

/**
 * Notify all listeners of a sync status update
 * @param status Current sync status
 */
const notifySyncListeners = (status: SyncStatus): void => {
  syncListeners.forEach(listener => {
    try {
      listener(status);
    } catch (error) {
      console.error('Error in sync status listener:', error);
    }
  });
};

/**
 * Process a single sync item
 * @param item Item to sync
 * @returns Whether the sync was successful
 */
const processSyncItem = async (item: SyncQueueItem): Promise<boolean> => {
  try {
    // Mark sync attempt
    await syncQueueService.markSyncAttempt(item.id);
    
    // Skip items that have exceeded max retry attempts
    if (item.attempts > MAX_RETRY_ATTEMPTS) {
      console.warn(`Skipping item ${item.id} after ${item.attempts} failed attempts`);
      await syncQueueService.markSyncAttempt(item.id, 'Exceeded maximum retry attempts');
      return false;
    }
    
    // Process based on entity type and operation
    switch (item.entity) {
      case 'budget':
        // Uncomment and implement when API service is available
        // if (item.type === 'create') {
        //   await api.budgets.create(item.data);
        // } else if (item.type === 'update') {
        //   await api.budgets.update(item.data.id, item.data);
        // } else if (item.type === 'delete') {
        //   await api.budgets.delete(item.data.id);
        // }
        
        // For now, just log the action
        console.log(`Synced budget ${item.type} for ID ${item.data.id}`);
        break;
        
      case 'expense':
        // Uncomment and implement when API service is available
        // if (item.type === 'create') {
        //   await api.expenses.create(item.data);
        // } else if (item.type === 'update') {
        //   await api.expenses.update(item.data.id, item.data);
        // } else if (item.type === 'delete') {
        //   await api.expenses.delete(item.data.id);
        // }
        
        // For now, just log the action
        console.log(`Synced expense ${item.type} for ID ${item.data.id}`);
        break;
        
      case 'savings':
        // Uncomment and implement when API service is available
        // if (item.type === 'create') {
        //   await api.savings.create(item.data);
        // } else if (item.type === 'update') {
        //   await api.savings.update(item.data.id, item.data);
        // } else if (item.type === 'delete') {
        //   await api.savings.delete(item.data.id);
        // }
        
        // For now, just log the action
        console.log(`Synced savings goal ${item.type} for ID ${item.data.id}`);
        break;
        
      case 'transaction':
        // Uncomment and implement when API service is available
        // if (item.type === 'create') {
        //   await api.transactions.create(item.data);
        // } else if (item.type === 'update') {
        //   await api.transactions.update(item.data.id, item.data);
        // } else if (item.type === 'delete') {
        //   await api.transactions.delete(item.data.id);
        // }
        
        // For now, just log the action
        console.log(`Synced transaction ${item.type} for ID ${item.data.id}`);
        break;
        
      default:
        console.warn(`Unknown entity type: ${item.entity}`);
        return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Error processing sync item ${item.id}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await syncQueueService.markSyncAttempt(item.id, errorMessage);
    return false;
  }
};

/**
 * Synchronize pending changes with the backend
 * @param options Sync options
 * @returns Promise that resolves when sync is complete
 */
export const syncPendingChanges = async (options: {
  forceSync?: boolean;
  maxItems?: number;
} = {}): Promise<void> => {
  const { forceSync = false, maxItems = 50 } = options;
  
  try {
    // Check if device is online
    const online = await offlineStorage.isOnline();
    if (!online && !forceSync) {
      console.log('Device is offline, skipping sync');
      return;
    }

    // Get current sync status
    let status = await syncQueueService.getSyncStatus() || {
      lastSyncAttempt: null,
      lastSuccessfulSync: null,
      isSyncing: false,
      pendingCount: 0,
      failedCount: 0,
      syncProgress: 0,
    };
    
    // If already syncing, don't start another sync
    if (status.isSyncing && !forceSync) {
      console.log('Sync already in progress, skipping');
      return;
    }
    
    // Update sync status to indicate sync is starting
    status = {
      ...status,
      isSyncing: true,
      lastSyncAttempt: Date.now(),
      syncProgress: 0,
    };
    await syncQueueService.updateSyncStatus(status);
    notifySyncListeners(status);

    // Get prioritized sync queue
    const queue = await syncQueueService.getPrioritizedSyncQueue();
    if (queue.length === 0) {
      console.log('No pending items to sync');
      
      // Update sync status to indicate sync is complete
      status = {
        ...status,
        isSyncing: false,
        lastSuccessfulSync: Date.now(),
        syncProgress: 100,
      };
      await syncQueueService.updateSyncStatus(status);
      notifySyncListeners(status);
      
      return;
    }

    console.log(`Syncing ${queue.length} pending items`);
    
    // Limit the number of items to process in this batch
    const itemsToProcess = queue.slice(0, maxItems);
    const totalItems = itemsToProcess.length;
    
    // Process each item
    const successfulIds: string[] = [];
    let processedCount = 0;
    
    for (const item of itemsToProcess) {
      const success = await processSyncItem(item);
      
      if (success) {
        successfulIds.push(item.id);
      }
      
      // Update progress
      processedCount++;
      const progress = Math.round((processedCount / totalItems) * 100);
      
      // Update sync status with progress
      status = {
        ...status,
        syncProgress: progress,
      };
      await syncQueueService.updateSyncStatus(status);
      notifySyncListeners(status);
    }

    // Remove successfully synced items
    if (successfulIds.length > 0) {
      await syncQueueService.removeFromSyncQueue(successfulIds);
      console.log(`Removed ${successfulIds.length} synced items from queue`);
    }

    // Get updated counts
    const remainingQueue = await syncQueueService.getSyncQueue();
    const failedItems = await syncQueueService.getFailedSyncItems();
    
    // Update sync status to indicate sync is complete
    status = {
      ...status,
      isSyncing: false,
      lastSuccessfulSync: Date.now(),
      pendingCount: remainingQueue.length,
      failedCount: failedItems.length,
      syncProgress: 100,
    };
    await syncQueueService.updateSyncStatus(status);
    notifySyncListeners(status);
    
    // Update legacy last sync timestamp
    await offlineStorage.updateLastSync();
    
    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Error syncing pending changes:', error);
    
    // Update sync status to indicate sync failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const status: SyncStatus = {
      isSyncing: false,
      lastSyncAttempt: Date.now(),
      lastSuccessfulSync: null,
      pendingCount: 0,
      failedCount: 0,
      syncProgress: 0,
      error: errorMessage,
    };
    await syncQueueService.updateSyncStatus(status);
    notifySyncListeners(status);
    
    throw error;
  }
};

/**
 * Pull latest data from the backend and update local storage
 * @returns Promise that resolves when pull is complete
 */
export const pullLatestData = async (): Promise<void> => {
  try {
    // Check if device is online
    const online = await offlineStorage.isOnline();
    if (!online) {
      console.log('Device is offline, skipping pull');
      return;
    }

    // Get last sync timestamp
    const lastSync = await offlineStorage.getLastSync();
    console.log(`Pulling data since ${lastSync ? new Date(lastSync).toISOString() : 'never'}`);

    // Fetch latest data from backend
    // Uncomment and implement when API service is available
    // const budgets = await api.budgets.getAll(lastSync);
    // const expenses = await api.expenses.getAll(lastSync);
    // const savingsGoals = await api.savings.getAll(lastSync);
    // const transactions = await api.transactions.getAll(lastSync);

    // For now, use mock data with proper typing
    const budgets: Budget[] = []; // Mock data
    const expenses: Expense[] = []; // Mock data
    const savingsGoals: SavingsGoal[] = []; // Mock data
    const transactions: Transaction[] = []; // Mock data

    // Update local storage
    await offlineStorage.saveBudgets(budgets);
    await offlineStorage.saveExpenses(expenses);
    await offlineStorage.saveSavingsGoals(savingsGoals);
    await offlineStorage.saveTransactions(transactions);

    // Update last sync timestamp
    await offlineStorage.updateLastSync();
    
    console.log('Pull completed successfully');
  } catch (error) {
    console.error('Error pulling latest data:', error);
    throw error;
  }
};

/**
 * Perform a full sync (push pending changes and pull latest data)
 * @param options Sync options
 * @returns Promise that resolves when sync is complete
 */
export const performFullSync = async (options: {
  forceSync?: boolean;
  maxItems?: number;
} = {}): Promise<void> => {
  try {
    // Check if device is online
    const online = await offlineStorage.isOnline();
    if (!online && !options.forceSync) {
      console.log('Device is offline, skipping full sync');
      return;
    }

    // First push pending changes
    await syncPendingChanges(options);
    
    // Then pull latest data
    await pullLatestData();
    
    console.log('Full sync completed successfully');
  } catch (error) {
    console.error('Error performing full sync:', error);
    throw error;
  }
};

/**
 * Background sync task handler
 * @returns BackgroundFetch result
 */
const backgroundSyncHandler = async (): Promise<BackgroundFetch.BackgroundFetchResult> => {
  try {
    console.log('Background sync started');
    
    // Check if there are pending items to sync
    const queue = await syncQueueService.getSyncQueue();
    if (queue.length === 0) {
      console.log('No pending items to sync in background');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    
    // Check if device is online
    const online = await offlineStorage.isOnline();
    if (!online) {
      console.log('Device is offline, skipping background sync');
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
    
    // Perform sync with limited items to avoid timeouts
    await syncPendingChanges({ maxItems: 20 });
    
    console.log('Background sync completed successfully');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Error during background sync:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
};

/**
 * Register background sync task
 */
export const registerBackgroundSync = async (): Promise<void> => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      // Register task handler
      TaskManager.defineTask(BACKGROUND_SYNC_TASK, backgroundSyncHandler);
      
      // Register background fetch
      const status = await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: SYNC_INTERVAL_MS / 1000, // Convert to seconds
        stopOnTerminate: false,
        startOnBoot: true,
      });
      
      console.log('Background sync registered:', status);
    } catch (error) {
      console.error('Error registering background sync:', error);
    }
  } else {
    console.log('Background sync not supported on this platform');
  }
};

/**
 * Unregister background sync task
 */
export const unregisterBackgroundSync = async (): Promise<void> => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      console.log('Background sync unregistered');
    } catch (error) {
      console.error('Error unregistering background sync:', error);
    }
  }
};

/**
 * Handle app state changes to trigger sync
 */
const handleAppStateChange = (nextAppState: AppStateStatus) => {
  if (nextAppState === 'active') {
    // App came to foreground, check for pending syncs
    console.log('App came to foreground, checking for pending syncs');
    performFullSync().catch(error => {
      console.error('Error during app foreground sync:', error);
    });
  }
};

/**
 * Initialize sync service and set up listeners
 * @returns Cleanup function to remove listeners
 */
export const initializeSyncService = (): (() => void) => {
  console.log('Initializing sync service');
  
  // Initialize sync queue status
  syncQueueService.initSyncStatus().catch((error: Error) => {
    console.error('Error initializing sync status:', error);
  });
  
  // Perform initial sync
  performFullSync().catch(error => {
    console.error('Error during initial sync:', error);
  });
  
  // Register background sync
  registerBackgroundSync().catch(error => {
    console.error('Error registering background sync:', error);
  });
  
  // Set up app state listener
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  
  // Set up network listener to sync when coming back online
  const unsubscribeNetwork = offlineStorage.setupNetworkListener(() => {
    console.log('Network connection restored, starting sync');
    performFullSync().catch(error => {
      console.error('Error during network-triggered sync:', error);
    });
  });
  
  // Return cleanup function
  return () => {
    // Remove app state listener
    subscription.remove();
    
    // Remove network listener
    unsubscribeNetwork();
    
    // Unregister background sync
    unregisterBackgroundSync().catch(error => {
      console.error('Error unregistering background sync:', error);
    });
  };
};

export default {
  syncPendingChanges,
  pullLatestData,
  performFullSync,
  initializeSyncService,
  registerBackgroundSync,
  unregisterBackgroundSync,
  addSyncStatusListener,
}; 