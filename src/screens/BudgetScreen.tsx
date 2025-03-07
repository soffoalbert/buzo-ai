import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
  AppState,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useNavigationState } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import NetInfo from '@react-native-community/netinfo';
import * as Progress from 'react-native-progress';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import { RootStackParamList } from '../navigation';
import { Budget } from '../models/Budget';
import { getBudgetStatistics } from '../services/budgetService';
import { budgetService } from '../services/budgetService';
import { supabase } from '../api/supabaseClient';
import syncQueueService from '../services/syncQueueService';
import NetworkManager from '../utils/NetworkManager';
import { formatCurrency, formatCurrencyAbbreviated } from '../utils/helpers';
import { formatCategory, getCategoryIcon } from '../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const BudgetScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const navigationState = useNavigationState(state => state);
  const [activeTab, setActiveTab] = useState('categories');
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statistics, setStatistics] = useState({
    totalBudgeted: 0,
    totalSpent: 0,
    remainingBudget: 0,
    spendingPercentage: 0,
  });
  const [syncIssue, setSyncIssue] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const isOffline = !NetworkManager.useNetworkStatus();

  const handleBack = () => {
    if (navigationState.routes.length > 1) {
      navigation.goBack();
    }
  };

  const fetchBudgets = async () => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('User not authenticated');
        Alert.alert('Error', 'You need to be logged in to view budgets.');
        setIsLoading(false);
        return;
      }
      
      // Follow the same approach as financialIntegrationService - load data in parallel
      const [expensesResult, loadedBudgets] = await Promise.all([
        // Get all expenses with their categories
        supabase
          .from('expenses')
          .select('id, amount, category, savings_contribution')
          .eq('user_id', user.id),
          
        // Get all budgets
        budgetService.getUserBudgets(user.id).catch((err: Error) => {
          console.error('Error fetching budgets:', err);
          return [];
        }),
      ]);
      
      // Process expense data
      let expenseData: any[] = [];
      if (expensesResult.error) {
        console.error('Error fetching expenses:', expensesResult.error);
      } else {
        expenseData = expensesResult.data || [];
        console.log('Found', expenseData.length, 'expenses');
      }
      
      // Group expenses by category
      const expensesByCategory: Record<string, { spent: number, saved: number }> = {};
      
      // Process expenses to calculate spending and savings per category
      if (expenseData && expenseData.length > 0) {
        expenseData.forEach((expense: any) => {
          // Skip expenses without a category
          if (!expense.category) return;
          
          // Initialize category record if it doesn't exist
          if (!expensesByCategory[expense.category]) {
            expensesByCategory[expense.category] = {
              spent: 0,
              saved: 0
            };
          }
          
          // Add to spent or saved based on savings_contribution flag
          if (expense.savings_contribution) {
            expensesByCategory[expense.category].saved += expense.amount;
          } else {
            expensesByCategory[expense.category].spent += expense.amount;
          }
        });
        
        console.log('Expenses grouped by category:', expensesByCategory);
      }
      
      // Update budgets with calculated spent and saved amounts by matching categories
      const processedBudgets = loadedBudgets.map((budget: Budget) => {
        // Get expenses for this budget's category
        const categoryExpenses = expensesByCategory[budget.category] || { spent: 0, saved: 0 };
        
        // Return updated budget with spent and saved amounts
        return {
          ...budget,
          spent: categoryExpenses.spent,
          savingsAllocation: categoryExpenses.saved,
          remainingAmount: budget.amount - categoryExpenses.spent - categoryExpenses.saved
        };
      });
      
      console.log('Budgets updated with category expense data:', 
        processedBudgets.map((b: Budget) => ({ 
          id: b.id, 
          name: b.name,
          category: b.category,
          spent: b.spent, 
          saved: b.savingsAllocation 
        }))
      );
      
      // Filter out duplicates
      const uniqueBudgetsMap = new Map();
      processedBudgets.forEach(budget => {
        if (budget.id) {
          uniqueBudgetsMap.set(budget.id, budget);
        }
      });
      
      const uniqueBudgets = Array.from(uniqueBudgetsMap.values());
      
      if (uniqueBudgets.length < processedBudgets.length) {
        console.warn(`Removed ${processedBudgets.length - uniqueBudgets.length} duplicate budgets`);
      }
      
      setBudgets(uniqueBudgets);
      
      // Calculate summary statistics
      const totalBudgeted = uniqueBudgets.reduce((sum, budget) => sum + budget.amount, 0);
      const totalSpent = uniqueBudgets.reduce((sum, budget) => sum + budget.spent, 0);
      const remainingBudget = totalBudgeted - totalSpent;
      const spendingPercentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
      
      setStatistics({
        totalBudgeted,
        totalSpent,
        remainingBudget,
        spendingPercentage,
      });
      
      // Check for sync issues
      const syncQueue = await syncQueueService.getSyncQueue();
      if (syncQueue.length > 0) {
        setSyncIssue(true);
      } else {
        setSyncIssue(false);
      }
    } catch (error) {
      console.error('Error loading budgets:', error);
      Alert.alert('Error', 'Failed to load budgets. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      console.log('Budget screen focused, refreshing budget data...');
      fetchBudgets();
    }, [isOffline])
  );

  // Set up a listener to refresh data when the app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        console.log('App has come to the foreground, refreshing budget data...');
        fetchBudgets();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleRefresh = async () => {
    console.log('Manual refresh initiated by user');
    setRefreshing(true);
    try {
      const syncStatus = await syncQueueService.getSyncStatus();
      
      if (syncStatus?.isSyncing && syncStatus.lastSyncAttempt && 
          (Date.now() - syncStatus.lastSyncAttempt > 5 * 60 * 1000)) {
        setSyncIssue(true);
      }
      
      if (isOffline) {
        console.log('Offline mode: Refreshing from local storage only');
        await fetchBudgets();
      } else {
        console.log('Online mode: Refreshing with sync');
        // Force a data reload
        await syncQueueService.synchronizeBudgets(true);
        await fetchBudgets();
      }
    } catch (error) {
      console.error('Error refreshing budgets:', error);
      Alert.alert('Error', 'Failed to refresh budgets. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const navigateToAddBudget = () => {
    navigation.navigate('AddBudget');
  };

  const handleFixSync = async () => {
    try {
      Alert.alert(
        "Fix Sync Issues",
        "This will reset the sync status and force a new sync. Continue?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Reset & Sync",
            onPress: async () => {
              setIsLoading(true);
              await syncQueueService.resetSyncStatus();
              await syncQueueService.synchronizeBudgets(true);
              await fetchBudgets();
              Alert.alert("Sync Reset", "Sync status has been reset and a forced sync was attempted.");
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error resetting sync:', error);
      Alert.alert('Error', 'Failed to reset sync status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMenuPress = () => {
    setShowMenu(true);
  };
  
  const handleMenuClose = () => {
    setShowMenu(false);
  };
  
  const handleResetSync = async () => {
    setShowMenu(false);
    
    try {
      setIsLoading(true);
      await syncQueueService.resetSyncStatus();
      Alert.alert("Sync Reset", "Sync status has been reset. Pull down to refresh and sync again.");
      setSyncIssue(false);
    } catch (error) {
      console.error('Error resetting sync:', error);
      Alert.alert('Error', 'Failed to reset sync status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToBudgetDetail = (budgetId: string) => {
    // Use type assertion to bypass type checking
    (navigation as any).navigate('BudgetDetail', { budgetId });
  };

  const renderCategoryItem = ({ item }: { item: Budget }) => {
    // Keep the new calculation logic
    const budgetAmount = item.amount || 0;
    const spentAmount = item.spent || 0;
    const savingsAmount = item.savingsAllocation || 0;
    const autoSavePercentage = typeof item.autoSavePercentage === 'number' ? item.autoSavePercentage : 0;
    
    // Calculate percentages
    const spentPercentage = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
    const savingsPercentage = budgetAmount > 0 ? (savingsAmount / budgetAmount) * 100 : 0;
    const isOverBudget = spentAmount + savingsAmount > budgetAmount;
    const isPendingSync = item.id && item.id.startsWith('local_');
    
    // Use a safe default if icon is not valid
    const safeIcon = (item.icon && typeof item.icon === 'string' && 
                     Ionicons.hasOwnProperty(item.icon)) 
                     ? item.icon 
                     : 'wallet-outline';
    
    return (
      <TouchableOpacity 
        style={styles.categoryCard} 
        onPress={() => navigateToBudgetDetail(item.id)}
      >
        <View style={styles.categoryHeader}>
          <View style={[styles.categoryIconContainer, { backgroundColor: `${item.color}20` }]}>
            <Ionicons name={safeIcon as any} size={24} color={item.color} />
          </View>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryName}>
              {item.name}
              {isPendingSync && (
                <Text style={styles.pendingSyncTag}> (Offline)</Text>
              )}
            </Text>
            <View style={styles.amountContainer}>
              <Text style={styles.categoryAmount}>
                R {spentAmount.toFixed(2)} <Text style={styles.budgetLimit}>/ R {budgetAmount.toFixed(2)}</Text>
              </Text>
              {savingsAmount > 0 && (
                <Text style={styles.savingsText}>
                  (R {savingsAmount.toFixed(2)} saved)
                </Text>
              )}
            </View>
          </View>
          {isPendingSync ? (
            <Ionicons name="cloud-upload-outline" size={20} color={colors.warning || '#856404'} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          )}
        </View>
        
        <View style={styles.progressBarContainer}>
          {/* Spent amount progress bar */}
          <View 
            style={[
              styles.progressBar, 
              { 
                width: `${Math.min(spentPercentage, 100)}%`,
                backgroundColor: isOverBudget ? colors.error : item.color
              }
            ]} 
          />
          {/* Savings allocation progress bar (if applicable) */}
          {savingsAmount > 0 && (
            <View 
              style={[
                styles.savingsProgressBar, 
                { 
                  width: `${Math.min(savingsPercentage, 100)}%`,
                  backgroundColor: colors.success
                }
              ]} 
            />
          )}
        </View>
        
        <View style={styles.categoryFooter}>
          <View style={styles.footerLeft}>
            <Text style={[
              styles.remainingText,
              isOverBudget ? styles.overBudgetText : null
            ]}>
              {isOverBudget 
                ? `R ${(spentAmount + savingsAmount - budgetAmount).toFixed(2)} over budget` 
                : `R ${(budgetAmount - spentAmount - savingsAmount).toFixed(2)} remaining`
              }
            </Text>
            {autoSavePercentage > 0 && (
              <Text style={styles.autoSaveText}>
                Auto-save: {autoSavePercentage}%
              </Text>
            )}
          </View>
          <Text style={styles.percentageText}>
            {Math.round(spentPercentage + savingsPercentage)}%
          </Text>
        </View>

        {item.linkedSavingsGoals && item.linkedSavingsGoals.length > 0 && (
          <View style={styles.linkedGoalsContainer}>
            <Text style={styles.linkedGoalsTitle}>Linked Goals:</Text>
            <View style={styles.goalChips}>
              {item.linkedSavingsGoals.map((goalId, index) => (
                <View key={goalId} style={styles.goalChip}>
                  <Ionicons name="wallet-outline" size={14} color={colors.primary} />
                  <Text style={styles.goalChipText}>Goal {index + 1}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name="wallet-outline" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyStateTitle}>No budgets yet</Text>
      <Text style={styles.emptyStateText}>
        Create your first budget to start tracking your spending
      </Text>
      <TouchableOpacity 
        style={styles.emptyStateButton}
        onPress={navigateToAddBudget}
      >
        <Text style={styles.emptyStateButtonText}>Create Budget</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading budgets...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.headerContainer}>
        {navigationState.routes.length > 1 && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Budgets</Text>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={navigateToAddBudget}
          >
            <Ionicons name="add-circle-outline" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
      
      {syncIssue && (
        <TouchableOpacity onPress={handleFixSync} style={styles.syncIssueButton}>
          <Ionicons name="warning-outline" size={18} color={colors.warning} />
          <Text style={styles.syncIssueText}>Sync issues detected. Tap to fix.</Text>
        </TouchableOpacity>
      )}
      
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.white} />
          <Text style={styles.offlineText}>You're offline. Changes will sync when you reconnect.</Text>
        </View>
      )}
      
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Budget</Text>
            <Text style={styles.summaryValue}>{formatCurrencyAbbreviated(statistics.totalBudgeted)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Spent</Text>
            <Text style={styles.summaryValue}>{formatCurrencyAbbreviated(statistics.totalSpent)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Remaining</Text>
            <Text style={[
              styles.summaryValue,
              statistics.remainingBudget < 0 ? styles.negativeAmount : styles.positiveAmount
            ]}>
              {formatCurrencyAbbreviated(statistics.remainingBudget)}
            </Text>
          </View>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { 
                width: `${Math.min(statistics.spendingPercentage, 100)}%`,
                backgroundColor: statistics.spendingPercentage > 90 ? colors.error : colors.primary
              }
            ]} 
          />
        </View>
        
        <Text style={styles.progressText}>
          {statistics.spendingPercentage > 100 
            ? `You've spent ${(statistics.spendingPercentage - 100).toFixed(0)}% more than your budget`
            : `You've spent ${statistics.spendingPercentage.toFixed(0)}% of your budget`
          }
        </Text>
      </View>
      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'categories' && styles.activeTab]}
          onPress={() => setActiveTab('categories')}
        >
          <Text style={[styles.tabText, activeTab === 'categories' && styles.activeTabText]}>
            Categories
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'transactions' && styles.activeTab]}
          onPress={() => setActiveTab('transactions')}
        >
          <Text style={[styles.tabText, activeTab === 'transactions' && styles.activeTabText]}>
            Transactions
          </Text>
        </TouchableOpacity>
      </View>
      
      {activeTab === 'categories' ? (
        <FlatList
          data={budgets}
          renderItem={renderCategoryItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      ) : (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="receipt-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyStateText}>Transaction history coming soon</Text>
        </View>
      )}
    
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  headerTitle: {
    fontSize: textStyles.h4.fontSize,
    fontWeight: textStyles.h4.fontWeight as any,
    color: colors.text,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: spacing.sm,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxxl,
  },
  categoryCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryAmount: {
    fontSize: textStyles.body2.fontSize,
    color: colors.text,
  },
  budgetLimit: {
    fontSize: textStyles.caption.fontSize,
    color: colors.textSecondary,
  },
  savingsText: {
    fontSize: textStyles.caption.fontSize,
    color: colors.success,
    marginLeft: spacing.xs,
  },
  autoSaveText: {
    fontSize: textStyles.caption.fontSize,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: borderRadius.round,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    borderRadius: borderRadius.round,
    minWidth: 5,
  },
  savingsProgressBar: {
    position: 'absolute',
    height: '100%',
    borderRadius: borderRadius.round,
    opacity: 0.7,
    minWidth: 5,
  },
  categoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'column',
  },
  remainingText: {
    fontSize: textStyles.caption.fontSize,
    color: colors.success,
  },
  overBudgetText: {
    color: colors.error,
  },
  percentageText: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    color: colors.textSecondary,
  },
  linkedGoalsContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkedGoalsTitle: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  goalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}15`,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  goalChipText: {
    fontSize: 12,
    color: colors.primary,
    marginLeft: 4,
  },
  pendingSyncTag: {
    fontSize: 12,
    color: colors.warning,
    fontStyle: 'italic',
  },
  // Styles for the summary card
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: textStyles.caption.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    fontSize: textStyles.h4.fontSize,
    fontWeight: textStyles.h4.fontWeight as any,
    color: colors.text,
  },
  summarySaveValue: {
    color: colors.success,
  },
  summarySpendValue: {
    color: colors.error,
  },
  summaryBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: borderRadius.round,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  summaryBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.round,
  },
  summaryBarLabel: {
    fontSize: textStyles.caption.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: 4,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: textStyles.button.fontSize,
    fontWeight: textStyles.button.fontWeight as any,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.white,
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateImage: {
    width: 120,
    height: 120,
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    fontSize: textStyles.subtitle1.fontSize,
    fontWeight: textStyles.subtitle1.fontWeight as any,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: textStyles.body2.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyStateButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  emptyStateButtonText: {
    color: colors.white,
    fontSize: textStyles.button.fontSize,
    fontWeight: textStyles.button.fontWeight as any,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: textStyles.body1.fontSize,
    color: colors.textSecondary,
  },
  syncIssueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  syncIssueText: {
    color: colors.warning,
    marginLeft: spacing.sm,
    fontSize: 14,
    fontWeight: '500',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.textSecondary,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.sm,
  },
  offlineText: {
    color: colors.white,
    marginLeft: spacing.sm,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default BudgetScreen;