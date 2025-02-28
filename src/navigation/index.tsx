import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { checkAuthState, subscribeToAuthStateChanges, unsubscribeFromAuthStateChanges } from '../utils/authStateManager';

// Import screens
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import BudgetScreen from '../screens/BudgetScreen';
import ExpenseScreen from '../screens/ExpenseScreen';
import SavingsScreen from '../screens/SavingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import InsightsScreen from '../screens/InsightsScreen';
import LearnScreen from '../screens/EducationScreen';
import ArticleDetailScreen from '../screens/ArticleDetailScreen';
import BankStatementsScreen from '../screens/BankStatementsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import LoadingScreen from '../components/LoadingScreen';
import AIAdvisorScreen from '../screens/AIAdvisorScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NotificationScreen from '../screens/NotificationScreen';
import OfflineTestScreen from '../screens/OfflineTestScreen';
import ExpenseAnalyticsScreen from '../screens/ExpenseAnalyticsScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';

// Import theme
import { colors } from '../utils/theme';

// Define navigation types
export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Budget: undefined;
  Expenses: undefined;
  Savings: undefined;
  Learn: undefined;
};

export type MainStackParamList = {
  Profile: undefined;
  BankStatements: undefined;
  Insights: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  ArticleDetail: { article: any };
  Profile: undefined;
  BankStatements: undefined;
  Insights: undefined;
  EditProfile: undefined;
  ExpenseScreen: { receiptData?: any };
  ExpenseAnalytics: undefined;
  AIAdvisor: undefined;
  Settings: undefined;
  Notifications: undefined;
  OfflineTest: undefined;
  TestChart: undefined;
  SubscriptionScreen: undefined;
};

// Create navigation stacks
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

// Auth Navigator
export const AuthNavigator: React.FC<{ hasOnboarded: boolean }> = ({ hasOnboarded }) => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName={hasOnboarded ? "Login" : "Onboarding"}
    >
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
};

// Main Tab Navigator
export const MainNavigator: React.FC = () => {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Budget') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'Expenses') {
            iconName = focused ? 'cash' : 'cash-outline';
          } else if (route.name === 'Savings') {
            iconName = focused ? 'trending-up' : 'trending-up-outline';
          } else if (route.name === 'Learn') {
            iconName = focused ? 'book' : 'book-outline';
          } else {
            iconName = 'help-circle-outline';
          }

          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          position: 'absolute',
          bottom: 15,
          left: 15,
          right: 15,
          elevation: 5,
          backgroundColor: '#ffffff',
          borderRadius: 15,
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          borderTopWidth: 0,
          zIndex: 8,
        },
        tabBarShowLabel: false,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      })}
    >
      <MainTab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          tabBarShowLabel: true,
        }}
      />
      <MainTab.Screen 
        name="Budget" 
        component={BudgetScreen}
        options={{
          tabBarShowLabel: true,
        }}
      />
      <MainTab.Screen 
        name="Expenses" 
        component={ExpenseScreen}
        options={{
          tabBarShowLabel: true,
        }}
      />
      <MainTab.Screen 
        name="Savings" 
        component={SavingsScreen}
        options={{
          tabBarShowLabel: true,
        }}
      />
      <MainTab.Screen 
        name="Learn" 
        component={LearnScreen}
        options={{
          tabBarShowLabel: true,
        }}
      />
    </MainTab.Navigator>
  );
};

// Root Stack with Main Tabs and Modal Screens
export const RootNavigator: React.FC = () => {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainNavigator} />
      <RootStack.Group screenOptions={{ presentation: 'modal' }}>
        <RootStack.Screen name="ArticleDetail" component={ArticleDetailScreen} />
      </RootStack.Group>
      <RootStack.Screen name="Profile" component={ProfileScreen} />
      <RootStack.Screen name="BankStatements" component={BankStatementsScreen} />
      <RootStack.Screen name="Insights" component={InsightsScreen} />
      <RootStack.Screen name="EditProfile" component={EditProfileScreen} />
      <RootStack.Screen name="ExpenseScreen" component={ExpenseScreen} />
      <RootStack.Screen name="ExpenseAnalytics" component={ExpenseAnalyticsScreen} />
      <RootStack.Screen name="AIAdvisor" component={AIAdvisorScreen} />
      <RootStack.Screen name="Settings" component={SettingsScreen} />
      <RootStack.Screen name="Notifications" component={NotificationScreen} />
      <RootStack.Screen name="OfflineTest" component={OfflineTestScreen} />
      <RootStack.Screen name="SubscriptionScreen" component={SubscriptionScreen} />
    </RootStack.Navigator>
  );
};

// Root Navigator
const AppNavigator: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);

  // Function to check authentication state
  const updateAuthState = async () => {
    try {
      setIsLoading(true);
      
      // Use the checkAuthState function from authStateManager
      const authStatus = await checkAuthState();
      const onboardingCompleted = await SecureStore.getItemAsync('onboardingCompleted');
      
      console.log('Auth status checked:', authStatus);
      console.log('Onboarding completed:', !!onboardingCompleted);
      
      setIsAuthenticated(authStatus);
      setHasOnboarded(!!onboardingCompleted);
    } catch (error) {
      console.error('Error checking auth state:', error);
      setIsAuthenticated(false);
      setHasOnboarded(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check auth state when component mounts
    updateAuthState();
    
    // Set up listener for auth state changes using the utility
    const subscription = subscribeToAuthStateChanges(() => {
      console.log('Auth state change detected, rechecking auth status');
      updateAuthState();
    });
    
    // Clean up listener on unmount
    return () => {
      unsubscribeFromAuthStateChanges(subscription);
    };
  }, []);

  // Show loading screen while checking auth state
  if (isAuthenticated === null) {
    return <LoadingScreen message="Starting Buzo..." />;
  }
  
  // Show loading screen during auth state changes
  if (isLoading) {
    return <LoadingScreen message="Updating..." />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <RootNavigator /> : <AuthNavigator hasOnboarded={hasOnboarded} />}
    </NavigationContainer>
  );
};

export default AppNavigator; 