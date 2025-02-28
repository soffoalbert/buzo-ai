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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';

import offlineStorage from '../services/offlineStorage';
import syncService from '../services/syncService';
import testOfflineMode from '../utils/testOfflineMode';
import OfflineStatusBar from '../components/OfflineStatusBar';
import Button from '../components/Button';
import { colors, spacing, textStyles } from '../utils/theme';

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
    Alert.alert(
      'Network Status',
      `Network status simulated as ${!isOnline ? 'online' : 'offline'}. This is just for UI testing.`
    );
  };

  // Load data on mount
  useEffect(() => {
    loadData();
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
              <Text style={styles.statusLabel}>Last Sync:</Text>
              <Text style={styles.statusValue}>
                {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
              </Text>
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
              title="Add Mock Data"
              onPress={handleAddMockData}
              leftIcon={<Ionicons name="add-circle" size={18} color={colors.white} />}
              style={styles.actionButton}
            />
            
            <Button
              title="Sync Data"
              onPress={handleSync}
              leftIcon={<Ionicons name="sync" size={18} color={colors.white} />}
              style={styles.actionButton}
              disabled={!isOnline}
            />
            
            <Button
              title="Clear All Data"
              onPress={handleClearData}
              variant="danger"
              leftIcon={<Ionicons name="trash" size={18} color={colors.white} />}
              style={styles.actionButton}
            />
          </View>
          
          <View style={styles.dataCard}>
            <Text style={styles.sectionTitle}>Cached Data</Text>
            
            <View style={styles.dataSection}>
              <Text style={styles.dataTitle}>Budgets ({budgets.length})</Text>
              {budgets.length > 0 ? (
                budgets.map((budget, index) => (
                  <View key={budget.id} style={styles.dataItem}>
                    <Text style={styles.dataItemTitle}>{budget.name}</Text>
                    <Text style={styles.dataItemSubtitle}>
                      {budget.amount.toFixed(2)} • {budget.category} • {budget.period}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No budgets found</Text>
              )}
            </View>
            
            <View style={styles.dataSection}>
              <Text style={styles.dataTitle}>Expenses ({expenses.length})</Text>
              {expenses.length > 0 ? (
                expenses.map((expense, index) => (
                  <View key={expense.id} style={styles.dataItem}>
                    <Text style={styles.dataItemTitle}>{expense.description}</Text>
                    <Text style={styles.dataItemSubtitle}>
                      {expense.amount.toFixed(2)} • {expense.category} • {new Date(expense.date).toLocaleDateString()}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No expenses found</Text>
              )}
            </View>
            
            <View style={styles.dataSection}>
              <Text style={styles.dataTitle}>Savings Goals ({savingsGoals.length})</Text>
              {savingsGoals.length > 0 ? (
                savingsGoals.map((goal, index) => (
                  <View key={goal.id} style={styles.dataItem}>
                    <Text style={styles.dataItemTitle}>{goal.name}</Text>
                    <Text style={styles.dataItemSubtitle}>
                      {goal.currentAmount.toFixed(2)} / {goal.targetAmount.toFixed(2)} • 
                      {new Date(goal.deadline).toLocaleDateString()}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No savings goals found</Text>
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
    fontWeight: '600',
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
    fontWeight: '500',
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