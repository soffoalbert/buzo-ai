import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionInfo, SubscriptionTier, SubscriptionTransaction } from '../models/User';
import { getUserSubscription, updateSubscription, isTestEnvironment } from './subscriptionService';
import { generateUUID } from '../utils/helpers';
import { supabase } from '../api/supabaseClient';

// Constants
const RECEIPT_STORAGE_KEY = 'buzo_app_store_receipts';
const TEST_IAP_ENABLED_KEY = 'buzo_test_iap_enabled';
const SUBSCRIPTION_PRODUCT_IDS = {
  MONTHLY: Platform.select({
    ios: 'buzo.premium.monthly',
    android: 'buzo.premium.monthly',
  }) as string,
  ANNUAL: Platform.select({
    ios: 'buzo.premium.annual',
    android: 'buzo.premium.annual',
  }) as string,
};

// Test product IDs (for sandbox/simulator)
const TEST_SUBSCRIPTION_PRODUCT_IDS = {
  MONTHLY: Platform.select({
    ios: 'buzo.test.monthly',
    android: 'buzo.test.monthly',
  }) as string,
  ANNUAL: Platform.select({
    ios: 'buzo.test.annual',
    android: 'buzo.test.annual',
  }) as string,
};

// Track if IAP is already initialized
let isIAPInitialized = false;

// Mock types for purchases
export interface MockPurchase {
  productId: string;
  transactionId: string;
  transactionDate?: number;
  acknowledged?: boolean;
}

// Type definitions for IAP products
export interface SubscriptionProduct {
  productId: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  localizedPrice: string;
  subscriptionPeriod?: string;
}

/**
 * Initialize the IAP connection (mock implementation)
 */
export const initializeIAP = async (): Promise<boolean> => {
  if (isIAPInitialized) {
    return true;
  }
  
  try {
    // Mock IAP initialization
    console.log('Mock IAP initialized - no actual store connection');
    isIAPInitialized = true;
    
    // Log if we're in test mode (wrapped in try/catch to prevent any possible issues)
    try {
      const isTestMode = await isTestEnvironment();
      console.log(`IAP initialized for ${Platform.OS}${isTestMode ? ' (TEST MODE)' : ''}`);
    } catch (err) {
      console.log('Unable to determine test mode, defaulting to mock implementation');
    }
    
    return true;
  } catch (error) {
    // Never let this fail the app initialization
    console.error('Error initializing mock IAP, continuing with app launch:', error);
    isIAPInitialized = true; // Set to true anyway to prevent further initialization attempts
    return true; // Return true regardless of errors to allow app to continue
  }
};

/**
 * Get appropriate product IDs based on environment
 */
export const getProductIds = async (): Promise<string[]> => {
  const isTestMode = await isTestEnvironment();
  
  if (isTestMode) {
    console.log('Using test product IDs for IAP');
    // Use test product IDs in test environments
    return Platform.select({
      ios: [
        TEST_SUBSCRIPTION_PRODUCT_IDS.MONTHLY,
        TEST_SUBSCRIPTION_PRODUCT_IDS.ANNUAL
      ],
      android: [
        TEST_SUBSCRIPTION_PRODUCT_IDS.MONTHLY,
        TEST_SUBSCRIPTION_PRODUCT_IDS.ANNUAL
      ]
    }) || [];
  } else {
    // Use real product IDs in production
    return Platform.select({
      ios: [
        SUBSCRIPTION_PRODUCT_IDS.MONTHLY,
        SUBSCRIPTION_PRODUCT_IDS.ANNUAL
      ],
      android: [
        SUBSCRIPTION_PRODUCT_IDS.MONTHLY,
        SUBSCRIPTION_PRODUCT_IDS.ANNUAL
      ]
    }) || [];
  }
};

/**
 * Process a successful purchase and update the user's subscription
 * @param purchase The mock purchase object
 */
