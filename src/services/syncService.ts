import offlineStorage, { PendingSyncItem } from './offlineStorage';
import syncQueueService, { SyncQueueItem, SyncStatus } from './syncQueueService';
import { AppState, AppStateStatus, Platform, Alert } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../api/supabaseClient';
import { checkSupabaseConnection } from '../api/supabaseClient';
import * as budgetApi from '../api/budgetApi';
import * as expenseApi from '../api/expenseApi';
import * as savingsApi from '../api/savingsApi';
import { offlineDataService } from './offlineDataService';
import { saveBudgets, saveExpenses, saveSavingsGoals } from './offlineStorage';

// Constants
const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 60000; // 1 minute
const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Define types for data models
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
    
    // Check if we have an internet connection
    const online = await offlineStorage.isOnline();
    if (!online) {
      console.log('No internet connection, cannot sync item');
      return false;
    }
    
    // Check if Supabase is reachable
    const isConnected = await checkSupabaseConnection();
    if (!isConnected) {
      console.log('Supabase not reachable, cannot sync item');
      return false;
    }
    
    // Process based on entity type and operation
    switch (item.entity) {
      case 'budget':
        if (item.type === 'CREATE_BUDGET') {
          // Create budget in Supabase
          const { data: createData, error: createError } = await supabase
            .from('budgets')
            .insert([item.data])
            .select()
            .single();
            
          if (createError) {
            console.error(`Error creating budget in Supabase: ${createError.message}`);
            await syncQueueService.markSyncAttempt(item.id, createError.message);
            return false;
          }
          
          console.log(`Synced budget creation for ID ${item.data.id}`);
          return true;
        } else if (item.type === 'UPDATE_BUDGET') {
          // Update budget in Supabase
          const { data: updateData, error: updateError } = await supabase
            .from('budgets')
            .update(item.data)
            .eq('id', item.data.id)
            .select()
            .single();
            
          if (updateError) {
            console.error(`Error updating budget in Supabase: ${updateError.message}`);
            await syncQueueService.markSyncAttempt(item.id, updateError.message);
            return false;
          }
          
          console.log(`Synced budget update for ID ${item.data.id}`);
          return true;
        } else if (item.type === 'DELETE_BUDGET') {
          // Delete budget from Supabase
          const { error: deleteError } = await supabase
            .from('budgets')
            .delete()
            .eq('id', item.data.id);
            
          if (deleteError) {
            console.error(`Error deleting budget from Supabase: ${deleteError.message}`);
            await syncQueueService.markSyncAttempt(item.id, deleteError.message);
            return false;
          }
          
          console.log(`Synced budget deletion for ID ${item.data.id}`);
          return true;
        }
        break;
        
      case 'expense':
        if (item.type === 'create') {
          // Create expense in Supabase
          const createdExpense = await expenseApi.createExpense(item.data);
          console.log(`Synced expense creation for ID ${item.data.id}`);
          return true;
        } else if (item.type === 'update') {
          // Update expense in Supabase
          await expenseApi.updateExpense(item.data.id, item.data);
          console.log(`Synced expense update for ID ${item.data.id}`);
          return true;
        } else if (item.type === 'delete') {
          // Delete expense from Supabase
          await expenseApi.deleteExpense(item.data.id);
          console.log(`Synced expense deletion for ID ${item.data.id}`);
          return true;
        }
        break;
        
      case 'savings':
        if (item.type === 'CREATE_SAVINGS_GOAL') {
          // Create savings goal in Supabase
          const { data: createData, error: createError } = await supabase
            .from('savings_goals')
            .insert([item.data])
            .select()
            .single();
            
          if (createError) {
            console.error(`Error creating savings goal in Supabase: ${createError.message}`);
            await syncQueueService.markSyncAttempt(item.id, createError.message);
            return false;
          }
          
          console.log(`Synced savings goal creation for ID ${item.data.id}`);
          return true;
        } else if (item.type === 'UPDATE_SAVINGS_GOAL') {
          // Update savings goal in Supabase
          const { data: updateData, error: updateError } = await supabase
            .from('savings_goals')
            .update(item.data)
            .eq('id', item.data.id)
            .select()
            .single();
            
          if (updateError) {
            console.error(`Error updating savings goal in Supabase: ${updateError.message}`);
            await syncQueueService.markSyncAttempt(item.id, updateError.message);
            return false;
          }
          
          console.log(`Synced savings goal update for ID ${item.data.id}`);
          return true;
        } else if (item.type === 'DELETE_SAVINGS_GOAL') {
          // Delete savings goal from Supabase
          const { error: deleteError } = await supabase
            .from('savings_goals')
            .delete()
            .eq('id', item.data.id);
            
          if (deleteError) {
            console.error(`Error deleting savings goal from Supabase: ${deleteError.message}`);
            await syncQueueService.markSyncAttempt(item.id, deleteError.message);
            return false;
          }
          
          console.log(`Synced savings goal deletion for ID ${item.data.id}`);
          return true;
        }
        break;
        
      default:
        console.warn(`Unknown entity type: ${item.entity}`);
        return false;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing sync item ${item.id}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await syncQueueService.markSyncAttempt(item.id, errorMessage);
    return false;
  }
};

/**
 * Pull the latest data from the backend
 */
