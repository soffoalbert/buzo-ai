import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useNavigationState } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import { RootStackParamList } from '../navigation';
import { 
  loadSavingsGoals, 
  getSavingsStatistics, 
  deleteSavingsGoal, 
  checkAndRepairCorruptedGoals 
} from '../services/savingsService';
import { SavingsGoal, SAVINGS_TIPS } from '../models/SavingsGoal';
import syncService from '../services/syncService';
import { SyncStatus } from '../services/syncQueueService';
import { formatCurrency, formatDate } from '../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
 
const SavingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const navigationState = useNavigationState(state => state);
  const [activeTab, setActiveTab] = useState('goals');
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [statistics, setStatistics] = useState({
    totalSaved: 0,
    totalTarget: 0,
    savingsProgress: 0,
    completedGoals: 0,
    inProgressGoals: 0,
    totalGoals: 0,
    avgSavingsRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

  const handleBack = () => {
    if (navigationState.routes.length > 1) {
      navigation.goBack();
    }
  };
  
  // Load savings goals and statistics
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const goals = await loadSavingsGoals();
      const stats = await getSavingsStatistics();
      
      console.log('SavingsScreen loadData - Raw goals:', JSON.stringify(goals, null, 2).substring(0, 200) + '...');
      console.log('SavingsScreen loadData - Raw statistics:', JSON.stringify(stats, null, 2));
      
      setSavingsGoals(goals);
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading savings data:', error);
      Alert.alert('Error', 'Failed to load savings data. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  
  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );
  
  // Add a sync listener to refresh data when sync completes
  useEffect(() => {
    const unsubscribe = syncService.addSyncStatusListener((status: SyncStatus) => {
      if (!status.isSyncing && status.lastSuccessfulSync) {
        // If sync just completed, reload data
        console.log('Sync completed, refreshing savings data...');
        loadData();
      }
    });
    
    // Cleanup on unmount
    return () => unsubscribe();
  }, [loadData]);
  
  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };
  
  // Navigate to add savings goal screen
  const handleAddSavingsGoal = () => {
    navigation.navigate('AddSavingsGoal');
  };
  
  // Handle delete savings goal
  const handleDeleteSavingsGoal = async (goalId: string) => {
    Alert.alert(
      'Delete Savings Goal',
      'Are you sure you want to delete this savings goal?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSavingsGoal(goalId);
              // Refresh data
              loadData();
            } catch (error) {
              console.error('Error deleting savings goal:', error);
              Alert.alert('Error', 'Failed to delete savings goal. Please try again.');
            }
          },
        },
      ]
    );
  };
  
  // Function to handle repairing corrupted data
  const handleRepairData = async () => {
    try {
      setIsRepairing(true);
      const goals = await loadSavingsGoals();
      
      // Show alert to confirm
      Alert.alert(
        'Repair Savings Data',
        'This will reset any corrupted savings goal values to 0. Continue?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setIsRepairing(false)
          },
          {
            text: 'Repair',
            style: 'destructive',
            onPress: async () => {
              try {
                await checkAndRepairCorruptedGoals(goals);
                Alert.alert('Success', 'Your savings data has been repaired.');
                await loadData(); // Reload the data
              } catch (error) {
                console.error('Error repairing data:', error);
                Alert.alert('Error', 'Failed to repair data. Please try again.');
              } finally {
                setIsRepairing(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error loading goals for repair:', error);
      Alert.alert('Error', 'Failed to load goals for repair. Please try again.');
      setIsRepairing(false);
    }
  };
  
  // Calculate days remaining until deadline
  const calculateDaysRemaining = (deadline: string) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const timeDiff = deadlineDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff > 0 ? daysDiff : 0;
  };
  
  // Render savings goal item
  const renderGoalItem = ({ item }: { item: SavingsGoal }) => {
    const progress = (item.currentAmount / item.targetAmount) * 100;
    const daysRemaining = calculateDaysRemaining(item.targetDate);
    
    return (
      <TouchableOpacity 
        style={styles.goalCard}
        onPress={() => {
          // Navigate to goal details screen
          navigation.navigate('SavingsGoalDetail', { goalId: item.id });
        }}
      >
        <View style={styles.goalHeader}>
          <View style={[styles.goalIconContainer, { backgroundColor: `${item.color}20` }]}>
            <Ionicons name={item.icon as any} size={24} color={item.color} />
          </View>
          <View style={styles.goalInfo}>
            <Text style={styles.goalTitle}>{item.title}</Text>
            <Text style={styles.goalDeadline}>Target date: {formatDate(item.targetDate)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDeleteSavingsGoal(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.goalAmounts}>
          <Text style={styles.goalCurrentAmount}>R {item.currentAmount.toFixed(2)}</Text>
          <Text style={styles.goalTargetAmount}>of R {item.targetAmount.toFixed(2)}</Text>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${progress}%`, backgroundColor: item.color }
            ]} 
          />
        </View>
        
        <View style={styles.goalFooter}>
          <Text style={styles.goalProgressText}>{progress.toFixed(0)}% complete</Text>
          <Text style={styles.goalTimeRemaining}>{daysRemaining} days remaining</Text>
        </View>
      </TouchableOpacity>
    );
  };
  
  // Render savings tip item
  const renderTipItem = ({ item, index }: { item: string, index: number }) => (
    <View style={styles.tipCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconContainer}>
          <Ionicons name="bulb-outline" size={24} color={colors.accent} />
        </View>
        <Text style={styles.tipTitle}>Savings Tip #{index + 1}</Text>
      </View>
      <Text style={styles.tipText}>{item}</Text>
    </View>
  );
  
  // Render empty state
  const renderEmptyGoals = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="wallet-outline" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyTitle}>No Savings Goals Yet</Text>
      <Text style={styles.emptyText}>
        Start saving for your future by creating your first savings goal.
      </Text>
      <TouchableOpacity 
        style={styles.emptyButton}
        onPress={handleAddSavingsGoal}
      >
        <Text style={styles.emptyButtonText}>Create Goal</Text>
      </TouchableOpacity>
    </View>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        {navigationState.routes.length > 1 && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Savings</Text>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={handleAddSavingsGoal}
        >
          <Ionicons name="add-circle" size={40} color={colors.primary} />
        </TouchableOpacity>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading savings data...</Text>
        </View>
      ) : (
        <>
          {/* Savings Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Total Savings</Text>
            <Text style={styles.summaryAmount}>
              R {(statistics.totalSaved > 1000000000 ? 0 : statistics.totalSaved).toFixed(2)}
              {statistics.totalSaved > 1000000000 && (
                <Text style={{fontSize: 14, color: colors.error}}> (Error: Value reset - please update your goals)</Text>
              )}
            </Text>
            <View style={styles.summaryDetails}>
              <Text style={styles.summaryTarget}>
                of R {(statistics.totalTarget > 1000000000 ? 0 : statistics.totalTarget).toFixed(2)} target 
                ({(statistics.totalTarget > 0 && statistics.totalTarget <= 1000000000) ? 
                  (Math.min(statistics.savingsProgress, 100)).toFixed(0) : '0'}%)
              </Text>
            </View>
          </View>
          
          {/* Display a warning if we detected unrealistically large values */}
          {(statistics.totalSaved > 1000000000 || statistics.totalTarget > 1000000000) && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                We detected an unrealistically large value in your savings data. The display has been reset to 0.
                Please edit your savings goals to correct this.
              </Text>
              <TouchableOpacity
                style={styles.repairButton}
                onPress={handleRepairData}
                disabled={isRepairing}
              >
                {isRepairing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.repairButtonText}>Repair Data</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          
          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'goals' && styles.activeTab]}
              onPress={() => setActiveTab('goals')}
            >
              <Text style={[styles.tabText, activeTab === 'goals' && styles.activeTabText]}>
                Goals
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'tips' && styles.activeTab]}
              onPress={() => setActiveTab('tips')}
            >
              <Text style={[styles.tabText, activeTab === 'tips' && styles.activeTabText]}>
                Savings Tips
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Content based on active tab */}
          {activeTab === 'goals' ? (
            <FlatList
              data={savingsGoals}
              renderItem={renderGoalItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
              ListEmptyComponent={renderEmptyGoals}
            />
          ) : (
            <FlatList
              data={SAVINGS_TIPS}
              renderItem={renderTipItem}
              keyExtractor={(_, index) => index.toString()}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  colors={[colors.primary]}
                  tintColor={colors.primary}
                />
              }
            />
          )}
        </>
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
  headerButton: {
    padding: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: textStyles.body1.fontSize,
    color: colors.textSecondary,
  },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  summaryTitle: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    lineHeight: textStyles.subtitle2.lineHeight,
    color: colors.white,
    opacity: 0.8,
  },
  summaryAmount: {
    fontSize: textStyles.h1.fontSize,
    fontWeight: textStyles.h1.fontWeight as any,
    lineHeight: textStyles.h1.lineHeight,
    color: colors.white,
    marginVertical: spacing.xs,
  },
  summaryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTarget: {
    fontSize: textStyles.body2.fontSize,
    color: colors.white,
    opacity: 0.8,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
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
    paddingBottom: spacing.xl * 2, // Extra padding for floating button
  },
  goalCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  goalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: textStyles.subtitle1.fontSize,
    fontWeight: textStyles.subtitle1.fontWeight as any,
    color: colors.text,
  },
  goalDeadline: {
    fontSize: textStyles.caption.fontSize,
    color: colors.textSecondary,
  },
  goalAmounts: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  goalCurrentAmount: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    color: colors.text,
    marginRight: spacing.xs,
  },
  goalTargetAmount: {
    fontSize: textStyles.body2.fontSize,
    color: colors.textSecondary,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  goalProgressText: {
    fontSize: textStyles.caption.fontSize,
    color: colors.textSecondary,
  },
  goalTimeRemaining: {
    fontSize: textStyles.caption.fontSize,
    color: colors.textSecondary,
  },
  tipCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.accent}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  tipTitle: {
    fontSize: textStyles.subtitle1.fontSize,
    fontWeight: textStyles.subtitle1.fontWeight as any,
    color: colors.text,
  },
  tipText: {
    fontSize: textStyles.body1.fontSize,
    color: colors.text,
    lineHeight: textStyles.body1.lineHeight,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyTitle: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: textStyles.body1.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: textStyles.button.fontSize,
    fontWeight: textStyles.button.fontWeight as any,
  },
  statisticsCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    padding: spacing.xs,
    ...shadows.sm,
  },
  warningContainer: {
    backgroundColor: colors.error,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  warningText: {
    fontSize: textStyles.body1.fontSize,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  repairButton: {
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    alignSelf: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  repairButtonText: {
    color: colors.error,
    fontWeight: 'bold',
  },
});

export default SavingsScreen; 