const processSuccessfulPurchase = async (purchase: MockPurchase): Promise<void> => {
  try {
    const { productId, transactionId, transactionDate } = purchase;
    console.log(`Processing purchase: ${productId}`);
    
    // Check if we're in test mode
    const isTestMode = await isTestEnvironment();
    
    // In test mode, we'll create a mock subscription without server validation
    if (isTestMode) {
      console.log('🧪 Test mode purchase detected - bypassing server validation');
      await createMockPremiumSubscription(productId);
      return;
    }
    
    // Get the user's ID for validation
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user found');
      return;
    }
    
    // Store the receipt for later verification if needed - NOTE: transactionId is stored but not in the transaction object
    await storeReceipt(productId, transactionId, 
      transactionDate ? new Date(transactionDate).toISOString() : new Date().toISOString());
    
    // For a real implementation, you would validate the receipt with Apple/Google here
    // Mock validation response
    const validation = {
      isValid: true,
      purchaseDate: new Date(transactionDate || Date.now()).toISOString(),
      expirationDate: calculateExpirationDate(
        productId === SUBSCRIPTION_PRODUCT_IDS.MONTHLY || 
        productId === TEST_SUBSCRIPTION_PRODUCT_IDS.MONTHLY
      ).toISOString(),
      autoRenewing: true
    };
    
    // Get product info
    const products = await getSubscriptionProducts();
    const product = products.find(p => p.productId === productId);
    
    if (!product) {
      console.error('Product not found for ID:', productId);
      return;
    }
    
    // Determine subscription tier and duration
    const isMonthly = productId === SUBSCRIPTION_PRODUCT_IDS.MONTHLY || 
                      productId === TEST_SUBSCRIPTION_PRODUCT_IDS.MONTHLY;
    
    // Create a transaction record
    const transaction: SubscriptionTransaction = {
      id: generateUUID(),
      amount: product.price,
      currency: product.currency,
      date: new Date().toISOString(),
      status: 'successful',
      description: `Buzo Premium - ${product.title}`,
      paymentMethod: Platform.OS === 'ios' ? 'apple' : 'google'
    };
    
    // Get and update the user's subscription
    const subscription = await getUserSubscription();
    if (!subscription) {
      console.error('User subscription not found');
      return;
    }
    
    // Calculate expiration date
    const purchaseDate = validation.purchaseDate ? new Date(validation.purchaseDate) : new Date();
    const expirationDate = validation.expirationDate ? 
                           new Date(validation.expirationDate) : 
                           calculateExpirationDate(isMonthly);
    
    // Update the subscription with the new transaction
    const updatedSubscription: SubscriptionInfo = {
      ...subscription,
      tier: SubscriptionTier.PREMIUM,
      startDate: purchaseDate.toISOString(),
      endDate: expirationDate.toISOString(),
      autoRenew: validation.autoRenewing || false,
      paymentMethod: Platform.OS === 'ios' ? 'apple' : 'google',
      transactionHistory: [
        transaction,
        ...(subscription.transactionHistory || []),
      ]
    };
    
    // Update the subscription
    await updateSubscription(updatedSubscription);
    
    console.log('Subscription updated successfully');
    
  } catch (error) {
    console.error('Error processing purchase:', error);
  }
};

/**
 * Create a mock premium subscription for testing
 */
const createMockPremiumSubscription = async (productId: string): Promise<void> => {
  try {
    // Get the current subscription
    const subscription = await getUserSubscription();
    if (!subscription) {
      console.error('User subscription not found');
      return;
    }
    
    // Determine if monthly or annual
    const isMonthly = productId === TEST_SUBSCRIPTION_PRODUCT_IDS.MONTHLY;
    
    // Create a mock transaction
    const transaction: SubscriptionTransaction = {
      id: generateUUID(),
      amount: isMonthly ? 9.99 : 99.99,
      currency: 'USD',
      date: new Date().toISOString(),
      status: 'successful',
      description: `Buzo Premium - ${isMonthly ? 'Monthly' : 'Annual'} (TEST)`,
      paymentMethod: Platform.OS === 'ios' ? 'apple' : 'google'
    };
    
    // Calculate expiration date
    const expirationDate = calculateExpirationDate(isMonthly);
    
    // Update the subscription
    const updatedSubscription: SubscriptionInfo = {
      ...subscription,
      tier: SubscriptionTier.PREMIUM,
      startDate: new Date().toISOString(),
      endDate: expirationDate.toISOString(),
      autoRenew: true,
      paymentMethod: Platform.OS === 'ios' ? 'apple' : 'google',
      transactionHistory: [
        transaction,
        ...(subscription.transactionHistory || []),
      ]
    };
    
    await updateSubscription(updatedSubscription);
    
    console.log(`🧪 Mock ${isMonthly ? 'monthly' : 'annual'} subscription created successfully`);
    Alert.alert(
      'Test Subscription Activated',
      `Your ${isMonthly ? 'monthly' : 'annual'} premium subscription has been activated in test mode.`
    );
    
  } catch (error) {
    console.error('Error creating mock subscription:', error);
  }
};

/**
 * Calculate expiration date based on subscription type
 */
const calculateExpirationDate = (isMonthly: boolean): Date => {
  const now = new Date();
  if (isMonthly) {
    return new Date(now.setMonth(now.getMonth() + 1));
  } else {
    return new Date(now.setFullYear(now.getFullYear() + 1));
  }
};

/**
 * Get available subscription products
 */
