import { supabase } from './supabaseClient';
import { Expense } from '../models/Expense';
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
 * Fetch all expenses for the current user
 * @returns Promise resolving to an array of expenses
 */
export const fetchExpenses = async (): Promise<Expense[]> => {
  try {
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching expenses:', error);
      throw error;
    }

    if (!expenses) {
      return [];
    }

    // Transform Supabase data to match our Expense model
    return expenses.map(item => ({
      id: item.id,
      title: item.title,
      amount: Number(item.amount),
      date: new Date(item.date).toISOString(),
      category: item.category,
      description: item.description || undefined,
      receiptImage: item.receipt_image_path || undefined,
      paymentMethod: item.payment_method || undefined,
      tags: item.tags || undefined,
      createdAt: new Date(item.created_at).toISOString(),
      updatedAt: new Date(item.updated_at).toISOString()
    }));
  } catch (error) {
    console.error('Error in fetchExpenses:', error);
    throw error;
  }
};

/**
 * Create a new expense in Supabase
 * @param expense Expense data without id, createdAt, updatedAt
 * @returns Promise resolving to the created expense
 */
export const createExpense = async (
  expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Expense> => {
  try {
    const now = new Date().toISOString();
    const userId = await getCurrentUserId();
    
    if (!userId) {
      throw new Error('User not authenticated. Cannot create expense.');
    }
    
    // Generate a new UUID or use the provided one if it exists
    const expenseId = (expense as any).id || generateUUID();
    
    // Check if an expense with this ID already exists
    if ((expense as any).id) {
      try {
        const { data: existingExpense } = await supabase
          .from('expenses')
          .select('*')
          .eq('id', expenseId)
          .single();
          
        if (existingExpense) {
          console.log(`Expense with ID ${expenseId} already exists, returning existing record`);
          
          // Convert from Supabase format to app format and return
          return {
            id: existingExpense.id,
            title: existingExpense.title,
            amount: Number(existingExpense.amount),
            date: new Date(existingExpense.date).toISOString(),
            category: existingExpense.category,
            description: existingExpense.description || undefined,
            receiptImage: existingExpense.receipt_image_path || undefined,
            paymentMethod: existingExpense.payment_method || undefined,
            tags: existingExpense.tags || undefined,
            createdAt: new Date(existingExpense.created_at).toISOString(),
            updatedAt: new Date(existingExpense.updated_at).toISOString()
          };
        }
      } catch (checkError) {
        // If there's an error checking, just continue with creation
        console.log('Error checking for existing expense, proceeding with creation:', checkError);
      }
    }
    
    const newExpense = {
      id: expenseId,
      title: expense.title,
      amount: expense.amount,
      date: new Date(expense.date),
      category: expense.category,
      description: expense.description || null,
      payment_method: expense.paymentMethod || null,
      tags: expense.tags || null,
      receipt_image_path: expense.receiptImage || null,
      user_id: userId, // Add user_id to satisfy RLS policy
      created_at: now,
      updated_at: now,
    };
    
    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert(newExpense)
        .select()
        .single();
      
      if (error) {
        // Check if this is a duplicate key error
        if (error.code === '23505' || error.message.includes('duplicate key')) {
          console.log(`Duplicate key error for expense ${expenseId}, fetching existing record`);
          
          // Fetch the existing record
          const { data: existingData, error: fetchError } = await supabase
            .from('expenses')
            .select('*')
            .eq('id', expenseId)
            .single();
            
          if (fetchError) {
            console.error('Error fetching existing expense after duplicate key error:', fetchError);
            throw error; // Throw the original error
          }
          
          if (!existingData) {
            throw new Error(`Could not find existing expense with ID ${expenseId} after duplicate key error`);
          }
          
          // Convert from Supabase format to app format
          return {
            id: existingData.id,
            title: existingData.title,
            amount: Number(existingData.amount),
            date: new Date(existingData.date).toISOString(),
            category: existingData.category,
            description: existingData.description || undefined,
            receiptImage: existingData.receipt_image_path || undefined,
            paymentMethod: existingData.payment_method || undefined,
            tags: existingData.tags || undefined,
            createdAt: new Date(existingData.created_at).toISOString(),
            updatedAt: new Date(existingData.updated_at).toISOString()
          };
        }
        
        console.error('Error creating expense:', error);
        throw error;
      }
      
      if (!data) {
        throw new Error('No data returned from expense creation');
      }
      
      // Convert from Supabase format to app format
      return {
        id: data.id,
        title: data.title,
        amount: Number(data.amount),
        date: new Date(data.date).toISOString(),
        category: data.category,
        description: data.description || undefined,
        receiptImage: data.receipt_image_path || undefined,
        paymentMethod: data.payment_method || undefined,
        tags: data.tags || undefined,
        createdAt: new Date(data.created_at).toISOString(),
        updatedAt: new Date(data.updated_at).toISOString()
      };
    } catch (insertError) {
      console.error('Error in expense insert operation:', insertError);
      throw insertError;
    }
  } catch (error) {
    console.error('Error in createExpense:', error);
    throw error;
  }
};

/**
 * Update an existing expense in Supabase
 * @param id Expense ID to update
 * @param expenseData Partial expense data to update
 * @returns Promise resolving to the updated expense
 */
