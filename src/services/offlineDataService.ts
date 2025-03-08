import { Budget } from '../models/Budget';
import { Expense } from '../models/Expense';
import { SavingsGoal } from '../models/SavingsGoal';
import { 
  saveData, 
  loadData, 
  removeData, 
  isOnline, 
  addToPendingSync, 
  saveBudgets, 
  loadBudgets as loadBudgetsFromStorage,
  saveExpenses,
  loadExpenses as loadExpensesFromStorage,
  saveSavingsGoals,
  loadSavingsGoals as loadSavingsGoalsFromStorage
} from './offlineStorage';
import { addToSyncQueue } from './syncQueueService';
import { generateUUID } from '../utils/helpers';
import { supabase } from '../api/supabaseClient';
import * as budgetApi from '../api/budgetApi';
import * as expenseApi from '../api/expenseApi';
import * as savingsApi from '../api/savingsApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserId, initializeUserIdCache } from './fixed/getUserId';

// Timeout for Supabase requests when offline detection might be unreliable
const SUPABASE_REQUEST_TIMEOUT = 5000; // 5 seconds

/**
 * Initialize the offline data service.
 * This should be called when the app starts to cache important data for offline use.
 */
export async function initializeOfflineService(): Promise<void> {
  try {
    // Pre-cache the user ID
    await initializeUserIdCache();
    
    // Log initialization
    console.log('Offline data service initialized, user ID cached for offline use');
  } catch (error) {
    console.error('Error initializing offline data service:', error);
  }
}

/**
 * Creates a promise that rejects after a specified timeout
 * @param ms Timeout in milliseconds
 */
const timeoutPromise = (ms: number) => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timed out')), ms);
  });
};

/**
 * A service for managing offline-first data operations
 * All CRUD operations will work offline and sync when online
 */
