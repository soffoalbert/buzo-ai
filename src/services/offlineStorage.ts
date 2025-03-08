import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Storage keys
const STORAGE_KEYS = {
  BUDGETS: 'buzo_budgets',
  EXPENSES: 'buzo_expenses',
  SAVINGS: 'buzo_savings_goals',
  TRANSACTIONS: 'buzo_transactions',
  PENDING_SYNC: 'buzo_pending_sync',
  LAST_SYNC: 'buzo_last_sync',
};

// Types
export interface PendingSyncItem {
  id: string;
  type: 'create' | 'update' | 'delete' | 'CREATE_BUDGET' | 'UPDATE_BUDGET' | 'DELETE_BUDGET' | 'CREATE_SAVINGS_GOAL' | 'UPDATE_SAVINGS_GOAL' | 'DELETE_SAVINGS_GOAL';
  entity: 'budget' | 'expense' | 'savings' | 'transaction';
  data: any;
  timestamp: number;
}

// Add this near the top of the file
// Cache for online status to prevent excessive network checks
let onlineStatusCache: {
  status: boolean | null;
  timestamp: number;
} = {
  status: null,
  timestamp: 0
};

// Max age for cached online status (1.5 seconds)
const ONLINE_STATUS_CACHE_MS = 1500;

// Timeout for network connectivity check (3 seconds)
const CONNECTIVITY_CHECK_TIMEOUT_MS = 3000;

/**
 * Save data to offline storage
 * @param key Storage key
 * @param data Data to store
 */
export const saveData = async <T>(key: string, data: T): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(data);
    await AsyncStorage.setItem(key, jsonValue);
  } catch (error) {
    console.error(`Error saving data to ${key}:`, error);
    throw error;
  }
};

/**
 * Load data from offline storage
 * @param key Storage key
 * @returns Stored data or null if not found
 */
export const loadData = async <T>(key: string): Promise<T | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (error) {
    console.error(`Error loading data from ${key}:`, error);
    throw error;
  }
};

/**
 * Remove data from offline storage
 * @param key Storage key
 */
