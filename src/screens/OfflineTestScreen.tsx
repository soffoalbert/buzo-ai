import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';

import offlineStorage from '../services/offlineStorage';
import syncService from '../services/syncService';
import syncQueueService from '../services/syncQueueService';
import testOfflineMode from '../utils/testOfflineMode';
import OfflineStatusBar from '../components/OfflineStatusBar';
import Button from '../components/Button';
import { colors, spacing, textStyles } from '../utils/theme';

// Define the type for font weights
type FontWeight = TextStyle['fontWeight'];

type OfflineTestScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const OfflineTestScreen: React.FC = () => {
  const navigation = useNavigation<OfflineTestScreenNavigationProp>();
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // Load data
  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Check online status
      const online = await offlineStorage.isOnline();
      setIsOnline(online);
      
      // Get pending sync items
      const pendingItems = await offlineStorage.getPendingSync();
      setPendingCount(pendingItems.length);
      
      // Get last sync time
      const lastSyncTime = await offlineStorage.getLastSync();
      setLastSync(lastSyncTime);
      
      // Get sync status
      const status = await syncQueueService.getSyncStatus();
      setSyncStatus(status);
      
      // Load cached data
      const cachedBudgets = await offlineStorage.loadBudgets();
      const cachedExpenses = await offlineStorage.loadExpenses();
      const cachedSavingsGoals = await offlineStorage.loadSavingsGoals();
      
      setBudgets(cachedBudgets);
      setExpenses(cachedExpenses);
      setSavingsGoals(cachedSavingsGoals);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // Add mock data
  const handleAddMockData = async () => {
    try {
      setIsLoading(true);
      await testOfflineMode.addMultipleMockItems(1);
      await loadData();
      Alert.alert('Success', 'Mock data added successfully');
    } catch (error) {
      console.error('Error adding mock data:', error);
      Alert.alert('Error', 'Failed to add mock data');
    } finally {
      setIsLoading(false);
    }
  };

  // Add multiple mock data items
  const handleAddMultipleMockData = async () => {
    try {
      setIsLoading(true);
      await testOfflineMode.addMultipleMockItems(5);
      await loadData();
      Alert.alert('Success', '5 mock data items added successfully');
    } catch (error) {
      console.error('Error adding mock data:', error);
      Alert.alert('Error', 'Failed to add mock data');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all data
  const handleClearData = async () => {
    try {
      setIsLoading(true);
      await testOfflineMode.clearAllOfflineData();
      await loadData();
      Alert.alert('Success', 'All data cleared successfully');
    } catch (error) {
      console.error('Error clearing data:', error);
      Alert.alert('Error', 'Failed to clear data');
    } finally {
      setIsLoading(false);
    }
  };

  // Sync data
  const handleSync = async () => {
    try {
      setIsLoading(true);
      await syncService.performFullSync();
      await loadData();
      Alert.alert('Success', 'Data synced successfully');
    } catch (error) {
      console.error('Error syncing data:', error);
      Alert.alert('Error', 'Failed to sync data');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle network status (for testing)
  const toggleNetworkStatus = async () => {
    // This is just a mock function to simulate network status changes
    // In a real app, you would use NetInfo to check actual network status
    setIsOnline(!isOnline);
    
    // Update the UI immediately
    Alert.alert(
      'Network Status',
      `Network status simulated as ${!isOnline ? 'online' : 'offline'}. This is just for UI testing.`,
      [
        {
          text: 'OK',
          onPress: async () => {
            // If toggling to online, offer to sync
            if (!isOnline) {
              Alert.alert(
                'Sync Data',
                'Would you like to sync data now that you are back online?',
                [
                  {
                    text: 'Yes',
                    onPress: handleSync,
                  },
                  {
                    text: 'No',
                    style: 'cancel',
                  },
                ]
              );
            }
          },
        },
      ]
    );
  };

  // Simulate sync failure
  const simulateSyncFailure = async () => {
    try {
      setIsLoading(true);
      
      // Get current sync status
      const status = await syncQueueService.getSyncStatus() || {
        lastSyncAttempt: Date.now(),
        lastSuccessfulSync: null,
        isSyncing: false,
        pendingCount: pendingCount,
        failedCount: 0,
        syncProgress: 0,
      };
      
      // Update sync status to simulate failure
      await syncQueueService.updateSyncStatus({
        ...status,
        error: 'Simulated sync failure',
        failedCount: pendingCount,
      });
      
      await loadData();
      Alert.alert('Simulated', 'Sync failure has been simulated');
    } catch (error) {
      console.error('Error simulating sync failure:', error);
      Alert.alert('Error', 'Failed to simulate sync failure');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset failed sync items
  const resetFailedSyncItems = async () => {
    try {
      setIsLoading(true);
      await syncQueueService.resetFailedSyncItems();
      await loadData();
      Alert.alert('Success', 'Failed sync items have been reset');
    } catch (error) {
      console.error('Error resetting failed sync items:', error);
      Alert.alert('Error', 'Failed to reset sync items');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle auto-sync
  const toggleAutoSync = (value: boolean) => {
    setAutoSyncEnabled(value);
    // In a real implementation, this would update a configuration setting
    Alert.alert(
      'Auto-Sync',
      `Auto-sync has been ${value ? 'enabled' : 'disabled'}. This is just for UI testing.`
    );
  };

  // Load data on mount
  useEffect(() => {
    loadData();
    
    // Set up sync status listener
    const unsubscribeSyncStatus = syncService.addSyncStatusListener((status) => {
      setSyncStatus(status);
      // Refresh data when sync completes
      if (!status.isSyncing && status.lastSuccessfulSync) {
        loadData();
      }
    });
    
    return () => {
      unsubscribeSyncStatus();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="auto" />
      
      <OfflineStatusBar onSyncComplete={loadData} />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Offline Mode Testing</Text>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.statusCard}>
            <Text style={styles.sectionTitle}>Network Status</Text>
            <View style={styles.statusRow}>
              <Ionicons
                name={isOnline ? "cloud-done" : "cloud-offline"}
                size={24}
                color={isOnline ? colors.success : colors.error}
              />
              <Text style={[styles.statusText, { color: isOnline ? colors.success : colors.error }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Pending Changes:</Text>
              <Text style={styles.statusValue}>{pendingCount}</Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Failed Syncs:</Text>
              <Text style={styles.statusValue}>{syncStatus?.failedCount || 0}</Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Last Sync:</Text>
              <Text style={styles.statusValue}>
                {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Auto-Sync:</Text>
              <Switch
                value={autoSyncEnabled}
                onValueChange={toggleAutoSync}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
            
            <Button
              title="Toggle Network Status (Simulation)"
              onPress={toggleNetworkStatus}
              variant="outline"
              size="small"
              style={styles.actionButton}
            />
          </View>
          
          <View style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Test Actions</Text>
            
            <Button
              title="Add Single Mock Item"
              onPress={handleAddMockData}
              variant="outline"
              size="small"
              style={styles.actionButton}
            />
            
            <Button
              title="Add 5 Mock Items"
              onPress={handleAddMultipleMockData}
              variant="outline"
              size="small"
              style={styles.actionButton}
            />
            
            <Button
              title="Edit Item Offline"
              onPress={async () => {
                try {
                  setIsLoading(true);
                  await testOfflineMode.simulateOfflineEdit();
                  await loadData();
                  Alert.alert('Success', 'Item edited offline');
                } catch (error) {
                  console.error('Error editing item offline:', error);
                  Alert.alert('Error', 'Failed to edit item offline');
                } finally {
                  setIsLoading(false);
                }
              }}
              variant="outline"
              size="small"
              style={styles.actionButton}
            />
            
            <Button
              title="Delete Item Offline"
              onPress={async () => {
                try {
                  setIsLoading(true);
                  await testOfflineMode.simulateOfflineDelete();
                  await loadData();
                  Alert.alert('Success', 'Item deleted offline');
                } catch (error) {
                  console.error('Error deleting item offline:', error);
                  Alert.alert('Error', 'Failed to delete item offline');
                } finally {
                  setIsLoading(false);
                }
              }}
              variant="outline"
              size="small"
              style={styles.actionButton}
            />
            
            <Button
              title="Generate Large Dataset (20 items)"
              onPress={async () => {
                try {
                  setIsLoading(true);
                  await testOfflineMode.generateLargeOfflineDataset(20);
                  await loadData();
                  Alert.alert('Success', 'Large dataset generated');
                } catch (error) {
                  console.error('Error generating large dataset:', error);
                  Alert.alert('Error', 'Failed to generate large dataset');
                } finally {
                  setIsLoading(false);
                }
              }}
              variant="outline"
              size="small"
              style={styles.actionButton}
            />
            
            <Button
              title="Sync Data Now"
              onPress={handleSync}
              variant="primary"
              size="small"
              style={styles.actionButton}
              disabled={!isOnline}
            />
            
            <Button
              title="Simulate Sync Failure"
              onPress={async () => {
                try {
                  setIsLoading(true);
                  await testOfflineMode.simulateSyncFailure();
                  await loadData();
                  Alert.alert('Success', 'Sync failure simulated');
                } catch (error) {
                  console.error('Error simulating sync failure:', error);
                  Alert.alert('Error', 'Failed to simulate sync failure');
                } finally {
                  setIsLoading(false);
                }
              }}
              variant="outline"
              size="small"
              style={styles.actionButton}
            />
            
            <Button
              title="Reset Failed Sync Items"
              onPress={resetFailedSyncItems}
              variant="outline"
              size="small"
              style={styles.actionButton}
              disabled={!syncStatus?.failedCount}
            />
            
            <Button
              title="Clear All Data"
              onPress={handleClearData}
              variant="danger"
              size="small"
              style={styles.actionButton}
            />
          </View>
          
          <View style={styles.dataCard}>
            <Text style={styles.sectionTitle}>Cached Data</Text>
            
            <View style={styles.dataSection}>
              <Text style={styles.dataTitle}>Budgets ({budgets.length})</Text>
              {budgets.length > 0 ? (
                budgets.slice(0, 3).map((budget, index) => (
                  <View key={budget.id || index} style={styles.dataItem}>
                    <Text style={styles.dataItemTitle}>{budget.name}</Text>
                    <Text style={styles.dataItemSubtitle}>
                      {budget.amount} • {budget.category} • {budget.period}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No budgets found</Text>
              )}
              {budgets.length > 3 && (
                <Text style={styles.emptyText}>...and {budgets.length - 3} more</Text>
              )}
            </View>
            
            <View style={styles.dataSection}>
              <Text style={styles.dataTitle}>Expenses ({expenses.length})</Text>
              {expenses.length > 0 ? (
                expenses.slice(0, 3).map((expense, index) => (
                  <View key={expense.id || index} style={styles.dataItem}>
                    <Text style={styles.dataItemTitle}>{expense.description}</Text>
                    <Text style={styles.dataItemSubtitle}>
                      {expense.amount} • {expense.category} • {new Date(expense.date).toLocaleDateString()}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No expenses found</Text>
              )}
              {expenses.length > 3 && (
                <Text style={styles.emptyText}>...and {expenses.length - 3} more</Text>
              )}
            </View>
            
            <View style={styles.dataSection}>
              <Text style={styles.dataTitle}>Savings Goals ({savingsGoals.length})</Text>
              {savingsGoals.length > 0 ? (
                savingsGoals.slice(0, 3).map((goal, index) => (
                  <View key={goal.id || index} style={styles.dataItem}>
                    <Text style={styles.dataItemTitle}>{goal.name}</Text>
                    <Text style={styles.dataItemSubtitle}>
                      {goal.currentAmount}/{goal.targetAmount} • {goal.category}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No savings goals found</Text>
              )}
              {savingsGoals.length > 3 && (
                <Text style={styles.emptyText}>...and {savingsGoals.length - 3} more</Text>
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.small,
  },
  headerTitle: {
    ...textStyles.h2,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...textStyles.body1,
    marginTop: spacing.small,
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.medium,
  },
  statusCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  actionsCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  dataCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sectionTitle: {
    ...textStyles.h3,
    marginBottom: spacing.small,
    color: colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  statusText: {
    ...textStyles.body1,
    marginLeft: spacing.small,
    fontWeight: '600' as FontWeight,
  },
  statusLabel: {
    ...textStyles.body2,
    color: colors.textSecondary,
    width: 120,
  },
  statusValue: {
    ...textStyles.body2,
    color: colors.text,
    flex: 1,
  },
  actionButton: {
    marginVertical: spacing.small / 2,
  },
  dataSection: {
    marginBottom: spacing.medium,
  },
  dataTitle: {
    ...textStyles.subtitle1,
    color: colors.text,
    marginBottom: spacing.small,
  },
  dataItem: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 8,
    padding: spacing.small,
    marginBottom: spacing.small,
  },
  dataItemTitle: {
    ...textStyles.body1,
    color: colors.text,
    fontWeight: '500' as FontWeight,
  },
  dataItemSubtitle: {
    ...textStyles.body2,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    ...textStyles.body2,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing.small,
  },
});

export default OfflineTestScreen; 