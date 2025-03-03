import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore
import { LineChart } from 'react-native-chart-kit';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import { loadBudgets, getBudgetStatistics } from '../services/budgetService';
import { loadSavingsGoals, getSavingsStatistics } from '../services/savingsService';
import { getExpenseStatistics, filterExpenses } from '../services/expenseService';
import { startOfWeek, endOfWeek, format, eachDayOfInterval } from 'date-fns';
import { generateAndSaveMockExpenses, setMockDataEnabled, isMockDataEnabled } from '../services/mockDataService';
import { supabase } from '../api/supabaseClient';
import { getUserProfile } from '../services/authService';
import { loadExpenses } from '../services/expenseService';
import { financialIntegrationService } from '../services/financialIntegrationService';
import { Expense } from '../models/Expense';

const { width } = Dimensions.get('window');

// Define the navigation param list with all the screens
export type HomeScreenNavigationProp = NativeStackNavigationProp<{
  Login: undefined;
  MainTabs: undefined;
  ArticleDetail: { article: any };
  Profile: undefined;
  BankStatements: undefined;
  Insights: undefined;
  EditProfile: undefined;
  Budget: undefined;
  Savings: undefined;
  ExpenseScreen: { receiptData?: any };
  ExpensesScreen: undefined;
  ExpenseAnalytics: undefined;
  AIAdvisor: undefined;
  Settings: undefined;
  Notifications: undefined;
  OfflineTest: undefined;
  TestChart: undefined;
  SubscriptionScreen: undefined;
  Testing: undefined;
  AddBudget: undefined;
  AddSavingsGoal: undefined;
  FeedbackScreen: undefined;
}>;

type ThemeColors = typeof colors;

const getRandomColor = (): string => {
  const colorKeys = (Object.keys(colors) as Array<keyof ThemeColors>).filter(key => 
    typeof colors[key] === 'string' && 
    !['text', 'background', 'border'].includes(key as string)
  );
  const randomKey = colorKeys[Math.floor(Math.random() * colorKeys.length)];
  return colors[randomKey];
};

// Update the interfaces to match the actual data structure
interface BudgetUtilization {
  id: string;
  name: string;
  utilization: number;
  savingsContribution: number;
  color?: string;
}

interface SavingsProgress {
  id: string;
  title: string;
  progress: number;
  nextSavingDate?: string;
  targetAmount: number;
  currentAmount: number;
}

interface BaseExpense {
  id: string;
  amount: number;
  category: string;
  date: string;
  description: string;
  user_id: string;
}

interface ExtendedExpense extends BaseExpense {
  name: string;
  spent: number;
  color: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface RawFinancialOverviewResponse {
  totalBudgeted?: number;
  totalSpent?: number;
  totalSaved?: number;
  budgetUtilization?: Array<{
    id?: string;
    name?: string;
    utilization?: number;
    savingsContribution?: number;
  }>;
  savingsProgress?: Array<{
    id?: string;
    title?: string;
    progress?: number;
    nextSavingDate?: string;
    targetAmount?: number;
    currentAmount?: number;
  }>;
  recentTransactions?: Array<{
    id?: string;
    amount?: number;
    category?: string;
    date?: string;
    description?: string;
    user_id?: string;
  }>;
}

interface IntegrationData {
  totalBudgeted: number;
  totalSpent: number;
  totalSaved: number;
  budgetUtilization: BudgetUtilization[];
  savingsProgress: SavingsProgress[];
  recentTransactions: ExtendedExpense[];
}

interface BudgetCategory {
  name: string;
  amount: number;
  color: string;
  spent?: number;
}

interface BudgetState {
  total: number;
  spent: number;
  remaining: number;
  categories: BudgetCategory[];
}

interface SavingsState {
  goal: number;
  current: number;
  progress: number;
  name: string;
}

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('User');
  const [usingMockData, setUsingMockData] = useState(false);
  
  // States for real data
  const [balanceData, setBalanceData] = useState({
    currentBalance: 0,
    income: 0,
    expenses: 0,
  });
  
  const [budgetData, setBudgetData] = useState<BudgetState>({
    total: 0,
    spent: 0,
    remaining: 0,
    categories: []
  });
  
  const [savingsData, setSavingsData] = useState<SavingsState>({
    goal: 0,
    current: 0,
    progress: 0,
    name: ''
  });
  
