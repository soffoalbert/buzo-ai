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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useNavigationState } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import NetInfo from '@react-native-community/netinfo';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import { RootStackParamList } from '../navigation';
import { Budget } from '../models/Budget';
import { getBudgetStatistics } from '../services/budgetService';
import { budgetService } from '../services/budgetService';
import { supabase } from '../api/supabaseClient';
import syncQueueService from '../services/syncQueueService';
import NetworkManager from '../utils/NetworkManager';

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
      
      let loadedBudgets: Budget[] = [];
      
      if (!isOffline) {
        try {
          console.log('Synchronizing budgets before fetching them...');
          await syncQueueService.synchronizeBudgets(true);
          setSyncIssue(false);
          
          loadedBudgets = await budgetService.getUserBudgets(user.id);
        } catch (syncError) {
          console.error('Sync error:', syncError);
          setSyncIssue(true);
          
          console.log('Falling back to local budgets due to sync error');
          loadedBudgets = await budgetService.getUserBudgetsOffline(user.id);
        }
      } else {
        console.log('Offline mode: Loading budgets from local storage');
        loadedBudgets = await budgetService.getUserBudgetsOffline(user.id);
        
        const syncQueue = await syncQueueService.getSyncQueue();
        
        if (syncQueue.length > 0) {
          setSyncIssue(true);
        }
      }
      
      const uniqueBudgetsMap = new Map();
      loadedBudgets.forEach(budget => {
        if (budget.id) {
          uniqueBudgetsMap.set(budget.id, budget);
        }
      });
      
      const uniqueBudgets = Array.from(uniqueBudgetsMap.values());
      
      if (uniqueBudgets.length < loadedBudgets.length) {
        console.warn(`Removed ${loadedBudgets.length - uniqueBudgets.length} duplicate budgets`);
      }
      
      setBudgets(uniqueBudgets);
      
      const totalBudgeted = uniqueBudgets.reduce((sum, budget) => sum + budget.amount, 0);
      const totalSpent = uniqueBudgets.reduce((sum, budget) => sum + (budget.spent || 0), 0);
      const remainingBudget = totalBudgeted - totalSpent;
      const spendingPercentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
      
      setStatistics({
        totalBudgeted,
        totalSpent,
        remainingBudget,
        spendingPercentage,
      });
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
      fetchBudgets();
    }, [isOffline])
  );

  const handleRefresh = async () => {
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

  const renderCategoryItem = ({ item }: { item: Budget }) => {
    const spentPercentage = (item.spent / item.amount) * 100;
    const savingsPercentage = ((item.savingsAllocation || 0) / item.amount) * 100;
    const isOverBudget = item.spent + (item.savingsAllocation || 0) > item.amount;
    const isPendingSync = item.id && item.id.startsWith('local_');
    
    return (
      <TouchableOpacity style={styles.categoryCard}>
        <View style={styles.categoryHeader}>
          <View style={[styles.categoryIconContainer, { backgroundColor: `${item.color}20` }]}>
            <Ionicons name={item.icon as any} size={24} color={item.color} />
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
                R {item.spent.toFixed(2)} <Text style={styles.budgetLimit}>/ R {item.amount.toFixed(2)}</Text>
              </Text>
              {item.savingsAllocation > 0 && (
                <Text style={styles.savingsText}>
                  (R {item.savingsAllocation.toFixed(2)} saved)
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
          <View 
            style={[
              styles.progressBar, 
              { 
                width: `${Math.min(spentPercentage, 100)}%`,
                backgroundColor: isOverBudget ? colors.error : item.color
              }
            ]} 
          />
          {item.savingsAllocation > 0 && (
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
                ? `R ${(item.spent + (item.savingsAllocation || 0) - item.amount).toFixed(2)} over budget` 
                : `R ${(item.amount - item.spent - (item.savingsAllocation || 0)).toFixed(2)} remaining`
              }
            </Text>
            {item.autoSavePercentage > 0 && (
              <Text style={styles.autoSaveText}>
                Auto-save: {item.autoSavePercentage}%
              </Text>
            )}
          </View>
          <Text style={styles.percentageText}>
            {((spentPercentage + savingsPercentage)).toFixed(0)}%
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
      
      <View style={styles.header}>
        {navigationState.routes.length > 1 && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Budgets</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleMenuPress} style={styles.menuButton}>
            <Ionicons name="ellipsis-vertical" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={navigateToAddBudget}
          >
            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          {showMenu && (
            <View style={styles.menuContainer}>
              <TouchableOpacity onPress={handleResetSync} style={styles.menuItem}>
                <Ionicons name="refresh" size={18} color={colors.textPrimary} />
                <Text style={styles.menuItemText}>Reset Sync Status</Text>
              </TouchableOpacity>
            </View>
          )}
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
            <Text style={styles.summaryValue}>R {statistics.totalBudgeted.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Spent</Text>
            <Text style={styles.summaryValue}>R {statistics.totalSpent.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Remaining</Text>
            <Text style={[
              styles.summaryValue,
              statistics.remainingBudget < 0 ? styles.negativeAmount : styles.positiveAmount
            ]}>
              R {statistics.remainingBudget.toFixed(2)}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: textStyles.h2.fontSize,
    fontWeight: textStyles.h2.fontWeight as any,
    lineHeight: textStyles.h2.lineHeight,
    color: textStyles.h2.color,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: spacing.xs,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    lineHeight: textStyles.caption.lineHeight,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    fontSize: textStyles.subtitle1.fontSize,
    fontWeight: textStyles.subtitle1.fontWeight as any,
    lineHeight: textStyles.subtitle1.lineHeight,
    color: textStyles.subtitle1.color,
  },
  positiveAmount: {
    color: colors.success,
  },
  negativeAmount: {
    color: colors.error,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: borderRadius.round,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: borderRadius.round,
  },
  progressText: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    lineHeight: textStyles.caption.lineHeight,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    padding: spacing.xs,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  activeTab: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  tabText: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  categoryCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
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
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
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
  categoryAmount: {
    fontSize: textStyles.body2.fontSize,
    color: colors.text,
  },
  budgetLimit: {
    color: colors.textSecondary,
  },
  categoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
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
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateTitle: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: textStyles.body1.fontSize,
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
  floatingButton: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  syncIssueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningBg || '#FFF3CD',
    paddingVertical: 8,
    paddingHorizontal: spacing.medium,
    marginHorizontal: spacing.medium,
    marginBottom: spacing.medium,
    borderRadius: borderRadius.small,
    borderWidth: 1,
    borderColor: colors.warning || '#FFE69C',
  },
  syncIssueText: {
    color: colors.warning || '#856404',
    marginLeft: spacing.small,
    fontSize: 14,
    fontWeight: '500',
  },
  menuButton: {
    padding: spacing.small,
    marginRight: spacing.small,
  },
  menuContainer: {
    position: 'absolute',
    top: 45,
    right: 10,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.small,
    ...shadows.md,
    zIndex: 10,
    minWidth: 180,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
  },
  menuItemText: {
    marginLeft: spacing.small,
    color: colors.textPrimary,
    fontSize: 16,
  },
  pendingSyncTag: {
    fontSize: 12,
    color: colors.warning || '#856404',
    fontStyle: 'italic',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.textSecondary || '#6c757d',
    paddingVertical: 8,
    paddingHorizontal: spacing.medium,
    marginHorizontal: spacing.medium,
    marginBottom: spacing.medium,
    borderRadius: borderRadius.small,
  },
  offlineText: {
    color: colors.white,
    marginLeft: spacing.small,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default BudgetScreen; 