export const pullLatestData = async (): Promise<void> => {
  try {
    // Check if online
    const online = await offlineStorage.isOnline();
    if (!online) {
      console.log('Device is offline, skipping pull of latest data');
      return;
    }
    
    // Check if Supabase is reachable
    const isConnected = await checkSupabaseConnection();
    if (!isConnected) {
      console.log('Supabase not reachable, skipping pull of latest data');
      return;
    }
    
    // Get latest budgets
    try {
      const { data: budgets, error: budgetsError } = await supabase
        .from('budgets')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (!budgetsError && budgets) {
        // Save budgets to local storage
        await saveBudgets(budgets);
        console.log(`Pulled ${budgets.length} budgets from Supabase`);
      } else {
        console.error('Error pulling budgets:', budgetsError);
      }
    } catch (error) {
      console.error('Error pulling budgets:', error);
    }
    
    // Get latest expenses
    try {
      const expenses = await expenseApi.fetchExpenses();
      
      // Save expenses to local storage
      await saveExpenses(expenses);
      console.log(`Pulled ${expenses.length} expenses from Supabase`);
    } catch (error) {
      console.error('Error pulling expenses:', error);
    }
    
    // Get latest savings goals
    try {
      const { data: savingsGoals, error: savingsError } = await supabase
        .from('savings_goals')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (!savingsError && savingsGoals) {
        // Save savings goals to local storage
        await saveSavingsGoals(savingsGoals);
        console.log(`Pulled ${savingsGoals.length} savings goals from Supabase`);
      } else {
        console.error('Error pulling savings goals:', savingsError);
      }
    } catch (error) {
      console.error('Error pulling savings goals:', error);
    }
    
    // Update last sync timestamp
    await offlineStorage.updateLastSync();
  } catch (error) {
    console.error('Error in pullLatestData:', error);
  }
};

/**
 * Synchronize pending changes with the backend
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
    
    // Update last sync timestamp
    await offlineStorage.updateLastSync();
  } catch (error) {
    console.error('Error in syncPendingChanges:', error);
    
    // Update sync status to indicate sync failed
    const status = await syncQueueService.getSyncStatus() || {
      lastSyncAttempt: Date.now(),
      lastSuccessfulSync: null,
      isSyncing: false,
      pendingCount: 0,
      failedCount: 0,
      syncProgress: 0,
    };
    
    await syncQueueService.updateSyncStatus({
      ...status,
      isSyncing: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    notifySyncListeners(await syncQueueService.getSyncStatus() || status);
  }
};

/**
 * Perform a full sync (push changes and pull latest data)
 */
export const performFullSync = async (options: {
  forceSync?: boolean;
  maxItems?: number;
  showAlert?: boolean;
} = {}): Promise<void> => {
  const { forceSync = false, maxItems = 50, showAlert = false } = options;
  
  try {
    // First push pending changes
    await syncPendingChanges({ forceSync, maxItems });
    
    // Then pull latest data
    await pullLatestData();
    
    if (showAlert) {
      Alert.alert(
        'Sync Complete',
        'Your data has been synchronized with the server.',
        [{ text: 'OK' }]
      );
    }
  } catch (error) {
    console.error('Error in performFullSync:', error);
    
    if (showAlert) {
      Alert.alert(
        'Sync Failed',
        'There was a problem synchronizing your data. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  }
};

/**
 * Background sync handler
 */
const backgroundSyncHandler = async (): Promise<BackgroundFetch.BackgroundFetchResult> => {
  try {
    // Check if online
    const online = await offlineStorage.isOnline();
    if (!online) {
      console.log('Device is offline, skipping background sync');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    
    // Get sync queue
    const queue = await syncQueueService.getSyncQueue();
    if (queue.length === 0) {
      console.log('No pending items to sync in background');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    
    console.log(`Background sync started with ${queue.length} pending items`);
    
    // Perform full sync
    await performFullSync({ maxItems: 20 }); // Limit to 20 items for background sync
    
    console.log('Background sync completed successfully');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Error in background sync:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
};

/**
 * Register background sync task
 */
export const registerBackgroundSync = async (): Promise<void> => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    try {
      // Define the task
      TaskManager.defineTask(BACKGROUND_SYNC_TASK, backgroundSyncHandler);
      
      // Register the task
      const status = await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: SYNC_INTERVAL_MS / 1000, // Convert ms to seconds
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
    // App came to foreground, perform sync
    performFullSync();
  }
};

/**
 * Initialize sync service
 */
export const initializeSyncService = (): (() => void) => {
  // Register app state change listener
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  
  // Register network change listener
  const unsubscribeNetInfo = NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      // Network is available, sync pending changes
      performFullSync();
    }
  });
  
  // Register background sync
  registerBackgroundSync();
  
  // Initialize sync status
  syncQueueService.initSyncStatus();
  
  // Return cleanup function
  return () => {
    subscription.remove();
    unsubscribeNetInfo();
    unregisterBackgroundSync();
  };
};

/**
 * Check if there are pending sync items
 */
export const hasPendingSyncItems = async (): Promise<boolean> => {
  const queue = await syncQueueService.getSyncQueue();
  return queue.length > 0;
};

/**
 * Get the count of pending sync items
 */
export const getPendingSyncCount = async (): Promise<number> => {
  const queue = await syncQueueService.getSyncQueue();
  return queue.length;
};

/**
 * Reset all sync data (for testing/debugging)
 */
export const resetSyncData = async (): Promise<void> => {
  await syncQueueService.clearSyncQueue();
  await syncQueueService.resetSyncStatus();
  console.log('Sync data reset');
};

export default {
  performFullSync,
  syncPendingChanges,
  pullLatestData,
  registerBackgroundSync,
  unregisterBackgroundSync,
  initializeSyncService,
  addSyncStatusListener,
  hasPendingSyncItems,
  getPendingSyncCount,
  resetSyncData
}; 