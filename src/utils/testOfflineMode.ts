import offlineStorage, { PendingSyncItem } from '../services/offlineStorage';
import syncQueueService from '../services/syncQueueService';
import syncService from '../services/syncService';
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
    description: `Test Expense ${Math.floor(Math.random() * 1000)}`,
    amount: Math.floor(Math.random() * 10000) / 100,
    category: ['Food', 'Transport', 'Entertainment', 'Utilities'][Math.floor(Math.random() * 4)],
    date: new Date().toISOString(),
    paymentMethod: ['cash', 'card', 'mobile'][Math.floor(Math.random() * 3)],
    notes: 'Created for offline testing',
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
    name: `Test Savings Goal ${Math.floor(Math.random() * 1000)}`,
    targetAmount,
    currentAmount: Math.floor(Math.random() * targetAmount * 100) / 100,
    category: ['Emergency', 'Education', 'Travel', 'Home'][Math.floor(Math.random() * 4)],
    deadline: new Date(Date.now() + Math.floor(Math.random() * 10000000000)).toISOString(),
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
    
    // Also add to sync queue with priority
    await syncQueueService.addToSyncQueue({
      id: pendingItem.id,
      entity: pendingItem.entity,
      type: pendingItem.type,
      data: pendingItem.data,
    }, 2);
    
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
    
    // Also add to sync queue with priority
    await syncQueueService.addToSyncQueue({
      id: pendingItem.id,
      entity: pendingItem.entity,
      type: pendingItem.type,
      data: pendingItem.data,
    }, 3);
    
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
    
    // Also add to sync queue with priority
    await syncQueueService.addToSyncQueue({
      id: pendingItem.id,
      entity: pendingItem.entity,
      type: pendingItem.type,
      data: pendingItem.data,
    }, 1);
    
    console.log('Mock savings goal added:', savingsGoal);
    return savingsGoal;
  } catch (error) {
    console.error('Error adding mock savings goal:', error);
    throw error;
  }
};

/**
 * Add multiple mock items of different types
 * @param count Number of each type of item to add
 * @returns Object containing arrays of created items
 */
