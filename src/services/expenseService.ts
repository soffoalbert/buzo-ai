import { Expense, ExpenseFilters, ExpenseStatistics, PaymentMethod } from '../models/Expense';
import { saveData, loadData, removeData } from './offlineStorage';
import { generateUUID, groupBy } from '../utils/helpers';
import { updateBudgetSpending, loadBudgets } from './budgetService';
import { isMockDataEnabled, loadMockExpenses } from './mockDataService';
import { supabase } from '../api/supabaseClient';
import { addToSyncQueue } from './syncQueueService';
import { processAllSyncItems } from './syncQueueService';
import NetInfo from '@react-native-community/netinfo';
import * as expenseApi from '../api/expenseApi';
import { checkSupabaseConnection } from '../api/supabaseClient';

// Define SyncOperation enum locally to avoid circular dependencies
export enum SyncOperation {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

// Storage keys
const EXPENSES_STORAGE_KEY = 'buzo_expenses';

/**
 * Check if the device is online
 * @returns Promise resolving to boolean indicating online status
 */
const isOnline = async (): Promise<boolean> => {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected === true && netInfo.isInternetReachable === true;
};

/**
 * Save expenses to local storage
 * @param expenses Array of expenses to save
 * @returns Promise resolving to the saved expenses
 */
export const saveExpenses = async (expenses: Expense[]): Promise<Expense[]> => {
  try {
    await saveData(EXPENSES_STORAGE_KEY, expenses);
    return expenses;
  } catch (error) {
    console.error('Error saving expenses:', error);
    throw new Error('Failed to save expenses');
  }
};

/**
 * Load expenses from local storage
 * @returns Promise resolving to array of expenses or empty array if none found
 */
export const loadExpenses = async (): Promise<Expense[]> => {
  try {
    // Check if mock data is enabled
    const mockEnabled = await isMockDataEnabled();
    
    if (mockEnabled) {
      // Load mock expenses
      return await loadMockExpenses();
    } else {
      // Load real expenses
      const expenses = await loadData<Expense[]>(EXPENSES_STORAGE_KEY);
      return expenses || [];
    }
  } catch (error) {
    console.error('Error loading expenses:', error);
    return [];
  }
};

/**
 * Fetch expenses from Supabase
 * @returns Promise resolving to array of expenses from Supabase
 */
export const fetchExpensesFromSupabase = async (): Promise<Expense[]> => {
  try {
    // Use the expenseApi instead of direct Supabase calls
    return await expenseApi.fetchExpenses();
  } catch (error) {
    console.error('Error in fetchExpensesFromSupabase:', error);
    throw error;
  }
};

/**
 * Sync local expenses with Supabase
 * This will fetch the latest expenses from Supabase and merge them with local ones
 * @returns Promise resolving to the synced expenses
 */
export const syncExpenses = async (): Promise<Expense[]> => {
  try {
    // Only sync if online
    const online = await isOnline();
    if (!online) {
      console.log('Device is offline, skipping expense sync');
      return await loadExpenses();
    }
    
    // Fetch from Supabase using the API
    const supabaseExpenses = await expenseApi.fetchExpenses();
    
    // Load local expenses
    const localExpenses = await loadExpenses();
    
    // Create a map of expenses by ID for easier lookup
    const expenseMap = new Map<string, Expense>();
    
    // Add all Supabase expenses to the map
    supabaseExpenses.forEach(expense => {
      expenseMap.set(expense.id, expense);
    });
    
    // Add or update with local expenses (local takes precedence for now)
    localExpenses.forEach(expense => {
      expenseMap.set(expense.id, expense);
    });
    
    // Convert map back to array
    const mergedExpenses = Array.from(expenseMap.values());
    
    // Save merged expenses locally
    await saveExpenses(mergedExpenses);
    
    return mergedExpenses;
  } catch (error) {
    console.error('Error syncing expenses:', error);
    // Fall back to local expenses
    return await loadExpenses();
  }
};

/**
 * Create a new expense
 * @param expenseData Expense data without id, createdAt, updatedAt
 * @param updateBudget Whether to update the associated budget's spent amount
 * @returns Promise resolving to the created expense
 */
export const createExpense = async (
  expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> | {
    title: string;
    amount: number;
    date: string;
    category: string;
    description?: string;
    paymentMethod?: string;
    receiptImage?: string;
    tags?: string[];
  },
  updateBudget = true
): Promise<Expense> => {
  try {
    // Check if we're online and can connect to Supabase
    const online = await checkSupabaseConnection();
    
    // Get the current user from Supabase auth
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    
    if (!userId) {
      throw new Error('User not authenticated. Cannot create expense.');
    }
    
    // Convert string paymentMethod to PaymentMethod enum if needed
    const normalizedData = {
      ...expenseData,
      paymentMethod: expenseData.paymentMethod as PaymentMethod | undefined
    };
    
    // Generate a new UUID for the expense
    const expenseId = generateUUID();
    
    if (online) {
      // If online, create in Supabase using the API
      try {
        const newExpense = await expenseApi.createExpense(normalizedData);
        
        // Update local storage
        const currentExpenses = await loadExpenses();
        await saveExpenses([...currentExpenses, newExpense]);
        
        // Update budget spending if requested and category is provided
        if (updateBudget && newExpense.category) {
          try {
            // Find budget by category instead of using category as ID
            const budgets = await loadBudgets();
            const matchingBudget = budgets.find(budget => 
              budget.category.toLowerCase() === newExpense.category.toLowerCase()
            );
            
            if (matchingBudget) {
              await updateBudgetSpending(matchingBudget.id, newExpense.amount);
            } else {
              console.warn(`No budget found for category: ${newExpense.category}`);
            }
          } catch (error) {
            console.warn('Could not update budget spending:', error);
          }
        }
        
        // Transform to Supabase format for sync queue
        const supabaseFormat = {
          id: newExpense.id,
          title: newExpense.title,
          amount: newExpense.amount,
          date: new Date(newExpense.date).toISOString(),
          category: newExpense.category,
          description: newExpense.description || null,
          payment_method: newExpense.paymentMethod || null,
          receipt_image_path: newExpense.receiptImage || null,
          tags: newExpense.tags || null,
          created_at: new Date(newExpense.createdAt).toISOString(),
          updated_at: new Date(newExpense.updatedAt).toISOString(),
          user_id: userId // Add user_id to satisfy RLS policy
        };
        
        // Queue for sync when back online
        await addToSyncQueue({
          id: newExpense.id,
          type: 'create',
          entity: 'expense',
          table: 'expenses',
          data: supabaseFormat,
        }, 5); // Higher priority for expenses
        
        return newExpense;
      } catch (apiError: any) {
        // Check if this is a duplicate key error
        if (apiError.code === '23505' || (apiError.message && apiError.message.includes('duplicate key'))) {
          console.log('Expense already exists in Supabase, fetching existing record');
          
          // Try to extract the ID from the error message if possible
          let existingId = '';
          const idMatch = /id: ([a-f0-9-]+)/i.exec(apiError.message);
          if (idMatch && idMatch[1]) {
            existingId = idMatch[1];
          }
          
          // If we have an ID, try to fetch the existing expense
          if (existingId) {
            try {
              const existingExpense = await expenseApi.getExpenseById(existingId);
              if (existingExpense) {
                // Update local storage with the existing expense
                const currentExpenses = await loadExpenses();
                const updatedExpenses = currentExpenses.filter(e => e.id !== existingId);
                await saveExpenses([...updatedExpenses, existingExpense]);
                return existingExpense;
              }
            } catch (fetchError) {
              console.error('Error fetching existing expense:', fetchError);
            }
          }
          
          // If we couldn't fetch the existing expense, create a new one with a different ID
          console.log('Creating expense with a new ID to avoid conflict');
          const newData = {
            ...normalizedData,
            id: `new_${generateUUID()}` // Use a different ID
          };
          return await createExpense(newData, updateBudget);
        }
        
        // If it's not a duplicate key error, rethrow
        throw apiError;
      }
    } else {
      // If offline, create locally and queue for sync
      console.log('Offline mode: Creating expense locally');
      
      const now = new Date().toISOString();
      const newExpense: Expense = {
        id: `local_${expenseId}`, // Use a prefix to identify locally created expenses
        createdAt: now,
        updatedAt: now,
        ...normalizedData,
      };
      
      // Save locally
      const currentExpenses = await loadExpenses();
      await saveExpenses([...currentExpenses, newExpense]);
      
      // Transform to Supabase format for sync queue
      const supabaseFormat = {
        id: newExpense.id,
        title: newExpense.title,
        amount: newExpense.amount,
        date: new Date(newExpense.date).toISOString(),
        category: newExpense.category,
        description: newExpense.description || null,
        payment_method: newExpense.paymentMethod || null,
        receipt_image_path: newExpense.receiptImage || null,
        tags: newExpense.tags || null,
        created_at: new Date(newExpense.createdAt).toISOString(),
        updated_at: new Date(newExpense.updatedAt).toISOString(),
        user_id: userId // Add user_id to satisfy RLS policy
      };
      
      // Queue for sync when back online
      await addToSyncQueue({
        id: newExpense.id,
        type: 'create',
        entity: 'expense',
        table: 'expenses',
        data: supabaseFormat,
      }, 5); // Higher priority for expenses
      
      // Update budget spending if requested and category is provided
      if (updateBudget && newExpense.category) {
        try {
          // Find budget by category instead of using category as ID
          const budgets = await loadBudgets();
          const matchingBudget = budgets.find(budget => 
            budget.category.toLowerCase() === newExpense.category.toLowerCase()
          );
          
          if (matchingBudget) {
            await updateBudgetSpending(matchingBudget.id, newExpense.amount);
          } else {
            console.warn(`No budget found for category: ${newExpense.category}`);
          }
        } catch (error) {
          console.warn('Could not update budget spending:', error);
        }
      }
      
      return newExpense;
    }
  } catch (error) {
    console.error('Error creating expense:', error);
    throw error;
  }
};

/**
 * Update an existing expense
 * @param id Expense ID to update
 * @param expenseData Partial expense data to update
 * @returns Promise resolving to the updated expense
 */
export const updateExpense = async (
  id: string,
  expenseData: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>> | {
    title?: string;
    amount?: number;
    date?: string;
    category?: string;
    description?: string;
    paymentMethod?: string;
    receiptImage?: string;
    tags?: string[];
  }
): Promise<Expense> => {
  try {
    // Check if we're online and can connect to Supabase
    const online = await checkSupabaseConnection();
    
    // Get the current user from Supabase auth
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    
    if (!userId) {
      throw new Error('User not authenticated. Cannot update expense.');
    }
    
    // Convert string paymentMethod to PaymentMethod enum if needed
    const normalizedData = {
      ...expenseData,
      paymentMethod: expenseData.paymentMethod as PaymentMethod | undefined
    };
    
    // Get the original expense to compare changes
    const originalExpense = await getExpenseById(id);
    if (!originalExpense) {
      throw new Error(`Expense with ID ${id} not found`);
    }
    
    if (online) {
      // If online, update in Supabase using the API
      const updatedExpense = await expenseApi.updateExpense(id, normalizedData);
      
      // Update local storage
      const currentExpenses = await loadExpenses();
      const updatedExpenses = currentExpenses.map(expense => 
        expense.id === id ? updatedExpense : expense
      );
      await saveExpenses(updatedExpenses);
      
      // Update budget spending if amount or category changed
      if (
        (normalizedData.amount !== undefined && normalizedData.amount !== originalExpense.amount) ||
        (normalizedData.category !== undefined && normalizedData.category !== originalExpense.category)
      ) {
        try {
          // If category changed, update both old and new category budgets
          if (normalizedData.category !== undefined && normalizedData.category !== originalExpense.category) {
            // Find old category budget
            const budgets = await loadBudgets();
            const oldBudget = budgets.find(budget => 
              budget.category.toLowerCase() === originalExpense.category.toLowerCase()
            );
            
            // Subtract the original amount from the old budget
            if (oldBudget) {
              await updateBudgetSpending(oldBudget.id, -originalExpense.amount);
            }
            
            // Find new category budget
            const newBudget = budgets.find(budget => 
              budget.category.toLowerCase() === normalizedData.category!.toLowerCase()
            );
            
            // Add the new amount to the new budget
            if (newBudget) {
              await updateBudgetSpending(newBudget.id, normalizedData.amount || originalExpense.amount);
            }
          } 
          // If only amount changed, update the current category budget
          else if (normalizedData.amount !== undefined) {
            const budgets = await loadBudgets();
            const budget = budgets.find(budget => 
              budget.category.toLowerCase() === originalExpense.category.toLowerCase()
            );
            
            if (budget) {
              // Calculate the difference and update
              const amountDifference = normalizedData.amount - originalExpense.amount;
              await updateBudgetSpending(budget.id, amountDifference);
            }
          }
        } catch (error) {
          console.warn('Could not update budget spending:', error);
        }
      }
      
      // Transform to Supabase format for sync queue
      const supabaseFormat = {
        id: updatedExpense.id,
        title: updatedExpense.title,
        amount: updatedExpense.amount,
        date: new Date(updatedExpense.date).toISOString(),
        category: updatedExpense.category,
        description: updatedExpense.description || null,
        payment_method: updatedExpense.paymentMethod || null,
        receipt_image_path: updatedExpense.receiptImage || null,
        tags: updatedExpense.tags || null,
        updated_at: new Date(updatedExpense.updatedAt).toISOString(),
        user_id: userId // Add user_id to satisfy RLS policy
      };
      
      // Queue for sync when back online
      await addToSyncQueue({
        id: updatedExpense.id,
        type: 'update',
        entity: 'expense',
        table: 'expenses',
        data: supabaseFormat,
      }, 3); // Medium priority for updates
      
      return updatedExpense;
    } else {
      // If offline, update locally and queue for sync
      console.log('Offline mode: Updating expense locally');
      
      const currentExpenses = await loadExpenses();
      const expenseIndex = currentExpenses.findIndex(expense => expense.id === id);
      
      if (expenseIndex === -1) {
        throw new Error(`Expense with ID ${id} not found`);
      }
      
      const currentExpense = currentExpenses[expenseIndex];
      const now = new Date().toISOString();
      
      const updatedExpense: Expense = {
        ...currentExpense,
        ...normalizedData,
        updatedAt: now,
      };
      
      // Save locally
      currentExpenses[expenseIndex] = updatedExpense;
      await saveExpenses(currentExpenses);
      
      // Update budget spending if amount or category changed
      if (
        (normalizedData.amount !== undefined && normalizedData.amount !== originalExpense.amount) ||
        (normalizedData.category !== undefined && normalizedData.category !== originalExpense.category)
      ) {
        try {
          // If category changed, update both old and new category budgets
          if (normalizedData.category !== undefined && normalizedData.category !== originalExpense.category) {
            // Find old category budget
            const budgets = await loadBudgets();
            const oldBudget = budgets.find(budget => 
              budget.category.toLowerCase() === originalExpense.category.toLowerCase()
            );
            
            // Subtract the original amount from the old budget
            if (oldBudget) {
              await updateBudgetSpending(oldBudget.id, -originalExpense.amount);
            }
            
            // Find new category budget
            const newBudget = budgets.find(budget => 
              budget.category.toLowerCase() === normalizedData.category!.toLowerCase()
            );
            
            // Add the new amount to the new budget
            if (newBudget) {
              await updateBudgetSpending(newBudget.id, normalizedData.amount || originalExpense.amount);
            }
          } 
          // If only amount changed, update the current category budget
          else if (normalizedData.amount !== undefined) {
            const budgets = await loadBudgets();
            const budget = budgets.find(budget => 
              budget.category.toLowerCase() === originalExpense.category.toLowerCase()
            );
            
            if (budget) {
              // Calculate the difference and update
              const amountDifference = normalizedData.amount - originalExpense.amount;
              await updateBudgetSpending(budget.id, amountDifference);
            }
          }
        } catch (error) {
          console.warn('Could not update budget spending:', error);
        }
      }
      
      // Transform to Supabase format for sync queue
      const supabaseFormat = {
        id: updatedExpense.id,
        title: updatedExpense.title,
        amount: updatedExpense.amount,
        date: new Date(updatedExpense.date).toISOString(),
        category: updatedExpense.category,
        description: updatedExpense.description || null,
        payment_method: updatedExpense.paymentMethod || null,
        receipt_image_path: updatedExpense.receiptImage || null,
        tags: updatedExpense.tags || null,
        updated_at: new Date(updatedExpense.updatedAt).toISOString(),
        user_id: userId // Add user_id to satisfy RLS policy
      };
      
      // Queue for sync when back online
      await addToSyncQueue({
        id: updatedExpense.id,
        type: 'update',
        entity: 'expense',
        table: 'expenses',
        data: supabaseFormat,
      }, 3); // Medium priority for updates
      
      return updatedExpense;
    }
  } catch (error) {
    console.error('Error updating expense:', error);
    throw error;
  }
};

/**
 * Delete an expense
 * @param id Expense ID to delete
 * @returns Promise resolving to boolean indicating success
 */
export const deleteExpense = async (id: string): Promise<boolean> => {
  try {
    // Check if we're online and can connect to Supabase
    const online = await checkSupabaseConnection();
    
    // Get the current user from Supabase auth
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    
    if (!userId) {
      throw new Error('User not authenticated. Cannot delete expense.');
    }
    
    if (online) {
      // If online, delete from Supabase using the API
      await expenseApi.deleteExpense(id);
      
      // Update local storage
      const currentExpenses = await loadExpenses();
      const updatedExpenses = currentExpenses.filter(expense => expense.id !== id);
      await saveExpenses(updatedExpenses);
      
      // Queue for sync when back online - for delete operations, we need the ID and user_id
      await addToSyncQueue({
        id: id,
        type: 'delete',
        entity: 'expense',
        table: 'expenses',
        data: { 
          id,
          user_id: userId // Add user_id to satisfy RLS policy
        },
      }, 4); // Higher priority for deletes
      
      return true;
    } else {
      // If offline, mark as deleted locally and queue for sync
      console.log('Offline mode: Deleting expense locally');
      
      const currentExpenses = await loadExpenses();
      const expense = currentExpenses.find(expense => expense.id === id);
      
      if (!expense) {
        throw new Error(`Expense with ID ${id} not found`);
      }
      
      // Remove from local storage
      const updatedExpenses = currentExpenses.filter(expense => expense.id !== id);
      await saveExpenses(updatedExpenses);
      
      // Queue for sync when back online - for delete operations, we need the ID and user_id
      await addToSyncQueue({
        id: id,
        type: 'delete',
        entity: 'expense',
        table: 'expenses',
        data: { 
          id,
          user_id: userId // Add user_id to satisfy RLS policy
        },
      }, 4); // Higher priority for deletes
      
      return true;
    }
  } catch (error) {
    console.error('Error deleting expense:', error);
    
    // If there's an error, still add to sync queue to retry later
    try {
      // Get the current user from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      if (userId) {
        await addToSyncQueue({
          id: id,
          type: 'delete',
          entity: 'expense',
          table: 'expenses',
          data: { 
            id,
            user_id: userId // Add user_id to satisfy RLS policy
          },
        }, 4); // Higher priority for deletes
      }
    } catch (syncError) {
      console.error('Error adding delete operation to sync queue:', syncError);
    }
    
    throw error;
  }
};

