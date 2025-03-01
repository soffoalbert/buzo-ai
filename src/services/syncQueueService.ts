import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import offlineStorage, { PendingSyncItem } from './offlineStorage';
import * as budgetApi from '../api/budgetApi';
import * as expenseApi from '../api/expenseApi';
import * as savingsApi from '../api/savingsApi';
import { supabase } from '../api/supabaseClient';

// Storage keys
const SYNC_QUEUE_KEY = 'buzo_sync_queue';
const SYNC_ATTEMPTS_KEY = 'buzo_sync_attempts';
const SYNC_STATUS_KEY = 'buzo_sync_status';

// Types
export type SyncQueueItemType = 
  | 'CREATE_BUDGET' 
  | 'UPDATE_BUDGET' 
  | 'DELETE_BUDGET'
  | 'CREATE_SAVINGS_GOAL'
  | 'UPDATE_SAVINGS_GOAL'
  | 'DELETE_SAVINGS_GOAL'
  | 'create'
  | 'update'
  | 'delete';

export interface SyncQueueItem extends PendingSyncItem {
  priority: number; // Higher number = higher priority
  attempts: number; // Number of sync attempts
  lastAttempt: number | null; // Timestamp of last attempt
  error?: string; // Last error message if sync failed
  type: SyncQueueItemType; // Type of sync operation
  data: any; // Data associated with the sync operation
  table?: string; // Optional table name for database operations
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
  item: Omit<PendingSyncItem, 'timestamp'> & { type: SyncQueueItemType; data: any; table?: string }, 
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
      id,
      type: item.type,
      entity: item.entity,
      data: item.data,
      timestamp: Date.now(),
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

// Fix the processSyncItem function
const processSyncItem = async (item: SyncQueueItem): Promise<boolean> => {
  try {
    console.log(`Processing sync item: ${item.type}`, item.data);
    
    switch (item.type) {
      // Add your existing cases here if any
      
      case 'CREATE_BUDGET':
        try {
          // For budget creation, we need to create it in Supabase
          // The data should contain the complete budget object
          const budget = item.data;
          
          // Remove local ID and use Supabase to generate a new one
          // Note: user_id will be added by the budgetApi.createBudget function
          const { id, createdAt, updatedAt, ...budgetData } = budget;
          
          await budgetApi.createBudget(budgetData);
          return true;
        } catch (error) {
          console.error('Error syncing CREATE_BUDGET:', error);
          return false;
        }
        
      case 'UPDATE_BUDGET':
        try {
          // For budget updates, we need to update it in Supabase
          // The data should contain the budget ID and the fields to update
          const { id, ...updateData } = item.data;
          
          if (!id) {
            console.error('Missing budget ID for UPDATE_BUDGET');
            return false;
          }
          
          // Remove user_id from update data if present
          // This is because we can't update the user_id of a budget
          const { user_id, ...cleanUpdateData } = updateData;
          
          await budgetApi.updateBudget(id, cleanUpdateData);
          return true;
        } catch (error) {
          console.error('Error syncing UPDATE_BUDGET:', error);
          return false;
        }
        
      case 'DELETE_BUDGET':
        try {
          // For budget deletion, we need to delete it from Supabase
          // The data should contain the budget ID
          const { id } = item.data;
          
          if (!id) {
            console.error('Missing budget ID for DELETE_BUDGET');
            return false;
          }
          
          await budgetApi.deleteBudget(id);
          return true;
        } catch (error) {
          console.error('Error syncing DELETE_BUDGET:', error);
          return false;
        }
      
      // Add handlers for savings goal operations
      case 'CREATE_SAVINGS_GOAL':
        try {
          // For savings goal creation, we need to create it in Supabase
          // The data should contain the complete savings goal object
          const savingsGoal = item.data;
          
          // Remove local ID and use Supabase to generate a new one
          const { id, createdAt, updatedAt, ...savingsGoalData } = savingsGoal;
          
          await savingsApi.createSavingsGoal(savingsGoalData);
          return true;
        } catch (error) {
          console.error('Error syncing CREATE_SAVINGS_GOAL:', error);
          return false;
        }
        
      case 'UPDATE_SAVINGS_GOAL':
        try {
          // For savings goal updates, we need to update it in Supabase
          // The data should contain the savings goal ID and the fields to update
          const { id, ...updateData } = item.data;
          
          if (!id) {
            console.error('Missing savings goal ID for UPDATE_SAVINGS_GOAL');
            return false;
          }
          
          // Remove user_id from update data if present
          const { user_id, ...cleanUpdateData } = updateData;
          
          await savingsApi.updateSavingsGoal(id, cleanUpdateData);
          return true;
        } catch (error) {
          console.error('Error syncing UPDATE_SAVINGS_GOAL:', error);
          return false;
        }
        
      case 'DELETE_SAVINGS_GOAL':
        try {
          // For savings goal deletion, we need to delete it from Supabase
          // The data should contain the savings goal ID
          const { id } = item.data;
          
          if (!id) {
            console.error('Missing savings goal ID for DELETE_SAVINGS_GOAL');
            return false;
          }
          
          await savingsApi.deleteSavingsGoal(id);
          return true;
        } catch (error) {
          console.error('Error syncing DELETE_SAVINGS_GOAL:', error);
          return false;
        }
      
      // Add handlers for expense operations
      case 'create':
        try {
          if (item.table === 'expenses') {
            // For expense creation, use expenseApi
            const expenseData = item.data;
            
            // If this is a locally created expense (has local_ prefix), we need to create a new one
            if (expenseData.id && expenseData.id.startsWith('local_')) {
              // Remove the local ID prefix and other fields that should be generated by the API
              const { id, createdAt, updatedAt, ...cleanExpenseData } = expenseData;
              
              try {
                await expenseApi.createExpense(cleanExpenseData);
                console.log('Successfully synced expense creation to Supabase');
                return true;
              } catch (error: any) {
                // Check if this is a duplicate key error
                if (error.code === '23505' || (error.message && error.message.includes('duplicate key'))) {
                  console.log('Expense already exists in Supabase, marking as synced');
                  return true; // Consider it synced since it already exists
                }
                console.error('Error creating expense via API:', error);
                return false;
              }
            } else {
              // For non-local IDs, use direct Supabase insert
              const { error } = await supabase
                .from('expenses')
                .insert(expenseData);
                
              if (error) {
                // Check if this is a duplicate key error
                if (error.code === '23505' || error.message.includes('duplicate key')) {
                  console.log('Expense already exists in Supabase, marking as synced');
                  return true; // Consider it synced since it already exists
                }
                console.error('Error syncing CREATE expense:', error);
                return false;
              }
              
              console.log('Successfully synced expense creation to Supabase');
              return true;
            }
          }
          return false;
        } catch (error) {
          console.error('Error syncing CREATE operation:', error);
          return false;
        }
        
      case 'update':
        try {
          if (item.table === 'expenses') {
            // For expense updates, use expenseApi
            const { id, ...updateData } = item.data;
            
            if (!id) {
              console.error('Missing expense ID for UPDATE operation');
              return false;
            }
            
            // Skip updating locally created expenses that haven't been synced yet
            if (id.startsWith('local_')) {
              console.log('Skipping update for local expense that has not been synced yet');
              return true;
            }
            
            try {
              await expenseApi.updateExpense(id, updateData);
              console.log('Successfully synced expense update to Supabase');
              return true;
            } catch (error: any) {
              // If the record doesn't exist, consider it synced (it might have been deleted)
              if (error.code === 'PGRST116' || 
                  error.code === '404' || 
                  (error.message && (
                    error.message.includes('not found') || 
                    error.message.includes('does not exist')
                  ))) {
                console.log(`Expense ${id} not found in Supabase, marking update as synced`);
                return true;
              }
              console.error('Error updating expense via API:', error);
              return false;
            }
          }
          return false;
        } catch (error) {
          console.error('Error syncing UPDATE operation:', error);
          return false;
        }
        
      case 'delete':
        try {
          if (item.table === 'expenses') {
            // For expense deletion, use expenseApi
            const { id } = item.data;
            
            if (!id) {
              console.error('Missing expense ID for DELETE operation');
              return false;
            }
            
            // Skip deleting locally created expenses that haven't been synced yet
            if (id.startsWith('local_')) {
              console.log('Skipping deletion for local expense that has not been synced yet');
              return true;
            }
            
            try {
              await expenseApi.deleteExpense(id);
              console.log('Successfully synced expense deletion to Supabase');
              return true;
            } catch (error: any) {
              // If the record doesn't exist, consider it synced (it's already deleted)
              if (error.code === 'PGRST116' || 
                  error.code === '404' || 
                  (error.message && (
                    error.message.includes('not found') || 
                    error.message.includes('does not exist')
                  ))) {
                console.log(`Expense ${id} not found in Supabase, marking deletion as synced`);
                return true;
              }
              console.error('Error deleting expense via API:', error);
              return false;
            }
          }
          return false;
        } catch (error) {
          console.error('Error syncing DELETE operation:', error);
          return false;
        }
      
      default:
        console.error(`Unknown sync item type: ${item.type}`);
        return false;
    }
  } catch (error) {
    console.error('Error processing sync item:', error);
    return false;
  }
};

/**
 * Process all items in the sync queue
 */
export const processAllSyncItems = async (): Promise<void> => {
  try {
    // Get current sync status
    const status = await getSyncStatus();
    
    // If already syncing, don't start another sync
    if (status?.isSyncing) {
      console.log('Sync already in progress, skipping');
      return;
    }
    
    // Update sync status to indicate sync is in progress
    await updateSyncStatus({
      isSyncing: true,
      lastSyncAttempt: Date.now(),
      syncProgress: 0,
    });
    
    // Get prioritized sync queue
    const queue = await getPrioritizedSyncQueue();
    
    if (queue.length === 0) {
      // No items to sync
      await updateSyncStatus({
        isSyncing: false,
        syncProgress: 100,
      });
      return;
    }
    
    console.log(`Processing ${queue.length} sync items`);
    
    // Process each item in the queue
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      
      // Update sync progress
      await updateSyncStatus({
        syncProgress: Math.round((i / queue.length) * 100),
      });
      
      // Process the item
      const success = await processSyncItem(item);
      
      if (success) {
        // Remove the item from the queue
        await removeFromSyncQueue([item.id]);
        successCount++;
      } else {
        // Mark the item as attempted
        await markSyncAttempt(item.id, 'Failed to sync');
        failCount++;
      }
    }
    
    // Update sync status
    await updateSyncStatus({
      isSyncing: false,
      lastSuccessfulSync: successCount > 0 ? Date.now() : status?.lastSuccessfulSync,
      syncProgress: 100,
      pendingCount: failCount,
      failedCount: failCount,
    });
    
    console.log(`Sync complete: ${successCount} succeeded, ${failCount} failed`);
  } catch (error) {
    console.error('Error processing sync queue:', error);
    
    // Update sync status to indicate sync failed
    await updateSyncStatus({
      isSyncing: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Synchronize budgets when the app comes back online
 */
export const synchronizeBudgets = async (): Promise<void> => {
  try {
    // Get all budgets from local storage
    const localBudgetsStr = await AsyncStorage.getItem('buzo_budgets');
    const localBudgets = localBudgetsStr ? JSON.parse(localBudgetsStr) : [];
    
    if (localBudgets.length === 0) {
      console.log('No local budgets to synchronize');
      return;
    }
    
    console.log(`Synchronizing ${localBudgets.length} local budgets`);
    
    // Try to fetch remote budgets
    try {
      const remoteBudgets = await budgetApi.fetchBudgets();
      
      // Create a map of remote budgets by ID for quick lookup
      const remoteBudgetsMap = new Map();
      remoteBudgets.forEach(budget => {
        remoteBudgetsMap.set(budget.id, budget);
      });
      
      // For each local budget, determine if it needs to be created, updated, or is already in sync
      for (const localBudget of localBudgets) {
        // Skip budgets with local IDs - they need to be created
        if (!localBudget.id || localBudget.id.includes('local_')) {
          // Make sure the budget has a user_id
          if (!localBudget.user_id) {
            // Try to get the current user ID
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.id) {
              localBudget.user_id = user.id;
            } else {
              console.error('Cannot sync budget without user_id');
              continue; // Skip this budget
            }
          }
          
          await addToSyncQueue({
            id: localBudget.id,
            type: 'CREATE_BUDGET',
            data: localBudget,
            timestamp: Date.now(),
          }, 5); // Higher priority for budgets
          continue;
        }
        
        // Check if the budget exists remotely
        const remoteBudget = remoteBudgetsMap.get(localBudget.id);
        
        if (!remoteBudget) {
          // Budget exists locally but not remotely - create it
          // Make sure the budget has a user_id
          if (!localBudget.user_id) {
            // Try to get the current user ID
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.id) {
              localBudget.user_id = user.id;
            } else {
              console.error('Cannot sync budget without user_id');
              continue; // Skip this budget
            }
          }
          
          await addToSyncQueue({
            id: localBudget.id,
            type: 'CREATE_BUDGET',
            data: localBudget,
            timestamp: Date.now(),
          }, 5);
        } else {
          // Budget exists both locally and remotely - check if they're different
          const localUpdatedAt = new Date(localBudget.updatedAt).getTime();
          const remoteUpdatedAt = new Date(remoteBudget.updatedAt).getTime();
          
          if (localUpdatedAt > remoteUpdatedAt) {
            // Local budget is newer - update remote
            // Don't include user_id in the update data
            const { user_id, id, createdAt, updatedAt, ...updateData } = localBudget;
            
            await addToSyncQueue({
              id: localBudget.id,
              type: 'UPDATE_BUDGET',
              data: { id: localBudget.id, ...updateData },
              timestamp: Date.now(),
            }, 5);
          } else if (remoteUpdatedAt > localUpdatedAt) {
            // Remote budget is newer - update local
            // This will be handled by the budgetService when it loads budgets
          }
        }
      }
      
      // Check for remote budgets that don't exist locally
      const localBudgetIds = new Set(localBudgets.map(b => b.id));
      const newRemoteBudgets = remoteBudgets.filter(b => !localBudgetIds.has(b.id));
      
      if (newRemoteBudgets.length > 0) {
        // Save the new remote budgets locally
        const allBudgets = [...localBudgets, ...newRemoteBudgets];
        await AsyncStorage.setItem('buzo_budgets', JSON.stringify(allBudgets));
      }
      
    } catch (error) {
      console.error('Error fetching remote budgets:', error);
      
      // If we can't fetch remote budgets, queue all local budgets for sync
      for (const budget of localBudgets) {
        // Skip budgets without user_id
        if (!budget.user_id) {
          // Try to get the current user ID
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            budget.user_id = user.id;
          } else {
            console.error('Cannot sync budget without user_id');
            continue; // Skip this budget
          }
        }
        
        const isCreate = !budget.id || budget.id.includes('local_');
        
        await addToSyncQueue({
          id: budget.id,
          type: isCreate ? 'CREATE_BUDGET' : 'UPDATE_BUDGET',
          data: budget,
          timestamp: Date.now(),
        }, 5); // Higher priority for budgets
      }
    }
    
    // Process the sync queue
    await processAllSyncItems();
  } catch (error) {
    console.error('Error synchronizing budgets:', error);
  }
};

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
  processAllSyncItems,
  synchronizeBudgets,
}; 