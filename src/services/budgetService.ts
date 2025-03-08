import { Budget, BudgetCategory, DEFAULT_BUDGET_CATEGORIES } from '../models/Budget';
import { saveData, loadData, removeData, addToPendingSync, isOnline, saveBudgets, loadBudgets as loadBudgetsFromStorage } from './offlineStorage';
import { generateUUID } from '../utils/helpers';
import * as budgetApi from '../api/budgetApi';
import { checkSupabaseConnection } from '../api/supabaseClient';
import syncQueueService from './syncQueueService';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../api/supabaseClient';
import { getUserId } from './fixed/getUserId';

// Storage keys
const BUDGETS_STORAGE_KEY = 'buzo_budgets';
const BUDGET_CATEGORIES_STORAGE_KEY = 'buzo_budget_categories';

class BudgetService {
  private readonly tableName = 'budgets';

  async createBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'> | Budget): Promise<Budget> {
    try {
      // Check if online
      const online = await isOnline();
      
      // Get the user ID with offline support
      const userId = await getUserId();
      
      if (!userId) {
        throw new Error('User not authenticated. Cannot create budget.');
      }

      // Generate ID if not provided
      const budgetId = (budget as any).id || generateUUID();
      
      // Create budget with timestamps and ID
      const now = new Date().toISOString();
      const newBudget: Budget = {
        ...(budget as any),
        id: budgetId,
        createdAt: now,
        updatedAt: now,
        user_id: userId,
        spent: (budget as any).spent || 0,
        remainingAmount: (budget as any).remainingAmount !== undefined ? 
          (budget as any).remainingAmount : 
          (budget as any).amount - ((budget as any).spent || 0) - ((budget as any).savingsAllocation || 0)
      };
      
      if (online) {
        try {
          // If online, create in Supabase
          const { data, error } = await supabase
            .from(this.tableName)
            .insert([{
              ...newBudget
            }])
            .select()
            .single();

          if (error) throw error;
          
          // Also update local storage
          const storedBudgets = await loadBudgetsFromStorage();
          await saveBudgets([...storedBudgets, newBudget]);
          
          return data;
        } catch (error) {
          console.error('Error creating budget in Supabase:', error);
          // Fall back to offline mode if Supabase fails
        }
      }
      
      // Store locally and add to sync queue
      const storedBudgets = await loadBudgetsFromStorage();
      await saveBudgets([...storedBudgets, newBudget]);
      
      // Add to sync queue for later synchronization
      await syncQueueService.addToSyncQueue({
        id: budgetId,
        type: 'CREATE_BUDGET',
        entity: 'budget',
        data: newBudget,
        table: this.tableName
      }, 2); // Higher priority (2) for budgets
      
      return newBudget;
    } catch (error) {
      console.error('Error in createBudget:', error);
      throw error;
    }
  }

  async getBudget(id: string): Promise<Budget | null> {
    try {
      // First try to get from local storage for fastest response
      const budgets = await loadBudgetsFromStorage();
      const localBudget = budgets.find(b => b.id === id);
      
      // If found locally and not in offline mode, return it
      if (localBudget) {
        return localBudget;
      }
      
      // If not found locally, try to get from Supabase
      const online = await isOnline();
      if (online) {
        const { data, error } = await supabase
          .from(this.tableName)
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) {
          console.error('Error fetching budget from Supabase:', error);
          // Return null if not found online either
          return null;
        }
        
        // Save to local storage for future use
        if (data) {
          const storedBudgets = await loadBudgetsFromStorage();
          const updatedBudgets = storedBudgets.filter(b => b.id !== id);
          await saveBudgets([...updatedBudgets, data]);
          return data;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error in getBudget:', error);
      return null;
    }
  }

  async updateBudget(budget: Budget): Promise<Budget> {
    try {
      if (!budget.id) {
        throw new Error('Budget ID is required for update');
      }
      
      // Update timestamp
      budget.updatedAt = new Date().toISOString();
      
      // Check online status
      const online = await isOnline();
      
      if (online) {
        try {
          // If online, update in Supabase
          const { data, error } = await supabase
            .from(this.tableName)
            .update(budget)
            .eq('id', budget.id)
            .select()
            .single();

          if (error) throw error;
          
          // Also update local storage
          const storedBudgets = await loadBudgetsFromStorage();
          const updatedBudgets = storedBudgets.map(b => 
            b.id === budget.id ? budget : b
          );
          await saveBudgets(updatedBudgets);
          
          return data;
        } catch (error) {
          console.error('Error updating budget in Supabase:', error);
          // Fall back to offline mode if Supabase fails
        }
      }
      
      // Store locally and add to sync queue
      const storedBudgets = await loadBudgetsFromStorage();
      const updatedBudgets = storedBudgets.map(b => 
        b.id === budget.id ? budget : b
      );
      await saveBudgets(updatedBudgets);
      
      // Add to sync queue for later synchronization
      await syncQueueService.addToSyncQueue({
        id: budget.id,
        type: 'UPDATE_BUDGET',
        entity: 'budget',
        data: budget,
        table: this.tableName
      }, 2); // Higher priority (2) for budgets
      
      return budget;
    } catch (error) {
      console.error('Error in updateBudget:', error);
      throw error;
    }
  }

  async deleteBudget(id: string): Promise<boolean> {
    try {
      // Check online status
      const online = await isOnline();
      
      if (online) {
        try {
          // If online, delete from Supabase
          const { error } = await supabase
            .from(this.tableName)
            .delete()
            .eq('id', id);

          if (error) throw error;
          
          // Also remove from local storage
          const storedBudgets = await loadBudgetsFromStorage();
          const filteredBudgets = storedBudgets.filter(b => b.id !== id);
          await saveBudgets(filteredBudgets);
          
          return true;
        } catch (error) {
          console.error('Error deleting budget from Supabase:', error);
          // Fall back to offline mode if Supabase fails
        }
      }
      
      // Remove from local storage
      const storedBudgets = await loadBudgetsFromStorage();
      const filteredBudgets = storedBudgets.filter(b => b.id !== id);
      await saveBudgets(filteredBudgets);
      
      // Get the budget before deletion for the sync queue
      const budgetToDelete = storedBudgets.find(b => b.id === id);
      
      // Add to sync queue for later synchronization
      if (budgetToDelete) {
        await syncQueueService.addToSyncQueue({
          id,
          type: 'DELETE_BUDGET',
          entity: 'budget',
          data: { id }, // Only need the ID for deletion
          table: this.tableName
        }, 2); // Higher priority (2) for budgets
      }
      
      return true;
    } catch (error) {
      console.error('Error in deleteBudget:', error);
      return false;
    }
  }

  // Integration methods
  async updateBudgetSpending(budgetId: string, amount: number): Promise<Budget> {
    const budget = await this.getBudget(budgetId);
    if (!budget) throw new Error('Budget not found');

    budget.spent += amount;
    budget.remainingAmount = budget.amount - budget.spent - (budget.savingsAllocation || 0);
    return this.updateBudget(budget);
  }

  async linkExpenseToBudget(budgetId: string, expenseId: string): Promise<Budget> {
    const budget = await this.getBudget(budgetId);
    if (!budget) throw new Error('Budget not found');

    budget.linkedExpenses = [...(budget.linkedExpenses || []), expenseId];
    return this.updateBudget(budget);
  }

  async linkSavingsGoalToBudget(budgetId: string, goalId: string, autoSavePercentage?: number): Promise<Budget> {
    const budget = await this.getBudget(budgetId);
    if (!budget) throw new Error('Budget not found');

    budget.linkedSavingsGoals = [...(budget.linkedSavingsGoals || []), goalId];
    if (autoSavePercentage !== undefined) {
      budget.autoSavePercentage = autoSavePercentage;
      const savingsAmount = (budget.amount * autoSavePercentage) / 100;
      budget.savingsAllocation = savingsAmount;
      budget.remainingAmount = budget.amount - budget.spent - savingsAmount;
    }
    return this.updateBudget(budget);
  }

  async getBudgetAnalytics(budgetId: string) {
    const budget = await this.getBudget(budgetId);
    if (!budget) throw new Error('Budget not found');

    return {
      totalAllocated: budget.amount,
      totalSpent: budget.spent,
      totalSaved: budget.savingsAllocation || 0,
      remaining: budget.remainingAmount || 0,
      utilizationPercentage: (budget.spent / budget.amount) * 100,
      savingsPercentage: ((budget.savingsAllocation || 0) / budget.amount) * 100
    };
  }

  // Get all budgets (with offline support)
  async getAllBudgets(): Promise<Budget[]> {
    try {
      // Check online status
      const online = await isOnline();
      
      if (online) {
        try {
          // If online, get from Supabase
          const { data, error } = await supabase
            .from(this.tableName)
            .select('*')
            .order('createdAt', { ascending: false });

          if (error) throw error;
          
          // Update local storage with fresh data
          if (data) {
            await saveBudgets(data);
            return data;
          }
        } catch (error) {
          console.error('Error fetching budgets from Supabase:', error);
          // Fall back to local storage if Supabase fails
        }
      }
      
      // Return from local storage
      return await loadBudgetsFromStorage();
    } catch (error) {
      console.error('Error in getAllBudgets:', error);
      return [];
    }
  }

  async getUserBudgets(userId: string): Promise<Budget[]> {
    try {
      // Check if online
      const online = await isOnline();
      
      if (online) {
        try {
          // If online, try to get from Supabase
          const { data, error } = await supabase
            .from(this.tableName)
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (error) throw error;
          
          // Update local storage with fresh data
          if (data) {
            await saveBudgets(data as Budget[]);
            return data as Budget[];
          }
        } catch (error) {
          console.error('Error fetching budgets from Supabase:', error);
          // Fall back to local storage if Supabase fails
        }
      }
      
      // If offline or Supabase failed, get from local storage and filter by user ID
      const localBudgets = await loadBudgetsFromStorage();
      return localBudgets.filter(budget => budget.user_id === userId);
    } catch (error) {
      console.error('Error in getUserBudgets:', error);
      return [];
    }
  }
}

