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
  Switch
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
        <TouchableOpacity 
          style={styles.optionsButton}
          onPress={() => {
            if (mockDataEnabled) {
              Alert.alert(
                'Reset Mock Data',
                'Do you want to reset the mock data?',
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Reset',
                    onPress: handleResetMockData,
                  },
                ]
              );
            }
          }}
        >
          <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      
      {/* Mock Data Toggle */}
      <View style={styles.mockDataToggleContainer}>
        <Text style={styles.mockDataLabel}>Use Demo Data</Text>
        <Switch
          value={mockDataEnabled}
          onValueChange={handleToggleMockData}
          trackColor={{ false: colors.border, true: colors.primary + '80' }}
          thumbColor={mockDataEnabled ? colors.primary : colors.white}
        />
      </View>
      
      {/* Time Period Selector */}
      <ScrollView 
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.periodSelector}
        contentContainerStyle={styles.periodSelectorContent}
      >
        {TIME_PERIODS.map(period => (
          <TouchableOpacity
            key={period.id}
            style={[
              styles.periodButton,
              selectedPeriod === period.id && styles.selectedPeriodButton,
              (period.id === '3months' || period.id === '6months' || period.id === 'year') && !isPremium && styles.premiumPeriodButton
            ]}
            onPress={() => handlePeriodSelect(period.id)}
          >
            <Text 
              style={[
                styles.periodButtonText,
                selectedPeriod === period.id && styles.selectedPeriodButtonText
              ]}
            >
              {period.label}
            </Text>
            {(period.id === '3months' || period.id === '6months' || period.id === 'year') && !isPremium && (
              <Ionicons name="lock-closed" size={12} color={colors.textSecondary} style={styles.premiumLockIcon} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
      
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
            {/* Mock Data Banner */}
            {mockDataEnabled && (
              <View style={styles.mockDataBanner}>
                <Ionicons name="information-circle-outline" size={20} color={colors.white} />
                <Text style={styles.mockDataBannerText}>
                  Viewing demo data. Toggle switch to see your real expenses.
                </Text>
              </View>
            )}
            
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
              <View style={[styles.chartContainer, { backgroundColor: 'transparent' }]}>
                <Chart
                  type="pie"
                  data={prepareCategoryData()}
                  width={Dimensions.get('window').width - 64}
                  height={220}
                  showLegend={true}
                  backgroundColor="transparent"
                  containerStyle={{ marginVertical: 0, backgroundColor: 'transparent' }}
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
            </View>
            
            {/* Monthly Spending Trends */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Monthly Spending Trends</Text>
              <View style={styles.chartContainer}>
                <Chart
                  type="bar"
                  data={prepareMonthlyData()}
                  width={Dimensions.get('window').width - 64}
                  height={220}
                  yAxisSuffix="R"
                  showGrid={true}
                  showValues={false}
                  containerStyle={{ marginVertical: 0, backgroundColor: 'transparent' }}
                  backgroundColor="#ffffff"
                  backgroundGradientFrom="#ffffff"
                  backgroundGradientTo="#ffffff"
                  decimalPlaces={0}
                />
              </View>
            </View>
            
            {/* Daily Spending (Last 7 Days) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily Spending (Last 7 Days)</Text>
              <View style={styles.chartContainer}>
                <Chart
                  type="line"
                  data={prepareDailyData()}
                  width={Dimensions.get('window').width - 64}
                  height={220}
                  yAxisSuffix="R"
                  showGrid={true}
                  showValues={true}
                  containerStyle={{ marginVertical: 0, backgroundColor: 'transparent' }}
                  backgroundColor="#ffffff"
                  backgroundGradientFrom="#ffffff"
                  backgroundGradientTo="#ffffff"
                  decimalPlaces={0}
                />
              </View>
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
  },
  headerTitle: {
    fontSize: textStyles.h2.fontSize,
    fontWeight: textStyles.h2.fontWeight as any,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodSelector: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  periodSelectorContent: {
    paddingHorizontal: spacing.lg,
  },
  periodButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    marginRight: spacing.sm,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  selectedPeriodButton: {
    backgroundColor: colors.primary,
  },
  periodButtonText: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: '500',
    color: colors.text,
  },
  selectedPeriodButtonText: {
    color: colors.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: textStyles.body1.fontSize,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  cardTitle: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    color: colors.text,
    marginBottom: spacing.md,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  comparisonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: textStyles.body2.fontSize,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  comparisonValue: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: '600',
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
  },
  topCategoriesContainer: {
    marginTop: spacing.md,
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
  },
  categoryName: {
    fontSize: textStyles.body2.fontSize,
    color: colors.text,
  },
  categoryAmount: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  anomalyDescription: {
    fontSize: textStyles.body2.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  anomalyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.warning + '10',
    borderRadius: borderRadius.md,
  },
  anomalyIcon: {
    marginRight: spacing.sm,
  },
  anomalyContent: {
    flex: 1,
  },
  anomalyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  insightItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
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
    marginBottom: 2,
  },
  insightText: {
    fontSize: textStyles.body2.fontSize,
    color: colors.textSecondary,
  },
  optionsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockDataToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mockDataLabel: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: '500',
    color: colors.text,
  },
  mockDataBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  mockDataBannerText: {
    fontSize: textStyles.body2.fontSize,
    color: colors.white,
    marginLeft: spacing.xs,
    flex: 1,
  },
  premiumBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  premiumBadgeText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 12,
  },
  premiumPeriodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  premiumLockIcon: {
    marginLeft: spacing.xs,
  },
  premiumFeatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  premiumFeatureText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: spacing.xs,
  },
  premiumUpsellCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.accent + '30',
  },
  premiumUpsellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  premiumUpsellTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  premiumUpsellDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  premiumFeatureList: {
    marginBottom: spacing.md,
  },
  premiumFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  premiumFeatureItemText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  premiumUpsellButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  premiumUpsellButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
});

export default ExpenseAnalyticsScreen; 