export const updateExpense = async (
  id: string,
  expenseData: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Expense> => {
  try {
    // Transform to Supabase format
    const updates: any = {
      updated_at: new Date().toISOString()
    };
    
    if (expenseData.title !== undefined) updates.title = expenseData.title;
    if (expenseData.amount !== undefined) updates.amount = expenseData.amount;
    if (expenseData.date !== undefined) updates.date = new Date(expenseData.date);
    if (expenseData.category !== undefined) updates.category = expenseData.category;
    if (expenseData.description !== undefined) updates.description = expenseData.description || null;
    if (expenseData.paymentMethod !== undefined) updates.payment_method = expenseData.paymentMethod || null;
    if (expenseData.tags !== undefined) updates.tags = expenseData.tags || null;
    if (expenseData.receiptImage !== undefined) updates.receipt_image_path = expenseData.receiptImage || null;
    
    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
    
    if (!data) {
      throw new Error(`Expense with ID ${id} not found`);
    }
    
    // Convert from Supabase format to app format
    return {
      id: data.id,
      title: data.title,
      amount: Number(data.amount),
      date: new Date(data.date).toISOString(),
      category: data.category,
      description: data.description || undefined,
      receiptImage: data.receipt_image_path || undefined,
      paymentMethod: data.payment_method || undefined,
      tags: data.tags || undefined,
      createdAt: new Date(data.created_at).toISOString(),
      updatedAt: new Date(data.updated_at).toISOString()
    };
  } catch (error) {
    console.error('Error in updateExpense:', error);
    throw error;
  }
};

/**
 * Delete an expense from Supabase
 * @param id Expense ID to delete
 * @returns Promise resolving to boolean indicating success
 */
export const deleteExpense = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Error in deleteExpense:', error);
    throw error;
  }
};

/**
 * Get an expense by ID from Supabase
 * @param id Expense ID to retrieve
 * @returns Promise resolving to the expense or null if not found
 */
export const getExpenseById = async (id: string): Promise<Expense | null> => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // PGRST116 is the error code for "no rows returned"
        return null;
      }
      console.error('Error getting expense by ID:', error);
      throw error;
    }
    
    if (!data) {
      return null;
    }
    
    // Convert from Supabase format to app format
    return {
      id: data.id,
      title: data.title,
      amount: Number(data.amount),
      date: new Date(data.date).toISOString(),
      category: data.category,
      description: data.description || undefined,
      receiptImage: data.receipt_image_path || undefined,
      paymentMethod: data.payment_method || undefined,
      tags: data.tags || undefined,
      createdAt: new Date(data.created_at).toISOString(),
      updatedAt: new Date(data.updated_at).toISOString()
    };
  } catch (error) {
    console.error('Error in getExpenseById:', error);
    throw error;
  }
};

/**
 * Get expense statistics from Supabase
 * @param startDate Optional start date for filtering
 * @param endDate Optional end date for filtering
 * @returns Promise resolving to expense statistics
 */
export const getExpenseStatistics = async (startDate?: string, endDate?: string) => {
  try {
    let query = supabase.from('expenses').select('*');
    
    if (startDate) {
      query = query.gte('date', startDate);
    }
    
    if (endDate) {
      query = query.lte('date', endDate);
    }
    
    const { data: expenses, error } = await query;
    
    if (error) {
      console.error('Error fetching expense statistics:', error);
      throw error;
    }
    
    if (!expenses || expenses.length === 0) {
      return {
        totalAmount: 0,
        expenseCount: 0,
        averageAmount: 0,
        categoryBreakdown: {},
        dateBreakdown: {},
      };
    }
    
    // Calculate total amount
    const totalAmount = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    
    // Calculate average amount
    const averageAmount = totalAmount / expenses.length;
    
    // Calculate category breakdown
    const categoryBreakdown = expenses.reduce((acc, expense) => {
      const category = expense.category;
      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += Number(expense.amount);
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate date breakdown
    const dateBreakdown = expenses.reduce((acc, expense) => {
      const date = new Date(expense.date).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date] += Number(expense.amount);
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalAmount,
      expenseCount: expenses.length,
      averageAmount,
      categoryBreakdown,
      dateBreakdown,
    };
  } catch (error) {
    console.error('Error in getExpenseStatistics:', error);
    throw error;
  }
};

/**
 * Get expenses by category from Supabase
 * @param category Category to filter by
 * @returns Promise resolving to an array of expenses
 */
export const getExpensesByCategory = async (category: string): Promise<Expense[]> => {
  try {
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('category', category)
      .order('date', { ascending: false });
    
    if (error) {
      console.error('Error fetching expenses by category:', error);
      throw error;
    }
    
    if (!expenses) {
      return [];
    }
    
    // Transform Supabase data to match our Expense model
    return expenses.map(item => ({
      id: item.id,
      title: item.title,
      amount: Number(item.amount),
      date: new Date(item.date).toISOString(),
      category: item.category,
      description: item.description || undefined,
      receiptImage: item.receipt_image_path || undefined,
      paymentMethod: item.payment_method || undefined,
      tags: item.tags || undefined,
      createdAt: new Date(item.created_at).toISOString(),
      updatedAt: new Date(item.updated_at).toISOString()
    }));
  } catch (error) {
    console.error('Error in getExpensesByCategory:', error);
    throw error;
  }
}; 