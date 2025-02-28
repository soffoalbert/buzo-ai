import { supabase } from '../api/supabaseClient';
import * as SecureStore from 'expo-secure-store';

// Constants
const API_KEY_STORAGE_KEY = 'buzo_openai_api_key';
const GLOBAL_API_KEY_TYPE = 'openai';
// Default API key is only used as a fallback if all other methods fail
const DEFAULT_API_KEY = '';

/**
 * Set the OpenAI API key as a global key not linked to any specific user
 * Falls back to SecureStore if Supabase is unavailable
 * @param apiKey The OpenAI API key
 */
export const setGlobalApiKey = async (apiKey: string): Promise<void> => {
  try {
    // Store as a global API key
    const { error } = await supabase.rpc('set_global_api_key', {
      key_type_param: GLOBAL_API_KEY_TYPE,
      api_key_param: apiKey,
      description_param: 'Global OpenAI API key for development'
    });
    
    if (error) {
      console.error('Error storing global API key:', error);
      // Fall back to SecureStore
      await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey);
    } else {
      console.log('Global API key stored successfully');
      // Also store in SecureStore for offline access
      await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey);
    }
  } catch (error) {
    console.error('Error in setGlobalApiKey:', error);
    // Final fallback
    try {
      await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey);
    } catch (secureStoreError) {
      console.error('Critical error storing API key:', secureStoreError);
      throw secureStoreError;
    }
  }
};

/**
 * Get the stored global OpenAI API key
 * Falls back to SecureStore if Supabase is unavailable
 * @returns The stored API key or the default key if not found
 */
export const getGlobalApiKey = async (): Promise<string | null> => {
  try {
    // Try to get the global API key
    const { data: globalKeyData, error: globalKeyError } = await supabase.rpc('get_global_api_key', {
      key_type_param: GLOBAL_API_KEY_TYPE
    });
    
    if (!globalKeyError && globalKeyData) {
      console.log('Global API key retrieved successfully');
      return globalKeyData;
    } else {
      console.warn('Could not retrieve global API key, falling back to SecureStore:', globalKeyError);
      // Fall back to SecureStore
      const secureStoreKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
      return secureStoreKey || DEFAULT_API_KEY;
    }
  } catch (error) {
    console.error('Error retrieving global API key:', error);
    // Fall back to SecureStore
    try {
      const secureStoreKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
      return secureStoreKey || DEFAULT_API_KEY;
    } catch (secureStoreError) {
      console.error('Critical error retrieving API key:', secureStoreError);
      return DEFAULT_API_KEY;
    }
  }
};

/**
 * Clear the stored global OpenAI API key
 */
export const clearGlobalApiKey = async (): Promise<void> => {
  try {
    // Delete the global API key
    // Note: There's no direct function to delete a global API key,
    // so we'll set it to an empty string instead
    const { error } = await supabase.rpc('set_global_api_key', {
      key_type_param: GLOBAL_API_KEY_TYPE,
      api_key_param: '',
      description_param: 'Cleared global API key'
    });
    
    if (error) {
      console.error('Error clearing global API key:', error);
    } else {
      console.log('Global API key cleared successfully');
    }
    
    // Always clear from SecureStore regardless of Supabase result
    await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
    console.log('API key deleted from SecureStore');
  } catch (error) {
    console.error('Error clearing global API key:', error);
    // Try to at least clear from SecureStore
    try {
      await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
    } catch (secureStoreError) {
      console.error('Critical error clearing API key:', secureStoreError);
      throw secureStoreError;
    }
  }
};

/**
 * Check if a global API key exists
 * @returns True if a global API key exists, false otherwise
 */
export const hasGlobalApiKey = async (): Promise<boolean> => {
  const apiKey = await getGlobalApiKey();
  return !!apiKey && apiKey !== DEFAULT_API_KEY;
};

/**
 * Direct SQL function to set a global API key (for use in SQL Editor)
 * @returns SQL command to execute in Supabase SQL Editor
 */
export const getSetGlobalApiKeySql = (apiKey: string): string => {
  return `SELECT set_global_api_key('${GLOBAL_API_KEY_TYPE}', '${apiKey}', 'Global OpenAI API key for development');`;
};

/**
 * Direct SQL function to get a global API key (for use in SQL Editor)
 * @returns SQL command to execute in Supabase SQL Editor
 */
export const getGlobalApiKeySql = (): string => {
  return `SELECT get_global_api_key('${GLOBAL_API_KEY_TYPE}');`;
}; 