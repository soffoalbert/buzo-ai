import { Budget, BudgetCategory, DEFAULT_BUDGET_CATEGORIES } from '../models/Budget';
import { saveData, loadData, removeData } from './offlineStorage';
import { generateUUID } from '../utils/helpers';
import * as budgetApi from '../api/budgetApi';
import { checkSupabaseConnection } from '../api/supabaseClient';
import syncQueueService from './syncQueueService';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../api/supabaseClient';

// Storage keys
const BUDGETS_STORAGE_KEY = 'buzo_budgets';
const BUDGET_CATEGORIES_STORAGE_KEY = 'buzo_budget_categories';

/**
 * Save budgets to local storage
 * @param budgets Array of budgets to save
 * @returns Promise resolving to the saved budgets
 */
export const saveBudgetsLocally = async (budgets: Budget[]): Promise<Budget[]> => {
  try {
    await saveData(BUDGETS_STORAGE_KEY, budgets);
    return budgets;
  } catch (error) {
    console.error('Error saving budgets locally:', error);
    throw new Error('Failed to save budgets locally');
  }
};

/**
 * Load budgets from local storage
 * @returns Promise resolving to array of budgets or empty array if none found
 */
export const loadBudgetsLocally = async (): Promise<Budget[]> => {
  try {
    const budgets = await loadData<Budget[]>(BUDGETS_STORAGE_KEY);
    return budgets || [];
  } catch (error) {
    console.error('Error loading budgets from local storage:', error);
    return [];
  }
};

/**
 * Load budgets from Supabase or local storage if offline
 * @returns Promise resolving to array of budgets
 */
export const loadBudgets = async (): Promise<Budget[]> => {
  try {
    // Check if we're online and can connect to Supabase
    const isOnline = await checkSupabaseConnection();
    
    if (isOnline) {
      // If online, fetch from Supabase
      const budgets = await budgetApi.fetchBudgets();
      
      // Save to local storage for offline access
      await saveBudgetsLocally(budgets);
      
      return budgets;
    } else {
      // If offline, load from local storage
      console.log('Offline mode: Loading budgets from local storage');
      return loadBudgetsLocally();
    }
  } catch (error) {
    console.error('Error loading budgets:', error);
    
    // Fallback to local storage if there's an error
    console.log('Falling back to local storage for budgets');
    return loadBudgetsLocally();
  }
};

/**
 * Create a new budget
 * @param budgetData Budget data without id, createdAt, updatedAt
 * @returns Promise resolving to the created budget
 */
export const createBudget = async (
  budgetData: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Budget> => {
  try {
    // Check if we're online and can connect to Supabase
    const isOnline = await checkSupabaseConnection();
    
    if (isOnline) {
      // If online, create in Supabase
      const newBudget = await budgetApi.createBudget(budgetData);
      
      // Update local storage
      const currentBudgets = await loadBudgetsLocally();
      await saveBudgetsLocally([...currentBudgets, newBudget]);
      
      return newBudget;
    } else {
      // If offline, create locally and queue for sync
      console.log('Offline mode: Creating budget locally');
      
      // Get the current user from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      if (!userId) {
        throw new Error('User not authenticated. Cannot create budget.');
      }
      
      const now = new Date().toISOString();
      const newBudget: Budget = {
        id: `local_${generateUUID()}`, // Use a prefix to identify locally created budgets
        createdAt: now,
        updatedAt: now,
        ...budgetData,
        user_id: userId, // Add user_id for when it's synced to Supabase
      };
      
      // Save locally
      const currentBudgets = await loadBudgetsLocally();
      await saveBudgetsLocally([...currentBudgets, newBudget]);
      
      // Queue for sync when back online
      await syncQueueService.addToSyncQueue({
        id: newBudget.id,
        type: 'CREATE_BUDGET',
        data: newBudget,
        timestamp: Date.now(),
      }, 5); // Higher priority for budgets
      
      return newBudget;
    }
  } catch (error) {
    console.error('Error creating budget:', error);
    throw error;
  }
};

/**
 * Update an existing budget
 * @param id Budget ID to update
 * @param budgetData Partial budget data to update
 * @returns Promise resolving to the updated budget
 */
