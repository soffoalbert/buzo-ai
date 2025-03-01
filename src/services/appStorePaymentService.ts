import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionInfo, SubscriptionTier, SubscriptionTransaction } from '../models/User';
import { getUserSubscription, updateSubscription } from './subscriptionService';
import { generateUUID } from '../utils/helpers';
import * as RNIap from 'react-native-iap';
import supabase, { RECEIPT_VALIDATION_ENDPOINT, getPlatformHeaders } from './supabase';
import axios from 'axios';

// Constants
const RECEIPT_STORAGE_KEY = 'buzo_app_store_receipts';
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

// Package name for Android validation
const PACKAGE_NAME = 'com.buzo.financialassistant';

// Define all subscription products
const itemSkus = Platform.select({
  ios: [
    SUBSCRIPTION_PRODUCT_IDS.MONTHLY,
    SUBSCRIPTION_PRODUCT_IDS.ANNUAL
  ],
  android: [
    SUBSCRIPTION_PRODUCT_IDS.MONTHLY,
    SUBSCRIPTION_PRODUCT_IDS.ANNUAL
  ]
}) || [];

// Define product details for UI
export interface SubscriptionProduct {
  productId: string;
  title: string;
  description: string;
  price: number;
  priceString: string;
  currency: string;
  period: string;
  introductoryPrice?: string;
}

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
    console.log(`IAP initialized for ${Platform.OS}`);
    return true;
  } catch (error) {
    console.error('Error initializing IAP:', error);
    return false;
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
 */
const processSuccessfulPurchase = async (
  purchase: RNIap.SubscriptionPurchase | RNIap.ProductPurchase
): Promise<void> => {
  try {
    // Get basic purchase info
    const { productId, transactionId, transactionDate } = purchase;
    const isMonthly = productId === SUBSCRIPTION_PRODUCT_IDS.MONTHLY;
    
    // Get user from Supabase
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !user.id) {
      console.error('No authenticated user found');
      return;
    }
    
    // Validate purchase with server
    const validationResult = await validatePurchaseWithServer(
      purchase,
      user.id,
      productId
    );
    
    if (!validationResult.isValid) {
      console.error('Purchase validation failed:', validationResult.error);
      return;
    }
    
    // Get product details to determine price
    const products = await getSubscriptionProducts();
    const product = products.find(p => p.productId === productId);
    
    if (!product) {
      console.error('Product details not found for:', productId);
      return;
    }
    
    // Create a transaction record
    const transaction: SubscriptionTransaction = {
      id: transactionId || generateUUID(),
      date: validationResult.purchaseDate || new Date(transactionDate || Date.now()).toISOString(),
      amount: product.price,
      currency: product.currency,
      status: 'successful',
      paymentMethod: Platform.OS === 'ios' ? 'Apple App Store' : 'Google Play Store',
      description: `Buzo Premium - ${product.title}`,
    };
    
    // Get and update the user's subscription
    const subscription = await getUserSubscription();
    if (!subscription) {
      console.error('User subscription not found');
      return;
    }
    
    // Parse expiration date
    const expirationDate = validationResult.expirationDate ? 
      new Date(validationResult.expirationDate) : 
      calculateExpirationDate(isMonthly);
    
    // Update the subscription with the new transaction
    const updatedSubscription: SubscriptionInfo = {
      ...subscription,
      tier: SubscriptionTier.PREMIUM,
      startDate: validationResult.purchaseDate || new Date().toISOString(),
      endDate: expirationDate.toISOString(),
      autoRenew: validationResult.autoRenewing || true,
      paymentMethod: Platform.OS === 'ios' ? 'Apple App Store' : 'Google Play Store',
      lastPaymentDate: validationResult.purchaseDate || new Date().toISOString(),
      nextPaymentDate: expirationDate.toISOString(),
      transactionHistory: [
        ...(subscription.transactionHistory || []),
        transaction
      ]
    };
    
    // Update the subscription
    await updateSubscription(updatedSubscription);
    
  } catch (error) {
    console.error('Error processing successful purchase:', error);
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
 * Get available subscription products from the store
 * @alias getProducts - For backward compatibility
 */
export const getSubscriptionProducts = async (): Promise<SubscriptionProduct[]> => {
  try {
    // Initialize if needed
    if (!isIAPInitialized) {
      await initializeIAP();
    }

    // Fetch subscription products from the store
    const products = await RNIap.getSubscriptions({ skus: itemSkus });
    
    // Map to our SubscriptionProduct interface
    return products.map(product => ({
      productId: product.productId,
      title: product.title,
      description: product.description,
      price: parseFloat(product.price || '0'),
      priceString: product.localizedPrice || '',
      currency: product.currency || 'USD',
      period: product.subscriptionPeriodAndroid || (product.productId.includes('monthly') ? 'month' : 'year'),
      introductoryPrice: product.introductoryPrice
    }));
  } catch (error) {
    console.error('Error getting subscription products:', error);
    
    // Return fallback products for development/testing
    return [
      {
        productId: SUBSCRIPTION_PRODUCT_IDS.MONTHLY,
        title: 'Monthly Premium',
        description: 'Unlock all premium features',
        price: 49.99,
        priceString: '$49.99',
        currency: 'USD',
        period: 'month',
      },
      {
        productId: SUBSCRIPTION_PRODUCT_IDS.ANNUAL,
        title: 'Annual Premium',
        description: 'Unlock all premium features at a discount',
        price: 499.99,
        priceString: '$499.99',
        currency: 'USD',
        period: 'year',
      },
    ];
  }
};

// Export alias for backward compatibility
export const getProducts = getSubscriptionProducts;

/**
 * Request a purchase for the specified product
 * @alias purchaseSubscription - For backward compatibility
 */
export const requestSubscription = async (productId: string): Promise<boolean> => {
  try {
    // Initialize if needed
    if (!isIAPInitialized) {
      await initializeIAP();
    }
    
    // Request the subscription purchase
    if (Platform.OS === 'ios') {
      await RNIap.requestSubscription(productId);
    } else {
      // For Android, you can specify additional options
      await RNIap.requestSubscription(productId, false); // false = don't upgrade/downgrade an existing subscription
    }
    
    // Purchase will be processed in the purchaseUpdatedListener
    return true;
  } catch (error) {
    console.error('Error requesting subscription:', error);
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