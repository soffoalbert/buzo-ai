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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';

const { width } = Dimensions.get('window');

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);

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
        data: [120, 85, 200, 150, 75, 180, 90],
        color: (opacity = 1) => `rgba(113, 65, 244, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  };

  const handleNavigateToBankStatements = () => {
    navigation.navigate('BankStatements');
  };

  const handleOpenAIAdvisor = () => {
    navigation.navigate('AIAdvisor');
  };

  const handleNavigateToNotifications = () => {
    navigation.navigate('Notifications');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, Thabo</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={handleNavigateToNotifications}
            >
              <Ionicons name="notifications-outline" size={28} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <Ionicons name="person-circle-outline" size={32} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceTitle}>Current Balance</Text>
            <TouchableOpacity 
              style={styles.uploadButton}
              onPress={handleNavigateToBankStatements}
            >
              <Ionicons name="document-text-outline" size={16} color={colors.white} />
              <Text style={styles.uploadButtonText}>Bank Statements</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceAmount}>R {balanceData.currentBalance.toFixed(2)}</Text>
          <View style={styles.balanceDetails}>
            <View style={styles.balanceItem}>
              <Ionicons name="arrow-down-circle" size={20} color={colors.success} />
              <View>
                <Text style={styles.balanceItemLabel}>Income</Text>
                <Text style={styles.balanceItemValue}>R {balanceData.income.toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Ionicons name="arrow-up-circle" size={20} color={colors.error} />
              <View>
                <Text style={styles.balanceItemLabel}>Expenses</Text>
                <Text style={styles.balanceItemValue}>R {balanceData.expenses.toFixed(2)}</Text>
              </View>
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
        <TouchableOpacity 
          style={styles.aiAdvisorCard}
          onPress={handleOpenAIAdvisor}
          accessible={true}
          accessibilityLabel="Ask Buzo AI assistant"
          accessibilityRole="button"
          accessibilityHint="Get personalized financial advice from your AI assistant"
        >
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
  scrollContent: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  profileButton: {
    padding: spacing.xs,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginRight: spacing.sm,
    padding: spacing.xs,
  },
  balanceCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  balanceTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  uploadButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  balanceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  balanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  balanceItemLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  balanceItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.xs,
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