export const getSubscriptionProducts = async (): Promise<SubscriptionProduct[]> => {
  try {
    // Ensure IAP is initialized
    if (!isIAPInitialized) {
      await initializeIAP();
    }
    
    // Check if we're in test mode
    const isTestMode = await isTestEnvironment();
    
    if (isTestMode) {
      return [
        {
          productId: TEST_SUBSCRIPTION_PRODUCT_IDS.MONTHLY,
          title: 'Buzo Premium Monthly (Test)',
          description: 'Monthly subscription to Buzo Premium (Test)',
          price: 9.99,
          currency: 'USD',
          localizedPrice: '$9.99',
          subscriptionPeriod: 'P1M'
        },
        {
          productId: TEST_SUBSCRIPTION_PRODUCT_IDS.ANNUAL,
          title: 'Buzo Premium Annual (Test)',
          description: 'Annual subscription to Buzo Premium (Test)',
          price: 99.99,
          currency: 'USD',
          localizedPrice: '$99.99',
          subscriptionPeriod: 'P1Y'
        }
      ];
    } else {
      // In production, alert that this is a mock implementation
      Alert.alert(
        'Development Build',
        'In-app purchases are not available in this build. This is a mock implementation.'
      );
      
      return [
        {
          productId: SUBSCRIPTION_PRODUCT_IDS.MONTHLY,
          title: 'Buzo Premium Monthly',
          description: 'Monthly subscription to Buzo Premium',
          price: 9.99,
          currency: 'USD',
          localizedPrice: '$9.99',
          subscriptionPeriod: 'P1M'
        },
        {
          productId: SUBSCRIPTION_PRODUCT_IDS.ANNUAL,
          title: 'Buzo Premium Annual',
          description: 'Annual subscription to Buzo Premium',
          price: 99.99,
          currency: 'USD',
          localizedPrice: '$99.99',
          subscriptionPeriod: 'P1Y'
        }
      ];
    }
  } catch (error) {
    console.error('Error getting subscription products:', error);
    return [];
  }
};

/**
 * Request a subscription
 */
export const requestSubscription = async (productId: string): Promise<boolean> => {
  try {
    console.log(`Requesting subscription for product: ${productId}`);
    
    // Ensure IAP is initialized
    if (!isIAPInitialized) {
      await initializeIAP();
    }
    
    // Check if we're in test mode
    const isTestMode = await isTestEnvironment();
    
    if (isTestMode) {
      // In test mode, create a mock subscription directly
      await createMockPremiumSubscription(productId);
      return true;
    } else {
      // Alert that this is a mock implementation
      Alert.alert(
        'Development Build',
        'In-app purchases are not available in this build. This is a mock implementation.'
      );
      
      // Process a mock subscription anyway for testing
      const mockPurchase: MockPurchase = {
        productId,
        transactionId: `mock-${generateUUID()}`,
        transactionDate: Date.now(),
        acknowledged: false
      };
      
      await processSuccessfulPurchase(mockPurchase);
      return true;
    }
  } catch (error) {
    console.error('Error requesting subscription:', error);
    Alert.alert('Subscription Error', 'There was an error processing your subscription request.');
    return false;
  }
};

/**
 * Restore purchases
 */
export const restorePurchases = async (): Promise<boolean> => {
  try {
    console.log('Attempting to restore purchases');
    
    // Ensure IAP is initialized
    if (!isIAPInitialized) {
      await initializeIAP();
    }
    
    // Check if we're in test mode
    const isTestMode = await isTestEnvironment();
    
    if (isTestMode) {
      // In test mode, create a mock subscription
      await createMockPremiumSubscription(TEST_SUBSCRIPTION_PRODUCT_IDS.MONTHLY);
      return true;
    } else {
      // Alert that this is a mock implementation
      Alert.alert(
        'Development Build',
        'In-app purchases are not available in this build. This is a mock implementation.'
      );
      
      return false;
    }
  } catch (error) {
    console.error('Error restoring purchases:', error);
    Alert.alert('Restore Error', 'There was an error restoring your purchases.');
    return false;
  }
};

/**
 * Store receipt for later verification
 */
const storeReceipt = async (productId: string, transactionId: string, date: string): Promise<void> => {
  try {
    // Get existing receipts
    const existingReceiptsJson = await AsyncStorage.getItem(RECEIPT_STORAGE_KEY);
    const existingReceipts = existingReceiptsJson ? JSON.parse(existingReceiptsJson) : [];
    
    // Add new receipt
    const newReceipt = {
      productId,
      transactionId,
      date,
      timestamp: new Date().toISOString()
    };
    
    // Save updated receipts
    await AsyncStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify([
      newReceipt,
      ...existingReceipts
    ]));
    
    console.log('Receipt stored successfully');
  } catch (error) {
    console.error('Error storing receipt:', error);
  }
};

/**
 * Get stored receipts
 */
export const getStoredReceipts = async (): Promise<any[]> => {
  try {
    const receiptsJson = await AsyncStorage.getItem(RECEIPT_STORAGE_KEY);
    return receiptsJson ? JSON.parse(receiptsJson) : [];
  } catch (error) {
    console.error('Error getting stored receipts:', error);
    return [];
  }
};

/**
 * End IAP connection
 */
export const endIAPConnection = async (): Promise<void> => {
  try {
    if (isIAPInitialized) {
      // Mock disconnecting
      isIAPInitialized = false;
      console.log('Mock IAP connection ended');
    }
  } catch (error) {
    console.error('Error ending IAP connection:', error);
  }
};

/**
 * Open store for subscription management
 */
export const openStoreForSubscriptionManagement = (): void => {
  // Mock implementation
  Alert.alert(
    'Subscription Management',
    'This is a mock implementation. In a production app, this would open the app store for subscription management.'
  );
}; 