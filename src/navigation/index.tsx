import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

// Import screens
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import BudgetScreen from '../screens/BudgetScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import SavingsScreen from '../screens/SavingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import InsightsScreen from '../screens/InsightsScreen';
import LearnScreen from '../screens/EducationScreen';
import ArticleDetailScreen from '../screens/ArticleDetailScreen';

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

export type RootStackParamList = {
  MainTabs: undefined;
  ArticleDetail: { article: any };
};

// Create navigation stacks
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

// Auth Navigator
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
};

// Main Tab Navigator
const MainNavigator = () => {
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
        component={ExpensesScreen}
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
const RootNavigator = () => {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainNavigator} />
      <RootStack.Group screenOptions={{ presentation: 'modal' }}>
        <RootStack.Screen name="ArticleDetail" component={ArticleDetailScreen} />
      </RootStack.Group>
    </RootStack.Navigator>
  );
};

// Root Navigator
const AppNavigator = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user is authenticated and has completed onboarding
    const checkAuthState = async () => {
      try {
        const userToken = await SecureStore.getItemAsync('userToken');
        const onboardingCompleted = await SecureStore.getItemAsync('onboardingCompleted');
        
        setIsAuthenticated(!!userToken);
        setHasOnboarded(!!onboardingCompleted);
      } catch (error) {
        console.error('Error checking auth state:', error);
        setIsAuthenticated(false);
        setHasOnboarded(false);
      }
    };

    checkAuthState();
  }, []);

  // Show loading screen while checking auth state
  if (isAuthenticated === null || hasOnboarded === null) {
    return null; // Replace with a loading component if needed
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <RootNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default AppNavigator; 