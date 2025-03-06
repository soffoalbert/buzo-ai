import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, SubscriptionTier, SubscriptionInfo, SubscriptionTransaction } from '../models/User';
import { loadUserProfile, updateUserProfile } from './userService';
import { generateUUID } from '../utils/helpers';
import { Alert, Platform } from 'react-native';
import { hasActiveSubscription, getSubscriptionExpiryDate } from './receiptValidationService';
import Constants from 'expo-constants';

// Storage keys
const SUBSCRIPTION_STORAGE_KEY = 'buzo_subscription_info';
const TEST_IAP_ENABLED_KEY = 'buzo_test_iap_enabled';

// Environment detection
const IS_EXPO = Constants.expoConfig !== undefined;
const IS_DEVELOPMENT = Constants.expoConfig?.extra?.env === 'development' || 
                       Constants.expoConfig?.extra?.env === 'local' || 
                       __DEV__;
                       
// TestFlight detection (iOS only)
const IS_TESTFLIGHT = Platform.OS === 'ios' && 
                      Constants.appOwnership !== 'standalone' &&
                      Constants.releaseChannel === 'default';

/**
 * Determines if we're in a development or testing environment
 * @returns True if in a development or testing environment, false if in production
 */
export const isTestEnvironment = async (): Promise<boolean> => {
  try {
    // First check if test IAP mode is explicitly enabled
    const testIapEnabled = await AsyncStorage.getItem(TEST_IAP_ENABLED_KEY);
    if (testIapEnabled === 'true') {
      return true;
    }
    
    // Then check environment variables
    return IS_EXPO || IS_DEVELOPMENT || IS_TESTFLIGHT;
  } catch (error) {
    console.warn('Error checking test environment:', error);
    // Default to false (production) in case of errors
    return false;
  }
};

/**
 * Enable or disable test in-app purchase mode
 * @param enabled Whether test mode should be enabled
 */