export const removeData = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing data from ${key}:`, error);
    throw error;
  }
};

/**
 * Check if the device is online with caching to prevent excessive network checks
 * @returns Promise that resolves to a boolean indicating if the device is online
 */
export const isOnline = async (): Promise<boolean> => {
  try {
    const now = Date.now();
    
    // Use cached value if it's not expired
    if (onlineStatusCache.status !== null && now - onlineStatusCache.timestamp < ONLINE_STATUS_CACHE_MS) {
      return onlineStatusCache.status;
    }
    
    // Create a promise that resolves with the network status
    const networkCheckPromise = new Promise<boolean>(async (resolve) => {
      try {
        const netInfo = await NetInfo.fetch();
        const isConnected = Boolean(netInfo.isConnected && netInfo.isInternetReachable);
        
        // Update cache
        onlineStatusCache = {
          status: isConnected,
          timestamp: Date.now()
        };
        
        resolve(isConnected);
      } catch (error) {
        console.warn('Error checking network status:', error);
        
        // If we can't check, assume offline if we have a cached value, otherwise assume online
        const fallbackStatus = onlineStatusCache.status !== null ? onlineStatusCache.status : true;
        resolve(fallbackStatus);
      }
    });
    
    // Add timeout to network check
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => {
        // If timeout occurs, use last known status or assume online
        const fallbackStatus = onlineStatusCache.status !== null ? onlineStatusCache.status : true;
        resolve(fallbackStatus);
      }, CONNECTIVITY_CHECK_TIMEOUT_MS);
    });
    
    // Race the network check against the timeout
    return await Promise.race([networkCheckPromise, timeoutPromise]);
  } catch (error) {
    console.error('Unexpected error in isOnline check:', error);
    // Fallback: assume online if we can't check, unless we have a cached value
    return onlineStatusCache.status !== null ? onlineStatusCache.status : true;
  }
};

/**
 * Add an item to the pending sync queue
 * @param item Item to add to the sync queue
 */
export const addToPendingSync = async (item: Omit<PendingSyncItem, 'timestamp'>): Promise<void> => {
  try {
    // Load existing pending sync items
    const pendingSync = await loadData<PendingSyncItem[]>(STORAGE_KEYS.PENDING_SYNC) || [];
    
    // Add new item with timestamp
    const newItem: PendingSyncItem = {
      ...item,
      timestamp: Date.now(),
    };
    
    // Save updated pending sync items
    await saveData(STORAGE_KEYS.PENDING_SYNC, [...pendingSync, newItem]);
  } catch (error) {
    console.error('Error adding item to pending sync:', error);
    throw error;
  }
};

/**
 * Get all pending sync items
 * @returns Array of pending sync items
 */
export const getPendingSync = async (): Promise<PendingSyncItem[]> => {
  try {
    return await loadData<PendingSyncItem[]>(STORAGE_KEYS.PENDING_SYNC) || [];
  } catch (error) {
    console.error('Error getting pending sync items:', error);
    throw error;
  }
};

/**
 * Remove items from the pending sync queue
 * @param ids IDs of items to remove
 */
export const removeFromPendingSync = async (ids: string[]): Promise<void> => {
  try {
    // Load existing pending sync items
    const pendingSync = await loadData<PendingSyncItem[]>(STORAGE_KEYS.PENDING_SYNC) || [];
    
    // Filter out items with matching IDs
    const updatedPendingSync = pendingSync.filter(item => !ids.includes(item.id));
    
    // Save updated pending sync items
    await saveData(STORAGE_KEYS.PENDING_SYNC, updatedPendingSync);
  } catch (error) {
    console.error('Error removing items from pending sync:', error);
    throw error;
  }
};

/**
 * Clear all pending sync items
 */
export const clearPendingSync = async (): Promise<void> => {
  try {
    await removeData(STORAGE_KEYS.PENDING_SYNC);
  } catch (error) {
    console.error('Error clearing pending sync items:', error);
    throw error;
  }
};

/**
 * Update the last sync timestamp
 */
export const updateLastSync = async (): Promise<void> => {
  try {
    await saveData(STORAGE_KEYS.LAST_SYNC, Date.now());
  } catch (error) {
    console.error('Error updating last sync timestamp:', error);
    throw error;
  }
};

/**
 * Get the last sync timestamp
 * @returns Last sync timestamp or null if never synced
 */
export const getLastSync = async (): Promise<number | null> => {
  try {
    return await loadData<number>(STORAGE_KEYS.LAST_SYNC);
  } catch (error) {
    console.error('Error getting last sync timestamp:', error);
    throw error;
  }
};

// Budget-specific functions
export const saveBudgets = async (budgets: any[]): Promise<void> => {
  await saveData(STORAGE_KEYS.BUDGETS, budgets);
};

export const loadBudgets = async (): Promise<any[]> => {
  return await loadData<any[]>(STORAGE_KEYS.BUDGETS) || [];
};

// Expense-specific functions
export const saveExpenses = async (expenses: any[]): Promise<void> => {
  await saveData(STORAGE_KEYS.EXPENSES, expenses);
};

export const loadExpenses = async (): Promise<any[]> => {
  return await loadData<any[]>(STORAGE_KEYS.EXPENSES) || [];
};

// Savings-specific functions
export const saveSavingsGoals = async (savingsGoals: any[]): Promise<void> => {
  await saveData(STORAGE_KEYS.SAVINGS, savingsGoals);
};

export const loadSavingsGoals = async (): Promise<any[]> => {
  return await loadData<any[]>(STORAGE_KEYS.SAVINGS) || [];
};

// Transaction-specific functions
export const saveTransactions = async (transactions: any[]): Promise<void> => {
  await saveData(STORAGE_KEYS.TRANSACTIONS, transactions);
};

export const loadTransactions = async (): Promise<any[]> => {
  return await loadData<any[]>(STORAGE_KEYS.TRANSACTIONS) || [];
};

/**
 * Set up a network change listener to trigger sync when coming back online
 * @param syncCallback Function to call when the device comes back online
 * @returns Unsubscribe function
 */
export const setupNetworkListener = (syncCallback: () => void): (() => void) => {
  try {
    return NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        // Device is online, trigger sync
        syncCallback();
      }
    });
  } catch (error) {
    console.error('Error setting up network listener:', error);
    // Return a no-op function if we can't set up the listener
    return () => {};
  }
};

export default {
  STORAGE_KEYS,
  saveData,
  loadData,
  removeData,
  isOnline,
  addToPendingSync,
  getPendingSync,
  removeFromPendingSync,
  clearPendingSync,
  updateLastSync,
  getLastSync,
  saveBudgets,
  loadBudgets,
  saveExpenses,
  loadExpenses,
  saveSavingsGoals,
  loadSavingsGoals,
  saveTransactions,
  loadTransactions,
  setupNetworkListener,
}; 