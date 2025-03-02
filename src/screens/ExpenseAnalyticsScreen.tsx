import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Alert,
  Switch,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, subDays, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';

// Components
import Chart from '../components/Chart';

// Services
import { getExpenseStatistics, filterExpenses } from '../services/expenseService';
import { isMockDataEnabled, setMockDataEnabled, resetMockData } from '../services/mockDataService';
import { hasPremiumAccess } from '../services/subscriptionService';

// Utils and types
import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import { Expense, ExpenseStatistics } from '../models/Expense';
import { formatCurrency } from '../utils/helpers';
import { accessPremiumFeature, PremiumFeatureType } from '../utils/premiumFeatures';
import { RootStackParamList } from '../navigation';

// Define the time periods for filtering
const TIME_PERIODS = [
  { id: 'week', label: 'Week', days: 7 },
  { id: 'month', label: 'Month', days: 30 },
  { id: '3months', label: '3 Months', days: 90 },
  { id: '6months', label: '6 Months', days: 180 },
  { id: 'year', label: 'Year', days: 365 },
];

// Define the expense categories with colors
const EXPENSE_CATEGORIES = [
  { id: 'groceries', name: 'Groceries', icon: 'cart-outline', color: colors.secondary },
  { id: 'transport', name: 'Transport', icon: 'car-outline', color: colors.accent },
  { id: 'dining', name: 'Dining', icon: 'restaurant-outline', color: '#FF9800' },
  { id: 'utilities', name: 'Utilities', icon: 'flash-outline', color: colors.error },
  { id: 'housing', name: 'Housing', icon: 'home-outline', color: colors.primary },
  { id: 'entertainment', name: 'Entertainment', icon: 'film-outline', color: colors.info },
  { id: 'health', name: 'Health', icon: 'fitness-outline', color: '#6366F1' },
  { id: 'education', name: 'Education', icon: 'school-outline', color: '#8B5CF6' },
  { id: 'shopping', name: 'Shopping', icon: 'bag-outline', color: '#EC4899' },
  { id: 'other', name: 'Other', icon: 'ellipsis-horizontal-outline', color: '#9CA3AF' },
];

const ExpenseAnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [statistics, setStatistics] = useState<ExpenseStatistics | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [anomalies, setAnomalies] = useState<Expense[]>([]);
  const [comparisonData, setComparisonData] = useState<{
    previousPeriod: number;
    currentPeriod: number;
    percentageChange: number;
  }>({
    previousPeriod: 0,
    currentPeriod: 0,
    percentageChange: 0,
  });
  const [mockDataEnabled, setMockDataEnabled] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  // Check if user has premium access
  useEffect(() => {
    const checkPremiumStatus = async () => {
      const premium = await hasPremiumAccess();
      setIsPremium(premium);
    };
    
    checkPremiumStatus();
  }, []);

  // Check if mock data is enabled on mount
  useEffect(() => {
    const checkMockDataStatus = async () => {
      const enabled = await isMockDataEnabled();
      setMockDataEnabled(enabled);
    };
    
    checkMockDataStatus();
  }, []);

  // Toggle mock data
  const handleToggleMockData = async (value: boolean) => {
    try {
      setIsLoading(true);
      await setMockDataEnabled(value);
      setMockDataEnabled(value);
      
      // Reload data with the new setting
      await loadData();
    } catch (error) {
      console.error('Error toggling mock data:', error);
      Alert.alert('Error', 'Failed to toggle mock data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset mock data
  const handleResetMockData = async () => {
    try {
      setIsLoading(true);
      await resetMockData();
      Alert.alert('Success', 'Mock data has been reset.');
      
      // Reload data with fresh mock data
      await loadData();
    } catch (error) {
      console.error('Error resetting mock data:', error);
      Alert.alert('Error', 'Failed to reset mock data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data based on selected period
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Calculate date range based on selected period
      const endDate = new Date();
      const periodDays = TIME_PERIODS.find(p => p.id === selectedPeriod)?.days || 30;
      const startDate = subDays(endDate, periodDays);
      
      // Get expense statistics for the selected period
      const stats = await getExpenseStatistics(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      
      setStatistics(stats);
      
      // Get all expenses for the selected period for detailed analysis
      const filteredExpenses = await filterExpenses({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
      
      setExpenses(filteredExpenses);
      
      // For premium users, calculate additional analytics
      if (isPremium) {
        // Calculate period comparison data
        await calculatePeriodComparison(selectedPeriod);
        
        // Detect spending anomalies
        detectAnomalies(filteredExpenses);
      }
      
    } catch (error) {
      console.error('Error loading expense analytics data:', error);
      Alert.alert('Error', 'Failed to load expense analytics data. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedPeriod, isPremium]);

  // Calculate comparison between current period and previous period
  const calculatePeriodComparison = async (period: string) => {
    try {
      const endDate = new Date();
      const periodDays = TIME_PERIODS.find(p => p.id === period)?.days || 30;
      const startCurrentPeriod = subDays(endDate, periodDays);
      const startPreviousPeriod = subDays(startCurrentPeriod, periodDays);
      
      // Get current period expenses
      const currentPeriodStats = await getExpenseStatistics(
        startCurrentPeriod.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      
      // Get previous period expenses
      const previousPeriodStats = await getExpenseStatistics(
        startPreviousPeriod.toISOString().split('T')[0],
        startCurrentPeriod.toISOString().split('T')[0]
      );
      
      const currentAmount = currentPeriodStats.totalAmount;
      const previousAmount = previousPeriodStats.totalAmount;
      
      // Calculate percentage change
      let percentageChange = 0;
      if (previousAmount > 0) {
        percentageChange = ((currentAmount - previousAmount) / previousAmount) * 100;
      }
      
      setComparisonData({
        currentPeriod: currentAmount,
        previousPeriod: previousAmount,
        percentageChange,
      });
      
    } catch (error) {
      console.error('Error calculating period comparison:', error);
    }
  };

  // Detect spending anomalies (unusually high expenses)
  const detectAnomalies = (expenseData: Expense[]) => {
    if (!expenseData || expenseData.length === 0) {
      setAnomalies([]);
      return;
    }
    
    // Group expenses by category
    const expensesByCategory: Record<string, Expense[]> = {};
    expenseData.forEach(expense => {
      if (!expensesByCategory[expense.category]) {
        expensesByCategory[expense.category] = [];
      }
      expensesByCategory[expense.category].push(expense);
    });
    
    // Calculate average and standard deviation for each category
    const categoryStats: Record<string, { mean: number; stdDev: number }> = {};
    Object.entries(expensesByCategory).forEach(([category, expenses]) => {
      const amounts = expenses.map(e => e.amount);
      const sum = amounts.reduce((acc, val) => acc + val, 0);
      const mean = sum / amounts.length;
      
      // Calculate standard deviation
      const squaredDiffs = amounts.map(val => Math.pow(val - mean, 2));
      const avgSquaredDiff = squaredDiffs.reduce((acc, val) => acc + val, 0) / amounts.length;
      const stdDev = Math.sqrt(avgSquaredDiff);
      
      categoryStats[category] = { mean, stdDev };
    });
    
    // Identify anomalies (expenses that are more than 2 standard deviations from the mean)
    const anomalousExpenses = expenseData.filter(expense => {
      const stats = categoryStats[expense.category];
      if (!stats) return false;
      
      // If standard deviation is 0 (all expenses are the same), no anomalies
      if (stats.stdDev === 0) return false;
      
      // Check if expense amount is more than 2 standard deviations from the mean
      return expense.amount > stats.mean + (2 * stats.stdDev);
    });
    
    setAnomalies(anomalousExpenses);
  };

  // Load data on mount, when period changes, or when mock data setting changes
  useEffect(() => {
    loadData();
  }, [loadData, mockDataEnabled]);

  // Handle refresh
  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Prepare data for charts
  const prepareCategoryData = () => {
    if (!statistics || !statistics.categoryBreakdown) return [];
    
    return Object.entries(statistics.categoryBreakdown).map(([category, amount]) => {
      const categoryInfo = EXPENSE_CATEGORIES.find(c => c.id === category) || 
                          { name: category, color: '#9CA3AF' };
      
      return {
        name: categoryInfo.name,
        value: amount,
        color: categoryInfo.color,
        legendFontColor: '#7F7F7F',
        legendFontSize: 12,
      };
    });
  };

  const prepareMonthlyData = () => {
    if (!statistics || !statistics.monthlyComparison) {
      return {
        labels: [],
        datasets: [{ data: [] }],
      };
    }
    
    // Sort monthly data by date
    const sortedData = [...statistics.monthlyComparison].sort((a, b) => 
      a.month.localeCompare(b.month)
    );
    
    // Format month labels (e.g., "Jan", "Feb")
    const labels = sortedData.map(item => {
      const [year, month] = item.month.split('-');
      return format(new Date(parseInt(year), parseInt(month) - 1, 1), 'MMM');
    });
    
    const data = sortedData.map(item => item.amount);
    
    return {
      labels,
      datasets: [{ 
        data,
        color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`, // Indigo color
      }],
    };
  };

  const prepareDailyData = () => {
    if (!statistics || !statistics.dailyExpenses) {
      return {
        labels: [],
        datasets: [{ data: [] }],
      };
    }
    
    // Sort daily data by date
    const sortedData = [...statistics.dailyExpenses].sort((a, b) => 
      a.date.localeCompare(b.date)
    );
    
    // Limit to last 7 days for readability
    const recentData = sortedData.slice(-7);
    
    // Format date labels (e.g., "Mon", "Tue")
    const labels = recentData.map(item => 
      format(parseISO(item.date), 'EEE')
    );
    
    const data = recentData.map(item => item.amount);
    
    return {
      labels,
      datasets: [{ 
        data,
        color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`, // Indigo color
        strokeWidth: 2,
      }],
    };
  };

  // Get category color
  const getCategoryColor = (categoryId: string) => {
    const category = EXPENSE_CATEGORIES.find(c => c.id === categoryId);
    return category ? category.color : '#9CA3AF';
  };

  // Get category name
  const getCategoryName = (categoryId: string) => {
    const category = EXPENSE_CATEGORIES.find(c => c.id === categoryId);
    return category ? category.name : categoryId;
  };

  // Format percentage change with + or - sign
  const formatPercentageChange = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  // Handle period selection
  const handlePeriodSelect = (period: string) => {
    // Check if detailed analytics is a premium feature for longer time periods
    if ((period === '3months' || period === '6months' || period === 'year') && !isPremium) {
      accessPremiumFeature(
        PremiumFeatureType.DETAILED_ANALYTICS,
        navigation,
        () => {
          setSelectedPeriod(period);
        }
      );
    } else {
      setSelectedPeriod(period);
    }
  };

  // Render premium badge
  const renderPremiumBadge = () => {
    if (!isPremium) return null;
    
    return (
      <View style={styles.premiumBadge}>
        <Text style={styles.premiumBadgeText}>Premium</Text>
      </View>
    );
  };

  // Render empty state for charts
  const renderEmptyState = (title: string, message: string, iconName: keyof typeof Ionicons.glyphMap) => {
    return (
      <View style={styles.emptyStateContainer}>
        <View style={styles.emptyStateIconContainer}>
          <Ionicons name={iconName} size={40} color={colors.primary + '80'} />
        </View>
        <Text style={styles.emptyStateTitle}>{title}</Text>
        <Text style={styles.emptyStateMessage}>{message}</Text>
      </View>
    );
  };

  // Check if category data is empty
  const isCategoryDataEmpty = () => {
    return !statistics || 
           !statistics.categoryBreakdown || 
           Object.keys(statistics.categoryBreakdown).length === 0;
  };

  // Check if monthly data is empty
  const isMonthlyDataEmpty = () => {
    return !statistics || 
           !statistics.monthlyComparison || 
           statistics.monthlyComparison.length === 0;
  };

  // Check if daily data is empty
  const isDailyDataEmpty = () => {
    return !statistics || 
           !statistics.dailyExpenses || 
           statistics.dailyExpenses.length === 0;
  };

  // Check if insights data is empty
  const hasNoInsights = () => {
    return (!statistics || 
            !statistics.dailyExpenses || 
            statistics.dailyExpenses.length === 0) &&
           (comparisonData.previousPeriod <= 0) &&
           (!statistics || 
            !statistics.categoryBreakdown || 
            Object.keys(statistics.categoryBreakdown).length === 0);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense Analytics</Text>
        {renderPremiumBadge()}
      </View>
      {/* Time Period Selector */}
      <View style={styles.periodSelectorContainer}>
        <View style={styles.periodSelectorInner}>
          <ScrollView 
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.periodSelectorContent}
            bounces={false}
          >
            {TIME_PERIODS.map(period => {
              const isSelected = selectedPeriod === period.id;
              const isPremiumOption = (period.id === '3months' || period.id === '6months' || period.id === 'year');
              const isLocked = isPremiumOption && !isPremium;
              
              return (
                <TouchableOpacity
                  key={period.id}
                  style={[
                    styles.periodButton,
                    isSelected && styles.selectedPeriodButton,
                    isLocked && styles.lockedPeriodButton
                  ]}
                  onPress={() => handlePeriodSelect(period.id)}
                  activeOpacity={0.7}
                >
                  <Text 
                    style={[
                      styles.periodButtonText,
                      isSelected && styles.selectedPeriodButtonText,
                      isLocked && styles.lockedPeriodButtonText
                    ]}
                  >
                    {period.label}
                  </Text>
                  {isLocked && (
                    <View style={styles.lockIconContainer}>
                      <Ionicons name="lock-closed" size={10} color={colors.textSecondary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
      
      {/* Main Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : (
          <>
        
            {/* Total Spending Overview */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Total Spending</Text>
              <Text style={styles.totalAmount}>
                {formatCurrency(statistics?.totalAmount || 0, 'en-ZA', 'ZAR')}
              </Text>
              
              {/* Period Comparison - Only for Premium */}
              {isPremium ? (
                <View style={styles.comparisonContainer}>
                  <Text style={styles.comparisonLabel}>
                    vs Previous {TIME_PERIODS.find(p => p.id === selectedPeriod)?.label}:
                  </Text>
                  <Text 
                    style={[
                      styles.comparisonValue,
                      comparisonData.percentageChange > 0 ? styles.negativeChange : styles.positiveChange,
                    ]}
                  >
                    {formatPercentageChange(comparisonData.percentageChange)}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.premiumFeatureButton}
                  onPress={() => accessPremiumFeature(
                    PremiumFeatureType.DETAILED_ANALYTICS,
                    navigation,
                    () => {}
                  )}
                >
                  <Ionicons name="lock-closed" size={14} color={colors.primary} />
                  <Text style={styles.premiumFeatureText}>
                    Unlock period comparison with Premium
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Category Breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Spending by Category</Text>
              
              {isCategoryDataEmpty() ? (
                renderEmptyState(
                  "No Category Data Yet",
                  "Start adding expenses to see your spending breakdown by category. This will help you track where your money goes.",
                  "pie-chart-outline"
                )
              ) : (
                <>
                  <View style={[
                    styles.chartContainer, 
                    { 
                      backgroundColor: 'transparent', 
                      borderWidth: Platform.OS === 'android' ? 0 : 1,
                      ...(Platform.OS === 'android' ? {
                        elevation: 0,
                        shadowColor: 'transparent',
                        shadowOpacity: 0,
                        shadowRadius: 0,
                        shadowOffset: { width: 0, height: 0 },
                        borderColor: 'transparent'
                      } : {})
                    }
                  ]}>
                    <Chart
                      type="pie"
                      data={prepareCategoryData()}
                      width={Dimensions.get('window').width - 64}
                      height={220}
                      showLegend={true}
                      backgroundColor="transparent"
                      containerStyle={{ 
                        marginVertical: 0, 
                        backgroundColor: 'transparent', 
                        elevation: 0,
                        ...(Platform.OS === 'android' ? {
                          shadowColor: 'transparent',
                          shadowOpacity: 0,
                          shadowRadius: 0,
                          shadowOffset: { width: 0, height: 0 },
                          borderWidth: 0,
                          borderColor: 'transparent'
                        } : {})
                      }}
                    />
                  </View>
                  
                  {/* Top Categories */}
                  <View style={styles.topCategoriesContainer}>
                    <Text style={styles.sectionSubtitle}>Top Categories</Text>
                    {statistics && statistics.categoryBreakdown && Object.entries(statistics.categoryBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([category, amount], index) => (
                        <View key={category} style={styles.categoryRow}>
                          <View style={styles.categoryInfo}>
                            <View 
                              style={[
                                styles.categoryDot, 
                                { backgroundColor: getCategoryColor(category) }
                              ]} 
                            />
                            <Text style={styles.categoryName}>{getCategoryName(category)}</Text>
                          </View>
                          <Text style={styles.categoryAmount}>
                            {formatCurrency(amount, 'en-ZA', 'ZAR')}
                          </Text>
                        </View>
                      ))
                    }
                  </View>
                </>
              )}
            </View>
            
            {/* Monthly Spending Trends */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Monthly Spending Trends</Text>
              
              {isMonthlyDataEmpty() ? (
                renderEmptyState(
                  "No Monthly Data Available",
                  "Add expenses over multiple months to see your spending trends over time. This helps identify patterns in your financial habits.",
                  "bar-chart-outline"
                )
              ) : (
                <View style={[styles.chartContainer, Platform.OS === 'android' ? { borderWidth: 0, elevation: 0 } : {}]}>
                  <Chart
                    type="bar"
                    data={prepareMonthlyData()}
                    width={Dimensions.get('window').width - 64}
                    height={220}
                    yAxisSuffix="R"
                    showGrid={true}
                    showValues={false}
                    containerStyle={{ marginVertical: 0, backgroundColor: 'transparent', elevation: 0 }}
                    backgroundColor="#ffffff"
                    backgroundGradientFrom="#ffffff"
                    backgroundGradientTo="#ffffff"
                    decimalPlaces={0}
                  />
                </View>
              )}
            </View>
            
            {/* Daily Spending (Last 7 Days) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily Spending (Last 7 Days)</Text>
              
              {isDailyDataEmpty() ? (
                renderEmptyState(
                  "No Daily Data Yet",
                  "Track your daily expenses to visualize your spending patterns throughout the week. This helps you understand your day-to-day habits.",
                  "calendar-outline"
                )
              ) : (
                <View style={[styles.chartContainer, Platform.OS === 'android' ? { borderWidth: 0, elevation: 0 } : {}]}>
                  <Chart
                    type="line"
                    data={prepareDailyData()}
                    width={Dimensions.get('window').width - 64}
                    height={220}
                    yAxisSuffix="R"
                    showGrid={true}
                    showValues={true}
                    containerStyle={{ marginVertical: 0, backgroundColor: 'transparent', elevation: 0 }}
                    backgroundColor="#ffffff"
                    backgroundGradientFrom="#ffffff"
                    backgroundGradientTo="#ffffff"
                    decimalPlaces={0}
                  />
                </View>
              )}
            </View>
            
            {/* Spending Anomalies - Only for Premium */}
            {anomalies.length > 0 && isPremium && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Spending Anomalies</Text>
                <Text style={styles.cardDescription}>
                  We've detected unusual spending patterns:
                </Text>
                
                {anomalies.map((anomaly, index) => (
                  <View key={index} style={styles.anomalyItem}>
                    <Ionicons name="alert-circle" size={24} color={colors.warning} style={styles.anomalyIcon} />
                    <View style={styles.anomalyContent}>
                      <Text style={styles.anomalyTitle}>{anomaly.title}</Text>
                      <Text style={styles.anomalyDescription}>{anomaly.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            
            {/* Spending Insights */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Spending Insights</Text>
              
              {hasNoInsights() ? (
                renderEmptyState(
                  "No Insights Available Yet",
                  "As you track more of your expenses, we'll provide personalized insights to help you better understand your spending patterns and financial behavior.",
                  "bulb-outline"
                )
              ) : (
                <>
                  {/* Highest Spending Day */}
                  {statistics && statistics.dailyExpenses && statistics.dailyExpenses.length > 0 && (
                    <View style={styles.insightItem}>
                      <Ionicons name="calendar-outline" size={24} color={colors.primary} style={styles.insightIcon} />
                      <View style={styles.insightContent}>
                        <Text style={styles.insightTitle}>Highest Spending Day</Text>
                        {(() => {
                          const highestDay = [...statistics.dailyExpenses].sort((a, b) => b.amount - a.amount)[0];
                          return (
                            <Text style={styles.insightText}>
                              {format(parseISO(highestDay.date), 'EEEE, MMMM d')} with 
                              {' '}{formatCurrency(highestDay.amount, 'en-ZA', 'ZAR')}
                            </Text>
                          );
                        })()}
                      </View>
                    </View>
                  )}
                  
                  {/* Month-over-Month Change */}
                  {comparisonData.previousPeriod > 0 && (
                    <View style={styles.insightItem}>
                      <Ionicons 
                        name={comparisonData.percentageChange >= 0 ? "trending-up-outline" : "trending-down-outline"} 
                        size={24} 
                        color={comparisonData.percentageChange >= 0 ? colors.error : colors.success} 
                        style={styles.insightIcon} 
                      />
                      <View style={styles.insightContent}>
                        <Text style={styles.insightTitle}>
                          {comparisonData.percentageChange >= 0 ? 'Spending Increased' : 'Spending Decreased'}
                        </Text>
                        <Text style={styles.insightText}>
                          Your spending {comparisonData.percentageChange >= 0 ? 'increased' : 'decreased'} by
                          {' '}{Math.abs(comparisonData.percentageChange).toFixed(1)}% compared to the previous period
                        </Text>
                      </View>
                    </View>
                  )}
                  
                  {/* Largest Category */}
                  {statistics && statistics.categoryBreakdown && Object.keys(statistics.categoryBreakdown).length > 0 && (
                    <View style={styles.insightItem}>
                      <Ionicons name="pie-chart-outline" size={24} color={colors.accent} style={styles.insightIcon} />
                      <View style={styles.insightContent}>
                        <Text style={styles.insightTitle}>Largest Spending Category</Text>
                        {(() => {
                          const entries = Object.entries(statistics.categoryBreakdown);
                          const [topCategory, topAmount] = entries.sort((a, b) => b[1] - a[1])[0];
                          const percentage = (topAmount / statistics.totalAmount) * 100;
                          
                          return (
                            <Text style={styles.insightText}>
                              {getCategoryName(topCategory)} accounts for {percentage.toFixed(1)}% of your total spending
                            </Text>
                          );
                        })()}
                      </View>
                    </View>
                  )}

                  {/* No specific insights but some data */}
                  {!hasNoInsights() && 
                   !statistics?.dailyExpenses?.length && 
                   !comparisonData.previousPeriod && 
                   !Object.keys(statistics?.categoryBreakdown || {}).length && (
                    <View style={styles.partialInsightContainer}>
                      <Ionicons name="analytics-outline" size={22} color={colors.primary} />
                      <Text style={styles.partialInsightText}>
                        We're analyzing your spending patterns. Add more transaction data to see detailed insights.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
            
            {!isPremium && (
              <View style={styles.premiumUpsellCard}>
                <View style={styles.premiumUpsellHeader}>
                  <Ionicons name="star" size={24} color={colors.accent} />
                  <Text style={styles.premiumUpsellTitle}>Upgrade to Premium</Text>
                </View>
                <Text style={styles.premiumUpsellDescription}>
                  Get access to advanced analytics features including:
                </Text>
                <View style={styles.premiumFeatureList}>
                  <View style={styles.premiumFeatureItem}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    <Text style={styles.premiumFeatureItemText}>Detailed spending analysis</Text>
                  </View>
                  <View style={styles.premiumFeatureItem}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    <Text style={styles.premiumFeatureItemText}>Long-term trend analysis (3-12 months)</Text>
                  </View>
                  <View style={styles.premiumFeatureItem}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    <Text style={styles.premiumFeatureItemText}>Spending anomaly detection</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.premiumUpsellButton}
                  onPress={() => navigation.navigate('SubscriptionScreen')}
                >
                  <Text style={styles.premiumUpsellButtonText}>Upgrade Now</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
    ...shadows.sm,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: textStyles.h2.fontSize,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  periodSelectorContainer: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
    paddingTop: 8,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
    zIndex: 10,
  },
  periodSelectorInner: {
    maxWidth: '100%',
  },
  periodSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 2,
    justifyContent: 'flex-start',
  },
  periodButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 10,
    backgroundColor: colors.background,
    minWidth: 76,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border + '60',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedPeriodButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  selectedPeriodButtonText: {
    color: colors.white,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    paddingBottom: spacing.xxxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: textStyles.body1.fontSize,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: 8,
    marginBottom: spacing.lg,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border + '20',
  },
  cardTitle: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    color: colors.text,
    marginBottom: spacing.md,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  comparisonLabel: {
    fontSize: textStyles.body2.fontSize,
    color: colors.textSecondary,
    marginRight: spacing.xs,
    fontWeight: '500',
  },
  comparisonValue: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: '700',
  },
  positiveChange: {
    color: colors.success,
  },
  negativeChange: {
    color: colors.error,
  },
  chartContainer: {
    marginVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    paddingVertical: spacing.md,
    borderWidth: Platform.OS === 'android' ? 0 : 1,
    borderColor: colors.border + '20',
    ...(Platform.OS === 'android' 
      ? { 
          elevation: 0,
          shadowColor: 'transparent',
          shadowOpacity: 0,
          shadowRadius: 0,
          shadowOffset: { width: 0, height: 0 },
        } 
      : shadows.sm),
  },
  topCategoriesContainer: {
    marginTop: spacing.md,
    backgroundColor: colors.background + '50',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  sectionSubtitle: {
    fontSize: textStyles.subtitle1.fontSize,
    fontWeight: textStyles.subtitle1.fontWeight as any,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  categoryName: {
    fontSize: textStyles.body2.fontSize,
    color: colors.text,
    fontWeight: '500',
  },
  categoryAmount: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: '700',
    color: colors.text,
  },
  anomalyDescription: {
    fontSize: textStyles.body2.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  anomalyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.warning + '15',
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    ...shadows.sm,
  },
  anomalyIcon: {
    marginRight: spacing.sm,
  },
  anomalyContent: {
    flex: 1,
  },
  anomalyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  insightItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  insightIcon: {
    marginRight: spacing.md,
    marginTop: 2,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    color: colors.text,
    marginBottom: 4,
  },
  insightText: {
    fontSize: textStyles.body2.fontSize,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  optionsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  mockDataToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    marginVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  mockDataLabel: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  mockDataBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  mockDataBannerText: {
    fontSize: textStyles.body2.fontSize,
    color: colors.white,
    marginLeft: spacing.xs,
    flex: 1,
    fontWeight: '500',
  },
  premiumBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
    ...shadows.sm,
  },
  premiumBadgeText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 12,
  },
  lockedPeriodButton: {
    backgroundColor: colors.background + '80',
    borderColor: colors.border + '40',
    opacity: 0.9,
  },
  lockedPeriodButtonText: {
    color: colors.textSecondary,
  },
  lockIconContainer: {
    marginLeft: 4,
    backgroundColor: colors.border + '40',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumFeatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  premiumFeatureText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  premiumUpsellCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    overflow: 'hidden',
  },
  premiumUpsellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  premiumUpsellTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  premiumUpsellDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  premiumFeatureList: {
    marginBottom: spacing.md,
  },
  premiumFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  premiumFeatureItemText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: spacing.sm,
    fontWeight: '500',
  },
  premiumUpsellButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...shadows.sm,
    marginTop: spacing.sm,
  },
  premiumUpsellButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    minHeight: 220,
    backgroundColor: colors.background + '30',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border + '40',
    borderStyle: 'dashed',
    margin: spacing.xs,
  },
  emptyStateIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  emptyStateTitle: {
    fontSize: textStyles.subtitle1.fontSize,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: textStyles.body2.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  partialInsightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight + '40',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  partialInsightText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: textStyles.body2.fontSize,
    color: colors.text,
    lineHeight: 20,
  },
});

export default ExpenseAnalyticsScreen; 