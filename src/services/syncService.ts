import offlineStorage, { PendingSyncItem } from './offlineStorage';
// Import API service (to be implemented)
// import api from './api';

/**
 * Synchronize pending changes with the backend
 * @returns Promise that resolves when sync is complete
 */
export const syncPendingChanges = async (): Promise<void> => {
  try {
    // Check if device is online
    const online = await offlineStorage.isOnline();
    if (!online) {
      console.log('Device is offline, skipping sync');
      return;
    }

    // Get pending sync items
    const pendingItems = await offlineStorage.getPendingSync();
    if (pendingItems.length === 0) {
      console.log('No pending items to sync');
      return;
    }

    console.log(`Syncing ${pendingItems.length} pending items`);

    // Group items by entity type for batch processing
    const groupedItems = pendingItems.reduce((acc, item) => {
      if (!acc[item.entity]) {
        acc[item.entity] = [];
      }
      acc[item.entity].push(item);
      return acc;
    }, {} as Record<string, PendingSyncItem[]>);

    // Process each entity type
    const syncedIds: string[] = [];
    
    // Process budgets
    if (groupedItems.budget) {
      const budgetItems = groupedItems.budget;
      for (const item of budgetItems) {
        try {
          // Uncomment and implement when API service is available
          // if (item.type === 'create') {
          //   await api.budgets.create(item.data);
          // } else if (item.type === 'update') {
          //   await api.budgets.update(item.data.id, item.data);
          // } else if (item.type === 'delete') {
          //   await api.budgets.delete(item.data.id);
          // }
          
          // For now, just log the action
          console.log(`Synced budget ${item.type} for ID ${item.data.id}`);
          syncedIds.push(item.id);
        } catch (error) {
          console.error(`Error syncing budget ${item.id}:`, error);
        }
      }
    }
    
    // Process expenses
    if (groupedItems.expense) {
      const expenseItems = groupedItems.expense;
      for (const item of expenseItems) {
        try {
          // Uncomment and implement when API service is available
          // if (item.type === 'create') {
          //   await api.expenses.create(item.data);
          // } else if (item.type === 'update') {
          //   await api.expenses.update(item.data.id, item.data);
          // } else if (item.type === 'delete') {
          //   await api.expenses.delete(item.data.id);
          // }
          
          // For now, just log the action
          console.log(`Synced expense ${item.type} for ID ${item.data.id}`);
          syncedIds.push(item.id);
        } catch (error) {
          console.error(`Error syncing expense ${item.id}:`, error);
        }
      }
    }
    
    // Process savings goals
    if (groupedItems.savings) {
      const savingsItems = groupedItems.savings;
      for (const item of savingsItems) {
        try {
          // Uncomment and implement when API service is available
          // if (item.type === 'create') {
          //   await api.savings.create(item.data);
          // } else if (item.type === 'update') {
          //   await api.savings.update(item.data.id, item.data);
          // } else if (item.type === 'delete') {
          //   await api.savings.delete(item.data.id);
          // }
          
          // For now, just log the action
          console.log(`Synced savings goal ${item.type} for ID ${item.data.id}`);
          syncedIds.push(item.id);
        } catch (error) {
          console.error(`Error syncing savings goal ${item.id}:`, error);
        }
      }
    }
    
    // Process transactions
    if (groupedItems.transaction) {
      const transactionItems = groupedItems.transaction;
      for (const item of transactionItems) {
        try {
          // Uncomment and implement when API service is available
          // if (item.type === 'create') {
          //   await api.transactions.create(item.data);
          // } else if (item.type === 'update') {
          //   await api.transactions.update(item.data.id, item.data);
          // } else if (item.type === 'delete') {
          //   await api.transactions.delete(item.data.id);
          // }
          
          // For now, just log the action
          console.log(`Synced transaction ${item.type} for ID ${item.data.id}`);
          syncedIds.push(item.id);
        } catch (error) {
          console.error(`Error syncing transaction ${item.id}:`, error);
        }
      }
    }

    // Remove synced items from pending sync
    if (syncedIds.length > 0) {
      await offlineStorage.removeFromPendingSync(syncedIds);
      console.log(`Removed ${syncedIds.length} synced items from pending sync`);
    }

    // Update last sync timestamp
    await offlineStorage.updateLastSync();
    
    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Error syncing pending changes:', error);
    throw error;
  }
};

/**
 * Pull latest data from the backend and update local storage
 * @returns Promise that resolves when pull is complete
 */
export const pullLatestData = async (): Promise<void> => {
  try {
    // Check if device is online
    const online = await offlineStorage.isOnline();
    if (!online) {
      console.log('Device is offline, skipping pull');
      return;
    }

    // Get last sync timestamp
    const lastSync = await offlineStorage.getLastSync();
    console.log(`Pulling data since ${lastSync ? new Date(lastSync).toISOString() : 'never'}`);

    // Fetch latest data from backend
    // Uncomment and implement when API service is available
    // const budgets = await api.budgets.getAll(lastSync);
    // const expenses = await api.expenses.getAll(lastSync);
    // const savingsGoals = await api.savings.getAll(lastSync);
    // const transactions = await api.transactions.getAll(lastSync);

    // For now, use mock data
    const budgets = []; // Mock data
    const expenses = []; // Mock data
    const savingsGoals = []; // Mock data
    const transactions = []; // Mock data

    // Update local storage
    await offlineStorage.saveBudgets(budgets);
    await offlineStorage.saveExpenses(expenses);
    await offlineStorage.saveSavingsGoals(savingsGoals);
    await offlineStorage.saveTransactions(transactions);

    // Update last sync timestamp
    await offlineStorage.updateLastSync();
    
    console.log('Pull completed successfully');
  } catch (error) {
    console.error('Error pulling latest data:', error);
    throw error;
  }
};

/**
 * Perform a full sync (push pending changes and pull latest data)
 * @returns Promise that resolves when sync is complete
 */
export const performFullSync = async (): Promise<void> => {
  try {
    // Check if device is online
    const online = await offlineStorage.isOnline();
    if (!online) {
      console.log('Device is offline, skipping full sync');
      return;
    }

    // First push pending changes
    await syncPendingChanges();
    
    // Then pull latest data
    await pullLatestData();
    
    console.log('Full sync completed successfully');
  } catch (error) {
    console.error('Error performing full sync:', error);
    throw error;
  }
};

/**
 * Initialize sync service and set up network listeners
 * @returns Cleanup function to remove listeners
 */
export const initializeSyncService = (): (() => void) => {
  console.log('Initializing sync service');
  
  // Perform initial sync
  performFullSync().catch(error => {
    console.error('Error during initial sync:', error);
  });
  
  // Set up network listener to sync when coming back online
  const unsubscribe = offlineStorage.setupNetworkListener(() => {
    console.log('Network connection restored, starting sync');
    performFullSync().catch(error => {
      console.error('Error during network-triggered sync:', error);
    });
  });
  
  return unsubscribe;
};

export default {
  syncPendingChanges,
  pullLatestData,
  performFullSync,
  initializeSyncService,
}; 