class OfflineDataService {
  // BUDGET OPERATIONS
  async createBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'> | Budget): Promise<Budget> {
    try {
      // Get the user ID with offline support
      const userId = await getUserId();
      
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
      
      // Check if online
      const online = await isOnline();
      
      if (online) {
        try {
          // Try to create in Supabase
          const { data, error } = await supabase
            .from('budgets')
            .insert([newBudget])
            .select()
            .single();

          if (error) throw error;
          
          // Update local storage
          const storedBudgets = await loadBudgetsFromStorage();
          await saveBudgets([...storedBudgets, data as Budget]);
          
          return data as Budget;
        } catch (error) {
          console.error('Error creating budget in Supabase:', error);
          // Fall back to offline mode if Supabase fails
        }
      }
      
      // Store locally and add to sync queue
      const storedBudgets = await loadBudgetsFromStorage();
      await saveBudgets([...storedBudgets, newBudget]);
      
      // Add to sync queue for later synchronization
      await addToSyncQueue({
        id: budgetId,
        type: 'CREATE_BUDGET',
        entity: 'budget',
        data: newBudget,
        table: 'budgets'
      }, 2); // Higher priority (2) for budgets
      
      return newBudget;
    } catch (error) {
      console.error('Error in createBudget:', error);
      throw error;
    }
  }

  async updateBudget(budget: Budget): Promise<Budget> {
    try {
      if (!budget.id) {
        throw new Error('Budget ID is required for update');
      }
      
      // Update timestamp
      budget.updatedAt = new Date().toISOString();
      
      // Check if online
      const online = await isOnline();
      
      if (online) {
        try {
          // Try to update in Supabase
          const { data, error } = await supabase
            .from('budgets')
            .update(budget)
            .eq('id', budget.id)
            .select()
            .single();

          if (error) throw error;
          
          // Update local storage
          const storedBudgets = await loadBudgetsFromStorage();
          const updatedBudgets = storedBudgets.map(b => 
            b.id === budget.id ? budget : b
          );
          await saveBudgets(updatedBudgets);
          
          return data as Budget;
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
      await addToSyncQueue({
        id: budget.id,
        type: 'UPDATE_BUDGET',
        entity: 'budget',
        data: budget,
        table: 'budgets'
      }, 2); // Higher priority (2) for budgets
      
      return budget;
    } catch (error) {
      console.error('Error in updateBudget:', error);
      throw error;
    }
  }

  async deleteBudget(id: string): Promise<boolean> {
    try {
      // Check if online
      const online = await isOnline();
      
      if (online) {
        try {
          // Try to delete from Supabase
          const { error } = await supabase
            .from('budgets')
            .delete()
            .eq('id', id);

          if (error) throw error;
          
          // Remove from local storage
          const storedBudgets = await loadBudgetsFromStorage();
          const filteredBudgets = storedBudgets.filter(b => b.id !== id);
          await saveBudgets(filteredBudgets);
          
          return true;
        } catch (error) {
          console.error('Error deleting budget from Supabase:', error);
          // Fall back to offline mode if Supabase fails
        }
      }
      
      // Get the budget before deletion for the sync queue
      const storedBudgets = await loadBudgetsFromStorage();
      const budgetToDelete = storedBudgets.find(b => b.id === id);
      
      // Remove from local storage
      const filteredBudgets = storedBudgets.filter(b => b.id !== id);
      await saveBudgets(filteredBudgets);
      
      // Add to sync queue for later synchronization
      if (budgetToDelete) {
        await addToSyncQueue({
          id,
          type: 'DELETE_BUDGET',
          entity: 'budget',
          data: { id }, // Only need the ID for deletion
          table: 'budgets'
        }, 2); // Higher priority (2) for budgets
      }
      
      return true;
    } catch (error) {
      console.error('Error in deleteBudget:', error);
      return false;
    }
  }

  async getBudget(id: string): Promise<Budget | null> {
    try {
      // First try to get from local storage for fastest response
      const budgets = await loadBudgetsFromStorage();
      const localBudget = budgets.find(b => b.id === id);
      
      // If found locally, return it
      if (localBudget) {
        return localBudget;
      }
      
      // If not found locally and online, try to get from Supabase
      const online = await isOnline();
      if (online) {
        try {
          // Use a timeout to prevent hanging if Supabase is slow to respond
          const dataPromise = supabase
            .from('budgets')
            .select('*')
            .eq('id', id)
            .single();
            
          const result = await Promise.race([
            dataPromise,
            timeoutPromise(SUPABASE_REQUEST_TIMEOUT)
          ]);
          
          const { data, error } = result as any;
          
          if (error) {
            console.error('Error fetching budget from Supabase:', error);
            return null;
          }
          
          // Save to local storage for future use
          if (data) {
            const storedBudgets = await loadBudgetsFromStorage();
            const updatedBudgets = storedBudgets.filter(b => b.id !== id);
            await saveBudgets([...updatedBudgets, data as Budget]);
            return data as Budget;
          }
        } catch (error) {
          console.error('Error or timeout fetching budget from Supabase:', error);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error in getBudget:', error);
      return null;
    }
  }

  async getAllBudgets(): Promise<Budget[]> {
    try {
      // Always get local data first for immediate response
      const localBudgets = await loadBudgetsFromStorage();
      
      // Check if online
      const online = await isOnline();
      
      if (!online) {
        console.log('Device is offline, returning local budgets');
        return localBudgets;
      }
      
      try {
        // If online, try to get from Supabase with a timeout
        const dataPromise = supabase
          .from('budgets')
          .select('*')
          .order('created_at', { ascending: false });
          
        const result = await Promise.race([
          dataPromise,
          timeoutPromise(SUPABASE_REQUEST_TIMEOUT)
        ]);
        
        const { data, error } = result as any;
        
        if (error) {
          console.error('Error fetching budgets from Supabase:', error);
          return localBudgets;
        }
        
        // Update local storage with fresh data
        if (data) {
          await saveBudgets(data as Budget[]);
          return data as Budget[];
        }
      } catch (error) {
        console.error('Error or timeout fetching budgets from Supabase:', error);
        // Fall back to local storage if Supabase fails or times out
      }
      
      // Return local budgets if we couldn't get from Supabase
      return localBudgets;
    } catch (error) {
      console.error('Error in getAllBudgets:', error);
      return await loadBudgetsFromStorage(); // Always fall back to local storage on any error
    }
  }
  
  // EXPENSE OPERATIONS
  async createExpense(expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> {
    try {
      // Get the user ID with offline support
      const userId = await getUserId();
      
      // Generate ID if not provided
      const expenseId = generateUUID();
      
      // Create expense with timestamps and ID
      const now = new Date().toISOString();
      const newExpense: Expense = {
        ...expenseData,
        id: expenseId,
        createdAt: now,
        updatedAt: now,
        user_id: userId
      };
      
      // Check if online
      const online = await isOnline();
      
      if (online) {
        try {
          // Try to create in Supabase
          const createdExpense = await expenseApi.createExpense(newExpense);
          
          // Update local storage
          const storedExpenses = await loadExpensesFromStorage();
          await saveExpenses([...storedExpenses, createdExpense]);
          
          return createdExpense;
        } catch (error) {
          console.error('Error creating expense in Supabase:', error);
          // Fall back to offline mode if Supabase fails
        }
      }
      
      // Store locally and add to sync queue
      const storedExpenses = await loadExpensesFromStorage();
      await saveExpenses([...storedExpenses, newExpense]);
      
      // Add to sync queue for later synchronization
      await addToSyncQueue({
        id: expenseId,
        type: 'create',
        entity: 'expense',
        data: newExpense,
        table: 'expenses'
      });
      
      return newExpense;
    } catch (error) {
      console.error('Error in createExpense:', error);
      throw error;
    }
  }

  async updateExpense(id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Expense> {
    try {
      // Get the original expense
      const originalExpense = await this.getExpense(id);
      if (!originalExpense) {
        throw new Error(`Expense with ID ${id} not found`);
      }
      
      // Create updated expense
      const updatedExpense: Expense = {
        ...originalExpense,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      // Check if online
      const online = await isOnline();
      
      if (online) {
        try {
          // Try to update in Supabase
          const result = await expenseApi.updateExpense(id, updates);
          
          // Update local storage
          const storedExpenses = await loadExpensesFromStorage();
          const updatedExpenses = storedExpenses.map(e => 
            e.id === id ? updatedExpense : e
          );
          await saveExpenses(updatedExpenses);
          
          return result;
        } catch (error) {
          console.error('Error updating expense in Supabase:', error);
          // Fall back to offline mode if Supabase fails
        }
      }
      
      // Store locally and add to sync queue
      const storedExpenses = await loadExpensesFromStorage();
      const updatedExpenses = storedExpenses.map(e => 
        e.id === id ? updatedExpense : e
      );
      await saveExpenses(updatedExpenses);
      
      // Add to sync queue for later synchronization
      await addToSyncQueue({
        id,
        type: 'update',
        entity: 'expense',
        data: updatedExpense,
        table: 'expenses'
      });
      
      return updatedExpense;
    } catch (error) {
      console.error('Error in updateExpense:', error);
      throw error;
    }
  }

  async deleteExpense(id: string): Promise<boolean> {
    try {
      // Get the expense before deletion
      const expenseToDelete = await this.getExpense(id);
      if (!expenseToDelete) {
        return true; // Already deleted
      }
      
      // Check if online
      const online = await isOnline();
      
      if (online) {
        try {
          // Try to delete from Supabase
          const success = await expenseApi.deleteExpense(id);
          
          if (success) {
            // Remove from local storage
            const storedExpenses = await loadExpensesFromStorage();
            const filteredExpenses = storedExpenses.filter(e => e.id !== id);
            await saveExpenses(filteredExpenses);
            
            return true;
          }
          
          return false;
        } catch (error) {
          console.error('Error deleting expense from Supabase:', error);
          // Fall back to offline mode if Supabase fails
        }
      }
      
      // Remove from local storage
      const storedExpenses = await loadExpensesFromStorage();
      const filteredExpenses = storedExpenses.filter(e => e.id !== id);
      await saveExpenses(filteredExpenses);
      
      // Add to sync queue for later synchronization
      await addToSyncQueue({
        id,
        type: 'delete',
        entity: 'expense',
        data: { id }, // Only need the ID for deletion
        table: 'expenses'
      });
      
      return true;
    } catch (error) {
      console.error('Error in deleteExpense:', error);
      return false;
    }
  }

  async getExpense(id: string): Promise<Expense | null> {
    try {
      // First try to get from local storage for fastest response
      const expenses = await loadExpensesFromStorage();
      const localExpense = expenses.find(e => e.id === id);
      
      // If found locally, return it
      if (localExpense) {
        return localExpense;
      }
      
      // If not found locally and online, try to get from Supabase
      const online = await isOnline();
      if (online) {
        try {
          // Use a timeout to prevent hanging if the API is slow to respond
          const expensePromise = expenseApi.getExpenseById(id);
          
          const expense = await Promise.race([
            expensePromise,
            timeoutPromise(SUPABASE_REQUEST_TIMEOUT)
          ]);
          
          // Save to local storage for future use
          if (expense) {
            const storedExpenses = await loadExpensesFromStorage();
            const updatedExpenses = storedExpenses.filter(e => e.id !== id);
            await saveExpenses([...updatedExpenses, expense]);
          }
          
          return expense as Expense;
        } catch (error) {
          console.error('Error or timeout fetching expense from Supabase:', error);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error in getExpense:', error);
      return null;
    }
  }

  async getAllExpenses(): Promise<Expense[]> {
    try {
      // Always get local data first for immediate response
      const localExpenses = await loadExpensesFromStorage();
      
      // Check if online
      const online = await isOnline();
      
      if (!online) {
        console.log('Device is offline, returning local expenses');
        return localExpenses;
      }
      
      try {
        // If online, try to get from Supabase with a timeout
        const expensesPromise = expenseApi.fetchExpenses();
        
        const expenses = await Promise.race([
          expensesPromise,
          timeoutPromise(SUPABASE_REQUEST_TIMEOUT)
        ]);
        
        // Update local storage with fresh data
        await saveExpenses(expenses as Expense[]);
        
        return expenses as Expense[];
      } catch (error) {
        console.error('Error or timeout fetching expenses from Supabase:', error);
        // Fall back to local storage if Supabase fails or times out
      }
      
      // Return local expenses if we couldn't get from Supabase
      return localExpenses;
    } catch (error) {
      console.error('Error in getAllExpenses:', error);
      return await loadExpensesFromStorage(); // Always fall back to local storage on any error
    }
  }
  
  // SAVINGS GOAL OPERATIONS
  async createSavingsGoal(goalData: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavingsGoal> {
    try {
      // Get the user ID with offline support
      const userId = await getUserId();
      
      // Generate ID if not provided
      const goalId = generateUUID();
      
      // Create savings goal with timestamps and ID
      const now = new Date().toISOString();
      const newGoal: SavingsGoal = {
        ...goalData,
        id: goalId,
        createdAt: now,
        updatedAt: now,
        user_id: userId
      };
      
      // Check if online
      const online = await isOnline();
      
      if (online) {
        try {
          // Try to create in Supabase
          const { data, error } = await supabase
            .from('savings_goals')
            .insert([newGoal])
            .select()
            .single();

          if (error) throw error;
          
          // Update local storage
          const storedGoals = await loadSavingsGoalsFromStorage();
          await saveSavingsGoals([...storedGoals, data as SavingsGoal]);
          
          return data as SavingsGoal;
        } catch (error) {
          console.error('Error creating savings goal in Supabase:', error);
          // Fall back to offline mode if Supabase fails
        }
      }
      
      // Store locally and add to sync queue
      const storedGoals = await loadSavingsGoalsFromStorage();
      await saveSavingsGoals([...storedGoals, newGoal]);
      
      // Add to sync queue for later synchronization
      await addToSyncQueue({
        id: goalId,
        type: 'CREATE_SAVINGS_GOAL',
        entity: 'savings',
        data: newGoal,
        table: 'savings_goals'
      }, 2); // Higher priority (2) for savings goals
      
      return newGoal;
    } catch (error) {
      console.error('Error in createSavingsGoal:', error);
      throw error;
    }
  }

  async updateSavingsGoal(goal: SavingsGoal): Promise<SavingsGoal> {
    try {
      if (!goal.id) {
        throw new Error('Savings goal ID is required for update');
      }
      
      // Update timestamp
      goal.updatedAt = new Date().toISOString();
      
      // Check if online
      const online = await isOnline();
      
      if (online) {
        try {
          // Try to update in Supabase
          const { data, error } = await supabase
            .from('savings_goals')
            .update(goal)
            .eq('id', goal.id)
            .select()
            .single();

          if (error) throw error;
          
          // Update local storage
          const storedGoals = await loadSavingsGoalsFromStorage();
          const updatedGoals = storedGoals.map(g => 
            g.id === goal.id ? goal : g
          );
          await saveSavingsGoals(updatedGoals);
          
          return data as SavingsGoal;
        } catch (error) {
          console.error('Error updating savings goal in Supabase:', error);
          // Fall back to offline mode if Supabase fails
        }
      }
      
      // Store locally and add to sync queue
      const storedGoals = await loadSavingsGoalsFromStorage();
      const updatedGoals = storedGoals.map(g => 
        g.id === goal.id ? goal : g
      );
      await saveSavingsGoals(updatedGoals);
      
      // Add to sync queue for later synchronization
      await addToSyncQueue({
        id: goal.id,
        type: 'UPDATE_SAVINGS_GOAL',
        entity: 'savings',
        data: goal,
        table: 'savings_goals'
      }, 2); // Higher priority (2) for savings goals
      
      return goal;
    } catch (error) {
      console.error('Error in updateSavingsGoal:', error);
      throw error;
    }
  }

  async deleteSavingsGoal(id: string): Promise<boolean> {
    try {
      // Check if online
      const online = await isOnline();
      
      if (online) {
        try {
          // Try to delete from Supabase
          const { error } = await supabase
            .from('savings_goals')
            .delete()
            .eq('id', id);

          if (error) throw error;
          
          // Remove from local storage
          const storedGoals = await loadSavingsGoalsFromStorage();
          const filteredGoals = storedGoals.filter(g => g.id !== id);
          await saveSavingsGoals(filteredGoals);
          
          return true;
        } catch (error) {
          console.error('Error deleting savings goal from Supabase:', error);
          // Fall back to offline mode if Supabase fails
        }
      }
      
      // Get the goal before deletion for the sync queue
      const storedGoals = await loadSavingsGoalsFromStorage();
      const goalToDelete = storedGoals.find(g => g.id === id);
      
      // Remove from local storage
      const filteredGoals = storedGoals.filter(g => g.id !== id);
      await saveSavingsGoals(filteredGoals);
      
      // Add to sync queue for later synchronization
      if (goalToDelete) {
        await addToSyncQueue({
          id,
          type: 'DELETE_SAVINGS_GOAL',
          entity: 'savings',
          data: { id }, // Only need the ID for deletion
          table: 'savings_goals'
        }, 2); // Higher priority (2) for savings goals
      }
      
      return true;
    } catch (error) {
      console.error('Error in deleteSavingsGoal:', error);
      return false;
    }
  }

  async getSavingsGoal(id: string): Promise<SavingsGoal | null> {
    try {
      // First try to get from local storage for fastest response
      const goals = await loadSavingsGoalsFromStorage();
      const localGoal = goals.find(g => g.id === id);
      
      // If found locally, return it
      if (localGoal) {
        return localGoal;
      }
      
      // If not found locally and online, try to get from Supabase
      const online = await isOnline();
      if (online) {
        try {
          // Use a timeout to prevent hanging if Supabase is slow to respond
          const dataPromise = supabase
            .from('savings_goals')
            .select('*')
            .eq('id', id)
            .single();
            
          const result = await Promise.race([
            dataPromise,
            timeoutPromise(SUPABASE_REQUEST_TIMEOUT)
          ]);
          
          const { data, error } = result as any;
          
          if (error) {
            console.error('Error fetching savings goal from Supabase:', error);
            return null;
          }
          
          // Save to local storage for future use
          if (data) {
            const storedGoals = await loadSavingsGoalsFromStorage();
            const updatedGoals = storedGoals.filter(g => g.id !== id);
            await saveSavingsGoals([...updatedGoals, data as SavingsGoal]);
            return data as SavingsGoal;
          }
        } catch (error) {
          console.error('Error or timeout fetching savings goal from Supabase:', error);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error in getSavingsGoal:', error);
      return null;
    }
  }

  async getAllSavingsGoals(): Promise<SavingsGoal[]> {
    try {
      // Always get local data first for immediate response
      const localGoals = await loadSavingsGoalsFromStorage();
      
      // Check if online
      const online = await isOnline();
      
      if (!online) {
        console.log('Device is offline, returning local savings goals');
        return localGoals;
      }
      
      try {
        // If online, try to get from Supabase with a timeout
        const dataPromise = supabase
          .from('savings_goals')
          .select('*')
          .order('created_at', { ascending: false });
          
        const result = await Promise.race([
          dataPromise,
          timeoutPromise(SUPABASE_REQUEST_TIMEOUT)
        ]);
        
        const { data, error } = result as any;
        
        if (error) {
          console.error('Error fetching savings goals from Supabase:', error);
          return localGoals;
        }
        
        // Update local storage with fresh data
        if (data) {
          await saveSavingsGoals(data as SavingsGoal[]);
          return data as SavingsGoal[];
        }
      } catch (error) {
        console.error('Error or timeout fetching savings goals from Supabase:', error);
        // Fall back to local storage if Supabase fails or times out
      }
      
      // Return local goals if we couldn't get from Supabase
      return localGoals;
    } catch (error) {
      console.error('Error in getAllSavingsGoals:', error);
      return await loadSavingsGoalsFromStorage(); // Always fall back to local storage on any error
    }
  }
}

// Export a singleton instance of the service and initialization function
export const offlineDataService = new OfflineDataService(); 