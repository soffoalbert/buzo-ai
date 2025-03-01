import { supabase } from '../api/supabaseClient';
import * as SecureStore from 'expo-secure-store';
import { getCurrentUser } from '../api/supabaseClient';

// Constants
const API_KEY_STORAGE_KEY = 'buzo_openai_api_key';
const API_KEY_TABLE = 'api_keys';
const VAULT_SECRET_NAME = 'OPENAI_API_KEY';
// Default API key is only used as a fallback if all other methods fail
// For development and testing, add your OpenAI API key here
// WARNING: Never commit this key to a public repository
// In production, this should be empty and keys should be stored in Supabase or SecureStore
const DEFAULT_API_KEY = null; // Set to null to prevent inadvertent usage of placeholder keys

/**
 * Set the OpenAI API key in Supabase Vault and database
 * Falls back to SecureStore if Supabase is unavailable
 * @param apiKey The OpenAI API key
 */
export const setApiKey = async (apiKey: string): Promise<void> => {
  try {
    // Get current user
    const { data, error: userError } = await getCurrentUser();
    
    if (userError) {
      console.error('Error getting current user:', userError);
      // Fall back to SecureStore
      await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey);
      return;
    }
    
    // Check if user exists and has an ID
    const userId = data?.user?.id;
    if (userId) {
      // Try to store in Vault first
      try {
        // Use the Vault API to store the secret
        const { error: vaultError } = await supabase.rpc('set_secret', {
          name: VAULT_SECRET_NAME,
          value: apiKey
        });
        
        if (vaultError) {
          console.warn('Could not store API key in Vault, falling back to database:', vaultError);
          
          // Store in database as fallback
          const { error } = await supabase
            .from(API_KEY_TABLE)
            .upsert(
              { 
                user_id: userId, 
                key_type: 'openai', 
                api_key: apiKey,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              },
              { onConflict: 'user_id,key_type' }
            );
          
          if (error) {
            console.error('Error storing API key in Supabase database:', error);
          } else {
            console.log('API key stored in Supabase database successfully');
          }
        } else {
          console.log('API key stored in Supabase Vault successfully');
        }
      } catch (error) {
        console.error('Error storing API key in Vault or database:', error);
        
        // Try database as fallback
        try {
          const { error: dbError } = await supabase
            .from(API_KEY_TABLE)
            .upsert(
              { 
                user_id: userId, 
                key_type: 'openai', 
                api_key: apiKey,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              },
              { onConflict: 'user_id,key_type' }
            );
          
          if (dbError) {
            console.error('Error storing API key in Supabase database:', dbError);
          } else {
            console.log('API key stored in Supabase database successfully');
          }
        } catch (dbError) {
          console.error('Error storing API key in database:', dbError);
        }
      }
      
      // Also store in SecureStore for offline access
      await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey);
    } else {
      // No authenticated user, use SecureStore
      await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey);
      console.log('No authenticated user, API key stored in SecureStore');
    }
  } catch (error) {
    console.error('Error in setApiKey:', error);
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
 * Get the stored OpenAI API key from Supabase Vault or database
 * Falls back to SecureStore if Supabase is unavailable
 * @returns The stored API key or null if not found
 */
export const getApiKey = async (): Promise<string | null> => {
  try {
    // Get current user
    const { data, error: userError } = await getCurrentUser();
    
    if (userError) {
      console.error('Error getting current user:', userError);
      // Fall back to SecureStore
      const secureStoreKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
      return secureStoreKey || DEFAULT_API_KEY;
    }
    
    // Check if user exists and has an ID
    const userId = data?.user?.id;
    if (userId) {
      // Try to get from Vault first
      try {
        const { data: vaultData, error: vaultError } = await supabase.rpc('get_secret', {
          name: VAULT_SECRET_NAME
        });
        
        if (!vaultError && vaultData) {
          console.log('API key retrieved from Supabase Vault successfully');
          return vaultData;
        } else {
          console.warn('Could not retrieve API key from Vault, trying database:', vaultError);
        }
      } catch (vaultError) {
        console.warn('Error accessing Vault, falling back to database:', vaultError);
      }
      
      // Try to get from database as fallback
      try {
        const { data: keyData, error } = await supabase
          .from(API_KEY_TABLE)
          .select('api_key')
          .eq('user_id', userId)
          .eq('key_type', 'openai')
          .single();
        
        if (error || !keyData) {
          console.log('API key not found in Supabase or error occurred, trying SecureStore');
          // Try SecureStore as fallback
          const secureStoreKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
          return secureStoreKey || DEFAULT_API_KEY;
        }
        
        return keyData.api_key || DEFAULT_API_KEY;
      } catch (dbError) {
        console.error('Error retrieving API key from database:', dbError);
        // Try SecureStore as fallback
        const secureStoreKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
        return secureStoreKey || DEFAULT_API_KEY;
      }
    } else {
      // No authenticated user, use SecureStore
      const secureStoreKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
      return secureStoreKey || DEFAULT_API_KEY;
    }
  } catch (error) {
    console.error('Error retrieving API key:', error);
    // Final fallback
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
 * Clear the stored OpenAI API key from Supabase Vault, database, and SecureStore
 */
export const clearApiKey = async (): Promise<void> => {
  try {
    // Get current user
    const { data, error: userError } = await getCurrentUser();
    
    if (userError) {
      console.error('Error getting current user:', userError);
      // Just clear from SecureStore
      await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
      return;
    }
    
    // Check if user exists and has an ID
    const userId = data?.user?.id;
    if (userId) {
      // Try to delete from Vault first
      try {
        const { error: vaultError } = await supabase.rpc('delete_secret', {
          name: VAULT_SECRET_NAME
        });
        
        if (vaultError) {
          console.warn('Could not delete API key from Vault:', vaultError);
        } else {
          console.log('API key deleted from Supabase Vault successfully');
        }
      } catch (vaultError) {
        console.warn('Error accessing Vault for deletion:', vaultError);
      }
      
      // Delete from database
      try {
        const { error } = await supabase
          .from(API_KEY_TABLE)
          .delete()
          .eq('user_id', userId)
          .eq('key_type', 'openai');
        
        if (error) {
          console.error('Error deleting API key from Supabase database:', error);
        } else {
          console.log('API key deleted from Supabase database successfully');
        }
      } catch (dbError) {
        console.error('Error deleting API key from database:', dbError);
      }
    }
    
    // Always clear from SecureStore regardless of Supabase result
    await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
    console.log('API key deleted from SecureStore');
  } catch (error) {
    console.error('Error clearing API key:', error);
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
 * Migrate existing API key from SecureStore to Supabase Vault and database
 * This can be called during app initialization to move keys to Supabase
 */
export const migrateApiKeyToSupabase = async (): Promise<void> => {
  try {
    // Check if user is authenticated
    const { data, error: userError } = await getCurrentUser();
    
    // Check if user exists and has an ID
    const userId = data?.user?.id;
    if (userError || !userId) {
      console.log('No authenticated user, skipping API key migration');
      return;
    }
    
    // Get key from SecureStore
    const apiKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
    if (!apiKey) {
      console.log('No API key found in SecureStore, nothing to migrate');
      return;
    }
    
    // Check if key already exists in Vault
    try {
      const { data: vaultData, error: vaultError } = await supabase.rpc('get_secret', {
        name: VAULT_SECRET_NAME
      });
      
      if (!vaultError && vaultData) {
        console.log('API key already exists in Supabase Vault, no need to migrate');
        return;
      }
    } catch (vaultError) {
      console.warn('Error checking Vault for existing key, will try to migrate anyway:', vaultError);
    }
    
    // Store in Supabase Vault
    try {
      const { error: vaultError } = await supabase.rpc('set_secret', {
        name: VAULT_SECRET_NAME,
        value: apiKey
      });
      
      if (vaultError) {
        console.warn('Could not migrate API key to Vault, trying database:', vaultError);
        
        // Check if key already exists in database
        const { data: existingKey } = await supabase
          .from(API_KEY_TABLE)
          .select('id')
          .eq('user_id', userId)
          .eq('key_type', 'openai')
          .single();
        
        if (existingKey) {
          console.log('API key already exists in Supabase database, no need to migrate');
          return;
        }
        
        // Store in database as fallback
        const { error } = await supabase
          .from(API_KEY_TABLE)
          .insert({ 
            user_id: userId, 
            key_type: 'openai', 
            api_key: apiKey,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (error) {
          console.error('Error migrating API key to Supabase database:', error);
        } else {
          console.log('API key successfully migrated to Supabase database');
        }
      } else {
        console.log('API key successfully migrated to Supabase Vault');
      }
    } catch (error) {
      console.error('Error during API key migration:', error);
    }
  } catch (error) {
    console.error('Error during API key migration:', error);
  }
};

/**
 * Ensure the api_keys table exists in Supabase
 * This should be called during app initialization
 */
export const ensureApiKeysTable = async (): Promise<{ success: boolean; error?: any }> => {
  try {
    // Check if the api_keys table exists by trying to query it
    const { error: queryError } = await supabase
      .from(API_KEY_TABLE)
      .select('count', { count: 'exact', head: true });
    
    if (queryError) {
      console.log('API keys table may not exist or has permission issues:', queryError);
      return { success: false, error: queryError };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error checking api_keys table:', error);
    return { success: false, error };
  }
}; 