export const updateBudget = async (
  id: string,
  budgetData: Partial<Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Budget> => {
  try {
    // Check if we're online and can connect to Supabase
    const isOnline = await checkSupabaseConnection();
    
    if (isOnline) {
      // If online, update in Supabase
      const updatedBudget = await budgetApi.updateBudget(id, budgetData);
      
      // Update local storage
      const currentBudgets = await loadBudgetsLocally();
      const updatedBudgets = currentBudgets.map(budget => 
        budget.id === id ? updatedBudget : budget
      );
      await saveBudgetsLocally(updatedBudgets);
      
      return updatedBudget;
    } else {
      // If offline, update locally and queue for sync
      console.log('Offline mode: Updating budget locally');
      
      const currentBudgets = await loadBudgetsLocally();
      const budgetIndex = currentBudgets.findIndex(budget => budget.id === id);
      
      if (budgetIndex === -1) {
        throw new Error(`Budget with ID ${id} not found`);
      }
      
      const now = new Date().toISOString();
      const updatedBudget: Budget = {
        ...currentBudgets[budgetIndex],
        ...budgetData,
        updatedAt: now,
      };
      
      currentBudgets[budgetIndex] = updatedBudget;
      await saveBudgetsLocally(currentBudgets);
      
      // Queue for sync when back online
      await syncQueueService.addToSyncQueue({
        id: updatedBudget.id,
        type: 'UPDATE_BUDGET',
        data: { id, ...budgetData },
        timestamp: Date.now(),
      }, 5); // Higher priority for budgets
      
      return updatedBudget;
    }
  } catch (error) {
    console.error('Error updating budget:', error);
    throw error;
  }
};

/**
 * Delete a budget
 * @param id Budget ID to delete
 * @returns Promise resolving to boolean indicating success
 */
export const deleteBudget = async (id: string): Promise<boolean> => {
  try {
    // Check if we're online and can connect to Supabase
    const isOnline = await checkSupabaseConnection();
    
    if (isOnline) {
      // If online, delete from Supabase
      await budgetApi.deleteBudget(id);
      
      // Update local storage
      const currentBudgets = await loadBudgetsLocally();
      const updatedBudgets = currentBudgets.filter(budget => budget.id !== id);
      await saveBudgetsLocally(updatedBudgets);
      
      return true;
    } else {
      // If offline, delete locally and queue for sync
      console.log('Offline mode: Deleting budget locally');
      
      const currentBudgets = await loadBudgetsLocally();
      const updatedBudgets = currentBudgets.filter(budget => budget.id !== id);
      
      if (updatedBudgets.length === currentBudgets.length) {
        return false; // No budget was deleted
      }
      
      await saveBudgetsLocally(updatedBudgets);
      
      // Queue for sync when back online
      await syncQueueService.addToQueue({
        type: 'DELETE_BUDGET',
        data: { id },
        timestamp: new Date().toISOString(),
      });
      
      return true;
    }
  } catch (error) {
    console.error('Error deleting budget:', error);
    return false;
  }
};

/**
 * Get a budget by ID
 * @param id Budget ID to retrieve
 * @returns Promise resolving to the budget or null if not found
 */
export const getBudgetById = async (id: string): Promise<Budget | null> => {
  try {
    // Check if we're online and can connect to Supabase
    const isOnline = await checkSupabaseConnection();
    
    if (isOnline) {
      // If online, get from Supabase
      return budgetApi.getBudgetById(id);
    } else {
      // If offline, get from local storage
      console.log('Offline mode: Getting budget from local storage');
      
      const budgets = await loadBudgetsLocally();
      const budget = budgets.find(budget => budget.id === id);
      return budget || null;
    }
  } catch (error) {
    console.error('Error getting budget by ID:', error);
    
    // Fallback to local storage
    console.log('Falling back to local storage for budget');
    const budgets = await loadBudgetsLocally();
    const budget = budgets.find(budget => budget.id === id);
    return budget || null;
  }
};

/**
 * Update budget spending amount
 * @param id Budget ID to update
 * @param amount Amount to add to spent (can be negative)
 * @returns Promise resolving to the updated budget
 */
export const updateBudgetSpending = async (
  id: string,
  amount: number
): Promise<Budget> => {
  try {
    const budget = await getBudgetById(id);
    
    if (!budget) {
      throw new Error(`Budget with ID ${id} not found`);
    }
    
    const newSpent = Math.max(0, (budget.spent || 0) + amount);
    return updateBudget(id, { spent: newSpent });
  } catch (error) {
    console.error('Error updating budget spending:', error);
    throw error;
  }
};

/**
 * Save budget categories to local storage
 * @param categories Array of budget categories to save
 * @returns Promise resolving to the saved categories
 */
export const saveBudgetCategories = async (
  categories: BudgetCategory[]
): Promise<BudgetCategory[]> => {
  try {
    await saveData(BUDGET_CATEGORIES_STORAGE_KEY, categories);
    return categories;
  } catch (error) {
    console.error('Error saving budget categories:', error);
    throw new Error('Failed to save budget categories');
  }
};

/**
 * Load budget categories from local storage
 * @returns Promise resolving to array of budget categories
 */
export const loadBudgetCategories = async (): Promise<BudgetCategory[]> => {
  try {
    const categories = await loadData<BudgetCategory[]>(BUDGET_CATEGORIES_STORAGE_KEY);
    
    // If no categories are found, initialize with defaults
    if (!categories || categories.length === 0) {
      await saveBudgetCategories(DEFAULT_BUDGET_CATEGORIES);
      return DEFAULT_BUDGET_CATEGORIES;
    }
    
    return categories;
  } catch (error) {
    console.error('Error loading budget categories:', error);
    return DEFAULT_BUDGET_CATEGORIES;
  }
};

/**
 * Create a new budget category
 * @param categoryData Category data without id
 * @returns Promise resolving to the created category
 */
export const createBudgetCategory = async (
  categoryData: Omit<BudgetCategory, 'id'>
): Promise<BudgetCategory> => {
  const newCategory: BudgetCategory = {
    id: generateUUID(),
    ...categoryData,
  };
  
  const currentCategories = await loadBudgetCategories();
  const updatedCategories = [...currentCategories, newCategory];
  
  await saveBudgetCategories(updatedCategories);
  return newCategory;
};

/**
 * Get budget statistics
 * @returns Promise resolving to budget statistics
 */
export const getBudgetStatistics = async () => {
  try {
    // Check if we're online and can connect to Supabase
    const isOnline = await checkSupabaseConnection();
    
    if (isOnline) {
      // If online, get statistics from Supabase
      return budgetApi.getBudgetStatistics();
    } else {
      // If offline, calculate from local storage
      console.log('Offline mode: Calculating budget statistics from local storage');
      
      const budgets = await loadBudgetsLocally();
      
      const totalBudgeted = budgets.reduce((sum, budget) => sum + budget.amount, 0);
      const totalSpent = budgets.reduce((sum, budget) => sum + (budget.spent || 0), 0);
      
      const categoryTotals = budgets.reduce((acc, budget) => {
        const categoryId = budget.category;
        if (!acc[categoryId]) {
          acc[categoryId] = {
            budgeted: 0,
            spent: 0,
          };
        }
        acc[categoryId].budgeted += budget.amount;
        acc[categoryId].spent += budget.spent || 0;
        return acc;
      }, {} as Record<string, { budgeted: number; spent: number }>);
      
      return {
        totalBudgeted,
        totalSpent,
        remainingBudget: totalBudgeted - totalSpent,
        spendingPercentage: totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0,
        categoryBreakdown: categoryTotals,
      };
    }
  } catch (error) {
    console.error('Error getting budget statistics:', error);
    
    // Fallback to local calculation
    console.log('Falling back to local calculation for budget statistics');
    
    const budgets = await loadBudgetsLocally();
    
    const totalBudgeted = budgets.reduce((sum, budget) => sum + budget.amount, 0);
    const totalSpent = budgets.reduce((sum, budget) => sum + (budget.spent || 0), 0);
    
    return {
      totalBudgeted,
      totalSpent,
      remainingBudget: totalBudgeted - totalSpent,
      spendingPercentage: totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0,
      categoryBreakdown: {},
    };
  }
};

// Add a function to initialize network listeners
export const initNetworkListeners = () => {
  // Subscribe to network state changes
  const unsubscribe = NetInfo.addEventListener(state => {
    // When the network becomes available
    if (state.isConnected && state.isInternetReachable) {
      console.log('Network is available, synchronizing budgets...');
      syncQueueService.synchronizeBudgets();
    }
  });
  
  return unsubscribe;
}; 