export const addMultipleMockItems = async (count = 1) => {
  try {
    const budgets = [];
    const expenses = [];
    const savingsGoals = [];
    
    for (let i = 0; i < count; i++) {
      const budget = await addMockBudget();
      const expense = await addMockExpense();
      const savingsGoal = await addMockSavingsGoal();
      
      budgets.push(budget);
      expenses.push(expense);
      savingsGoals.push(savingsGoal);
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
    
    // Also clear sync queue
    await syncQueueService.clearSyncQueue();
    
    console.log('All offline data cleared');
  } catch (error) {
    console.error('Error clearing offline data:', error);
    throw error;
  }
};

/**
 * Simulate a network error during sync
 */
export const simulateSyncFailure = async () => {
  try {
    // Get current sync status
    const status = await syncQueueService.getSyncStatus() || {
      lastSyncAttempt: Date.now(),
      lastSuccessfulSync: null,
      isSyncing: false,
      pendingCount: 0,
      failedCount: 0,
      syncProgress: 0,
    };
    
    // Get sync queue
    const queue = await syncQueueService.getSyncQueue();
    
    // Update sync status to simulate failure
    await syncQueueService.updateSyncStatus({
      ...status,
      error: 'Simulated network error during sync',
      failedCount: queue.length,
      isSyncing: false,
      lastSyncAttempt: Date.now(),
    });
    
    // Mark all items as failed
    for (const item of queue) {
      await syncQueueService.updateSyncQueueItem(item.id, {
        ...item,
        attempts: item.attempts + 1,
        lastAttempt: Date.now(),
        error: 'Simulated network error',
      });
    }
    
    console.log('Sync failure simulated');
  } catch (error) {
    console.error('Error simulating sync failure:', error);
    throw error;
  }
};

/**
 * Simulate editing an existing item while offline
 */
export const simulateOfflineEdit = async () => {
  try {
    // Try to edit a budget first
    const budgets = await offlineStorage.loadBudgets();
    if (budgets.length > 0) {
      // Edit the first budget
      const budget = budgets[0];
      const updatedBudget = {
        ...budget,
        name: `${budget.name} (Edited Offline)`,
        amount: budget.amount + 10,
        updatedAt: new Date().toISOString(),
      };
      
      // Update in storage
      const updatedBudgets = budgets.map(b => 
        b.id === budget.id ? updatedBudget : b
      );
      await offlineStorage.saveBudgets(updatedBudgets);
      
      // Add to pending sync
      const pendingItem: PendingSyncItem = {
        id: uuidv4(),
        entity: 'budget',
        type: 'update',
        data: updatedBudget,
        timestamp: Date.now(),
      };
      
      await offlineStorage.addToPendingSync(pendingItem);
      
      // Also add to sync queue with priority
      await syncQueueService.addToSyncQueue({
        id: pendingItem.id,
        entity: pendingItem.entity,
        type: pendingItem.type,
        data: pendingItem.data,
      }, 2);
      
      console.log('Budget edited offline:', updatedBudget);
      return { type: 'budget', item: updatedBudget };
    }
    
    // If no budgets, try expenses
    const expenses = await offlineStorage.loadExpenses();
    if (expenses.length > 0) {
      // Edit the first expense
      const expense = expenses[0];
      const updatedExpense = {
        ...expense,
        description: `${expense.description} (Edited Offline)`,
        amount: expense.amount + 5,
        updatedAt: new Date().toISOString(),
      };
      
      // Update in storage
      const updatedExpenses = expenses.map(e => 
        e.id === expense.id ? updatedExpense : e
      );
      await offlineStorage.saveExpenses(updatedExpenses);
      
      // Add to pending sync
      const pendingItem: PendingSyncItem = {
        id: uuidv4(),
        entity: 'expense',
        type: 'update',
        data: updatedExpense,
        timestamp: Date.now(),
      };
      
      await offlineStorage.addToPendingSync(pendingItem);
      
      // Also add to sync queue with priority
      await syncQueueService.addToSyncQueue({
        id: pendingItem.id,
        entity: pendingItem.entity,
        type: pendingItem.type,
        data: pendingItem.data,
      }, 3);
      
      console.log('Expense edited offline:', updatedExpense);
      return { type: 'expense', item: updatedExpense };
    }
    
    // If no expenses, try savings goals
    const savingsGoals = await offlineStorage.loadSavingsGoals();
    if (savingsGoals.length > 0) {
      // Edit the first savings goal
      const savingsGoal = savingsGoals[0];
      const updatedSavingsGoal = {
        ...savingsGoal,
        name: `${savingsGoal.name} (Edited Offline)`,
        currentAmount: savingsGoal.currentAmount + 20,
        updatedAt: new Date().toISOString(),
      };
      
      // Update in storage
      const updatedSavingsGoals = savingsGoals.map(s => 
        s.id === savingsGoal.id ? updatedSavingsGoal : s
      );
      await offlineStorage.saveSavingsGoals(updatedSavingsGoals);
      
      // Add to pending sync
      const pendingItem: PendingSyncItem = {
        id: uuidv4(),
        entity: 'savings',
        type: 'update',
        data: updatedSavingsGoal,
        timestamp: Date.now(),
      };
      
      await offlineStorage.addToPendingSync(pendingItem);
      
      // Also add to sync queue with priority
      await syncQueueService.addToSyncQueue({
        id: pendingItem.id,
        entity: pendingItem.entity,
        type: pendingItem.type,
        data: pendingItem.data,
      }, 1);
      
      console.log('Savings goal edited offline:', updatedSavingsGoal);
      return { type: 'savings', item: updatedSavingsGoal };
    }
    
    // If no items found, add a new one and then edit it
    const budget = await addMockBudget();
    return await simulateOfflineEdit();
  } catch (error) {
    console.error('Error simulating offline edit:', error);
    throw error;
  }
};

/**
 * Simulate deleting an item while offline
 */
export const simulateOfflineDelete = async () => {
  try {
    // Try to delete a budget first
    const budgets = await offlineStorage.loadBudgets();
    if (budgets.length > 0) {
      // Delete the last budget
      const budget = budgets[budgets.length - 1];
      
      // Update in storage
      const updatedBudgets = budgets.filter(b => b.id !== budget.id);
      await offlineStorage.saveBudgets(updatedBudgets);
      
      // Add to pending sync
      const pendingItem: PendingSyncItem = {
        id: uuidv4(),
        entity: 'budget',
        type: 'delete',
        data: { id: budget.id },
        timestamp: Date.now(),
      };
      
      await offlineStorage.addToPendingSync(pendingItem);
      
      // Also add to sync queue with priority
      await syncQueueService.addToSyncQueue({
        id: pendingItem.id,
        entity: pendingItem.entity,
        type: pendingItem.type,
        data: { id: budget.id },
      }, 2);
      
      console.log('Budget deleted offline:', budget);
      return { type: 'budget', item: budget };
    }
    
    // If no budgets, try expenses
    const expenses = await offlineStorage.loadExpenses();
    if (expenses.length > 0) {
      // Delete the last expense
      const expense = expenses[expenses.length - 1];
      
      // Update in storage
      const updatedExpenses = expenses.filter(e => e.id !== expense.id);
      await offlineStorage.saveExpenses(updatedExpenses);
      
      // Add to pending sync
      const pendingItem: PendingSyncItem = {
        id: uuidv4(),
        entity: 'expense',
        type: 'delete',
        data: { id: expense.id },
        timestamp: Date.now(),
      };
      
      await offlineStorage.addToPendingSync(pendingItem);
      
      // Also add to sync queue with priority
      await syncQueueService.addToSyncQueue({
        id: pendingItem.id,
        entity: pendingItem.entity,
        type: pendingItem.type,
        data: { id: expense.id },
      }, 3);
      
      console.log('Expense deleted offline:', expense);
      return { type: 'expense', item: expense };
    }
    
    // If no expenses, try savings goals
    const savingsGoals = await offlineStorage.loadSavingsGoals();
    if (savingsGoals.length > 0) {
      // Delete the last savings goal
      const savingsGoal = savingsGoals[savingsGoals.length - 1];
      
      // Update in storage
      const updatedSavingsGoals = savingsGoals.filter(s => s.id !== savingsGoal.id);
      await offlineStorage.saveSavingsGoals(updatedSavingsGoals);
      
      // Add to pending sync
      const pendingItem: PendingSyncItem = {
        id: uuidv4(),
        entity: 'savings',
        type: 'delete',
        data: { id: savingsGoal.id },
        timestamp: Date.now(),
      };
      
      await offlineStorage.addToPendingSync(pendingItem);
      
      // Also add to sync queue with priority
      await syncQueueService.addToSyncQueue({
        id: pendingItem.id,
        entity: pendingItem.entity,
        type: pendingItem.type,
        data: { id: savingsGoal.id },
      }, 1);
      
      console.log('Savings goal deleted offline:', savingsGoal);
      return { type: 'savings', item: savingsGoal };
    }
    
    // If no items found, add a new one and then delete it
    await addMultipleMockItems(1);
    return await simulateOfflineDelete();
  } catch (error) {
    console.error('Error simulating offline delete:', error);
    throw error;
  }
};

/**
 * Generate a large number of offline changes to test sync performance
 * @param count Number of items to create
 */
export const generateLargeOfflineDataset = async (count = 20) => {
  try {
    console.log(`Generating ${count} items of each type for performance testing...`);
    const results = {
      budgets: [],
      expenses: [],
      savingsGoals: [],
    };
    
    // Create items in batches to avoid overwhelming the device
    const batchSize = 5;
    const batches = Math.ceil(count / batchSize);
    
    for (let i = 0; i < batches; i++) {
      const currentBatchSize = Math.min(batchSize, count - i * batchSize);
      console.log(`Processing batch ${i + 1}/${batches} (${currentBatchSize} items)...`);
      
      for (let j = 0; j < currentBatchSize; j++) {
        const budget = await addMockBudget();
        const expense = await addMockExpense();
        const savingsGoal = await addMockSavingsGoal();
        
        results.budgets.push(budget);
        results.expenses.push(expense);
        results.savingsGoals.push(savingsGoal);
      }
    }
    
    console.log(`Generated ${results.budgets.length} budgets, ${results.expenses.length} expenses, and ${results.savingsGoals.length} savings goals.`);
    return results;
  } catch (error) {
    console.error('Error generating large offline dataset:', error);
    throw error;
  }
};

export default {
  addMockBudget,
  addMockExpense,
  addMockSavingsGoal,
  addMultipleMockItems,
  clearAllOfflineData,
  simulateSyncFailure,
  simulateOfflineEdit,
  simulateOfflineDelete,
  generateLargeOfflineDataset,
}; 