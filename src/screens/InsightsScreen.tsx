import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import FinancialInsights, { 
  FinancialInsight, 
  SpendingCategory, 
  SpendingTrend 
} from '../components/FinancialInsights';
import { getBudgetStatistics } from '../services/budgetService';
import { getExpenseStatistics } from '../services/expenseService';
import { getSavingsStatistics } from '../services/savingsService';
import { generateFinancialInsights, getAIFinancialInsights } from '../services/aiAdvisor';
import { formatCurrency } from '../utils/helpers';
import { loadExpenses } from '../services/expenseService';
import { loadBudgets } from '../services/budgetService';
import { loadSavingsGoals } from '../services/savingsService';
import { colors } from '../utils/theme';

// Define interfaces for service responses
interface Expense {
  category: string;
  amount: number;
  date: string;
  description?: string;
}

interface Budget {
  category: string;
  amount: number;
  spent: number;
}

interface SavingsGoal {
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
}

interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

interface ExpenseStatistics {
  totalAmount: number;
  totalIncome?: number;
  categoryBreakdown: CategoryBreakdown[];
}

const InsightsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [insights, setInsights] = useState<FinancialInsight[]>([]);
  const [spendingCategories, setSpendingCategories] = useState<SpendingCategory[]>([]);
  const [spendingTrends, setSpendingTrends] = useState<SpendingTrend[]>([]);
  const [savingsRate, setSavingsRate] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('month');
  const [useAI, setUseAI] = useState(false); // Toggle between AI and rule-based insights

  // Load financial data
  useEffect(() => {
    loadData();
  }, [timeframe, useAI]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load real data from services
      let userExpenses: Expense[] = [];
      let budgets: Budget[] = [];
      let savingsGoals: SavingsGoal[] = [];
      let budgetStats = null;
      let expenseStats: ExpenseStatistics | null = null;
      let savingsStats = null;
      
      try {
        userExpenses = await loadExpenses() as Expense[];
      } catch (error) {
        console.error('Error loading expenses:', error);
        userExpenses = [];
      }
      
      try {
        budgets = await loadBudgets() as Budget[];
      } catch (error) {
        console.error('Error loading budgets:', error);
        budgets = [];
      }
      
      try {
        savingsGoals = await loadSavingsGoals() as SavingsGoal[];
      } catch (error) {
        console.error('Error loading savings goals:', error);
        savingsGoals = [];
      }
      
      // Get budget statistics
      try {
        budgetStats = await getBudgetStatistics();
      } catch (error) {
        console.error('Error loading budget statistics:', error);
        budgetStats = null;
      }
      
      // Get expense statistics - pass as object with date range
      try {
        expenseStats = await getExpenseStatistics({
          startDate: getStartDateForTimeframe(timeframe),
          endDate: new Date(),
        } as any) as unknown as ExpenseStatistics;
        
        // Ensure categoryBreakdown is always an array
        if (!expenseStats || !expenseStats.categoryBreakdown || !Array.isArray(expenseStats.categoryBreakdown)) {
          expenseStats = {
            ...(expenseStats || {}),
            totalAmount: expenseStats?.totalAmount || 0,
            totalIncome: expenseStats?.totalIncome || 10000,
            categoryBreakdown: []
          };
        }
      } catch (error) {
        console.error('Error loading expense statistics:', error);
        expenseStats = {
          totalAmount: 0,
          totalIncome: 10000, // Mock income as fallback
          categoryBreakdown: []
        };
      }
      
      // Get savings statistics
      try {
        savingsStats = await getSavingsStatistics();
      } catch (error) {
        console.error('Error loading savings statistics:', error);
        savingsStats = null;
      }
      
      // Calculate savings rate (savings / income) * 100
      const income = expenseStats?.totalIncome || 10000; // Mock income if not available
      const totalExpenses = expenseStats?.totalAmount || 0;
      const savings = income - totalExpenses;
      const rate = income > 0 ? (savings / income) * 100 : 0;
      
      // Prepare spending categories data
      const categories = [];
      
      try {
        if (expenseStats?.categoryBreakdown && Array.isArray(expenseStats.categoryBreakdown)) {
          expenseStats.categoryBreakdown.forEach((category: CategoryBreakdown) => {
            categories.push({
              name: category.category,
              amount: category.amount,
              percentage: category.percentage,
              color: getCategoryColor(category.category),
              icon: getCategoryIcon(category.category) as any,
            });
          });
        }
      } catch (error) {
        console.error('Error mapping category breakdown:', error);
        // Continue with empty categories array
      }
      
      // If no categories are available, add some mock data for better UI experience
      if (categories.length === 0) {
        categories.push(
          {
            name: 'Food',
            amount: 2500,
            percentage: 30,
            color: getCategoryColor('Food'),
            icon: getCategoryIcon('Food') as any,
          },
          {
            name: 'Housing',
            amount: 4000,
            percentage: 45,
            color: getCategoryColor('Housing'),
            icon: getCategoryIcon('Housing') as any,
          },
          {
            name: 'Transportation',
            amount: 1500,
            percentage: 15,
            color: getCategoryColor('Transportation'),
            icon: getCategoryIcon('Transportation') as any,
          },
          {
            name: 'Entertainment',
            amount: 1000,
            percentage: 10,
            color: getCategoryColor('Entertainment'),
            icon: getCategoryIcon('Entertainment') as any,
          }
        );
      }
      
      // Prepare spending trends data
      const trends = generateTrendData(timeframe);
      
      // Prepare financial data for insights generation
      const financialData = {
        income,
        expenses: userExpenses ? userExpenses.map((e: Expense) => ({
          category: e.category,
          amount: e.amount,
          date: e.date,
          title: e.description || e.category,
        })) : [],
        budgets: budgets ? budgets.map((b: Budget) => ({
          category: b.category,
          limit: b.amount,
          spent: b.spent,
        })) : [],
        savingsGoals: savingsGoals ? savingsGoals.map((g: SavingsGoal) => ({
          title: g.title,
          target: g.targetAmount,
          current: g.currentAmount,
          deadline: g.targetDate,
        })) : [],
        // Add historical data if available
        historicalExpenses: trends.map(t => ({
          month: t.month,
          totalAmount: t.expenses,
          categories: {},
        })),
        historicalIncome: trends.map(t => ({
          month: t.month,
          amount: t.income,
        })),
      };
      
      // Generate insights based on financial data
      let generatedInsights: FinancialInsight[] = [];
      
      if (useAI) {
        try {
          // Try to get AI-powered insights
          generatedInsights = await getAIFinancialInsights(financialData);
        } catch (error) {
          console.error('Error getting AI insights:', error);
          // Fall back to rule-based insights
          generatedInsights = await generateFinancialInsights(financialData);
          // Alert user about the fallback
          Alert.alert(
            'AI Insights Unavailable',
            'Using standard insights instead. Please check your API key in settings.',
            [{ text: 'OK' }]
          );
          setUseAI(false);
        }
      } else {
        // Use rule-based insights
        generatedInsights = await generateFinancialInsights(financialData);
      }
      
      // Set state with loaded data
      setInsights(generatedInsights);
      setSpendingCategories(categories);
      setSpendingTrends(trends);
      setSavingsRate(Math.round(rate));
      setMonthlyIncome(income);
      setMonthlyExpenses(totalExpenses);
      
    } catch (error) {
      console.error('Error loading insights data:', error);
      // Handle error state
      Alert.alert(
        'Error Loading Data',
        'There was a problem loading your financial data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleInsightPress = (insight: FinancialInsight) => {
    // Mark insight as read
    const updatedInsights = insights.map(item => 
      item.id === insight.id ? { ...item, read: true } : item
    );
    setInsights(updatedInsights);
    
    // Navigate if actionable
    if (insight.actionable && insight.action?.screen) {
      // @ts-ignore - navigation typing issue
      navigation.navigate(insight.action.screen, insight.action.params);
    }
  };

  const handleSeeAllInsights = () => {
    // In a real app, this would navigate to a dedicated insights list screen
    Alert.alert(
      'All Insights',
      'This would navigate to a full list of all insights.',
      [{ text: 'OK' }]
    );
  };

  const handleSeeAllCategories = () => {
    // Navigate to expenses screen with category breakdown
    // @ts-ignore - navigation typing issue
    navigation.navigate('ExpensesScreen');
  };

  const handleSeeAllTrends = () => {
    // In a real app, this would navigate to a detailed trends screen
    Alert.alert(
      'Detailed Trends',
      'This would navigate to a detailed financial trends screen.',
      [{ text: 'OK' }]
    );
  };

  const toggleInsightMode = () => {
    setUseAI(!useAI);
  };

  // Helper functions
  const getStartDateForTimeframe = (timeframe: 'week' | 'month' | 'year'): Date => {
    const now = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return startDate;
  };

  const getCategoryColor = (category: string): string => {
    // Map categories to colors
    const colorMap: Record<string, string> = {
      Food: '#F59E0B',
      Housing: '#3B82F6',
      Transportation: '#10B981',
      Entertainment: '#8B5CF6',
      Shopping: '#EC4899',
      Utilities: '#6366F1',
      Healthcare: '#EF4444',
      Education: '#14B8A6',
      Travel: '#F97316',
      Savings: '#22C55E',
    };
    
    return colorMap[category] || '#6B7280';
  };

  const getCategoryIcon = (category: string): string => {
    // Map categories to Ionicons
    const iconMap: Record<string, string> = {
      Food: 'restaurant-outline',
      Housing: 'home-outline',
      Transportation: 'car-outline',
      Entertainment: 'film-outline',
      Shopping: 'cart-outline',
      Utilities: 'flash-outline',
      Healthcare: 'medical-outline',
      Education: 'school-outline',
      Travel: 'airplane-outline',
      Savings: 'wallet-outline',
    };
    
    return iconMap[category] || 'pricetag-outline';
  };

  const generateTrendData = (timeframe: 'week' | 'month' | 'year'): SpendingTrend[] => {
    // Generate mock trend data based on timeframe
    const trends: SpendingTrend[] = [];
    const now = new Date();
    let numPoints = 0;
    let format = '';
    
    switch (timeframe) {
      case 'week':
        numPoints = 7; // 7 days
        format = 'Day';
        break;
      case 'month':
        numPoints = 4; // 4 weeks
        format = 'Week';
        break;
      case 'year':
        numPoints = 12; // 12 months
        format = 'MMM';
        break;
    }
    
    // Generate mock data points
    for (let i = numPoints - 1; i >= 0; i--) {
      const date = new Date();
      let label = '';
      
      if (timeframe === 'week') {
        label = `Day ${numPoints - i}`;
      } else {
        date.setMonth(now.getMonth() - i);
        label = date.toLocaleString('default', { month: 'short' });
      }
      
      // Generate random but somewhat realistic values
      const baseIncome = 10000;
      const baseExpense = 8000;
      const randomFactor = 0.2; // 20% variation
      
      const income = baseIncome * (1 + (Math.random() * randomFactor - randomFactor/2));
      const expenses = baseExpense * (1 + (Math.random() * randomFactor - randomFactor/2));
      
      trends.push({
        month: label,
        income,
        expenses,
      });
    }
    
    return trends;
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {useAI ? 'AI is analyzing your financial data...' : 'Loading your insights...'}
          </Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.contentContainer}
          contentContainerStyle={styles.contentContainerStyle}
        >
          {/* Timeframe Selector */}
          <View style={styles.timeframeContainer}>
            <Text style={styles.timeframeLabel}>Timeframe:</Text>
            <View style={styles.timeframeButtonsContainer}>
              {['week', 'month', 'year'].map((tf) => (
                <TouchableOpacity
                  key={tf}
                  style={[
                    styles.timeframeButton,
                    timeframe === tf && styles.timeframeButtonActive,
                  ]}
                  onPress={() => setTimeframe(tf as 'week' | 'month' | 'year')}
                >
                  <Text
                    style={[
                      styles.timeframeButtonText,
                      timeframe === tf && styles.timeframeButtonTextActive,
                    ]}
                  >
                    {tf.charAt(0).toUpperCase() + tf.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* AI Toggle */}
            <View style={styles.aiToggleContainer}>
              <Text style={styles.aiToggleLabel}>AI Insights</Text>
              <Switch
                value={useAI}
                onValueChange={setUseAI}
                trackColor={{ false: '#D1D5DB', true: '#C7D2FE' }}
                thumbColor={useAI ? colors.primary : '#F3F4F6'}
              />
            </View>
          </View>

          {/* Financial Insights */}
          <FinancialInsights
            insights={insights}
            onInsightPress={handleInsightPress}
            spendingCategories={spendingCategories}
            spendingTrends={spendingTrends}
            savingsRate={savingsRate}
            monthlyIncome={monthlyIncome}
            monthlyExpenses={monthlyExpenses}
            isLoading={isRefreshing}
            onSeeAllInsights={handleSeeAllInsights}
            onSeeAllCategories={handleSeeAllCategories}
            onSeeAllTrends={handleSeeAllTrends}
            currency="USD"
            locale="en-US"
          />
        </ScrollView>
      )}
    </View>
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
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  contentContainerStyle: {
    padding: 16,
    paddingBottom: 100, // Add padding to ensure content is not hidden behind the bottom nav
  },
  timeframeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeframeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginRight: 8,
  },
  timeframeButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeframeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
  },
  timeframeButtonActive: {
    backgroundColor: '#4F46E520',
  },
  timeframeButtonText: {
    fontSize: 14,
    color: '#6B7280',
  },
  timeframeButtonTextActive: {
    color: '#4F46E5',
    fontWeight: '500',
  },
  aiToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  aiToggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginRight: 8,
  },
});

export default InsightsScreen; 