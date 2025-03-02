import { supabase } from '../api/supabaseClient';
import { Platform } from 'react-native';

/**
 * Interface for purchase validation record
 */
export interface PurchaseValidation {
  id: string;
  user_id: string;
  product_id: string;
  transaction_id: string;
  platform: string;
  purchase_date: string;
  validation_date: string;
  is_valid: boolean;
  expiration_date: string | null;
  is_trial?: boolean;
  is_intro_offer?: boolean;
  original_transaction_id?: string;
  auto_renewing?: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get purchase validations for the current user
 */
export const getUserPurchaseValidations = async (): Promise<PurchaseValidation[]> => {
  try {
    const { data, error } = await supabase
      .from('purchase_validations')
      .select('*')
      .order('purchase_date', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching purchase validations:', error);
    return [];
  }
};

/**
 * Get most recent valid subscription
 */
export const getLatestValidSubscription = async (): Promise<PurchaseValidation | null> => {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('purchase_validations')
      .select('*')
      .eq('is_valid', true)
      .gt('expiration_date', now)
      .order('expiration_date', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      // If no valid subscription was found, this will throw an error
      return null;
    }
    
    return data || null;
  } catch (error) {
    console.error('Error fetching latest valid subscription:', error);
    return null;
  }
};

/**
 * Check if a product has been purchased
 */
export const isProductPurchased = async (productId: string): Promise<boolean> => {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('purchase_validations')
      .select('id')
      .eq('product_id', productId)
      .eq('is_valid', true)
      .gt('expiration_date', now)
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error(`Error checking if product ${productId} is purchased:`, error);
    return false;
  }
};

/**
 * Check if user has any active subscriptions
 */
export const hasActiveSubscription = async (): Promise<boolean> => {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('purchase_validations')
      .select('id')
      .eq('is_valid', true)
      .gt('expiration_date', now)
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error('Error checking for active subscriptions:', error);
    return false;
  }
};

/**
 * Get purchase validation by transaction ID
 */
export const getPurchaseValidationByTransactionId = async (
  transactionId: string
): Promise<PurchaseValidation | null> => {
  try {
    const { data, error } = await supabase
      .from('purchase_validations')
      .select('*')
      .eq('transaction_id', transactionId)
      .eq('platform', Platform.OS)
      .single();
    
    if (error) {
      return null;
    }
    
    return data || null;
  } catch (error) {
    console.error(`Error fetching validation for transaction ${transactionId}:`, error);
    return null;
  }
};

/**
 * Get subscription expiration date (if any)
 */
export const getSubscriptionExpiryDate = async (): Promise<Date | null> => {
  try {
    const latestSubscription = await getLatestValidSubscription();
    
    if (latestSubscription && latestSubscription.expiration_date) {
      return new Date(latestSubscription.expiration_date);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting subscription expiry date:', error);
    return null;
  }
}; 