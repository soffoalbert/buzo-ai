import { Budget, BudgetCategory, DEFAULT_BUDGET_CATEGORIES } from '../models/Budget';
import { saveData, loadData, removeData } from './offlineStorage';
import { generateUUID } from '../utils/helpers';

// Storage keys
const BUDGETS_STORAGE_KEY = 'buzo_budgets';
const BUDGET_CATEGORIES_STORAGE_KEY = 'buzo_budget_categories';

/**
 * Save budgets to local storage
 * @param budgets Array of budgets to save
 * @returns Promise resolving to the saved budgets
 */
export const saveBudgets = async (budgets: Budget[]): Promise<Budget[]> => {
  try {
    await saveData(BUDGETS_STORAGE_KEY, budgets);
    return budgets;
  } catch (error) {
    console.error('Error saving budgets:', error);
    throw new Error('Failed to save budgets');
  }
};

/**
 * Load budgets from local storage
 * @returns Promise resolving to array of budgets or empty array if none found
 */
export const loadBudgets = async (): Promise<Budget[]> => {
  try {
    const budgets = await loadData<Budget[]>(BUDGETS_STORAGE_KEY);
    return budgets || [];
  } catch (error) {
    console.error('Error loading budgets:', error);
    return [];
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
  const now = new Date().toISOString();
  
  const newBudget: Budget = {
    id: generateUUID(),
    createdAt: now,
    updatedAt: now,
    ...budgetData,
  };
  
  const currentBudgets = await loadBudgets();
  const updatedBudgets = [...currentBudgets, newBudget];
  
  await saveBudgets(updatedBudgets);
  return newBudget;
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
  const currentBudgets = await loadBudgets();
  const budgetIndex = currentBudgets.findIndex(budget => budget.id === id);
  
  if (budgetIndex === -1) {
    throw new Error(`Budget with ID ${id} not found`);
  }
  
  const updatedBudget: Budget = {
    ...currentBudgets[budgetIndex],
    ...budgetData,
    updatedAt: new Date().toISOString(),
  };
  
  currentBudgets[budgetIndex] = updatedBudget;
  await saveBudgets(currentBudgets);
  
  return updatedBudget;
};

/**
 * Delete a budget
 * @param id Budget ID to delete
 * @returns Promise resolving to boolean indicating success
 */
export const deleteBudget = async (id: string): Promise<boolean> => {
  try {
    const currentBudgets = await loadBudgets();
    const updatedBudgets = currentBudgets.filter(budget => budget.id !== id);
    
    if (updatedBudgets.length === currentBudgets.length) {
      return false; // No budget was deleted
    }
    
    await saveBudgets(updatedBudgets);
    return true;
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
  const budgets = await loadBudgets();
  const budget = budgets.find(budget => budget.id === id);
  return budget || null;
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
  const budget = await getBudgetById(id);
  
  if (!budget) {
    throw new Error(`Budget with ID ${id} not found`);
  }
  
  const newSpent = Math.max(0, (budget.spent || 0) + amount);
  return updateBudget(id, { spent: newSpent });
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
  const budgets = await loadBudgets();
  
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
}; 