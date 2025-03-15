import { supabase } from './supabaseClient';
import { Budget } from '../models/Budget';
import { generateUUID } from '../utils/helpers';

/**
 * Get the current user ID from Supabase auth
 * @returns Promise resolving to the current user ID or null if not authenticated
 */
const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return null;
  }
};

/**
 * Fetch all budgets for the current user
 * @returns Promise resolving to an array of budgets
 */
export const fetchBudgets = async (): Promise<Budget[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: budgets, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching budgets:', error);
      throw error;
    }

    // Transform the data to match the Budget model
    const transformedBudgets = (budgets || []).map(budget => ({
      id: budget.id,
      name: budget.name,
      amount: budget.amount,
      spent: budget.spent || 0,
      category: budget.category,
      color: budget.color,
      icon: budget.icon,
      createdAt: budget.created_at,
      updatedAt: budget.updated_at,
      user_id: budget.user_id,
      linkedExpenses: budget.linked_expenses,
      savingsAllocation: budget.savings_allocation,
      linkedSavingsGoals: budget.linked_savings_goals,
      autoSavePercentage: budget.auto_save_percentage,
      remainingAmount: budget.remaining_amount
    }));

    return transformedBudgets;
  } catch (error) {
    console.error('Error in fetchBudgets:', error);
    throw error;
  }
};

/**
 * Create a new budget in Supabase
 * @param budget Budget data without id, createdAt, updatedAt
 * @returns Promise resolving to the created budget
 */
export const createBudget = async (
  budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Budget> => {
  try {
    const now = new Date().toISOString();
    const userId = await getCurrentUserId();
    
    if (!userId) {
      throw new Error('User not authenticated. Cannot create budget.');
    }
    
    const newBudget = {
      ...budget,
      user_id: userId, // Add user_id to satisfy RLS policy
      created_at: now,
      updated_at: now,
    };
    
    const { data, error } = await supabase
      .from('budgets')
      .insert(newBudget)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating budget:', error);
      throw error;
    }
    
    if (!data) {
      throw new Error('No data returned from budget creation');
    }
    
    // Convert from Supabase format to app format
    return {
      id: data.id,
      name: data.name,
      amount: data.amount,
      spent: data.spent,
      category: data.category,
      color: data.color,
      icon: data.icon,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error in createBudget:', error);
    throw error;
  }
};

/**
 * Update an existing budget in Supabase
 * @param id Budget ID to update
 * @param budgetData Partial budget data to update
 * @returns Promise resolving to the updated budget
 */
export const updateBudget = async (
  id: string,
  budgetData: Partial<Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Budget> => {
  try {
    const updates = {
      ...budgetData,
      updated_at: new Date().toISOString(),
    };
    
    const { data, error } = await supabase
      .from('budgets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating budget:', error);
      throw error;
    }
    
    if (!data) {
      throw new Error(`Budget with ID ${id} not found`);
    }
    
    // Convert from Supabase format to app format
    return {
      id: data.id,
      name: data.name,
      amount: data.amount,
      spent: data.spent,
      category: data.category,
      color: data.color,
      icon: data.icon,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error in updateBudget:', error);
    throw error;
  }
};

/**
 * Delete a budget from Supabase
 * @param id Budget ID to delete
 * @returns Promise resolving to boolean indicating success
 */
export const deleteBudget = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting budget:', error);
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Error in deleteBudget:', error);
    throw error;
  }
};

/**
 * Get a budget by ID from Supabase
 * @param id Budget ID to retrieve
 * @returns Promise resolving to the budget or null if not found
 */
export const getBudgetById = async (id: string): Promise<Budget | null> => {
  try {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // PGRST116 is the error code for "no rows returned"
        return null;
      }
      console.error('Error getting budget by ID:', error);
      throw error;
    }
    
    if (!data) {
      return null;
    }
    
    // Convert from Supabase format to app format
    return {
      id: data.id,
      name: data.name,
      amount: data.amount,
      spent: data.spent,
      category: data.category,
      color: data.color,
      icon: data.icon,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('Error in getBudgetById:', error);
    throw error;
  }
};

/**
 * Update budget spending amount in Supabase
 * @param id Budget ID to update
 * @param amount Amount to add to spent (can be negative)
 * @returns Promise resolving to the updated budget
 */
export const updateBudgetSpending = async (
  id: string,
  amount: number
): Promise<Budget> => {
  try {
    // First get the current budget to calculate new spent amount
    const budget = await getBudgetById(id);
    
    if (!budget) {
      throw new Error(`Budget with ID ${id} not found`);
    }
    
    const newSpent = Math.max(0, (budget.spent || 0) + amount);
    return updateBudget(id, { spent: newSpent });
  } catch (error) {
    console.error('Error in updateBudgetSpending:', error);
    throw error;
  }
};

/**
 * Get budget statistics from Supabase
 * @returns Promise resolving to budget statistics
 */
export const getBudgetStatistics = async () => {
  try {
    const { data: budgets, error } = await supabase
      .from('budgets')
      .select('*');
    
    if (error) {
      console.error('Error fetching budgets for statistics:', error);
      throw error;
    }
    
    const totalBudgeted = budgets?.reduce((sum, budget) => sum + Number(budget.amount), 0) || 0;
    const totalSpent = budgets?.reduce((sum, budget) => sum + Number(budget.spent || 0), 0) || 0;
    
    const categoryTotals = budgets?.reduce((acc, budget) => {
      const categoryId = budget.category;
      if (!acc[categoryId]) {
        acc[categoryId] = {
          budgeted: 0,
          spent: 0,
        };
      }
      acc[categoryId].budgeted += Number(budget.amount);
      acc[categoryId].spent += Number(budget.spent || 0);
      return acc;
    }, {} as Record<string, { budgeted: number; spent: number }>) || {};
    
    return {
      totalBudgeted,
      totalSpent,
      remainingBudget: totalBudgeted - totalSpent,
      spendingPercentage: totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0,
      categoryBreakdown: categoryTotals,
    };
  } catch (error) {
    console.error('Error in getBudgetStatistics:', error);
    throw error;
  }
}; 