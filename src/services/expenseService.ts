import { Expense, ExpenseFilters, ExpenseStatistics, PaymentMethod } from '../models/Expense';
import { saveData, loadData, removeData, isOnline, addToPendingSync, saveExpenses, loadExpenses as loadExpensesFromStorage } from './offlineStorage';
import { generateUUID, groupBy } from '../utils/helpers';
import { updateBudgetSpending, loadBudgets } from './budgetService';
import { isMockDataEnabled, loadMockExpenses } from './mockDataService';
import { supabase } from '../api/supabaseClient';
import { addToSyncQueue } from './syncQueueService';
import { processAllSyncItems } from './syncQueueService';
import NetInfo from '@react-native-community/netinfo';
import * as expenseApi from '../api/expenseApi';
import { checkSupabaseConnection } from '../api/supabaseClient';
import { budgetService } from './budgetService';
import { getUserId } from './fixed/getUserId';

// Define SyncOperation enum locally to avoid circular dependencies
export enum SyncOperation {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

// Storage key
const EXPENSES_STORAGE_KEY = 'buzo_expenses';

class ExpenseService {
  private readonly tableName = 'expenses';

  async createExpense(
    expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> | {
      title: string;
      amount: number;
      date: string;
      category: string;
      categoryName?: string;
      description?: string;
      paymentMethod?: string;
      receiptImage?: string;
      tags?: string[];
      budgetId?: string;
    }
  ): Promise<Expense> {
    try {
      // Check if we're online
      const online = await isOnline();
      
      // Get user ID with offline support
      const userId = await getUserId();
      
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
      
      // Create the expense object with timestamps
      const now = new Date().toISOString();
      const newExpense: Expense = {
        id: expenseId,
        title: normalizedData.title,
        amount: normalizedData.amount,
        date: normalizedData.date,
        category: normalizedData.category,
        categoryName: normalizedData.categoryName,
        description: normalizedData.description,
        receiptImage: normalizedData.receiptImage,
        paymentMethod: normalizedData.paymentMethod,
        tags: normalizedData.tags,
        budgetId: normalizedData.budgetId,
        createdAt: now,
        updatedAt: now,
        user_id: userId
      };
      
      if (online) {
        try {
          // If online, create in Supabase
          const createdExpense = await expenseApi.createExpense(newExpense);
          
          // Save to local storage as well
          const storedExpenses = await loadExpensesFromStorage();
          await saveExpenses([...storedExpenses, createdExpense]);
          
          // Update budget if needed
          if (normalizedData.budgetId) {
            await this.updateRelatedBudget(createdExpense);
          }
          
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
        data: newExpense
      });
      
      // Update budget if needed (locally)
      if (normalizedData.budgetId) {
        await this.updateRelatedBudget(newExpense);
      }
      
      return newExpense;
    } catch (error) {
      console.error('Error in createExpense:', error);
      throw error;
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
      
      // If not found locally, try to get from Supabase
      const online = await isOnline();
      if (online) {
        try {
          const expense = await expenseApi.getExpenseById(id);
          
          // Save to local storage for future use
          if (expense) {
            const storedExpenses = await loadExpensesFromStorage();
            const updatedExpenses = storedExpenses.filter(e => e.id !== id);
            await saveExpenses(updatedExpenses);
          }
          
          return expense;
        } catch (error) {
          console.error('Error fetching expense from Supabase:', error);
          return null;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error in getExpense:', error);
      return null;
    }
  }

  async updateExpense(
    id: string, 
    updates: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Expense> {
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
      
      // Check if we're online
      const online = await isOnline();
      
      if (online) {
        try {
          // If online, update in Supabase
          const result = await expenseApi.updateExpense(id, updates);
          
          // Update local storage
          const storedExpenses = await loadExpensesFromStorage();
          const updatedExpenses = storedExpenses.map(e => 
            e.id === id ? updatedExpense : e
          );
          await saveExpenses(updatedExpenses);
          
          // Update budgets if amount or category changed
          if (
            (updates.amount !== undefined && updates.amount !== originalExpense.amount) ||
            (updates.category !== undefined && updates.category !== originalExpense.category) ||
            (updates.budgetId !== undefined && updates.budgetId !== originalExpense.budgetId)
          ) {
            await this.handleExpenseUpdate(originalExpense, updatedExpense);
          }
          
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
        data: updatedExpense
      });
      
      // Update budgets if needed (locally)
      if (
        (updates.amount !== undefined && updates.amount !== originalExpense.amount) ||
        (updates.category !== undefined && updates.category !== originalExpense.category) ||
        (updates.budgetId !== undefined && updates.budgetId !== originalExpense.budgetId)
      ) {
        await this.handleExpenseUpdate(originalExpense, updatedExpense);
      }
      
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
        console.warn(`Expense with ID ${id} not found, already deleted`);
        return true;
      }
      
      // Check if we're online
      const online = await isOnline();
      
      if (online) {
        try {
          // If online, delete from Supabase
          const success = await expenseApi.deleteExpense(id);
          
          if (success) {
            // Remove from local storage
            const storedExpenses = await loadExpensesFromStorage();
            const filteredExpenses = storedExpenses.filter(e => e.id !== id);
            await saveExpenses(filteredExpenses);
            
            // Update budget if this expense was linked to one
            if (expenseToDelete.budgetId) {
              await this.handleExpenseDeletion(expenseToDelete);
            }
            
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
        data: { id } // Only need the ID for deletion
      });
      
      // Update budget if this expense was linked to one (locally)
      if (expenseToDelete.budgetId) {
        await this.handleExpenseDeletion(expenseToDelete);
      }
      
      return true;
    } catch (error) {
      console.error('Error in deleteExpense:', error);
      return false;
    }
  }
  
  // Helper method to update budget when expense is created
  private async updateRelatedBudget(expense: Expense): Promise<void> {
    try {
      if (expense.budgetId) {
        await budgetService.updateBudgetSpending(expense.budgetId, expense.amount);
        await budgetService.linkExpenseToBudget(expense.budgetId, expense.id);
      } else if (expense.category) {
        // Try to find a budget by category
        const budgets = await loadBudgets();
        const matchingBudget = budgets.find(b => 
          b.category === expense.category || 
          (expense.categoryName && b.name.toLowerCase() === expense.categoryName.toLowerCase())
        );
        
        if (matchingBudget) {
          await budgetService.updateBudgetSpending(matchingBudget.id, expense.amount);
          await budgetService.linkExpenseToBudget(matchingBudget.id, expense.id);
        }
      }
    } catch (error) {
      console.warn('Error updating related budget:', error);
    }
  }
  
  // Helper method to handle expense updates that affect budgets
  private async handleExpenseUpdate(
    originalExpense: Expense, 
    updatedExpense: Expense
  ): Promise<void> {
    try {
      const amountChanged = updatedExpense.amount !== originalExpense.amount;
      const categoryChanged = updatedExpense.category !== originalExpense.category;
      const budgetIdChanged = updatedExpense.budgetId !== originalExpense.budgetId;
      
      // Handle budget ID change
      if (budgetIdChanged) {
        // Remove from old budget if it had one
        if (originalExpense.budgetId) {
          await budgetService.updateBudgetSpending(originalExpense.budgetId, -originalExpense.amount);
        }
        
        // Add to new budget if it has one
        if (updatedExpense.budgetId) {
          await budgetService.updateBudgetSpending(updatedExpense.budgetId, updatedExpense.amount);
          await budgetService.linkExpenseToBudget(updatedExpense.budgetId, updatedExpense.id);
        }
      } 
      // Handle category change
      else if (categoryChanged) {
        // Try to find budgets by category
        const budgets = await loadBudgets();
        
        // Find old category budget
        const oldBudget = budgets.find(b => 
          b.category === originalExpense.category || 
          (originalExpense.categoryName && b.name.toLowerCase() === originalExpense.categoryName.toLowerCase())
        );
        
        // Subtract from old budget
        if (oldBudget) {
          await budgetService.updateBudgetSpending(oldBudget.id, -originalExpense.amount);
        }
        
        // Find new category budget
        const newBudget = budgets.find(b => 
          b.category === updatedExpense.category || 
          (updatedExpense.categoryName && b.name.toLowerCase() === updatedExpense.categoryName.toLowerCase())
        );
        
        // Add to new budget
        if (newBudget) {
          await budgetService.updateBudgetSpending(newBudget.id, updatedExpense.amount);
          await budgetService.linkExpenseToBudget(newBudget.id, updatedExpense.id);
        }
      }
      // If only amount changed
      else if (amountChanged && originalExpense.budgetId) {
        // Calculate difference
        const amountDifference = updatedExpense.amount - originalExpense.amount;
        
        // Update budget with difference
        await budgetService.updateBudgetSpending(originalExpense.budgetId, amountDifference);
      }
    } catch (error) {
      console.warn('Error handling expense update for budgets:', error);
    }
  }
  
  // Helper method to handle expense deletion that affects budgets
  private async handleExpenseDeletion(expense: Expense): Promise<void> {
    try {
      if (expense.budgetId) {
        // Subtract the expense amount from the budget
        await budgetService.updateBudgetSpending(expense.budgetId, -expense.amount);
      }
    } catch (error) {
      console.warn('Error handling expense deletion for budgets:', error);
    }
  }
  
  // Get all expenses (with offline support)
  async getAllExpenses(): Promise<Expense[]> {
    try {
      let expenses: any[] = [];
      
      // Check if we're online
      const online = await isOnline();
      
      if (online) {
        try {
          // If online, get from Supabase
          expenses = await expenseApi.fetchExpenses();
          
          // Update local storage with fresh data
          await saveExpenses(expenses);
        } catch (error) {
          console.error('Error fetching expenses from Supabase:', error);
          // Fall back to local storage if Supabase fails
          expenses = await loadExpensesFromStorage();
        }
      } else {
        // Return from local storage if offline
        expenses = await loadExpensesFromStorage();
      }
      
      // Ensure proper type conversion for amounts
      return expenses.map(expense => ({
        ...expense,
        amount: typeof expense.amount === 'string' ? parseFloat(expense.amount) : (expense.amount || 0),
        // Ensure dates are in proper format
        date: expense.date ? new Date(expense.date).toISOString() : new Date().toISOString(),
        createdAt: expense.createdAt || new Date().toISOString(),
        updatedAt: expense.updatedAt || new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error in getAllExpenses:', error);
      return [];
    }
  }

  async getUserExpenses(userId: string, filters?: ExpenseFilters): Promise<Expense[]> {
    try {
      // Get all expenses
      const allExpenses = await this.getAllExpenses();
      
      // Filter by user ID
      let userExpenses = allExpenses.filter(e => e.user_id === userId);
      
      // Apply additional filters if provided
      if (filters) {
        userExpenses = this.applyExpenseFilters(userExpenses, filters);
      }
      
      return userExpenses;
    } catch (error) {
      console.error('Error in getUserExpenses:', error);
      return [];
    }
  }
  
  private applyExpenseFilters(expenses: Expense[], filters: ExpenseFilters): Expense[] {
    let filteredExpenses = [...expenses];
    
    // Filter by date range
    if (filters.startDate) {
      const startDate = new Date(filters.startDate).getTime();
      filteredExpenses = filteredExpenses.filter(e => new Date(e.date).getTime() >= startDate);
    }
    
    if (filters.endDate) {
      const endDate = new Date(filters.endDate).getTime();
      filteredExpenses = filteredExpenses.filter(e => new Date(e.date).getTime() <= endDate);
    }
    
    // Filter by categories
    if (filters.categories && filters.categories.length > 0) {
      filteredExpenses = filteredExpenses.filter(e => filters.categories!.includes(e.category));
    }
    
    // Filter by amount range
    if (filters.minAmount !== undefined) {
      filteredExpenses = filteredExpenses.filter(e => e.amount >= filters.minAmount!);
    }
    
    if (filters.maxAmount !== undefined) {
      filteredExpenses = filteredExpenses.filter(e => e.amount <= filters.maxAmount!);
    }
    
    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filteredExpenses = filteredExpenses.filter(e => 
        e.title.toLowerCase().includes(query) || 
        (e.description && e.description.toLowerCase().includes(query))
      );
    }
    
    // Filter by payment methods
    if (filters.paymentMethods && filters.paymentMethods.length > 0) {
      filteredExpenses = filteredExpenses.filter(e => 
        e.paymentMethod && filters.paymentMethods!.includes(e.paymentMethod)
      );
    }
    
    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      filteredExpenses = filteredExpenses.filter(e => 
        e.tags && e.tags.some(tag => filters.tags!.includes(tag))
      );
    }
    
    // Filter by budget IDs
    if (filters.budgetIds && filters.budgetIds.length > 0) {
      filteredExpenses = filteredExpenses.filter(e => 
        e.budgetId && filters.budgetIds!.includes(e.budgetId)
      );
    }
    
    // Filter by savings goal IDs
    if (filters.savingsGoalIds && filters.savingsGoalIds.length > 0) {
      filteredExpenses = filteredExpenses.filter(e => 
        e.linkedSavingsGoals && e.linkedSavingsGoals.some(goalId => 
          filters.savingsGoalIds!.includes(goalId)
        )
      );
    }
    
    // Filter by automated savings
    if (filters.includeAutomatedSavings !== undefined) {
      filteredExpenses = filteredExpenses.filter(e => 
        !!e.isAutomatedSaving === filters.includeAutomatedSavings
      );
    }
    
    return filteredExpenses;
  }

  async getExpenseStatistics(userId: string, filters?: ExpenseFilters): Promise<ExpenseStatistics> {
    const expenses = await this.getUserExpenses(userId, filters);
    
    const stats: ExpenseStatistics = {
      totalAmount: 0,
      categoryBreakdown: {},
      dailyExpenses: [],
      monthlyComparison: [],
      weeklyComparison: [],
      paymentMethodBreakdown: {},
      averageAmount: 0,
      expenseFrequency: 0,
      expenseCount: expenses.length,
      savingsProgress: {
        totalSaved: 0,
        goalProgress: {}
      },
      budgetImpact: {}
    };

    // Calculate basic statistics
    expenses.forEach(expense => {
      stats.totalAmount += expense.amount;
      
      // Category breakdown
      stats.categoryBreakdown[expense.category] = (stats.categoryBreakdown[expense.category] || 0) + expense.amount;
      
      // Payment method breakdown
      if (expense.paymentMethod) {
        stats.paymentMethodBreakdown[expense.paymentMethod] = 
          (stats.paymentMethodBreakdown[expense.paymentMethod] || 0) + expense.amount;
      }

      // Savings tracking
      if (expense.savingsContribution && expense.linkedSavingsGoals) {
        stats.savingsProgress.totalSaved += expense.savingsContribution;
        expense.linkedSavingsGoals.forEach(goalId => {
          if (!stats.savingsProgress.goalProgress[goalId]) {
            stats.savingsProgress.goalProgress[goalId] = {
              currentAmount: 0,
              targetAmount: 0,
              percentage: 0
            };
          }
          stats.savingsProgress.goalProgress[goalId].currentAmount += expense.savingsContribution;
        });
      }

      // Budget impact
      if (expense.budgetId) {
        if (!stats.budgetImpact[expense.budgetId]) {
          stats.budgetImpact[expense.budgetId] = {
            allocated: 0,
            spent: 0,
            remaining: 0,
            savingsAllocated: 0
          };
        }
        stats.budgetImpact[expense.budgetId].spent += expense.amount;
      }
    });
    
    // Calculate average amount
    stats.averageAmount = expenses.length > 0 ? stats.totalAmount / expenses.length : 0;
    
    // Group expenses by date
    const byDate = groupBy(expenses, e => 
      new Date(e.date).toISOString().split('T')[0]
    );
    
    // Calculate daily expenses
    stats.dailyExpenses = Object.entries(byDate).map(([date, dayExpenses]) => ({
      date,
      amount: dayExpenses.reduce((sum, e) => sum + e.amount, 0),
      count: dayExpenses.length
    }));
    
    // Sort by date
    stats.dailyExpenses.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Calculate monthly comparison (last 6 months)
    const byMonth = groupBy(expenses, e => {
      const date = new Date(e.date);
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    });
    
    stats.monthlyComparison = Object.entries(byMonth).map(([month, monthExpenses]) => ({
      month,
      amount: monthExpenses.reduce((sum, e) => sum + e.amount, 0)
    }));
    
    // Sort by month
    stats.monthlyComparison.sort((a, b) => a.month.localeCompare(b.month));
    
    // Keep only last 6 months
    if (stats.monthlyComparison.length > 6) {
      stats.monthlyComparison = stats.monthlyComparison.slice(-6);
    }
    
    // Calculate expense frequency (average number of expenses per day)
    if (expenses.length > 0) {
      const dateSet = new Set(expenses.map(e => 
        new Date(e.date).toISOString().split('T')[0]
      ));
      stats.expenseFrequency = expenses.length / dateSet.size;
    }
    
    // Enhance budget impact with data from budget service
    for (const budgetId in stats.budgetImpact) {
      try {
        const budget = await budgetService.getBudget(budgetId);
        if (budget) {
          stats.budgetImpact[budgetId].allocated = budget.amount;
          stats.budgetImpact[budgetId].remaining = budget.remainingAmount || 0;
          stats.budgetImpact[budgetId].savingsAllocated = budget.savingsAllocation || 0;
        }
      } catch (error) {
        console.warn(`Could not get budget info for ${budgetId}:`, error);
      }
    }
    
    return stats;
  }
}

// Create and export an instance of the expense service
export const expenseService = new ExpenseService();

// Exported functions for backward compatibility
export const createExpense = async (
  expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> | {
    title: string;
    amount: number;
    date: string;
    category: string;
    categoryName?: string;
    description?: string;
    paymentMethod?: string;
    receiptImage?: string;
    tags?: string[];
    budgetId?: string;
  },
  updateBudget = true
): Promise<Expense> => {
  return expenseService.createExpense(expenseData);
};

export const updateExpense = async (
  id: string,
  updates: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Expense> => {
  return expenseService.updateExpense(id, updates);
};

export const deleteExpense = async (id: string): Promise<boolean> => {
  return expenseService.deleteExpense(id);
};

export const getExpense = async (id: string): Promise<Expense | null> => {
  return expenseService.getExpense(id);
};

export const loadExpenses = async (): Promise<Expense[]> => {
  return expenseService.getAllExpenses();
};

export const getUserExpenses = async (userId: string, filters?: ExpenseFilters): Promise<Expense[]> => {
  return expenseService.getUserExpenses(userId, filters);
};

export const getExpenseStatisticsByUserId = async (userId: string, filters?: ExpenseFilters): Promise<ExpenseStatistics> => {
  return expenseService.getExpenseStatistics(userId, filters);
};

export const filterExpenses = async (filters: ExpenseFilters): Promise<Expense[]> => {
  // Get the current user ID
  const userId = await getUserId();
  if (!userId) {
    console.warn('No user ID available for filterExpenses');
    return [];
  }
  
  // Get user expenses with the specified filters
  return expenseService.getUserExpenses(userId, filters);
};

/**
 * Get expense statistics with date range parameters
 * Used by ExpenseAnalyticsScreen
 */
export const getExpenseStatistics = async (startDate: string, endDate: string) => {
  try {
    console.log('Getting expense statistics for date range:', { startDate, endDate });
    
    // Get the current user ID
    const userId = await getUserId();
    if (!userId) {
      console.warn('No user ID available for getExpenseStatistics');
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
        savingsProgress: {
          totalSaved: 0,
          goalProgress: {}
        },
        budgetImpact: {}
      };
    }
    
    // Call the original getExpenseStatistics with filters
    return expenseService.getExpenseStatistics(userId, {
      startDate,
      endDate
    });
  } catch (error) {
    console.error('Error in date-based getExpenseStatistics:', error);
    throw error;
  }
};

// Add saveExpensesLocally for consistent API across services
export const saveExpensesLocally = async (expenses: Expense[]): Promise<void> => {
  await saveExpenses(expenses);
};