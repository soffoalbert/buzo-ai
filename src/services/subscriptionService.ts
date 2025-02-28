import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, SubscriptionTier, SubscriptionInfo, SubscriptionTransaction } from '../models/User';
import { loadUserProfile, updateUserProfile } from './userService';
import { generateUUID } from '../utils/helpers';

// Storage keys
const SUBSCRIPTION_STORAGE_KEY = 'buzo_subscription_info';

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
 * Process a subscription payment
 * @param amount The payment amount
 * @param currency The payment currency
 * @param paymentMethod The payment method
 * @param description The payment description
 * @returns The transaction information if successful, null otherwise
 */
export const processSubscriptionPayment = async (
  amount: number,
  currency: string,
  paymentMethod: string,
  description: string
): Promise<SubscriptionTransaction | null> => {
  try {
    // In a real app, this would integrate with a payment gateway
    // For now, we'll simulate a successful payment
    
    const transaction: SubscriptionTransaction = {
      id: generateUUID(),
      date: new Date().toISOString(),
      amount,
      currency,
      status: 'successful',
      paymentMethod,
      description
    };
    
    // Get the current subscription
    const subscription = await getUserSubscription();
    
    if (!subscription) {
      return null;
    }
    
    // Update the subscription with the new transaction
    const updatedSubscription: SubscriptionInfo = {
      ...subscription,
      tier: SubscriptionTier.PREMIUM,
      startDate: new Date().toISOString(),
      // Set end date to 1 month from now
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: true,
      paymentMethod,
      lastPaymentDate: new Date().toISOString(),
      nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      transactionHistory: [
        ...(subscription.transactionHistory || []),
        transaction
      ]
    };
    
    // Update the subscription
    const success = await updateSubscription(updatedSubscription);
    
    if (!success) {
      return null;
    }
    
    return transaction;
  } catch (error) {
    console.error('Error processing subscription payment:', error);
    return null;
  }
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