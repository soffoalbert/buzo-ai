import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  BUDGETS: 'buzo_budgets',
  EXPENSES: 'buzo_expenses',
  SAVINGS_GOALS: 'buzo_savings_goals',
  PENDING_SYNC: 'buzo_pending_sync',
  USER_PROFILE: 'buzo_user_profile',
};

// Interface for pending sync items
interface PendingSyncItem {
  id: string;
  type: 'budget' | 'expense' | 'savings' | 'profile';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

/**
 * Save data to local storage
 * @param key Storage key
 * @param data Data to store
 */
export const saveData = async <T>(key: string, data: T): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(data);
    await AsyncStorage.setItem(key, jsonValue);
  } catch (error) {
    console.error('Error saving data to storage:', error);
    throw error;
  }
};

/**
 * Load data from local storage
 * @param key Storage key
 * @returns The stored data or null if not found
 */
export const loadData = async <T>(key: string): Promise<T | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) as T : null;
  } catch (error) {
    console.error('Error loading data from storage:', error);
    throw error;
  }
};

/**
 * Remove data from local storage
 * @param key Storage key
 */
export const removeData = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing data from storage:', error);
    throw error;
  }
};

/**
 * Add an item to the pending sync queue
 * @param item The item to add to the sync queue
 */
export const addToPendingSync = async (item: Omit<PendingSyncItem, 'timestamp'>): Promise<void> => {
  try {
    const pendingSync = await loadData<PendingSyncItem[]>(STORAGE_KEYS.PENDING_SYNC) || [];
    const newItem: PendingSyncItem = {
      ...item,
      timestamp: Date.now(),
    };
    pendingSync.push(newItem);
    await saveData(STORAGE_KEYS.PENDING_SYNC, pendingSync);
  } catch (error) {
    console.error('Error adding to pending sync:', error);
    throw error;
  }
};

/**
 * Get all pending sync items
 * @returns Array of pending sync items
 */
export const getPendingSyncItems = async (): Promise<PendingSyncItem[]> => {
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
    const pendingSync = await loadData<PendingSyncItem[]>(STORAGE_KEYS.PENDING_SYNC) || [];
    const filtered = pendingSync.filter((item: PendingSyncItem) => !ids.includes(item.id));
    await saveData(STORAGE_KEYS.PENDING_SYNC, filtered);
  } catch (error) {
    console.error('Error removing from pending sync:', error);
    throw error;
  }
};

/**
 * Save budget data locally
 * @param budgets Budget data to save
 */
export const saveBudgets = async <T>(budgets: T[]): Promise<void> => {
  await saveData<T[]>(STORAGE_KEYS.BUDGETS, budgets);
};

/**
 * Load budget data from local storage
 * @returns Budget data
 */
export const loadBudgets = async <T>(): Promise<T[]> => {
  return await loadData<T[]>(STORAGE_KEYS.BUDGETS) || [];
};

/**
 * Save expense data locally
 * @param expenses Expense data to save
 */
export const saveExpenses = async <T>(expenses: T[]): Promise<void> => {
  await saveData<T[]>(STORAGE_KEYS.EXPENSES, expenses);
};

/**
 * Load expense data from local storage
 * @returns Expense data
 */
export const loadExpenses = async <T>(): Promise<T[]> => {
  return await loadData<T[]>(STORAGE_KEYS.EXPENSES) || [];
};

/**
 * Save savings goals data locally
 * @param goals Savings goals data to save
 */
export const saveSavingsGoals = async <T>(goals: T[]): Promise<void> => {
  await saveData<T[]>(STORAGE_KEYS.SAVINGS_GOALS, goals);
};

/**
 * Load savings goals data from local storage
 * @returns Savings goals data
 */
export const loadSavingsGoals = async <T>(): Promise<T[]> => {
  return await loadData<T[]>(STORAGE_KEYS.SAVINGS_GOALS) || [];
};

/**
 * Save user profile data locally
 * @param profile User profile data to save
 */
export const saveUserProfile = async <T>(profile: T): Promise<void> => {
  await saveData<T>(STORAGE_KEYS.USER_PROFILE, profile);
};

/**
 * Load user profile data from local storage
 * @returns User profile data
 */
export const loadUserProfile = async <T>(): Promise<T | null> => {
  return await loadData<T>(STORAGE_KEYS.USER_PROFILE);
};

// Export storage keys for use in other modules
export { STORAGE_KEYS }; 