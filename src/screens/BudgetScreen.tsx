import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';

// Mock data for budget categories
const BUDGET_CATEGORIES = [
  { id: '1', name: 'Housing', budget: 1500, spent: 1500, color: colors.primary, icon: 'home-outline' },
  { id: '2', name: 'Food', budget: 1200, spent: 950, color: colors.secondary, icon: 'restaurant-outline' },
  { id: '3', name: 'Transport', budget: 800, spent: 420, color: colors.accent, icon: 'car-outline' },
  { id: '4', name: 'Entertainment', budget: 500, spent: 349.25, color: colors.info, icon: 'film-outline' },
  { id: '5', name: 'Utilities', budget: 600, spent: 580, color: colors.error, icon: 'flash-outline' },
  { id: '6', name: 'Shopping', budget: 400, spent: 320, color: colors.success, icon: 'cart-outline' },
  { id: '7', name: 'Savings', budget: 1000, spent: 0, color: '#6366F1', icon: 'wallet-outline' },
];

const BudgetScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState('categories');
  
  // Calculate total budget and spending
  const totalBudget = BUDGET_CATEGORIES.reduce((sum, category) => sum + category.budget, 0);
  const totalSpent = BUDGET_CATEGORIES.reduce((sum, category) => sum + category.spent, 0);
  const remainingBudget = totalBudget - totalSpent;
  const spentPercentage = (totalSpent / totalBudget) * 100;

  const renderCategoryItem = ({ item }: { item: typeof BUDGET_CATEGORIES[0] }) => {
    const spentPercentage = (item.spent / item.budget) * 100;
    const isOverBudget = item.spent > item.budget;
    
    return (
      <TouchableOpacity style={styles.categoryCard}>
        <View style={styles.categoryHeader}>
          <View style={[styles.categoryIconContainer, { backgroundColor: `${item.color}20` }]}>
            <Ionicons name={item.icon as any} size={24} color={item.color} />
          </View>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryName}>{item.name}</Text>
            <Text style={styles.categoryAmount}>
              R {item.spent.toFixed(2)} <Text style={styles.budgetLimit}>/ R {item.budget.toFixed(2)}</Text>
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
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
        </View>
        
        <View style={styles.categoryFooter}>
          <Text style={[
            styles.remainingText,
            isOverBudget ? styles.overBudgetText : null
          ]}>
            {isOverBudget 
              ? `R ${(item.spent - item.budget).toFixed(2)} over budget` 
              : `R ${(item.budget - item.spent).toFixed(2)} remaining`
            }
          </Text>
          <Text style={styles.percentageText}>{spentPercentage.toFixed(0)}%</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Budget</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="add-circle" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
      
      {/* Budget Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Budget</Text>
            <Text style={styles.summaryValue}>R {totalBudget.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Spent</Text>
            <Text style={styles.summaryValue}>R {totalSpent.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Remaining</Text>
            <Text style={[
              styles.summaryValue,
              remainingBudget < 0 ? styles.negativeAmount : styles.positiveAmount
            ]}>
              R {remainingBudget.toFixed(2)}
            </Text>
          </View>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { 
                width: `${Math.min(spentPercentage, 100)}%`,
                backgroundColor: spentPercentage > 90 ? colors.error : colors.primary
              }
            ]} 
          />
        </View>
        
        <Text style={styles.progressText}>
          {spentPercentage > 100 
            ? `You've spent ${(spentPercentage - 100).toFixed(0)}% more than your budget`
            : `You've spent ${spentPercentage.toFixed(0)}% of your budget`
          }
        </Text>
      </View>
      
      {/* Tabs */}
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
      
      {/* Categories List */}
      {activeTab === 'categories' ? (
        <FlatList
          data={BUDGET_CATEGORIES}
          renderItem={renderCategoryItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="receipt-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyStateText}>Transaction history coming soon</Text>
        </View>
      )}
      
      {/* Add Budget Button */}
      <TouchableOpacity style={styles.floatingButton}>
        <Ionicons name="add" size={24} color={colors.white} />
      </TouchableOpacity>
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
  headerTitle: {
    fontSize: textStyles.h2.fontSize,
    fontWeight: textStyles.h2.fontWeight as any,
    lineHeight: textStyles.h2.lineHeight,
    color: textStyles.h2.color,
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
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    lineHeight: textStyles.subtitle2.lineHeight,
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.white,
  },
  listContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  categoryCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
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
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: textStyles.subtitle1.fontSize,
    fontWeight: textStyles.subtitle1.fontWeight as any,
    lineHeight: textStyles.subtitle1.lineHeight,
    color: textStyles.subtitle1.color,
  },
  categoryAmount: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: textStyles.body2.fontWeight as any,
    lineHeight: textStyles.body2.lineHeight,
    color: textStyles.body2.color,
  },
  budgetLimit: {
    color: colors.textSecondary,
  },
  categoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  remainingText: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    lineHeight: textStyles.caption.lineHeight,
    color: colors.success,
  },
  overBudgetText: {
    color: colors.error,
  },
  percentageText: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    lineHeight: textStyles.caption.lineHeight,
    color: colors.textSecondary,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyStateText: {
    fontSize: textStyles.body1.fontSize,
    fontWeight: textStyles.body1.fontWeight as any,
    lineHeight: textStyles.body1.lineHeight,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
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
  scrollViewContent: {
    paddingBottom: 100,
  },
});

export default BudgetScreen; 