export const setTestIapMode = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(TEST_IAP_ENABLED_KEY, enabled ? 'true' : 'false');
    console.log(`Test IAP mode ${enabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('Error setting test IAP mode:', error);
  }
};

/**
 * Enum of all premium-gated features in the app
 */
export enum PremiumFeature {
  PERSONALIZED_COACHING = 'PERSONALIZED_COACHING',
  DETAILED_SPENDING_ANALYTICS = 'DETAILED_SPENDING_ANALYTICS',
  PRIORITY_SUPPORT = 'PRIORITY_SUPPORT',
  AD_FREE_EXPERIENCE = 'AD_FREE_EXPERIENCE',
  ADVANCED_BUDGET_TOOLS = 'ADVANCED_BUDGET_TOOLS',
  UNLIMITED_SAVINGS_GOALS = 'UNLIMITED_SAVINGS_GOALS',
  RECEIPT_SCANNING = 'RECEIPT_SCANNING',
  BANK_STATEMENT_ANALYSIS = 'BANK_STATEMENT_ANALYSIS',
  CUSTOM_CATEGORIES = 'CUSTOM_CATEGORIES',
  DATA_EXPORT = 'DATA_EXPORT',
}

/**
 * Free plan limits
 */
export const FREE_PLAN_LIMITS = {
  MAX_SAVINGS_GOALS: 2,
  MAX_BUDGETS: 5,
  MAX_RECEIPT_SCANS_PER_MONTH: 5,
  MAX_BANK_STATEMENTS_PER_MONTH: 1,
  FINANCIAL_TIPS_FREQUENCY: 'weekly', // 'daily' for premium
};

/**
 * Get the current user's subscription information
 * @returns The subscription information or null if not found
 */
export const getUserSubscription = async (): Promise<SubscriptionInfo | null> => {
  try {
    const userProfile = await loadUserProfile();
    if (!userProfile) {
      return null;
    }
    
    return userProfile.subscription || null;
  } catch (error) {
    console.error('Error getting user subscription:', error);
    return null;
  }
};

/**
 * Check if the user has premium access
 * @returns True if the user has premium access, false otherwise
 */
export const hasPremiumAccess = async (): Promise<boolean> => {
  try {
    // Check if we're in a test environment
    const isTestMode = await isTestEnvironment();
    
    // When running in test environment, grant premium access if explicitly enabled
    if (isTestMode) {
      console.log('🔓 Running in test environment: Premium access automatically granted');
      return true;
    }
    
    // First, check server-side validations for active subscriptions
    const hasServerValidatedSubscription = await hasActiveSubscription();
    
    if (hasServerValidatedSubscription) {
      return true;
    }
    
    // Fall back to local subscription info if server validation fails
    const subscription = await getUserSubscription();
    
    if (!subscription) {
      return false;
    }
    
    // Check if the subscription is premium and not expired
    if (subscription.tier === SubscriptionTier.PREMIUM) {
      // If there's an end date, check if it's in the future
      if (subscription.endDate) {
        const endDate = new Date(subscription.endDate);
        const now = new Date();
        return endDate > now;
      }
      
      // If there's no end date, assume it's active
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking premium access:', error);
    return false;
  }
};

/**
 * Update the user's subscription information
 * @param subscriptionInfo The new subscription information
 * @returns True if the update was successful, false otherwise
 */
export const updateSubscription = async (subscriptionInfo: SubscriptionInfo): Promise<boolean> => {
  try {
    const userProfile = await loadUserProfile();
    if (!userProfile) {
      return false;
    }
    
    // Update the user profile with the new subscription information
    const updatedProfile: User = {
      ...userProfile,
      subscription: subscriptionInfo
    };
    
    // Save the updated profile
    await updateUserProfile(updatedProfile);
    
    return true;
  } catch (error) {
    console.error('Error updating subscription:', error);
    return false;
  }
};

/**
 * Process a subscription payment - this is now an adapter to the app store payment system
 * @returns The transaction information if successful, null otherwise
 */
export const processSubscriptionPayment = async (
  amount: number,
  currency: string,
  paymentMethod: string,
  description: string
): Promise<SubscriptionTransaction | null> => {
  console.warn('Direct subscription payments are deprecated. Use App Store or Google Play purchases instead.');
  return null;
};

/**
 * Cancel the user's premium subscription
 * @returns True if the cancellation was successful, false otherwise
 */
export const cancelPremiumSubscription = async (): Promise<boolean> => {
  try {
    const subscription = await getUserSubscription();
    
    if (!subscription) {
      return false;
    }
    
    // Update the subscription to disable auto-renew
    const updatedSubscription: SubscriptionInfo = {
      ...subscription,
      autoRenew: false
    };
    
    // Update the subscription
    return await updateSubscription(updatedSubscription);
  } catch (error) {
    console.error('Error canceling premium subscription:', error);
    return false;
  }
};

/**
 * Get the list of premium features
 * @returns An array of premium features
 */
export const getPremiumFeatures = (): { title: string; description: string; icon: string }[] => {
  return [
    {
      title: 'Personalized Financial Coaching',
      description: 'Get tailored advice from our AI financial coach based on your spending habits and goals.',
      icon: 'person-outline'
    },
    {
      title: 'Detailed Spending Analysis',
      description: 'Access advanced analytics and insights about your spending patterns and trends.',
      icon: 'analytics-outline'
    },
    {
      title: 'Priority Customer Support',
      description: 'Get faster responses and dedicated support for all your questions and issues.',
      icon: 'headset-outline'
    },
    {
      title: 'Ad-Free Experience',
      description: 'Enjoy a clean, distraction-free experience without any advertisements.',
      icon: 'shield-checkmark-outline'
    },
    {
      title: 'Advanced Budget Tools',
      description: 'Access advanced budgeting features like custom categories and rollover budgets.',
      icon: 'wallet-outline'
    },
    {
      title: 'Unlimited Savings Goals',
      description: 'Create and track unlimited savings goals to achieve your financial dreams.',
      icon: 'trending-up-outline'
    }
  ];
};

/**
 * Check if the user has access to a specific premium feature
 * @param feature The premium feature to check access for
 * @returns True if the user has access to the feature, false otherwise
 */
export const hasFeatureAccess = async (feature: PremiumFeature): Promise<boolean> => {
  try {
    // When running in test environment, automatically grant access to all features
    const isTestMode = await isTestEnvironment();
    if (isTestMode) {
      return true;
    }
    
    const isPremium = await hasPremiumAccess();
    
    // If the user has premium, they have access to all features
    if (isPremium) {
      return true;
    }
    
    // Free users have access to basic features with limitations
    switch (feature) {
      case PremiumFeature.UNLIMITED_SAVINGS_GOALS:
        // Free users are limited to a certain number of savings goals
        const goalCount = await getSavingsGoalsCount();
        return goalCount < FREE_PLAN_LIMITS.MAX_SAVINGS_GOALS;
        
      case PremiumFeature.ADVANCED_BUDGET_TOOLS:
        // Free users are limited to a certain number of budget categories
        const budgetCount = await getBudgetCategoriesCount();
        return budgetCount < FREE_PLAN_LIMITS.MAX_BUDGETS;
        
      case PremiumFeature.RECEIPT_SCANNING:
        // Free users are limited to a certain number of scans per month
        const scanCount = await getMonthlyReceiptScanCount();
        return scanCount < FREE_PLAN_LIMITS.MAX_RECEIPT_SCANS_PER_MONTH;
        
      case PremiumFeature.BANK_STATEMENT_ANALYSIS:
        // Free users are limited to a certain number of bank statement analyses per month
        const statementCount = await getMonthlyBankStatementCount();
        return statementCount < FREE_PLAN_LIMITS.MAX_BANK_STATEMENTS_PER_MONTH;
        
      // The following features are premium-only
      case PremiumFeature.PERSONALIZED_COACHING:
      case PremiumFeature.DETAILED_SPENDING_ANALYTICS:
      case PremiumFeature.PRIORITY_SUPPORT:
      case PremiumFeature.AD_FREE_EXPERIENCE:
      case PremiumFeature.CUSTOM_CATEGORIES:
      case PremiumFeature.DATA_EXPORT:
        return false;
        
      default:
        return false;
    }
  } catch (error) {
    console.error('Error checking feature access:', error);
    return false;
  }
};

/**
 * Check if a feature limit has been reached (for free tier users)
 * @param feature The feature to check
 * @returns True if the limit has been reached, false otherwise
 */
export const isFeatureLimitReached = async (feature: PremiumFeature): Promise<boolean> => {
  try {
    // In test environments, never show feature limits
    const isTestMode = await isTestEnvironment();
    if (isTestMode) {
      return false;
    }
    
    const isPremium = await hasPremiumAccess();
    
    // Premium users have no limits
    if (isPremium) {
      return false;
    }
    
    // Check limits for free tier users
    switch (feature) {
      case PremiumFeature.UNLIMITED_SAVINGS_GOALS:
        const goalCount = await getSavingsGoalsCount();
        return goalCount >= FREE_PLAN_LIMITS.MAX_SAVINGS_GOALS;
        
      case PremiumFeature.ADVANCED_BUDGET_TOOLS:
        const budgetCount = await getBudgetCategoriesCount();
        return budgetCount >= FREE_PLAN_LIMITS.MAX_BUDGETS;
        
      case PremiumFeature.RECEIPT_SCANNING:
        const scanCount = await getMonthlyReceiptScanCount();
        return scanCount >= FREE_PLAN_LIMITS.MAX_RECEIPT_SCANS_PER_MONTH;
        
      case PremiumFeature.BANK_STATEMENT_ANALYSIS:
        const statementCount = await getMonthlyBankStatementCount();
        return statementCount >= FREE_PLAN_LIMITS.MAX_BANK_STATEMENTS_PER_MONTH;
        
      // For premium-only features, the limit is always reached for free users
      case PremiumFeature.PERSONALIZED_COACHING:
      case PremiumFeature.DETAILED_SPENDING_ANALYTICS:
      case PremiumFeature.PRIORITY_SUPPORT:
      case PremiumFeature.AD_FREE_EXPERIENCE:
      case PremiumFeature.CUSTOM_CATEGORIES:
      case PremiumFeature.DATA_EXPORT:
        return true;
        
      default:
        return true;
    }
  } catch (error) {
    console.error('Error checking feature limit:', error);
    // Default to not limiting in case of an error
    return false;
  }
};

// Helper functions for checking limits
// In a real app, these would query the database
// For now, we'll use AsyncStorage as a placeholder

const getMonthlyBankStatementCount = async (): Promise<number> => {
  // Implementation similar to getMonthlyReceiptScanCount
  return 0;
};

const getSavingsGoalsCount = async (): Promise<number> => {
  try {
    // In a real app, this would query the database
    const { getSavingsGoals } = await import('./savingsService');
    const goals = await getSavingsGoals();
    return goals.length;
  } catch (error) {
    console.error('Error getting savings goals count:', error);
    return 0;
  }
};

const getBudgetCategoriesCount = async (): Promise<number> => {
  try {
    // In a real app, this would query the database
    const { getBudgetCategories } = await import('./budgetService');
    const categories = await getBudgetCategories();
    return categories.length;
  } catch (error) {
    console.error('Error getting budget categories count:', error);
    return 0;
  }
};

/**
 * Display a premium upgrade modal
 * @param feature The feature that requires premium
 * @param navigation The navigation object to use for redirection
 */
export const showPremiumUpgradeModal = (
  feature: PremiumFeature,
  navigation: any
): void => {
  const featureNames = {
    [PremiumFeature.PERSONALIZED_COACHING]: 'Personalized Financial Coaching',
    [PremiumFeature.DETAILED_SPENDING_ANALYTICS]: 'Detailed Spending Analytics',
    [PremiumFeature.PRIORITY_SUPPORT]: 'Priority Customer Support',
    [PremiumFeature.AD_FREE_EXPERIENCE]: 'Ad-Free Experience',
    [PremiumFeature.ADVANCED_BUDGET_TOOLS]: 'Advanced Budget Tools',
    [PremiumFeature.UNLIMITED_SAVINGS_GOALS]: 'Unlimited Savings Goals',
    [PremiumFeature.RECEIPT_SCANNING]: 'Receipt Scanning',
    [PremiumFeature.BANK_STATEMENT_ANALYSIS]: 'Bank Statement Analysis',
    [PremiumFeature.CUSTOM_CATEGORIES]: 'Custom Categories',
    [PremiumFeature.DATA_EXPORT]: 'Data Export',
  };
  
  // Get feature name
  const featureName = featureNames[feature] || 'this feature';
  
  // Show alert
  Alert.alert(
    'Premium Feature',
    `${featureName} is a premium feature. Upgrade to Buzo Premium to access this and other exclusive features.`,
    [
      { text: 'Not Now', style: 'cancel' },
      { 
        text: 'View Premium Plans', 
        onPress: () => {
          // Navigate to subscription screen
          navigation.navigate('Subscription');
        }
      }
    ]
  );
};

/**
 * Get the subscription expiration date
 * @returns The subscription expiration date or null if not found
 */
export const getSubscriptionEndDate = async (): Promise<Date | null> => {
  try {
    // First, try to get expiration date from server validations
    const serverExpiryDate = await getSubscriptionExpiryDate();
    
    if (serverExpiryDate) {
      return serverExpiryDate;
    }
    
    // Fall back to local subscription info
    const subscription = await getUserSubscription();
    
    if (subscription && subscription.endDate) {
      return new Date(subscription.endDate);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting subscription end date:', error);
    return null;
  }
};

// Export additional functions
export default {
  getUserSubscription,
  hasPremiumAccess,
  updateSubscription,
  processSubscriptionPayment,
  cancelPremiumSubscription,
  getPremiumFeatures,
  hasFeatureAccess,
  isFeatureLimitReached,
  showPremiumUpgradeModal,
  PremiumFeature,
  FREE_PLAN_LIMITS,
  getSubscriptionEndDate,
}; 