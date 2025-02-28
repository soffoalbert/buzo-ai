import { Expense, ExpenseFilters, ExpenseStatistics, PaymentMethod } from '../models/Expense';
import { saveData, loadData, removeData } from './offlineStorage';
import { generateUUID, groupBy } from '../utils/helpers';
import { updateBudgetSpending } from './budgetService';

// Storage keys
const EXPENSES_STORAGE_KEY = 'buzo_expenses';

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
    const expenses = await loadData<Expense[]>(EXPENSES_STORAGE_KEY);
    return expenses || [];
  } catch (error) {
    console.error('Error loading expenses:', error);
    return [];
  }
};

/**
 * Create a new expense
 * @param expenseData Expense data without id, createdAt, updatedAt
 * @param updateBudget Whether to update the associated budget's spent amount
 * @returns Promise resolving to the created expense
 */
export const createExpense = async (
  expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>,
  updateBudget = true
): Promise<Expense> => {
  const now = new Date().toISOString();
  
  const newExpense: Expense = {
    id: generateUUID(),
    createdAt: now,
    updatedAt: now,
    ...expenseData,
  };
  
  const currentExpenses = await loadExpenses();
  const updatedExpenses = [...currentExpenses, newExpense];
  
  await saveExpenses(updatedExpenses);
  
  // Update budget spending if requested and category is provided
  if (updateBudget && newExpense.category) {
    try {
      await updateBudgetSpending(newExpense.category, newExpense.amount);
    } catch (error) {
      console.warn('Could not update budget spending:', error);
    }
  }
  
  return newExpense;
};

/**
 * Update an existing expense
 * @param id Expense ID to update
 * @param expenseData Partial expense data to update
 * @returns Promise resolving to the updated expense
 */
export const updateExpense = async (
  id: string,
  expenseData: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Expense> => {
  const currentExpenses = await loadExpenses();
  const expenseIndex = currentExpenses.findIndex(expense => expense.id === id);
  
  if (expenseIndex === -1) {
    throw new Error(`Expense with ID ${id} not found`);
  }
  
  const oldExpense = currentExpenses[expenseIndex];
  const updatedExpense: Expense = {
    ...oldExpense,
    ...expenseData,
    updatedAt: new Date().toISOString(),
  };
  
  currentExpenses[expenseIndex] = updatedExpense;
  await saveExpenses(currentExpenses);
  
  // If amount or category changed, update budget spending
  if (
    (expenseData.amount && expenseData.amount !== oldExpense.amount) ||
    (expenseData.category && expenseData.category !== oldExpense.category)
  ) {
    // If category changed, update both old and new category budgets
    if (expenseData.category && expenseData.category !== oldExpense.category) {
      if (oldExpense.category) {
        try {
          await updateBudgetSpending(oldExpense.category, -oldExpense.amount);
        } catch (error) {
          console.warn('Could not update old budget spending:', error);
        }
      }
      
      try {
        await updateBudgetSpending(
          expenseData.category,
          expenseData.amount || oldExpense.amount
        );
      } catch (error) {
        console.warn('Could not update new budget spending:', error);
      }
    } 
    // If only amount changed, update the current category budget
    else if (expenseData.amount && oldExpense.category) {
      try {
        await updateBudgetSpending(
          oldExpense.category,
          expenseData.amount - oldExpense.amount
        );
      } catch (error) {
        console.warn('Could not update budget spending:', error);
      }
    }
  }
  
  return updatedExpense;
};

/**
 * Delete an expense
 * @param id Expense ID to delete
 * @param updateBudget Whether to update the associated budget's spent amount
 * @returns Promise resolving to boolean indicating success
 */
export const deleteExpense = async (
  id: string,
  updateBudget = true
): Promise<boolean> => {
  try {
    const currentExpenses = await loadExpenses();
    const expenseToDelete = currentExpenses.find(expense => expense.id === id);
    
    if (!expenseToDelete) {
      return false; // No expense was found
    }
    
    const updatedExpenses = currentExpenses.filter(expense => expense.id !== id);
    await saveExpenses(updatedExpenses);
    
    // Update budget spending if requested and category is provided
    if (updateBudget && expenseToDelete.category) {
      try {
        await updateBudgetSpending(expenseToDelete.category, -expenseToDelete.amount);
      } catch (error) {
        console.warn('Could not update budget spending:', error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting expense:', error);
    return false;
  }
};

/**
 * Get an expense by ID
 * @param id Expense ID to retrieve
 * @returns Promise resolving to the expense or null if not found
 */
export const getExpenseById = async (id: string): Promise<Expense | null> => {
  const expenses = await loadExpenses();
  const expense = expenses.find(expense => expense.id === id);
  return expense || null;
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
  let expenses = await loadExpenses();
  
  // Filter by date range if provided
  if (startDate || endDate) {
    expenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      if (startDate && expenseDate < new Date(startDate)) {
        return false;
      }
      if (endDate && expenseDate > new Date(endDate)) {
        return false;
      }
      return true;
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
  
  return {
    totalAmount,
    categoryBreakdown,
    dailyExpenses,
    monthlyComparison,
  };
}; 