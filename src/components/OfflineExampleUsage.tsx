import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useOffline } from '../providers/OfflineProvider';
import { Budget } from '../models/Budget';
import { Expense } from '../models/Expense';
import { SavingsGoal } from '../models/SavingsGoal';
import OfflineStatusBar from './OfflineStatusBar';

/**
 * Example component to demonstrate how to use the offline functionality
 */
const OfflineExampleUsage: React.FC = () => {
  const { isOnline, pendingChanges, syncNow, offlineData } = useOffline();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dataSource, setDataSource] = useState<'local' | 'remote'>('local');

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Load all data from offline storage
  const loadData = async () => {
    setLoading(true);
    try {
      // Always load from local storage first for immediate response
      const localBudgets = await offlineData.getAllBudgets();
      const localExpenses = await offlineData.getAllExpenses();
      const localSavingsGoals = await offlineData.getAllSavingsGoals();
      
      // Update state with local data
      setBudgets(localBudgets);
      setExpenses(localExpenses);
      setSavingsGoals(localSavingsGoals);
      
      // Indicate data is from local storage
      setDataSource('local');
      
      // If we displayed local data, we can mark loading as complete
      setLoading(false);
      
      // If online, try to get fresh data from the server
      // without blocking the UI
      if (isOnline) {
        try {
          // These calls might time out after SUPABASE_REQUEST_TIMEOUT (5 seconds)
          // but they won't block the UI since we already displayed local data
          const [serverBudgets, serverExpenses, serverSavingsGoals] = await Promise.all([
            offlineData.getAllBudgets(),
            offlineData.getAllExpenses(),
            offlineData.getAllSavingsGoals(),
          ]);
          
          // Update state with server data
          setBudgets(serverBudgets);
          setExpenses(serverExpenses);
          setSavingsGoals(serverSavingsGoals);
          
          // Indicate data is from server
          setDataSource('remote');
        } catch (serverError) {
          console.error('Error fetching server data:', serverError);
          // We already displayed local data, so this is just an informational message
          Alert.alert(
            'Offline Mode',
            'Unable to fetch the latest data from the server. Showing locally stored data instead.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert(
        'Error',
        'There was a problem loading your data.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Create a new budget as an example
  const createBudget = async () => {
    try {
      const newBudget = {
        name: `Budget ${Math.floor(Math.random() * 1000)}`,
        amount: Math.floor(Math.random() * 10000) / 100,
        spent: 0,
        category: 'Other',
        color: '#' + Math.floor(Math.random() * 16777215).toString(16),
        icon: 'wallet',
      };

      const createdBudget = await offlineData.createBudget(newBudget);
      
      // Update local state
      setBudgets(prevBudgets => [...prevBudgets, createdBudget]);
      
      console.log('Created budget:', createdBudget);
      
      // Show success message
      Alert.alert(
        'Success',
        `Budget "${createdBudget.name}" created ${!isOnline ? 'offline' : ''}. ${
          !isOnline ? 'It will sync when you reconnect.' : ''
        }`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error creating budget:', error);
      
      let errorMessage = 'Failed to create budget';
      
      // Extract more specific error message if available
      if (error instanceof Error) {
        if (error.message.includes('User not authenticated')) {
          errorMessage = 'Authentication error. Your session may have expired.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert(
        'Error',
        errorMessage,
        [{ text: 'OK' }]
      );
    }
  };
  
  // Create a new expense as an example
  const createExpense = async () => {
    try {
      // Use a random budget if available
      const randomBudget = budgets.length > 0 
        ? budgets[Math.floor(Math.random() * budgets.length)] 
        : null;
      
      const newExpense = {
        title: `Expense ${Math.floor(Math.random() * 1000)}`,
        amount: Math.floor(Math.random() * 10000) / 100,
        date: new Date().toISOString(),
        category: randomBudget?.category || 'Other',
        budgetId: randomBudget?.id,
      };

      const createdExpense = await offlineData.createExpense(newExpense);
      
      // Update local state
      setExpenses(prevExpenses => [...prevExpenses, createdExpense]);
      
      console.log('Created expense:', createdExpense);
      
      // Show success message
      Alert.alert(
        'Success',
        `Expense "${createdExpense.title}" created ${!isOnline ? 'offline' : ''}. ${
          !isOnline ? 'It will sync when you reconnect.' : ''
        }`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error creating expense:', error);
      
      let errorMessage = 'Failed to create expense';
      
      // Extract more specific error message if available
      if (error instanceof Error) {
        if (error.message.includes('User not authenticated')) {
          errorMessage = 'Authentication error. Your session may have expired.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert(
        'Error',
        errorMessage,
        [{ text: 'OK' }]
      );
    }
  };
  
  // Create a new savings goal as an example
  const createSavingsGoal = async () => {
    try {
      const newSavingsGoal = {
        title: `Goal ${Math.floor(Math.random() * 1000)}`,
        description: 'Example savings goal',
        targetAmount: Math.floor(Math.random() * 100000) / 100,
        currentAmount: 0,
        startDate: new Date().toISOString(),
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        category: 'Other',
        isCompleted: false,
        isShared: false,
      };

      const createdGoal = await offlineData.createSavingsGoal(newSavingsGoal);
      
      // Update local state
      setSavingsGoals(prevGoals => [...prevGoals, createdGoal]);
      
      console.log('Created savings goal:', createdGoal);
      
      // Show success message
      Alert.alert(
        'Success',
        `Savings goal "${createdGoal.title}" created ${!isOnline ? 'offline' : ''}. ${
          !isOnline ? 'It will sync when you reconnect.' : ''
        }`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error creating savings goal:', error);
      
      let errorMessage = 'Failed to create savings goal';
      
      // Extract more specific error message if available
      if (error instanceof Error) {
        if (error.message.includes('User not authenticated')) {
          errorMessage = 'Authentication error. Your session may have expired.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert(
        'Error',
        errorMessage,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Offline Status Bar - will only show when offline or syncing */}
      <OfflineStatusBar isLoading={loading} />
      
      {/* Connection status */}
      <View style={[
        styles.statusContainer, 
        { backgroundColor: isOnline ? '#4CAF50' : '#F44336' }
      ]}>
        <Text style={styles.statusText}>
          {isOnline ? 'Online' : 'Offline'} 
          {pendingChanges > 0 && ` (${pendingChanges} pending changes)`}
        </Text>
        {pendingChanges > 0 && isOnline && (
          <Button title="Sync Now" onPress={syncNow} />
        )}
      </View>

      {/* Data Source Info */}
      <View style={styles.dataSourceContainer}>
        <Text style={styles.dataSourceText}>
          Data Source: {dataSource === 'local' ? 'Local Storage' : 'Server'}
          {!isOnline && ' (Offline Mode)'}
        </Text>
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={loadData}
          disabled={loading}
        >
          <Text style={styles.refreshButtonText}>
            {loading ? 'Loading...' : 'Refresh Data'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Create data (works offline)</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={styles.button} 
            onPress={createBudget}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Add Budget</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.button} 
            onPress={createExpense}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Add Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.button} 
            onPress={createSavingsGoal}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Add Goal</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading data...</Text>
        </View>
      )}

      {/* Data display */}
      <View style={styles.dataContainer}>
        <View style={styles.dataSection}>
          <Text style={styles.sectionTitle}>Budgets ({budgets.length})</Text>
          <FlatList
            data={budgets}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.dataItem}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text>${item.amount.toFixed(2)}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {loading ? 'Loading budgets...' : 'No budgets'}
              </Text>
            }
          />
        </View>

        <View style={styles.dataSection}>
          <Text style={styles.sectionTitle}>Expenses ({expenses.length})</Text>
          <FlatList
            data={expenses}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.dataItem}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text>${item.amount.toFixed(2)}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {loading ? 'Loading expenses...' : 'No expenses'}
              </Text>
            }
          />
        </View>

        <View style={styles.dataSection}>
          <Text style={styles.sectionTitle}>Savings Goals ({savingsGoals.length})</Text>
          <FlatList
            data={savingsGoals}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.dataItem}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text>${item.targetAmount.toFixed(2)}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {loading ? 'Loading savings goals...' : 'No savings goals'}
              </Text>
            }
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#2196F3',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  dataSourceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 16,
  },
  dataSourceText: {
    fontWeight: '500',
    fontSize: 14,
  },
  actionsContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  refreshButton: {
    backgroundColor: '#9E9E9E',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 100,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 12,
  },
  dataContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  dataSection: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  dataItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  itemTitle: {
    fontWeight: '500',
  },
  emptyText: {
    fontStyle: 'italic',
    color: '#757575',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default OfflineExampleUsage; 