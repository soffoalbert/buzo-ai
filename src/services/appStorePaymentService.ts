import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionInfo, SubscriptionTier, SubscriptionTransaction } from '../models/User';
import { getUserSubscription, updateSubscription, isTestEnvironment } from './subscriptionService';
import { generateUUID } from '../utils/helpers';
import * as RNIap from 'react-native-iap';
import { supabase } from '../api/supabaseClient';
import axios from 'axios';
import Constants from 'expo-constants';

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

// Package name for Android validation
const PACKAGE_NAME = 'com.buzo.financialassistant';

// Track if IAP is already initialized
let isIAPInitialized = false;

/**
 * Initialize the react-native-iap connection
 */
export const initializeIAP = async (): Promise<boolean> => {
  try {
    if (isIAPInitialized) {
      return true;
    }

    // Initialize the connection
    await RNIap.initConnection();
    
    // Set up purchase listener
    setupPurchaseListeners();
    
    isIAPInitialized = true;
    
    // Log if we're in test mode
    const isTestMode = await isTestEnvironment();
    console.log(`IAP initialized for ${Platform.OS}${isTestMode ? ' (TEST MODE)' : ''}`);
    
    return true;
  } catch (error) {
    console.error('Error initializing IAP:', error);
    return false;
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
 * Set up purchase update and error listeners
 */
const setupPurchaseListeners = () => {
  // Remove any existing listeners first
  RNIap.clearTransactionIOS();
  
  // Purchase completion listener
  const purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(
    async (purchase: RNIap.SubscriptionPurchase | RNIap.ProductPurchase) => {
      // Handle the purchase
      console.log('Purchase completed:', purchase);
      
      // For iOS, finish the transaction
      if (Platform.OS === 'ios') {
        await RNIap.finishTransactionIOS(purchase.transactionId);
      }
      
      // Acknowledge the purchase (required for Android)
      if (Platform.OS === 'android' && !purchase.acknowledged) {
        try {
          await RNIap.acknowledgePurchaseAndroid(purchase.purchaseToken);
        } catch (error) {
          console.error('Error acknowledging Android purchase:', error);
        }
      }
      
      // Process the purchase to update user's subscription
      await processSuccessfulPurchase(purchase);
    }
  );

  // Purchase error listener
  const purchaseErrorSubscription = RNIap.purchaseErrorListener(
    (error: RNIap.PurchaseError) => {
      console.error('Purchase error:', error);
      // Handle the error (e.g., show an error message to the user)
    }
  );

  return () => {
    // Clean up listeners when needed
    if (purchaseUpdateSubscription) {
      purchaseUpdateSubscription.remove();
    }
    if (purchaseErrorSubscription) {
      purchaseErrorSubscription.remove();
    }
  };
};

/**
 * Process a successful purchase and update the user's subscription
 * @param purchase The purchase object from IAP
 */
const processSuccessfulPurchase = async (
  purchase: RNIap.SubscriptionPurchase | RNIap.ProductPurchase
): Promise<void> => {
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
    
    // Store the receipt for later verification if needed
    await storeReceipt(productId, transactionId, transactionDate);
    
    // Validate the purchase with our server
    const validation = await validatePurchaseWithServer(purchase, user.id, productId);
    
    if (!validation.isValid) {
      console.error('Purchase validation failed:', validation.error);
      Alert.alert('Subscription Error', 'We could not validate your purchase. Please contact support.');
      return;
    }
    
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
      type: 'subscription',
      status: 'completed',
      description: `Buzo Premium - ${product.title}`,
      transactionId: purchase.transactionId
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
 * @param productId The ID of the test product
 */
const createMockPremiumSubscription = async (productId: string): Promise<void> => {
  try {
    // Determine if monthly or annual subscription
    const isMonthly = productId === TEST_SUBSCRIPTION_PRODUCT_IDS.MONTHLY;
    
    // Get product info (or create mock data if not available)
    let product: SubscriptionProduct;
    try {
      const products = await getSubscriptionProducts();
      product = products.find(p => p.productId === productId) || {
        productId,
        title: isMonthly ? 'Monthly Premium (Test)' : 'Annual Premium (Test)',
        description: 'Test subscription for development',
        price: isMonthly ? 9.99 : 99.99,
        priceString: isMonthly ? '$9.99/month' : '$99.99/year',
        currency: 'USD',
        period: isMonthly ? 'month' : 'year'
      };
    } catch (error) {
      // Create fallback mock product
      product = {
        productId,
        title: isMonthly ? 'Monthly Premium (Test)' : 'Annual Premium (Test)',
        description: 'Test subscription for development',
        price: isMonthly ? 9.99 : 99.99,
        priceString: isMonthly ? '$9.99/month' : '$99.99/year',
        currency: 'USD',
        period: isMonthly ? 'month' : 'year'
      };
    }
    
    // Create a mock transaction
    const transaction: SubscriptionTransaction = {
      id: generateUUID(),
      amount: product.price,
      currency: product.currency,
      date: new Date().toISOString(),
      type: 'subscription',
      status: 'completed',
      description: `TEST - ${product.title}`,
      transactionId: `test-${generateUUID().slice(0, 8)}`
    };
    
    // Get existing subscription or create new one
    const subscription = await getUserSubscription() || {
      tier: SubscriptionTier.FREE,
      startDate: new Date().toISOString(),
      paymentMethod: 'test',
      transactionHistory: []
    };
    
    // Calculate expiration date
    const now = new Date();
    const expirationDate = new Date(now);
    expirationDate.setDate(expirationDate.getDate() + (isMonthly ? 30 : 365));
    
    // Create mock updated subscription
    const updatedSubscription: SubscriptionInfo = {
      ...subscription,
      tier: SubscriptionTier.PREMIUM,
      startDate: new Date().toISOString(),
      endDate: expirationDate.toISOString(),
      autoRenew: true,
      paymentMethod: 'test',
      transactionHistory: [
        transaction,
        ...(subscription.transactionHistory || []),
      ]
    };
    
    // Update the subscription
    await updateSubscription(updatedSubscription);
    
    // Show success message
    Alert.alert(
      'Test Subscription Activated',
      `Your test ${isMonthly ? 'monthly' : 'annual'} premium subscription has been activated until ${expirationDate.toDateString()}.`,
      [{ text: 'OK' }]
    );
    
    console.log('Test subscription created successfully');
  } catch (error) {
    console.error('Error creating test subscription:', error);
    Alert.alert('Error', 'Failed to create test subscription');
  }
};

/**
 * Validate purchase with server-side validation endpoint
 */
const validatePurchaseWithServer = async (
  purchase: RNIap.SubscriptionPurchase | RNIap.ProductPurchase,
  userId: string,
  productId: string
): Promise<{
  isValid: boolean;
  purchaseDate?: string;
  expirationDate?: string;
  autoRenewing?: boolean;
  error?: string;
}> => {
  try {
    // Get platform-specific data
    if (Platform.OS === 'ios') {
      const receiptData = await RNIap.getReceiptIOS();
      
      if (!receiptData) {
        return { isValid: false, error: 'No receipt data available' };
      }
      
      // Validate with server
      const response = await axios.post(RECEIPT_VALIDATION_ENDPOINT, {
        platform: 'ios',
        receiptData,
        productId,
        transactionId: purchase.transactionId,
        userId
      }, {
        headers: getPlatformHeaders()
      });
      
      return {
        isValid: response.data.isValid,
        purchaseDate: response.data.purchaseDate,
        expirationDate: response.data.expirationDate,
        autoRenewing: response.data.autoRenewing,
      };
      
    } else if (Platform.OS === 'android' && 'purchaseToken' in purchase) {
      // Validate with server
      const response = await axios.post(RECEIPT_VALIDATION_ENDPOINT, {
        platform: 'android',
        packageName: PACKAGE_NAME,
        productId,
        purchaseToken: purchase.purchaseToken,
        transactionId: purchase.transactionId || purchase.orderId,
        userId
      }, {
        headers: getPlatformHeaders()
      });
      
      return {
        isValid: response.data.isValid,
        purchaseDate: response.data.purchaseDate,
        expirationDate: response.data.expirationDate,
        autoRenewing: response.data.autoRenewing,
      };
    }
    
    return { isValid: false, error: 'Unsupported platform or missing purchase token' };
  } catch (error) {
    console.error('Server validation error:', error);
    return { 
      isValid: false, 
      error: error.response?.data?.error || error.message 
    };
  }
};

/**
 * Calculate expiration date for a subscription
 */
const calculateExpirationDate = (isMonthly: boolean): Date => {
  const now = new Date();
  const endDate = new Date();
  
  if (isMonthly) {
    endDate.setMonth(endDate.getMonth() + 1);
  } else {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }
  
  return endDate;
};

/**
 * Get available subscription products
 * @returns Array of subscription products
 */
export const getSubscriptionProducts = async (): Promise<SubscriptionProduct[]> => {
  try {
    // Initialize IAP if needed
    if (!isIAPInitialized) {
      await initializeIAP();
    }
    
    // Get product IDs based on environment
    const itemSkus = await getProductIds();
    
    // Fetch subscription products from the store
    const products = await RNIap.getSubscriptions({ skus: itemSkus });
    
    console.log(`Fetched ${products.length} subscription products`);
    
    // Check if we're in test mode
    const isTestMode = await isTestEnvironment();
    
    // If in test mode and no products found, return test mock products
    if (isTestMode && products.length === 0) {
      console.log('No test products found in store - using mock test products');
      return [
        {
          productId: TEST_SUBSCRIPTION_PRODUCT_IDS.MONTHLY,
          title: 'Monthly Premium (Test)',
          description: 'Unlock all premium features with monthly billing. Test version.',
          price: 9.99,
          priceString: 'R 9.99/month',
          currency: 'ZAR',
          period: 'month'
        },
        {
          productId: TEST_SUBSCRIPTION_PRODUCT_IDS.ANNUAL,
          title: 'Annual Premium (Test)',
          description: 'Unlock all premium features with annual billing (2 months free). Test version.',
          price: 99.99,
          priceString: 'R 99.99/year',
          currency: 'ZAR',
          period: 'year'
        }
      ];
    }
    
    // Map the products to our format
    return products.map(product => ({
      productId: product.productId,
      title: product.title,
      description: product.description,
      price: Number(product.price) || 0,
      priceString: product.localizedPrice || `${product.currency || 'ZAR'} ${product.price || '0'}`,
      currency: product.currency || 'ZAR',
      period: product.subscriptionPeriodUnitIOS || product.subscriptionPeriodAndroid || 'month',
      introductoryPrice: product.introductoryPrice
    }));
  } catch (error) {
    console.error('Error getting subscription products:', error);
    
    // Check if we're in test mode and return test products
    const isTestMode = await isTestEnvironment();
    if (isTestMode) {
      console.log('Error fetching products - returning mock test products');
      return [
        {
          productId: TEST_SUBSCRIPTION_PRODUCT_IDS.MONTHLY,
          title: 'Monthly Premium (Test)',
          description: 'Unlock all premium features with monthly billing. Test version.',
          price: 9.99,
          priceString: 'R 9.99/month',
          currency: 'ZAR',
          period: 'month'
        },
        {
          productId: TEST_SUBSCRIPTION_PRODUCT_IDS.ANNUAL,
          title: 'Annual Premium (Test)',
          description: 'Unlock all premium features with annual billing (2 months free). Test version.',
          price: 99.99,
          priceString: 'R 99.99/year',
          currency: 'ZAR',
          period: 'year'
        }
      ];
    }
    
    // Return empty array in production
    return [];
  }
};

// Export alias for backward compatibility
export const getProducts = getSubscriptionProducts;

/**
 * Request to purchase a subscription
 * @param productId The ID of the product to purchase
 * @returns Promise that resolves to true if the purchase was successful
 */
export const requestSubscription = async (productId: string): Promise<boolean> => {
  try {
    // Initialize IAP if needed
    if (!isIAPInitialized) {
      await initializeIAP();
    }
    
    // Check if we're in test mode
    const isTestMode = await isTestEnvironment();
    
    console.log(`Requesting subscription for product: ${productId} (Test mode: ${isTestMode})`);
    
    // For test mode with test product IDs, we can directly create a test subscription
    if (isTestMode && (
        productId === TEST_SUBSCRIPTION_PRODUCT_IDS.MONTHLY || 
        productId === TEST_SUBSCRIPTION_PRODUCT_IDS.ANNUAL
      )) {
      console.log('🧪 Creating direct test subscription (bypassing store)');
      await createMockPremiumSubscription(productId);
      return true;
    }
    
    // Otherwise, proceed with regular IAP flow (this will also work for TestFlight sandbox purchases)
    if (Platform.OS === 'ios') {
      await RNIap.requestSubscription(productId);
    } else {
      // Android specific
      await RNIap.requestSubscription(productId, false); // false = don't upgrade/downgrade an existing subscription
    }
    
    // The purchase will be processed by the purchaseUpdatedListener in setupPurchaseListeners
    return true;
  } catch (error) {
    console.error('Error requesting subscription:', error);
    
    // Show user-friendly error message
    if (error instanceof Error) {
      const errorMessage = error.message || 'Unknown error';
      
      // Check for user cancellation
      if (errorMessage.includes('cancel') || errorMessage.includes('cancelled')) {
        Alert.alert('Purchase Cancelled', 'The subscription purchase was cancelled.');
      } else {
        Alert.alert(
          'Subscription Error', 
          'There was a problem processing your subscription request. Please try again later.'
        );
      }
    }
    
    return false;
  }
};

// Export alias for backward compatibility
export const purchaseSubscription = requestSubscription;

/**
 * Restore previous purchases from the app store
 */
export const restorePurchases = async (): Promise<boolean> => {
  try {
    // Initialize if needed
    if (!isIAPInitialized) {
      await initializeIAP();
    }
    
    // Get available purchases
    let purchases;
    if (Platform.OS === 'ios') {
      // iOS needs to explicitly restore purchases
      purchases = await RNIap.getAvailablePurchases();
    } else {
      // Android purchases should already be available
      purchases = await RNIap.getAvailablePurchases();
    }
    
    // Process each available purchase
    if (purchases && purchases.length > 0) {
      // Filter for active subscriptions
      const activeSubscriptions = purchases.filter(
        purchase => !purchase.expirationDate || new Date(purchase.expirationDate) > new Date()
      );
      
      if (activeSubscriptions.length > 0) {
        // Process the most recent active subscription
        const latestPurchase = activeSubscriptions.sort(
          (a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
        )[0];
        
        // Get user details
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user || !user.id) {
          console.error('No authenticated user found');
          return false;
        }
        
        // Validate the purchase with the server
        const validationResult = await validatePurchaseWithServer(
          latestPurchase,
          user.id,
          latestPurchase.productId
        );
        
        if (validationResult.isValid) {
          await processSuccessfulPurchase(latestPurchase);
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    return false;
  }
};

/**
 * Validate a receipt with server
 */
export const validateReceipt = async (
  purchase: RNIap.SubscriptionPurchase | RNIap.ProductPurchase
): Promise<boolean> => {
  try {
    // Get user from Supabase
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !user.id) {
      console.error('No authenticated user found');
      return false;
    }
    
    // Use server-side validation
    const validationResult = await validatePurchaseWithServer(
      purchase,
      user.id,
      purchase.productId
    );
    
    return validationResult.isValid;
  } catch (error) {
    console.error('Error validating receipt:', error);
    return false;
  }
};

/**
 * Store receipt information locally for reference
 */
const storeReceipt = async (productId: string, transactionId: string, date: string): Promise<void> => {
  try {
    // Get existing receipts
    const receiptsData = await AsyncStorage.getItem(RECEIPT_STORAGE_KEY);
    const receipts = receiptsData ? JSON.parse(receiptsData) : [];
    
    // Add new receipt
    receipts.push({
      productId,
      transactionId,
      date,
      platform: Platform.OS,
    });
    
    // Store updated receipts
    await AsyncStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(receipts));
  } catch (error) {
    console.error('Error storing receipt:', error);
  }
};

/**
 * Get all stored receipts
 */
export const getStoredReceipts = async (): Promise<any[]> => {
  try {
    const receiptsData = await AsyncStorage.getItem(RECEIPT_STORAGE_KEY);
    return receiptsData ? JSON.parse(receiptsData) : [];
  } catch (error) {
    console.error('Error getting stored receipts:', error);
    return [];
  }
};

/**
 * End an active subscription connection
 */
export const endIAPConnection = async (): Promise<void> => {
  try {
    if (isIAPInitialized) {
      await RNIap.endConnection();
      isIAPInitialized = false;
    }
  } catch (error) {
    console.error('Error ending IAP connection:', error);
  }
};

/**
 * Guide user to App Store/Play Store to manage their subscription
 */
export const openStoreForSubscriptionManagement = (): void => {
  if (Platform.OS === 'ios') {
    // iOS: Open the subscription management page in the App Store
    RNIap.openIosSubscriptionsSettings();
  } else {
    // Android: Unfortunately, there isn't a direct method to open Play Store subscriptions
    // We would typically use Linking to open the Play Store app subscription section
    console.log('Please open Google Play Store and go to your subscriptions to manage them');
  }
}; 