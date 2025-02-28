import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore
import { LineChart } from 'react-native-chart-kit';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';

const { width } = Dimensions.get('window');

const HomeScreen: React.FC = () => {
  // Mock data for the dashboard
  const balanceData = {
    currentBalance: 5280.75,
    income: 8500.00,
    expenses: 3219.25,
  };

  const budgetData = {
    total: 5000,
    spent: 3219.25,
    remaining: 1780.75,
    categories: [
      { name: 'Housing', amount: 1500, spent: 1500, color: colors.primary },
      { name: 'Food', amount: 1200, spent: 950, color: colors.secondary },
      { name: 'Transport', amount: 800, spent: 420, color: colors.accent },
      { name: 'Entertainment', amount: 500, spent: 349.25, color: colors.info },
      { name: 'Savings', amount: 1000, spent: 0, color: colors.success },
    ],
  };

  const savingsData = {
    goal: 10000,
    current: 2500,
    progress: 25,
  };

  const spendingChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [120, 85, 200, 150, 320, 250, 95],
        color: () => colors.primary,
        strokeWidth: 2,
      },
    ],
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const onRefresh = () => {
    setIsRefreshing(true);
    // Refresh data here
    // For example: fetchUserData(), fetchRecentTransactions(), etc.
    
    // Simulate API delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView 
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={["#4F46E5"]}
            tintColor="#4F46E5"
          />
        }
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, User</Text>
            <Text style={styles.date}>{new Date().toDateString()}</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceTitle}>Current Balance</Text>
          <Text style={styles.balanceAmount}>R {balanceData.currentBalance.toFixed(2)}</Text>
          <View style={styles.balanceDetails}>
            <View style={styles.balanceItem}>
              <Ionicons name="arrow-down-circle-outline" size={20} color={colors.success} />
              <Text style={styles.balanceItemLabel}>Income</Text>
              <Text style={styles.balanceItemAmount}>R {balanceData.income.toFixed(2)}</Text>
            </View>
            <View style={styles.balanceItem}>
              <Ionicons name="arrow-up-circle-outline" size={20} color={colors.error} />
              <Text style={styles.balanceItemLabel}>Expenses</Text>
              <Text style={styles.balanceItemAmount}>R {balanceData.expenses.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Spending Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.cardTitle}>Weekly Spending</Text>
          <LineChart
            data={spendingChartData}
            width={width - spacing.lg * 2 - 10}
            height={180}
            chartConfig={{
              backgroundColor: colors.white,
              backgroundGradientFrom: colors.white,
              backgroundGradientTo: colors.white,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
              labelColor: () => colors.textSecondary,
              style: {
                borderRadius: 16,
                paddingRight: 15,
                paddingLeft: 10,
              },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: colors.primary,
              },
            }}
            bezier
            style={styles.chart}
            withInnerLines={false}
            withOuterLines={false}
          />
        </View>

        {/* Budget Overview */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Budget Overview</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.budgetProgressContainer}>
            <View style={styles.budgetProgressBar}>
              <View 
                style={[
                  styles.budgetProgressFill, 
                  { width: `${(budgetData.spent / budgetData.total) * 100}%` }
                ]} 
              />
            </View>
            <View style={styles.budgetProgressLabels}>
              <Text style={styles.budgetProgressLabel}>
                Spent: R {budgetData.spent.toFixed(2)}
              </Text>
              <Text style={styles.budgetProgressLabel}>
                Remaining: R {budgetData.remaining.toFixed(2)}
              </Text>
            </View>
          </View>

          {budgetData.categories.slice(0, 3).map((category, index) => (
            <View key={index} style={styles.budgetCategoryItem}>
              <View style={styles.budgetCategoryHeader}>
                <Text style={styles.budgetCategoryName}>{category.name}</Text>
                <Text style={styles.budgetCategoryAmount}>
                  R {category.spent.toFixed(2)} / R {category.amount.toFixed(2)}
                </Text>
              </View>
              <View style={styles.budgetCategoryProgressBar}>
                <View 
                  style={[
                    styles.budgetCategoryProgressFill, 
                    { 
                      width: `${(category.spent / category.amount) * 100}%`,
                      backgroundColor: category.color 
                    }
                  ]} 
                />
              </View>
            </View>
          ))}
        </View>

        {/* Savings Goal */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.cardTitle}>Savings Goal</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.savingsGoalContainer}>
            <View style={styles.savingsGoalInfo}>
              <Text style={styles.savingsGoalTitle}>Emergency Fund</Text>
              <Text style={styles.savingsGoalAmount}>
                R {savingsData.current.toFixed(2)} / R {savingsData.goal.toFixed(2)}
              </Text>
              <View style={styles.savingsProgressBar}>
                <View 
                  style={[
                    styles.savingsProgressFill, 
                    { width: `${savingsData.progress}%` }
                  ]} 
                />
              </View>
              <Text style={styles.savingsProgressText}>{savingsData.progress}% Complete</Text>
            </View>
          </View>
        </View>

        {/* AI Advisor */}
        <TouchableOpacity style={styles.aiAdvisorCard}>
          <View style={styles.aiAdvisorContent}>
            <Ionicons name="chatbubble-ellipses" size={24} color={colors.white} />
            <View style={styles.aiAdvisorTextContainer}>
              <Text style={styles.aiAdvisorTitle}>Ask Buzo</Text>
              <Text style={styles.aiAdvisorDescription} numberOfLines={2}>
                Get personalized financial advice from your AI assistant
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.white} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollViewContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: textStyles.h2.fontSize,
    fontWeight: textStyles.h2.fontWeight as any,
    lineHeight: textStyles.h2.lineHeight,
    color: textStyles.h2.color,
  },
  date: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: textStyles.body2.fontWeight as any,
    lineHeight: textStyles.body2.lineHeight,
    color: colors.textSecondary,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  balanceTitle: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    lineHeight: textStyles.subtitle2.lineHeight,
    color: colors.white,
    opacity: 0.8,
  },
  balanceAmount: {
    fontSize: textStyles.h1.fontSize,
    fontWeight: textStyles.h1.fontWeight as any,
    lineHeight: textStyles.h1.lineHeight,
    color: colors.white,
    marginVertical: spacing.sm,
  },
  balanceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceItemLabel: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    lineHeight: textStyles.caption.lineHeight,
    color: colors.white,
    opacity: 0.8,
    marginLeft: spacing.xs,
    marginRight: spacing.sm,
  },
  balanceItemAmount: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    lineHeight: textStyles.subtitle2.lineHeight,
    color: colors.white,
  },
  chartCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  chart: {
    marginVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    lineHeight: textStyles.h3.lineHeight,
    color: textStyles.h3.color,
  },
  seeAllText: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    lineHeight: textStyles.subtitle2.lineHeight,
    color: colors.primary,
  },
  budgetProgressContainer: {
    marginBottom: spacing.md,
  },
  budgetProgressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: borderRadius.round,
    marginBottom: spacing.xs,
  },
  budgetProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.round,
  },
  budgetProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  budgetProgressLabel: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    lineHeight: textStyles.caption.lineHeight,
    color: colors.textSecondary,
  },
  budgetCategoryItem: {
    marginBottom: spacing.md,
  },
  budgetCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  budgetCategoryName: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    lineHeight: textStyles.subtitle2.lineHeight,
    color: textStyles.subtitle2.color,
  },
  budgetCategoryAmount: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    lineHeight: textStyles.caption.lineHeight,
    color: colors.textSecondary,
  },
  budgetCategoryProgressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: borderRadius.round,
  },
  budgetCategoryProgressFill: {
    height: '100%',
    borderRadius: borderRadius.round,
  },
  savingsGoalContainer: {
    backgroundColor: `${colors.success}10`,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  savingsGoalInfo: {
    alignItems: 'center',
  },
  savingsGoalTitle: {
    fontSize: textStyles.subtitle1.fontSize,
    fontWeight: textStyles.subtitle1.fontWeight as any,
    lineHeight: textStyles.subtitle1.lineHeight,
    color: textStyles.subtitle1.color,
    marginBottom: spacing.xs,
  },
  savingsGoalAmount: {
    fontSize: textStyles.h4.fontSize,
    fontWeight: textStyles.h4.fontWeight as any,
    lineHeight: textStyles.h4.lineHeight,
    color: textStyles.h4.color,
    marginBottom: spacing.md,
  },
  savingsProgressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: borderRadius.round,
    width: '100%',
    marginBottom: spacing.xs,
  },
  savingsProgressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: borderRadius.round,
  },
  savingsProgressText: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    lineHeight: textStyles.caption.lineHeight,
    color: colors.success,
  },
  aiAdvisorCard: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.md,
    marginBottom: spacing.lg,
    minHeight: 90,
  },
  aiAdvisorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    maxWidth: '85%',
  },
  aiAdvisorTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
    paddingRight: spacing.md,
  },
  aiAdvisorTitle: {
    fontSize: textStyles.h4.fontSize,
    fontWeight: textStyles.h4.fontWeight as any,
    lineHeight: textStyles.h4.lineHeight,
    color: colors.white,
  },
  aiAdvisorDescription: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: textStyles.body2.fontWeight as any,
    lineHeight: textStyles.body2.lineHeight,
    color: colors.white,
    opacity: 0.8,
    flexWrap: 'wrap',
  },
});

export default HomeScreen; 