/**
 * Get an expense by ID
 * @param id Expense ID to retrieve
 * @returns Promise resolving to the expense or null if not found
 */
export const getExpenseById = async (id: string): Promise<Expense | null> => {
  try {
    // First check local storage
    const expenses = await loadExpenses();
    const localExpense = expenses.find(expense => expense.id === id);
    
    if (localExpense) {
      return localExpense;
    }
    
    // If not found locally and we're online, try to fetch from Supabase
    const online = await isOnline();
    if (online) {
      try {
        const expense = await expenseApi.getExpenseById(id);
        return expense;
      } catch (error) {
        console.error(`Error fetching expense ${id} from Supabase:`, error);
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting expense by ID ${id}:`, error);
    return null;
  }
};

/**
 * Filter expenses based on criteria
 * @param filters Filters to apply
 * @returns Promise resolving to filtered expenses
 */
export const filterExpenses = async (
  filters: ExpenseFilters
): Promise<Expense[]> => {
  const expenses = await loadExpenses();
  
  return expenses.filter(expense => {
    // Filter by date range
    if (filters.startDate && new Date(expense.date) < new Date(filters.startDate)) {
      return false;
    }
    if (filters.endDate && new Date(expense.date) > new Date(filters.endDate)) {
      return false;
    }
    
    // Filter by categories
    if (
      filters.categories &&
      filters.categories.length > 0 &&
      !filters.categories.includes(expense.category)
    ) {
      return false;
    }
    
    // Filter by amount range
    if (filters.minAmount && expense.amount < filters.minAmount) {
      return false;
    }
    if (filters.maxAmount && expense.amount > filters.maxAmount) {
      return false;
    }
    
    // Filter by search query (title or description)
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const titleMatch = expense.title.toLowerCase().includes(query);
      const descriptionMatch = expense.description
        ? expense.description.toLowerCase().includes(query)
        : false;
      
      if (!titleMatch && !descriptionMatch) {
        return false;
      }
    }
    
    // Filter by payment methods
    if (
      filters.paymentMethods &&
      filters.paymentMethods.length > 0 &&
      expense.paymentMethod &&
      !filters.paymentMethods.includes(expense.paymentMethod)
    ) {
      return false;
    }
    
    // Filter by tags
    if (
      filters.tags &&
      filters.tags.length > 0 &&
      expense.tags &&
      !expense.tags.some(tag => filters.tags!.includes(tag))
    ) {
      return false;
    }
    
    return true;
  });
};

/**
 * Get expense statistics
 * @param startDate Optional start date for statistics
 * @param endDate Optional end date for statistics
 * @returns Promise resolving to expense statistics
 */
export const getExpenseStatistics = async (
  startDate?: string,
  endDate?: string
): Promise<ExpenseStatistics> => {
  try {
    // Check if we're online and can connect to Supabase
    const online = await checkSupabaseConnection();
    
    if (online) {
      // If online, try to get statistics from Supabase using the API
      try {
        const stats = await expenseApi.getExpenseStatistics(startDate, endDate);
        
        // Transform the API response to match our ExpenseStatistics model
        // This is a simplified version - you may need to adapt it based on what expenseApi.getExpenseStatistics returns
        return {
          totalAmount: stats.totalAmount,
          categoryBreakdown: stats.categoryBreakdown,
          dailyExpenses: Object.entries(stats.dateBreakdown || {}).map(([date, amount]) => ({
            date,
            amount: Number(amount), // Explicitly convert to number
            count: 0, // We don't have this information from the API
          })),
          monthlyComparison: [], // Need to calculate this from dateBreakdown
          weeklyComparison: [], // Need to calculate this from dateBreakdown
          paymentMethodBreakdown: {}, // Not available from the API
          averageAmount: stats.averageAmount,
          expenseFrequency: 0, // Not available from the API
          expenseCount: stats.expenseCount,
        };
      } catch (error) {
        console.error('Error getting expense statistics from API:', error);
        // Fall back to calculating from local expenses
      }
    }
    
    // Calculate statistics from local expenses
    let expenses = await loadExpenses();
    
    // Filter by date range if provided
    if (startDate || endDate) {
      expenses = expenses.filter(expense => {
        // Ensure we're working with a valid date object
        let expenseDate;
        try {
          // Handle both timestamp and ISO string formats
          if (typeof expense.date === 'number') {
            expenseDate = new Date(expense.date);
          } else {
            expenseDate = new Date(expense.date);
          }
          
          // Check if the date is valid
          if (isNaN(expenseDate.getTime())) {
            console.warn(`Invalid date format for expense: ${expense.id}, date: ${expense.date}`);
            return false;
          }
          
          // Apply date filters
          if (startDate && expenseDate < new Date(startDate)) {
            return false;
          }
          if (endDate && expenseDate > new Date(endDate)) {
            return false;
          }
          return true;
        } catch (error) {
          console.error(`Error parsing date for expense: ${expense.id}`, error);
          return false;
        }
      });
    }
    
    // Calculate total amount
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Calculate category breakdown
    const categoryBreakdown = expenses.reduce((acc, expense) => {
      const category = expense.category;
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += expense.amount;
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate daily expenses
    const dailyExpenses = Object.entries(
      groupBy(expenses, expense => expense.date.split('T')[0])
    ).map(([date, expenses]) => ({
      date,
      amount: expenses.reduce((sum, expense) => sum + expense.amount, 0),
      count: expenses.length,
    }));
    
    // Calculate monthly comparison
    const monthlyExpenses = expenses.reduce((acc, expense) => {
      const month = expense.date.substring(0, 7); // YYYY-MM format
      if (!acc[month]) {
        acc[month] = 0;
      }
      acc[month] += expense.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const monthlyComparison = Object.entries(monthlyExpenses).map(
      ([month, amount]) => ({
        month,
        amount,
      })
    );
    
    // Calculate weekly comparison
    const weeklyExpenses = expenses.reduce((acc, expense) => {
      // Get the week number and year
      const date = new Date(expense.date);
      const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
      const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
      const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      const weekKey = `${date.getFullYear()}-W${weekNumber}`;
      
      if (!acc[weekKey]) {
        acc[weekKey] = 0;
      }
      acc[weekKey] += expense.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const weeklyComparison = Object.entries(weeklyExpenses).map(
      ([week, amount]) => ({
        week,
        amount,
      })
    );
    
    // Calculate payment method breakdown
    const paymentMethodBreakdown = expenses.reduce((acc, expense) => {
      const method = expense.paymentMethod || 'unknown';
      if (!acc[method]) {
        acc[method] = 0;
      }
      acc[method] += expense.amount;
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate average expense amount
    const averageAmount = totalAmount / (expenses.length || 1);
    
    // Calculate expense frequency (expenses per day)
    const uniqueDays = new Set(expenses.map(expense => expense.date.split('T')[0])).size;
    const expenseFrequency = uniqueDays > 0 ? expenses.length / uniqueDays : 0;
    
    return {
      totalAmount,
      categoryBreakdown,
      dailyExpenses,
      monthlyComparison,
      weeklyComparison,
      paymentMethodBreakdown,
      averageAmount,
      expenseFrequency,
      expenseCount: expenses.length,
    };
  } catch (error) {
    console.error('Error getting expense statistics:', error);
    // Return empty statistics
    return {
      totalAmount: 0,
      categoryBreakdown: {},
      dailyExpenses: [],
      monthlyComparison: [],
      weeklyComparison: [],
      paymentMethodBreakdown: {},
      averageAmount: 0,
      expenseFrequency: 0,
      expenseCount: 0,
    };
  }
};

/**
 * Manually sync expenses to Supabase
 * This can be called after creating an expense to ensure it's immediately synced
 */
export const syncExpensesToSupabase = async (): Promise<void> => {
  try {
    const online = await isOnline();
    if (!online) {
      console.log('Cannot sync expenses: Device is offline');
      return;
    }
    
    await processAllSyncItems();
  } catch (error) {
    console.error('Error syncing expenses to Supabase:', error);
  }
};