export const budgetService = new BudgetService();

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
      // Get the current user from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // If online, fetch from Supabase using getUserBudgets
      const budgetService = new BudgetService();
      console.log(`Fetching budgets from Supabase for user ${user.id}`);
      const budgets = await budgetService.getAllBudgets();
      
      // Save to local storage for offline access
      console.log(`Saving ${budgets.length} budgets to local storage for offline access`);
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
    const online = await isOnline();
    
    if (online) {
      // If online, create in Supabase
      const newBudget = await budgetApi.createBudget(budgetData);
      
      // Update local storage
      const currentBudgets = await loadBudgetsLocally();
      await saveBudgetsLocally([...currentBudgets, newBudget]);
      
      // Queue for sync when back online
      await syncQueueService.addToSyncQueue({
        id: newBudget.id,
        type: 'CREATE_BUDGET',
        data: newBudget,
        entity: 'budget'
      }, 5); // Higher priority for budgets
      
      return newBudget;
    } else {
      // If offline, create locally and queue for sync
      console.log('Offline mode: Creating budget locally');
      
      // Get the user ID with offline support
      const userId = await getUserId();
      
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
        entity: 'budget'
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
      
      // Queue for sync when back online
      await syncQueueService.addToSyncQueue({
        id: updatedBudget.id,
        type: 'UPDATE_BUDGET',
        data: updatedBudget,
        entity: 'budget'
      }, 5); // Higher priority for budgets
      
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
        data: updatedBudget,
        entity: 'budget'
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
      await syncQueueService.addToSyncQueue({
        id,
        type: 'DELETE_BUDGET',
        data: { id },
        entity: 'budget'
      }, 5); // Higher priority for budgets
      
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

/**
 * Get all budget categories with spending information
 * @returns Promise resolving to array of budget categories with additional fields
 */
export const getBudgetCategories = async (): Promise<(BudgetCategory & { 
  limit: number; 
  alerts?: string[]; 
})[]> => {
  try {
    // Load budget categories
    const categories = await loadBudgetCategories();
    
    // Load budgets for spending information
    const budgets = await loadBudgets();
    
    // Enhance categories with spending and limit information
    return categories.map(category => {
      // Find all budgets for this category
      const categoryBudgets = budgets.filter(budget => 
        budget.category === category.id || 
        budget.category.toLowerCase() === category.name.toLowerCase()
      );
      
      // Calculate total budget limit for the category
      const limit = categoryBudgets.reduce((total, budget) => total + budget.amount, 0);
      
      // Add any alerts that have been sent (default to empty array)
      const alerts = categoryBudgets.reduce((allAlerts, budget) => {
        if (budget.alerts) {
          return [...allAlerts, ...budget.alerts];
        }
        return allAlerts;
      }, [] as string[]);
      
      return {
        ...category,
        limit: limit || 0,
        alerts: [...new Set(alerts)] // Remove duplicates
      };
    });
  } catch (error) {
    console.error('Error getting budget categories with spending:', error);
    return [];
  }
};

/**
 * Get current spending for a specific category
 * @param categoryId The budget category ID
 * @returns Promise resolving to the total spent amount for the category
 */
export const getCategorySpending = async (categoryId: string): Promise<number> => {
  try {
    // Load budgets
    const budgets = await loadBudgets();
    
    // Find all budgets for this category
    const categoryBudgets = budgets.filter(budget => 
      budget.category === categoryId
    );
    
    // Sum up the spent amounts
    return categoryBudgets.reduce((total, budget) => total + (budget.spent || 0), 0);
  } catch (error) {
    console.error(`Error getting spending for category ${categoryId}:`, error);
    return 0;
  }
};

/**
 * Get a specific budget category by ID
 * @param categoryId The budget category ID
 * @returns Promise resolving to the budget category or null if not found
 */
export const getBudgetCategory = async (categoryId: string): Promise<BudgetCategory | null> => {
  try {
    const categories = await loadBudgetCategories();
    return categories.find(cat => cat.id === categoryId) || null;
  } catch (error) {
    console.error(`Error getting budget category ${categoryId}:`, error);
    return null;
  }
};

/**
 * Update a budget category
 * @param categoryId The category ID to update
 * @param categoryData Updated category data
 * @returns Promise resolving to the updated category
 */
export const updateBudgetCategory = async (
  categoryId: string,
  categoryData: Partial<BudgetCategory & { alerts?: string[] }>
): Promise<BudgetCategory> => {
  try {
    const categories = await loadBudgetCategories();
    const index = categories.findIndex(cat => cat.id === categoryId);
    
    if (index === -1) {
      throw new Error(`Budget category with ID ${categoryId} not found`);
    }
    
    // Create updated category
    const updatedCategory = {
      ...categories[index],
      ...categoryData,
    };
    
    // Replace in array
    categories[index] = updatedCategory;
    
    // Save to storage
    await saveBudgetCategories(categories);
    
    return updatedCategory;
  } catch (error) {
    console.error(`Error updating budget category ${categoryId}:`, error);
    throw error;
  }
};

// Add loadBudgetsLocally method to the existing budgetService instance
Object.assign(budgetService, {
  loadBudgetsLocally,
  getUserBudgetsOffline: async (userId: string) => {
    try {
      // If offline, filter local budgets by user_id
      const budgets = await loadBudgetsLocally();
      return budgets.filter(budget => budget.user_id === userId);
    } catch (error) {
      console.error('Error fetching user budgets offline:', error);
      return [];
    }
  }
});

// Also add this exported function for backward compatibility
export const getUserBudgets = async (userId: string): Promise<Budget[]> => {
  return budgetService.getUserBudgets(userId);
}; 