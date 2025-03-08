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
import { formatCurrency, formatCurrencyAbbreviated } from '../utils/helpers';

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
  const [useDayOfWeekMapping, setUseDayOfWeekMapping] = useState(false);
  
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

  const processWeeklySpendingData = (expenses: ExtendedExpense[]) => {
    if (!expenses || expenses.length === 0) {
      console.log('No expenses provided to processWeeklySpendingData');
      return {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            data: [0, 0, 0, 0, 0, 0, 0],
            color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
            strokeWidth: 2,
          },
        ],
      };
    }

    console.log('EXPENSES FOR WEEKLY SPENDING:', JSON.stringify(expenses.map(e => ({
      id: e.id,
      amount: e.amount,
      date: e.date,
      description: e.description,
      category: e.category
    })), null, 2));

    // Get current week's dates
    const now = new Date();
    
    // DETAILED DATE DEBUGGING
    console.log('DETAILED DATE DEBUGGING:');
    console.log('Current date (now):', now.toISOString());
    console.log('Current date components:', {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      dayOfWeek: now.getDay(), // 0 = Sunday, 1 = Monday, etc.
      dayOfWeekName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
    });
    
    // Check if date is in the future
    if (now.getFullYear() > new Date().getFullYear() + 1) {
      console.log('🚨 WARNING: Current date is from ' + now.getFullYear() + ' - this suggests device date is set to future!');
    }
    
    // Analyze expense dates
    const yearsInExpenses = [...new Set(expenses.map(e => new Date(e.date).getFullYear()))];
    console.log('Years found in expenses:', yearsInExpenses);
    
    // OPTION 1: Force expenses to today's date for testing
    // Uncomment this block to make all expenses show up as "today"
    /*
    const FORCE_EXPENSES_TO_TODAY = true;
    if (FORCE_EXPENSES_TO_TODAY) {
      console.log('⚠️ FORCING ALL EXPENSES TO TODAY FOR TESTING');
      const today = new Date();
      const todayStr = formatToDateString(today);
      
      // Clone expenses and update their dates
      expenses = expenses.map(exp => {
        return {
          ...exp,
          date: today.toISOString()
        };
      });
      
      console.log('Updated expense dates to today:', today.toISOString());
    }
    */
    
    // Use the state variable for day of week mapping
    const USE_DAY_OF_WEEK_ONLY = useDayOfWeekMapping;
    
    if (USE_DAY_OF_WEEK_ONLY) {
      console.log('⚠️ Using day-of-week mapping only - ignoring actual dates');
    }
    
    // Group expenses by date
    const expenseDateCount = {};
    let mostFrequentDate = null;
    let maxCount = 0;
    
    expenses.forEach(exp => {
      try {
        const dateStr = exp.date.substring(0, 10); // Get YYYY-MM-DD part
        expenseDateCount[dateStr] = (expenseDateCount[dateStr] || 0) + 1;
        
        if (expenseDateCount[dateStr] > maxCount) {
          maxCount = expenseDateCount[dateStr];
          mostFrequentDate = dateStr;
        }
      } catch (e) {
        console.warn('Error parsing expense date', e);
      }
    });
    
    console.log('Expense date distribution:', expenseDateCount);
    console.log('Most frequent expense date:', mostFrequentDate);
    
    // Determine week start/end based on the most frequent expense date
    let weekStart, weekEnd;
    
    if (mostFrequentDate) {
      const referenceDate = new Date(mostFrequentDate);
      console.log('Using reference date for week calculation:', referenceDate.toISOString());
      
      // NOTE: We're intentionally using the date from the expenses
      weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
      weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
      
      console.log('Week calculated from most frequent expense date:', {
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString()
      });
    } else {
      // Fallback to current date
      weekStart = startOfWeek(now, { weekStartsOn: 1 });
      weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    }
    
    // Create array of dates for the week
    const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    // Create labels for chart (e.g., 'Mon', 'Tue', etc.)
    const labels = daysOfWeek.map(day => format(day, 'EEE'));
    
    // Initialize spending data for each day of the week
    const dailySpending = Array(7).fill(0);
    
    // Get the year, month, and day of the week start and end
    const weekStartYear = weekStart.getFullYear();
    const weekStartMonth = weekStart.getMonth();
    const weekStartDay = weekStart.getDate();
    
    const weekEndYear = weekEnd.getFullYear();
    const weekEndMonth = weekEnd.getMonth();
    const weekEndDay = weekEnd.getDate();
    
    console.log('Week range for spending data:', {
      weekStartDate: `${weekStartYear}-${weekStartMonth+1}-${weekStartDay}`,
      weekEndDate: `${weekEndYear}-${weekEndMonth+1}-${weekEndDay}`,
      expenses: expenses.length
    });
    
    // Create function to convert dates to YYYY-MM-DD format for comparison
    const formatToDateString = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // Create an array of all days in the week as strings
    const daysInWeekAsStrings = daysOfWeek.map(day => formatToDateString(day));
    console.log('Days in week as strings:', daysInWeekAsStrings);
    
    // Process expenses and categorize by day of week
    expenses.forEach(expense => {
      try {
        // Parse the expense date and normalize to YYYY-MM-DD format
        const expenseDateObj = new Date(expense.date);
        const expenseYMD = formatToDateString(expenseDateObj);
        const dayOfWeek = expenseDateObj.getDay(); // 0 = Sunday, 1 = Monday
        // Convert to our scale where 0 = Monday, 6 = Sunday
        const adjustedDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        // For debugging
        console.log(`Processing expense: ${expense.description || expense.category} ($${expense.amount}) on date ${expenseYMD}`);
        console.log(`  - Day of week: ${dayOfWeek} (0=Sunday, 1=Monday, etc.) → ${adjustedDayIndex} (0=Monday, 6=Sunday)`);
        
        if (USE_DAY_OF_WEEK_ONLY) {
          // Always use day of week mapping
          console.log(`✅ Adding expense using day of week mapping: ${expense.amount} to ${labels[adjustedDayIndex]}`);
          dailySpending[adjustedDayIndex] += expense.amount;
        } else {
          // Use date-based mapping with fallback
          // Check if this date is in our week
          const dayIndex = daysInWeekAsStrings.indexOf(expenseYMD);
          
          if (dayIndex >= 0) {
            console.log(`✅ Expense found for ${labels[dayIndex]} (${expenseYMD}): $${expense.amount}`);
            dailySpending[dayIndex] += expense.amount;
          } else {
            // Try to directly map to day of week for very recent expenses
            console.log(`⚠️ Using direct day mapping: ${dayOfWeek} → ${adjustedDayIndex} (${labels[adjustedDayIndex]})`);
            
            // Only add if expense date is roughly within current week (within 3 days of today)
            const today = new Date();
            const expenseDate = new Date(expense.date);
            const diffDays = Math.abs(Math.floor((today.getTime() - expenseDate.getTime()) / (1000 * 60 * 60 * 24)));
            
            if (diffDays <= 3) {
              console.log(`✅ Adding expense using day of week mapping: ${expense.amount} to ${labels[adjustedDayIndex]}`);
              dailySpending[adjustedDayIndex] += expense.amount;
            } else {
              console.log(`❌ Expense date ${expenseYMD} not in current week range [${daysInWeekAsStrings[0]} to ${daysInWeekAsStrings[6]}] and too far from today (${diffDays} days)`);
            }
          }
        }
      } catch (err) {
        console.warn('Error processing expense date:', err, expense);
      }
    });
    
    // Check if any spending data is present
    const hasSpendingData = dailySpending.some(amount => amount > 0);
    
    console.log('Weekly spending data final:', {
      labels,
      dailySpending,
      daysWithSpending: dailySpending.filter(amount => amount > 0).length,
      hasSpendingData,
      total: dailySpending.reduce((sum, amount) => sum + amount, 0)
    });
    
    // Format data for the chart
    return {
      labels,
      datasets: [
        {
          data: dailySpending,
          color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
          strokeWidth: 2,
        },
      ],
    };
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Set a timeout to ensure loading state is cleared even if API calls fail or hang
      const loadingTimeout = setTimeout(() => {
        if (loading) {
          console.warn('Data loading timeout reached, clearing loading state');
          setLoading(false);
          setRefreshing(false);
        }
      }, 5000); // 5 second timeout
      
      // Load user profile from authService
      const { data: profile, error: profileError } = await getUserProfile();
      
      if (profileError) {
        console.error('Error loading user profile:', profileError);
        clearTimeout(loadingTimeout);
        setLoading(false);
        return; // Exit early if we can't get the profile
      }
      
      if (!profile?.id) {
        console.error('No user profile ID available');
        clearTimeout(loadingTimeout);
        setLoading(false);
        return; // Exit early if no profile ID
      }

      console.log('Loading financial data for user:', profile.id);
      
      // Load integrated financial data
      const rawResponse = await financialIntegrationService.getFinancialOverview(profile.id);
      
      // Clear timeout as data has been loaded
      clearTimeout(loadingTimeout);

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
      const expenses: ExtendedExpense[] = (rawResponse.recentTransactions || []).map(transaction => {
        // Ensure date is properly formatted
        let transactionDate = transaction.date || new Date().toISOString();
        // Try to parse the date to ensure it's valid
        try {
          const parsedDate = new Date(transactionDate);
          if (isNaN(parsedDate.getTime())) {
            console.warn(`Invalid date detected: ${transactionDate}, using current date instead`);
            transactionDate = new Date().toISOString();
          }
        } catch (e) {
          console.warn(`Error parsing date: ${transactionDate}, using current date instead`);
          transactionDate = new Date().toISOString();
        }
        
        return {
          id: transaction.id || '',
          amount: transaction.amount || 0,
          category: transaction.category || '',
          date: transactionDate,
          description: transaction.description || '',
          user_id: transaction.user_id || '',
          name: transaction.category || '',
          spent: transaction.amount || 0,
          color: getRandomColor(),
          title: transaction.description || '',
          createdAt: transactionDate,
          updatedAt: transactionDate
        };
      });

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

      // Process and update weekly spending chart data
      const weeklyData = processWeeklySpendingData(expenses);
      
      // Explicitly check dailySpending array for spending data
      const hasCurrentWeekData = weeklyData.datasets[0].data.some(amount => amount > 0);
      setSpendingChartData(weeklyData);
      setHasWeeklySpendingData(hasCurrentWeekData);
      
      console.log('Weekly spending data processed:', {
        hasData: expenses.length > 0,
        hasCurrentWeekData,
        dataPoints: weeklyData.datasets[0].data,
        daysWithSpending: weeklyData.datasets[0].data.filter(amount => amount > 0).length,
        labels: weeklyData.labels
      });

      setHasBudgetData(budgetData.length > 0);
      setHasSavingsData(savingsData.length > 0);
      
      // Update budget state
      if (rawResponse.totalBudgeted && rawResponse.totalBudgeted > 0) {
        const newBudgetState: BudgetState = {
          total: rawResponse.totalBudgeted,
          spent: rawResponse.totalSpent || 0,
          remaining: rawResponse.totalBudgeted - (rawResponse.totalSpent || 0),
          categories: (rawResponse.budgetUtilization || []).map(budget => ({
            name: budget.name || 'Unnamed Budget',
            amount: budget.amount || 0,
            color: getRandomColor(),
            spent: budget.spent || 0
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
    message: string,
    actionButton?: {
      label: string;
      onPress: () => void;
    }
  ) => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name={icon} size={40} color={colors.textSecondary} />
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateMessage}>{message}</Text>
      {actionButton && (
        <TouchableOpacity 
          style={styles.emptyStateActionButton}
          onPress={actionButton.onPress}
        >
          <Text style={styles.emptyStateActionText}>{actionButton.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Function to create a sample expense for the current week
  const addSampleExpenseForWeek = async () => {
    try {
      setLoading(true);
      
      // Create today's date in ISO format
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0] + 'T00:00:00+00:00';
      
      console.log('Creating sample expense with date:', formattedDate);
      
      const { data: profile } = await getUserProfile();
      if (!profile?.id) {
        Alert.alert('Error', 'Unable to add sample data: No user profile found');
        return;
      }
      
      // Create a sample expense
      const sampleExpense = {
        amount: Math.floor(Math.random() * 50) + 10, // Random amount between 10-60
        category: 'Groceries',
        date: formattedDate,
        description: 'Sample Expense',
        user_id: profile.id,
        paymentMethod: PaymentMethod.CreditCard,
        isAutomatedSaving: false
      };
      
      const createdExpense = await expenseService.createExpense(sampleExpense);
      console.log('Sample expense created:', createdExpense);
      
      // Reload data
      await loadData();
      
      Alert.alert('Success', 'Sample expense created for today');
    } catch (error) {
      console.error('Error creating sample expense:', error);
      Alert.alert('Error', 'Failed to create sample expense');
    } finally {
      setLoading(false);
    }
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
                  <Text style={styles.overviewAmount}>
                    {formatCurrencyAbbreviated(integrationData.totalBudgeted)}
                  </Text>
                </View>
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewLabel}>Total Spent</Text>
                  <Text style={styles.overviewAmount}>
                    {formatCurrencyAbbreviated(integrationData.totalSpent)}
                  </Text>
                </View>
                <View style={styles.overviewItem}>
                  <Text style={styles.overviewLabel}>Total Saved</Text>
                  <Text style={[styles.overviewAmount, { color: colors.success }]}>
                    {formatCurrencyAbbreviated(integrationData.totalSaved)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Weekly Spending */}
            <View style={styles.chartCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Weekly Spending</Text>
                <View style={styles.chartHeaderRight}>
                  <TouchableOpacity onPress={handleNavigateToExpenseAnalytics}>
                    <Text style={styles.seeAllText}>See Analytics</Text>
                  </TouchableOpacity>
                </View>
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
                        Spent: {formatCurrencyAbbreviated(budgetData.spent || 0)}
                      </Text>
                      <Text style={styles.budgetProgressLabel}>
                        Remaining: {formatCurrencyAbbreviated(budgetData.remaining || 0)}
                      </Text>
                    </View>
                  </View>

                  {budgetData.categories.slice(0, 3).map((category, index) => (
                    <View key={index} style={styles.budgetCategoryItem}>
                      <View style={styles.budgetCategoryHeader}>
                        <Text style={styles.budgetCategoryName}>{category.name}</Text>
                        <Text style={styles.budgetCategoryAmount}>
                          {formatCurrencyAbbreviated(category.spent || 0)} / {formatCurrencyAbbreviated(category.amount || 0)}
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
                      {formatCurrencyAbbreviated(savingsData.current || 0)} / {formatCurrencyAbbreviated(savingsData.goal || 0)}
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
    ...textStyles.h4,
    color: colors.text,
    marginTop: 4,
    fontSize: 18,
    flexShrink: 1,
  },
  emptyStateActionButton: {
    padding: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  emptyStateActionText: {
    color: colors.white,
    fontSize: textStyles.caption.fontSize,
  },
  chartHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartViewToggle: {
    padding: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  toggleText: {
    color: colors.white,
    fontSize: textStyles.caption.fontSize,
  },
});

export default HomeScreen; 