  const [spendingChartData, setSpendingChartData] = useState({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [0, 0, 0, 0, 0, 0, 0],
        color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  });
  
  // Flags for empty states
  const [hasWeeklySpendingData, setHasWeeklySpendingData] = useState(false);
  const [hasBudgetData, setHasBudgetData] = useState(false);
  const [hasSavingsData, setHasSavingsData] = useState(false);

  const [integrationData, setIntegrationData] = useState<IntegrationData>({
    totalBudgeted: 0,
    totalSpent: 0,
    totalSaved: 0,
    budgetUtilization: [],
    savingsProgress: [],
    recentTransactions: []
  });

  const [expenseData, setExpenseData] = useState<ExtendedExpense[]>([]);

  const [chartData, setChartData] = useState<any>({}); // Type this properly based on your chart library's requirements

  useEffect(() => {
    // Check Supabase authentication before loading data
    checkAuthentication();
    
    // Explicitly disable mock data on component mount
    const disableMockData = async () => {
      // Always disable mock data, regardless of current setting
      await setMockDataEnabled(false);
      setUsingMockData(false);
      console.log('Mock data disabled, only real data will be used');
    };
    
    // Get user directly from Supabase session
    const getSessionUser = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const user = data.session.user;
          // Get first name from full_name in user metadata
          const fullName = user.user_metadata?.full_name || '';
          const firstName = fullName.split(' ')[0];
          if (firstName) {
            setUserName(firstName);
            console.log('Using name from Supabase session:', firstName);
          }
          
          // Also check for a profile in the profiles table
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
            
          if (profileData?.full_name) {
            const profileFirstName = profileData.full_name.split(' ')[0];
            setUserName(profileFirstName);
            console.log('Using name from Supabase profile:', profileFirstName);
          }
        }
      } catch (error) {
        console.error('Error getting user from session:', error);
      }
    };
    
    // Set up auth state change subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event);
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          if (session?.user) {
            // Update user name from metadata
            const fullName = session.user.user_metadata?.full_name || '';
            if (fullName) {
              setUserName(fullName.split(' ')[0]);
              console.log('User name updated from auth state change:', fullName);
            }
            
            // Reload all data
            loadData();
          }
        } else if (event === 'SIGNED_OUT') {
          // Handle sign out if needed
          setUserName('User');
          // Even on sign out, don't use mock data
          setUsingMockData(false);
        }
      }
    );
    
    // Run both operations in parallel
    Promise.all([
      disableMockData(),
      getSessionUser()
    ]).then(() => {
      // Load remaining data
      loadData();
    });
    
    // Clean up subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Check if the user is authenticated with Supabase
  const checkAuthentication = async () => {
    const { data } = await supabase.auth.getSession();
    
    if (!data.session) {
      // User is not authenticated, show alert
      Alert.alert(
        "Authentication Required",
        "Please sign in to see your real financial data.",
        [
          {
            text: "Sign In",
            onPress: () => navigation.navigate('Login')
          }
        ]
      );
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load user profile from authService
      const { data: profile, error: profileError } = await getUserProfile();
      
      if (profileError) {
        console.error('Error loading user profile:', profileError);
        return; // Exit early if we can't get the profile
      }
      
      if (!profile?.id) {
        console.error('No user profile ID available');
        return; // Exit early if no profile ID
      }

      console.log('Loading financial data for user:', profile.id);
      
      // Load integrated financial data
      const rawResponse = await financialIntegrationService.getFinancialOverview(profile.id);
      
      console.log('Raw financial data:', JSON.stringify(rawResponse, null, 2));
      
      // Transform budget utilization data
      const budgetData: BudgetUtilization[] = (rawResponse.budgetUtilization || []).map(b => ({
        id: b.id || '',
        name: b.name || '',
        utilization: b.utilization || 0,
        savingsContribution: b.savingsContribution || 0,
        color: getRandomColor()
      }));

      // Transform savings progress data
      const savingsData: SavingsProgress[] = (rawResponse.savingsProgress || []).map(s => ({
        id: s.id || '',
        title: s.title || '',
        progress: s.progress || 0,
        nextSavingDate: s.nextSavingDate,
        targetAmount: s.targetAmount || 0,
        currentAmount: s.currentAmount || 0
      }));

      // Transform expense data with proper typing
      const expenses: ExtendedExpense[] = (rawResponse.recentTransactions || []).map(transaction => ({
        id: transaction.id || '',
        amount: transaction.amount || 0,
        category: transaction.category || '',
        date: transaction.date || new Date().toISOString(),
        description: transaction.description || '',
        user_id: transaction.user_id || '',
        name: transaction.category || '',
        spent: transaction.amount || 0,
        color: getRandomColor(),
        title: transaction.description || '',
        createdAt: transaction.date || new Date().toISOString(),
        updatedAt: transaction.date || new Date().toISOString()
      }));

      console.log('Transformed data:', {
        budgetCount: budgetData.length,
        savingsCount: savingsData.length,
        expenseCount: expenses.length
      });

      const newIntegrationData: IntegrationData = {
        totalBudgeted: rawResponse.totalBudgeted || 0,
        totalSpent: rawResponse.totalSpent || 0,
        totalSaved: rawResponse.totalSaved || 0,
        budgetUtilization: budgetData,
        savingsProgress: savingsData,
        recentTransactions: expenses
      };

      console.log('Final integration data:', {
        totalBudgeted: newIntegrationData.totalBudgeted,
        totalSpent: newIntegrationData.totalSpent,
        totalSaved: newIntegrationData.totalSaved
      });

      setIntegrationData(newIntegrationData);
      setExpenseData(expenses);
      
      // Update chart data
      setChartData({
        labels: expenses.map(expense => expense.category),
        datasets: [{
          data: expenses.map(expense => expense.amount)
        }]
      });

      setHasBudgetData(budgetData.length > 0);
      setHasSavingsData(savingsData.length > 0);
      
      // Update budget state
      if (rawResponse.totalBudgeted && rawResponse.totalBudgeted > 0) {
        const newBudgetState: BudgetState = {
          total: rawResponse.totalBudgeted,
          spent: rawResponse.totalSpent || 0,
          remaining: rawResponse.totalBudgeted - (rawResponse.totalSpent || 0),
          categories: budgetData.map(budget => ({
            name: budget.name,
            amount: rawResponse.totalBudgeted! * (budget.utilization / 100),
            color: budget.color || getRandomColor(),
            spent: (rawResponse.totalSpent || 0) * (budget.utilization / 100)
          }))
        };
        setBudgetData(newBudgetState);
      }
      
      // Update savings state
      if (savingsData.length > 0) {
        const topSavingsGoal = savingsData[0];
        const newSavingsState: SavingsState = {
          goal: topSavingsGoal.targetAmount,
          current: topSavingsGoal.currentAmount,
          progress: topSavingsGoal.progress,
          name: topSavingsGoal.title
        };
        setSavingsData(newSavingsState);
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load financial data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    // Always ensure mock data is disabled on refresh
    setMockDataEnabled(false).then(() => loadData());
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

  const handleNavigateToExpenseAnalytics = () => {
    navigation.navigate('ExpenseAnalytics');
  };

  const handleNavigateToSettings = () => {
    navigation.navigate('Settings');
  };

  const handleNavigateToBudget = () => {
    navigation.navigate('Budget');
  };

  const handleNavigateToSavings = () => {
    navigation.navigate('Savings');
  };

  // Empty state component
  const renderEmptyState = (
    icon: keyof typeof Ionicons.glyphMap, 
    title: string, 
    message: string
  ) => (
    <View style={styles.emptyStateContainer}>
      <View style={styles.emptyStateIconContainer}>
        <Ionicons name={icon} size={36} color={colors.primary} />
      </View>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateMessage}>{message}</Text>
    </View>
  );

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
            <Text style={styles.greeting}>Hello, {userName}</Text>
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
              onPress={handleNavigateToSettings}
            >
              <Ionicons name="settings-outline" size={28} color={colors.primary} />
            </TouchableOpacity>
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

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your financial data...</Text>
          </View>
        ) : (
          <>
            {/* Financial Overview Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Financial Overview</Text>
              <View style={styles.overviewContainer}>
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewLabel}>Total Budget</Text>
                  <Text style={styles.overviewAmount}>R {integrationData.totalBudgeted.toFixed(2)}</Text>
                </View>
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewLabel}>Total Spent</Text>
                  <Text style={styles.overviewAmount}>R {integrationData.totalSpent.toFixed(2)}</Text>
                </View>
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewLabel}>Total Saved</Text>
                  <Text style={[styles.overviewAmount, { color: colors.success }]}>
                    R {integrationData.totalSaved.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Weekly Spending */}
            <View style={styles.chartCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Weekly Spending</Text>
                <TouchableOpacity onPress={handleNavigateToExpenseAnalytics}>
                  <Text style={styles.seeAllText}>See Analytics</Text>
                </TouchableOpacity>
              </View>
              
              {hasWeeklySpendingData ? (
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
              ) : (
                renderEmptyState(
                  "bar-chart-outline", 
                  "No spending data yet", 
                  "Track your expenses to see your weekly spending patterns here."
                )
              )}
            </View>

            {/* Budget Overview */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardTitle}>Budget Overview</Text>
                <TouchableOpacity onPress={handleNavigateToBudget}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              
              {hasBudgetData ? (
                <>
                  <View style={styles.budgetProgressContainer}>
                    <View style={styles.budgetProgressBar}>
                      <View 
                        style={[
                          styles.budgetProgressFill, 
                          { width: `${((budgetData.spent || 0) / (budgetData.total || 1) * 100)}%` }
                        ]} 
                      />
                    </View>
                    <View style={styles.budgetProgressLabels}>
                      <Text style={styles.budgetProgressLabel}>
                        Spent: R {(budgetData.spent || 0).toFixed(2)}
                      </Text>
                      <Text style={styles.budgetProgressLabel}>
                        Remaining: R {(budgetData.remaining || 0).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {budgetData.categories.slice(0, 3).map((category, index) => (
                    <View key={index} style={styles.budgetCategoryItem}>
                      <View style={styles.budgetCategoryHeader}>
                        <Text style={styles.budgetCategoryName}>{category.name}</Text>
                        <Text style={styles.budgetCategoryAmount}>
                          R {(category.spent || 0).toFixed(2)} / R {(category.amount || 0).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.budgetCategoryProgressBar}>
                        <View 
                          style={[
                            styles.budgetCategoryProgressFill, 
                            { 
                              width: `${((category.spent || 0) / (category.amount || 1) * 100)}%`,
                              backgroundColor: category.color 
                            }
                          ]} 
                        />
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                renderEmptyState(
                  "wallet-outline", 
                  "No budget data",
                  "Create your first budget to start tracking your spending against your financial goals."
                )
              )}
            </View>

            {/* Savings Goal */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.cardTitle}>Savings Goal</Text>
                <TouchableOpacity onPress={handleNavigateToSavings}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              
              {hasSavingsData ? (
                <View style={styles.savingsGoalContainer}>
                  <View style={styles.savingsGoalInfo}>
                    <Text style={styles.savingsGoalTitle}>{savingsData.name}</Text>
                    <Text style={styles.savingsGoalAmount}>
                      R {(savingsData.current || 0).toFixed(2)} / R {(savingsData.goal || 0).toFixed(2)}
                    </Text>
                    <View style={styles.savingsProgressBar}>
                      <View 
                        style={[
                          styles.savingsProgressFill, 
                          { width: `${savingsData.progress || 0}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.savingsProgressText}>{savingsData.progress || 0}% Complete</Text>
                  </View>
                </View>
              ) : (
                renderEmptyState(
                  "wallet-outline", 
                  "No savings goals yet",
                  "Set up a savings goal to start building your financial future."
                )
              )}
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
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  chart: {
    marginVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    color: colors.text,
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
    marginBottom: Platform.OS === 'android' ? spacing.xxl * 2 : spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.md,
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
  // Empty State Styles
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    minHeight: 180,
  },
  emptyStateIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    fontSize: textStyles.h4.fontSize,
    fontWeight: textStyles.h4.fontWeight as any,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: textStyles.body2.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Loading styles
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl * 2,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: textStyles.body1.fontSize,
    color: colors.textSecondary,
  },
  // Mock data banner
  mockDataBanner: {
    backgroundColor: colors.warning,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockDataText: {
    color: colors.white,
    fontSize: textStyles.caption.fontSize,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  dataSourceBanner: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataSourceText: {
    color: colors.white,
    fontSize: textStyles.caption.fontSize,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  overviewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewItem: {
    flex: 1,
    alignItems: 'center',
  },
  overviewLabel: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    lineHeight: textStyles.caption.lineHeight,
    color: colors.textSecondary,
  },
  overviewAmount: {
    fontSize: textStyles.h4.fontSize,
    fontWeight: textStyles.h4.fontWeight as any,
    lineHeight: textStyles.h4.lineHeight,
    color: colors.text,
  },
});

export default HomeScreen; 