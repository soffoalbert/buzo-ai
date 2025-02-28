import offlineStorage, { PendingSyncItem } from '../services/offlineStorage';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a mock budget object
 * @returns A mock budget object
 */
const generateMockBudget = () => {
  const id = uuidv4();
  return {
    id,
    name: `Test Budget ${Math.floor(Math.random() * 1000)}`,
    amount: Math.floor(Math.random() * 10000) / 100,
    category: ['Food', 'Transport', 'Entertainment', 'Utilities'][Math.floor(Math.random() * 4)],
    period: ['weekly', 'monthly'][Math.floor(Math.random() * 2)],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Generate a mock expense object
 * @returns A mock expense object
 */
const generateMockExpense = () => {
  const id = uuidv4();
  return {
    id,
    amount: Math.floor(Math.random() * 10000) / 100,
    category: ['Food', 'Transport', 'Entertainment', 'Utilities'][Math.floor(Math.random() * 4)],
    description: `Test Expense ${Math.floor(Math.random() * 1000)}`,
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Generate a mock savings goal object
 * @returns A mock savings goal object
 */
const generateMockSavingsGoal = () => {
  const id = uuidv4();
  const targetAmount = Math.floor(Math.random() * 100000) / 100;
  return {
    id,
    name: `Test Goal ${Math.floor(Math.random() * 1000)}`,
    targetAmount,
    currentAmount: Math.floor(Math.random() * targetAmount * 100) / 100,
    deadline: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Add a mock budget to offline storage
 * @returns The created budget
 */
export const addMockBudget = async () => {
  try {
    const budget = generateMockBudget();
    
    // Get existing budgets
    const existingBudgets = await offlineStorage.loadBudgets();
    
    // Add new budget
    const updatedBudgets = [...existingBudgets, budget];
    
    // Save to storage
    await offlineStorage.saveBudgets(updatedBudgets);
    
    // Add to pending sync
    const pendingItem: PendingSyncItem = {
      id: uuidv4(),
      entity: 'budget',
      type: 'create',
      data: budget,
      timestamp: Date.now(),
    };
    
    await offlineStorage.addToPendingSync(pendingItem);
    
    console.log('Mock budget added:', budget);
    return budget;
  } catch (error) {
    console.error('Error adding mock budget:', error);
    throw error;
  }
};

/**
 * Add a mock expense to offline storage
 * @returns The created expense
 */
export const addMockExpense = async () => {
  try {
    const expense = generateMockExpense();
    
    // Get existing expenses
    const existingExpenses = await offlineStorage.loadExpenses();
    
    // Add new expense
    const updatedExpenses = [...existingExpenses, expense];
    
    // Save to storage
    await offlineStorage.saveExpenses(updatedExpenses);
    
    // Add to pending sync
    const pendingItem: PendingSyncItem = {
      id: uuidv4(),
      entity: 'expense',
      type: 'create',
      data: expense,
      timestamp: Date.now(),
    };
    
    await offlineStorage.addToPendingSync(pendingItem);
    
    console.log('Mock expense added:', expense);
    return expense;
  } catch (error) {
    console.error('Error adding mock expense:', error);
    throw error;
  }
};

/**
 * Add a mock savings goal to offline storage
 * @returns The created savings goal
 */
export const addMockSavingsGoal = async () => {
  try {
    const savingsGoal = generateMockSavingsGoal();
    
    // Get existing savings goals
    const existingSavingsGoals = await offlineStorage.loadSavingsGoals();
    
    // Add new savings goal
    const updatedSavingsGoals = [...existingSavingsGoals, savingsGoal];
    
    // Save to storage
    await offlineStorage.saveSavingsGoals(updatedSavingsGoals);
    
    // Add to pending sync
    const pendingItem: PendingSyncItem = {
      id: uuidv4(),
      entity: 'savings',
      type: 'create',
      data: savingsGoal,
      timestamp: Date.now(),
    };
    
    await offlineStorage.addToPendingSync(pendingItem);
    
    console.log('Mock savings goal added:', savingsGoal);
    return savingsGoal;
  } catch (error) {
    console.error('Error adding mock savings goal:', error);
    throw error;
  }
};

/**
 * Add multiple mock items to offline storage
 * @param count Number of each type of item to add
 * @returns Object containing arrays of created items
 */
export const addMultipleMockItems = async (count = 3) => {
  try {
    const budgets = [];
    const expenses = [];
    const savingsGoals = [];
    
    for (let i = 0; i < count; i++) {
      budgets.push(await addMockBudget());
      expenses.push(await addMockExpense());
      savingsGoals.push(await addMockSavingsGoal());
    }
    
    return { budgets, expenses, savingsGoals };
  } catch (error) {
    console.error('Error adding multiple mock items:', error);
    throw error;
  }
};

/**
 * Clear all offline data (for testing purposes)
 */
export const clearAllOfflineData = async () => {
  try {
    await offlineStorage.removeData(offlineStorage.STORAGE_KEYS.BUDGETS);
    await offlineStorage.removeData(offlineStorage.STORAGE_KEYS.EXPENSES);
    await offlineStorage.removeData(offlineStorage.STORAGE_KEYS.SAVINGS);
    await offlineStorage.removeData(offlineStorage.STORAGE_KEYS.TRANSACTIONS);
    await offlineStorage.removeData(offlineStorage.STORAGE_KEYS.PENDING_SYNC);
    await offlineStorage.removeData(offlineStorage.STORAGE_KEYS.LAST_SYNC);
    
    console.log('All offline data cleared');
  } catch (error) {
    console.error('Error clearing offline data:', error);
    throw error;
  }
};

export default {
  addMockBudget,
  addMockExpense,
  addMockSavingsGoal,
  addMultipleMockItems,
  clearAllOfflineData,
}; 