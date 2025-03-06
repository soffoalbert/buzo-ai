import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import { RootStackParamList } from '../navigation';
import { Budget } from '../models/Budget';
import { budgetService } from '../services/budgetService';
import { supabase } from '../api/supabaseClient';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type BudgetDetailRouteProp = RouteProp<RootStackParamList, 'BudgetDetail'>;

const BudgetDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<BudgetDetailRouteProp>();
  const { budgetId } = route.params;
  
  const [budget, setBudget] = useState<Budget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadBudget = async () => {
      try {
        setIsLoading(true);
        
        if (!budgetId) {
          Alert.alert('Error', 'Budget ID is missing');
          navigation.goBack();
          return;
        }
        
        // First, get the budget details
        const budgetResult = await budgetService.getBudget(budgetId).catch((err) => {
          console.error('Error fetching budget:', err);
          return null;
        });
        
        if (!budgetResult) {
          Alert.alert('Error', 'Budget not found');
          navigation.goBack();
          return;
        }
        
        // Now that we have the budget, get expenses for its category
        const expensesResult = await supabase
          .from('expenses')
          .select('id, amount, category, savings_contribution')
          .eq('user_id', budgetResult.user_id);
        
        // Process expense data
        let spent = 0;
        let saved = 0;
        
        if (!expensesResult.error && expensesResult.data) {
          // Filter expenses by category
          const categoryExpenses = expensesResult.data.filter(
            expense => expense.category === budgetResult.category
          );
          
          console.log(`Found ${categoryExpenses.length} expenses for category "${budgetResult.category}"`);
          
          // Calculate spent and saved amounts
          categoryExpenses.forEach(expense => {
            if (expense.savings_contribution) {
              saved += expense.amount;
            } else {
              spent += expense.amount;
            }
          });
          
          console.log(`Calculated: spent=${spent}, saved=${saved}`);
        } else if (expensesResult.error) {
          console.error('Error fetching expenses:', expensesResult.error);
        }
        
        // Update budget with calculated spent and saved amounts
        const updatedBudget = {
          ...budgetResult,
          spent: spent,
          savingsAllocation: saved,
          remainingAmount: budgetResult.amount - spent - saved
        };
        
        setBudget(updatedBudget);
      } catch (error) {
        console.error('Error loading budget details:', error);
        Alert.alert('Error', 'Failed to load budget details');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadBudget();
  }, [budgetId, navigation]);
  
  const handleBack = () => {
    navigation.goBack();
  };
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading budget details...</Text>
      </SafeAreaView>
    );
  }
  
  if (!budget) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
        <Text style={styles.errorText}>Budget not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  // Calculate percentages
  const spentPercentage = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;
  const savingsPercentage = budget.amount > 0 ? ((budget.savingsAllocation || 0) / budget.amount) * 100 : 0;
  const isOverBudget = budget.spent + (budget.savingsAllocation || 0) > budget.amount;
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{budget.name}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="ellipsis-vertical" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.budgetCard}>
          <View style={styles.budgetHeader}>
            <View style={[styles.iconContainer, { backgroundColor: `${budget.color}20` }]}>
              <Ionicons name={budget.icon as any} size={32} color={budget.color} />
            </View>
            <View style={styles.budgetInfo}>
              <Text style={styles.budgetTitle}>{budget.name}</Text>
              <Text style={styles.budgetAmount}>R {budget.amount.toFixed(2)}</Text>
            </View>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Spent</Text>
              <Text style={styles.statValue}>R {budget.spent.toFixed(2)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Saved</Text>
              <Text style={styles.statValue}>R {(budget.savingsAllocation || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Remaining</Text>
              <Text style={[
                styles.statValue,
                isOverBudget ? styles.negativeAmount : styles.positiveAmount
              ]}>
                R {(budget.amount - budget.spent - (budget.savingsAllocation || 0)).toFixed(2)}
              </Text>
            </View>
          </View>
          
          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Budget Usage</Text>
            <View style={styles.progressBarContainer}>
              <View 
                style={[
                  styles.progressBar, 
                  { 
                    width: `${Math.min(spentPercentage, 100)}%`,
                    backgroundColor: isOverBudget ? colors.error : budget.color
                  }
                ]} 
              />
              {(budget.savingsAllocation || 0) > 0 && (
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
            <Text style={styles.progressText}>
              {isOverBudget 
                ? `You've spent ${Math.round(spentPercentage)}% of your budget (${Math.round(spentPercentage - 100)}% over)`
                : `You've spent ${Math.round(spentPercentage)}% of your budget`
              }
            </Text>
          </View>
        </View>
        
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <View style={styles.emptyStateContainer}>
            <Ionicons name="receipt-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyStateText}>No transactions yet</Text>
          </View>
        </View>
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  errorText: {
    fontSize: textStyles.h3.fontSize,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
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
    color: colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  budgetCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  budgetInfo: {
    flex: 1,
  },
  budgetTitle: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  budgetAmount: {
    fontSize: textStyles.h4.fontSize,
    fontWeight: textStyles.h4.fontWeight as any,
    color: colors.text,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: textStyles.caption.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: textStyles.subtitle1.fontSize,
    fontWeight: textStyles.subtitle1.fontWeight as any,
    color: colors.text,
  },
  positiveAmount: {
    color: colors.success,
  },
  negativeAmount: {
    color: colors.error,
  },
  progressContainer: {
    marginTop: spacing.md,
  },
  progressLabel: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: borderRadius.round,
    marginBottom: spacing.sm,
    overflow: 'hidden',
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
  progressText: {
    fontSize: textStyles.caption.fontSize,
    color: colors.textSecondary,
  },
  sectionContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  sectionTitle: {
    fontSize: textStyles.h4.fontSize,
    fontWeight: textStyles.h4.fontWeight as any,
    color: colors.text,
    marginBottom: spacing.md,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyStateText: {
    fontSize: textStyles.body1.fontSize,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: textStyles.button.fontSize,
    fontWeight: textStyles.button.fontWeight as any,
  },
});

export default BudgetDetailScreen; 