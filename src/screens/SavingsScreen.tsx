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

// Mock data for savings goals
const SAVINGS_GOALS = [
  {
    id: '1',
    title: 'Emergency Fund',
    target: 10000,
    current: 4500,
    deadline: '2023-12-31',
    icon: 'medkit-outline',
    color: colors.error,
  },
  {
    id: '2',
    title: 'New Laptop',
    target: 15000,
    current: 3000,
    deadline: '2024-03-15',
    icon: 'laptop-outline',
    color: colors.primary,
  },
  {
    id: '3',
    title: 'Holiday Trip',
    target: 20000,
    current: 8500,
    deadline: '2024-06-30',
    icon: 'airplane-outline',
    color: colors.accent,
  },
  {
    id: '4',
    title: 'Car Down Payment',
    target: 50000,
    current: 12000,
    deadline: '2025-01-15',
    icon: 'car-outline',
    color: colors.secondary,
  },
];

// Mock data for savings tips
const SAVINGS_TIPS = [
  "Set up automatic transfers to your savings account on payday",
  "Try the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings",
  "Save unexpected income like tax refunds or bonuses",
  "Review and cancel unused subscriptions",
  "Use the 24-hour rule for non-essential purchases",
];

const SavingsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState('goals');
  
  // Calculate total savings
  const totalSavings = SAVINGS_GOALS.reduce((sum, goal) => sum + goal.current, 0);
  const totalTarget = SAVINGS_GOALS.reduce((sum, goal) => sum + goal.target, 0);
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
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
  const renderGoalItem = ({ item }: { item: typeof SAVINGS_GOALS[0] }) => {
    const progress = (item.current / item.target) * 100;
    const daysRemaining = calculateDaysRemaining(item.deadline);
    
    return (
      <TouchableOpacity style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <View style={[styles.goalIconContainer, { backgroundColor: `${item.color}20` }]}>
            <Ionicons name={item.icon as any} size={24} color={item.color} />
          </View>
          <View style={styles.goalInfo}>
            <Text style={styles.goalTitle}>{item.title}</Text>
            <Text style={styles.goalDeadline}>Target date: {formatDate(item.deadline)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </View>
        
        <View style={styles.goalAmounts}>
          <Text style={styles.goalCurrentAmount}>R {item.current.toFixed(2)}</Text>
          <Text style={styles.goalTargetAmount}>of R {item.target.toFixed(2)}</Text>
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
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Savings</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="add-circle" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
      
      {/* Savings Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Total Savings</Text>
        <Text style={styles.summaryAmount}>R {totalSavings.toFixed(2)}</Text>
        <View style={styles.summaryDetails}>
          <Text style={styles.summaryTarget}>
            of R {totalTarget.toFixed(2)} target ({((totalSavings / totalTarget) * 100).toFixed(0)}%)
          </Text>
        </View>
      </View>
      
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
          data={SAVINGS_GOALS}
          renderItem={renderGoalItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={SAVINGS_TIPS}
          renderItem={renderTipItem}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
      
      {/* Add Goal Button */}
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
  },
  summaryTarget: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: textStyles.body2.fontWeight as any,
    lineHeight: textStyles.body2.lineHeight,
    color: colors.white,
    opacity: 0.8,
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
  goalCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
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
    lineHeight: textStyles.subtitle1.lineHeight,
    color: textStyles.subtitle1.color,
  },
  goalDeadline: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    lineHeight: textStyles.caption.lineHeight,
    color: colors.textSecondary,
  },
  goalAmounts: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  goalCurrentAmount: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    lineHeight: textStyles.h3.lineHeight,
    color: textStyles.h3.color,
    marginRight: spacing.xs,
  },
  goalTargetAmount: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: textStyles.body2.fontWeight as any,
    lineHeight: textStyles.body2.lineHeight,
    color: colors.textSecondary,
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
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalProgressText: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    lineHeight: textStyles.caption.lineHeight,
    color: colors.success,
  },
  goalTimeRemaining: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    lineHeight: textStyles.caption.lineHeight,
    color: colors.textSecondary,
  },
  tipCard: {
    backgroundColor: colors.white,
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
    lineHeight: textStyles.subtitle1.lineHeight,
    color: colors.accent,
  },
  tipText: {
    fontSize: textStyles.body1.fontSize,
    fontWeight: textStyles.body1.fontWeight as any,
    lineHeight: textStyles.body1.lineHeight,
    color: textStyles.body1.color,
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

export default SavingsScreen; 