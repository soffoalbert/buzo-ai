import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import offlineStorage, { PendingSyncItem } from './offlineStorage';

// Storage keys
const SYNC_QUEUE_KEY = 'buzo_sync_queue';
const SYNC_ATTEMPTS_KEY = 'buzo_sync_attempts';
const SYNC_STATUS_KEY = 'buzo_sync_status';

// Types
export interface SyncQueueItem extends PendingSyncItem {
  priority: number; // Higher number = higher priority
  attempts: number; // Number of sync attempts
  lastAttempt: number | null; // Timestamp of last attempt
  error?: string; // Last error message if sync failed
}

export interface SyncStatus {
  lastSyncAttempt: number | null; // Timestamp of last sync attempt
  lastSuccessfulSync: number | null; // Timestamp of last successful sync
  isSyncing: boolean; // Whether sync is currently in progress
  pendingCount: number; // Number of items pending sync
  failedCount: number; // Number of items that failed to sync
  syncProgress: number; // Progress of current sync (0-100)
  error?: string; // Last error message if sync failed
}

/**
 * Initialize sync status
 */
export const initSyncStatus = async (): Promise<void> => {
  try {
    const existingStatus = await getSyncStatus();
    if (!existingStatus) {
      const initialStatus: SyncStatus = {
        lastSyncAttempt: null,
        lastSuccessfulSync: null,
        isSyncing: false,
        pendingCount: 0,
        failedCount: 0,
        syncProgress: 0,
      };
      await AsyncStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(initialStatus));
    }
  } catch (error) {
    console.error('Error initializing sync status:', error);
  }
};

/**
 * Get current sync status
 */
export const getSyncStatus = async (): Promise<SyncStatus | null> => {
  try {
    const statusJson = await AsyncStorage.getItem(SYNC_STATUS_KEY);
    return statusJson ? JSON.parse(statusJson) : null;
  } catch (error) {
    console.error('Error getting sync status:', error);
    return null;
  }
};

/**
 * Update sync status
 */
export const updateSyncStatus = async (updates: Partial<SyncStatus>): Promise<void> => {
  try {
    const currentStatus = await getSyncStatus() || {
      lastSyncAttempt: null,
      lastSuccessfulSync: null,
      isSyncing: false,
      pendingCount: 0,
      failedCount: 0,
      syncProgress: 0,
    };
    
    const updatedStatus = { ...currentStatus, ...updates };
    await AsyncStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(updatedStatus));
  } catch (error) {
    console.error('Error updating sync status:', error);
  }
};

/**
 * Add an item to the sync queue
 */
export const addToSyncQueue = async (
  item: Omit<PendingSyncItem, 'timestamp'>, 
  priority: number = 1
): Promise<string> => {
  try {
    // Generate a unique ID for the item
    const id = item.id || uuidv4();
    
    // Create the queue item
    const queueItem: SyncQueueItem = {
      ...item,
      id,
      timestamp: Date.now(),
      priority,
      attempts: 0,
      lastAttempt: null,
    };
    
    // Get existing queue
    const queue = await getSyncQueue();
    
    // Add item to queue
    queue.push(queueItem);
    
    // Save updated queue
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    
    // Update sync status
    await updateSyncStatus({
      pendingCount: queue.length,
    });
    
    // Also add to the legacy pending sync for backward compatibility
    await offlineStorage.addToPendingSync({
      ...item,
      id,
    });
    
    return id;
  } catch (error) {
    console.error('Error adding item to sync queue:', error);
    throw error;
  }
};

/**
 * Get all items in the sync queue
 */
export const getSyncQueue = async (): Promise<SyncQueueItem[]> => {
  try {
    const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (error) {
    console.error('Error getting sync queue:', error);
    return [];
  }
};

/**
 * Get sync queue items sorted by priority (highest first)
 */
export const getPrioritizedSyncQueue = async (): Promise<SyncQueueItem[]> => {
  const queue = await getSyncQueue();
  return queue.sort((a, b) => b.priority - a.priority);
};

/**
 * Update a sync queue item
 */
export const updateSyncQueueItem = async (id: string, updates: Partial<SyncQueueItem>): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const index = queue.findIndex(item => item.id === id);
    
    if (index !== -1) {
      queue[index] = { ...queue[index], ...updates };
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (error) {
    console.error(`Error updating sync queue item ${id}:`, error);
  }
};

/**
 * Remove items from the sync queue
 */
export const removeFromSyncQueue = async (ids: string[]): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const updatedQueue = queue.filter(item => !ids.includes(item.id));
    
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(updatedQueue));
    
    // Update sync status
    await updateSyncStatus({
      pendingCount: updatedQueue.length,
    });
    
    // Also remove from legacy pending sync for backward compatibility
    await offlineStorage.removeFromPendingSync(ids);
  } catch (error) {
    console.error('Error removing items from sync queue:', error);
  }
};

/**
 * Mark a sync queue item as attempted
 */
export const markSyncAttempt = async (id: string, error?: string): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const index = queue.findIndex(item => item.id === id);
    
    if (index !== -1) {
      queue[index] = {
        ...queue[index],
        attempts: queue[index].attempts + 1,
        lastAttempt: Date.now(),
        error: error,
      };
      
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      
      // Update failed count in sync status if there was an error
      if (error) {
        const failedItems = queue.filter(item => item.error);
        await updateSyncStatus({
          failedCount: failedItems.length,
          error: error,
        });
      }
    }
  } catch (error) {
    console.error(`Error marking sync attempt for item ${id}:`, error);
  }
};

/**
 * Get items that have failed to sync
 */
export const getFailedSyncItems = async (): Promise<SyncQueueItem[]> => {
  try {
    const queue = await getSyncQueue();
    return queue.filter(item => item.error);
  } catch (error) {
    console.error('Error getting failed sync items:', error);
    return [];
  }
};

/**
 * Reset sync attempts for failed items
 */
export const resetFailedSyncItems = async (): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    
    const updatedQueue = queue.map(item => {
      if (item.error) {
        return {
          ...item,
          attempts: 0,
          lastAttempt: null,
          error: undefined,
        };
      }
      return item;
    });
    
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(updatedQueue));
    
    // Update sync status
    await updateSyncStatus({
      failedCount: 0,
      error: undefined,
    });
  } catch (error) {
    console.error('Error resetting failed sync items:', error);
  }
};

/**
 * Clear the entire sync queue
 */
export const clearSyncQueue = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
    
    // Update sync status
    await updateSyncStatus({
      pendingCount: 0,
      failedCount: 0,
      syncProgress: 0,
      error: undefined,
    });
    
    // Also clear legacy pending sync for backward compatibility
    await offlineStorage.clearPendingSync();
  } catch (error) {
    console.error('Error clearing sync queue:', error);
  }
};

// Initialize sync status when the module is loaded
initSyncStatus().catch(error => {
  console.error('Error during sync status initialization:', error);
});

export default {
  addToSyncQueue,
  getSyncQueue,
  getPrioritizedSyncQueue,
  updateSyncQueueItem,
  removeFromSyncQueue,
  markSyncAttempt,
  getFailedSyncItems,
  resetFailedSyncItems,
  clearSyncQueue,
  getSyncStatus,
  updateSyncStatus,
  initSyncStatus,
}; 