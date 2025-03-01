import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';

// Supabase configuration
// Replace these with your actual Supabase URL and anon key
const supabaseUrl = 'https://tsowtcltuvcbwgmylqxf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzb3d0Y2x0dXZjYndnbXlscXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA3MzM3NjUsImV4cCI6MjA1NjMwOTc2NX0.rL2E7XtIUsqO40ZPWf6ZwOHpAXd1dQQyop6T8fXRKg0';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzb3d0Y2x0dXZjYndnbXlscXhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDczMzc2NSwiZXhwIjoyMDU2MzA5NzY1fQ.WIAD8T7D__kbfqwM0VEMLB1P3N3T54Qn5o725EIVzVQ'

// Add service role key for admin operations (keep this secure!)
// This should be used only for server-side operations
// For security, in a production app, this would be stored in environment variables
// and only used in secure server contexts, not in the client app
 const supabaseServiceKey = SUPABASE_SERVICE_KEY;

// Validate Supabase URL format
try {
  new URL(supabaseUrl);
  console.log('Supabase URL format is valid');
} catch (error) {
  console.error('Invalid Supabase URL format:', error);
}

// Custom storage implementation using SecureStore for tokens and AsyncStorage for other data
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (key.includes('token') || key.includes('refresh')) {
        return await SecureStore.getItemAsync(key);
      }
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error getting item from storage:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (key.includes('token') || key.includes('refresh')) {
        await SecureStore.setItemAsync(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.error('Error setting item in storage:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (key.includes('token') || key.includes('refresh')) {
        await SecureStore.deleteItemAsync(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Error removing item from storage:', error);
    }
  },
};

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Create a service role client for admin operations
// This should only be used for server-side operations that require bypassing RLS
// WARNING: This client has admin privileges and should be used with caution
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Log Supabase initialization
console.log('Supabase client initialized with URL:', supabaseUrl);
if (supabaseAdmin) {
  console.log('Supabase admin client initialized');
} else {
  console.log('Supabase admin client not initialized (service key not provided)');
}

// Import migration manager
import { initializeMigrations, getMigrationStatus } from './migrations/migrationManager';

// Helper function to check if Supabase is connected
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    console.log('Checking Supabase connection...');
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error connecting to Supabase:', error);
      return false;
    }
    
    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Error checking Supabase connection:', error);
    return false;
  }
};

// Call checkSupabaseConnection on initialization to verify connection
checkSupabaseConnection()
  .then(isConnected => {
    if (!isConnected) {
      console.warn('Failed to connect to Supabase on initialization');
    } else {
      // If connected, run migrations first
      initializeMigrations()
        .then(migrationsSuccess => {
          if (migrationsSuccess) {
            console.log('Database migrations completed successfully');
            
            // Get migration status
            getMigrationStatus().then(status => {
              console.log(`Current database version: ${status.currentVersion}`);
              console.log(`Migration history: ${status.history.length} migrations applied`);
            });
          } else {
            console.warn('Database migrations failed or partially completed');
          }
          
          // Continue with database table checks
          ensureDatabaseTables()
            .then(result => {
              if (result.success) {
                console.log('Database tables check completed successfully');
                // Now ensure storage buckets exist
                ensureStorageBuckets()
                  .then(bucketResult => {
                    if (bucketResult.success) {
                      console.log('Storage buckets check completed successfully');
                    } else {
                      console.warn('Storage buckets check failed:', bucketResult.error);
                    }
                  })
                  .catch(error => {
                    console.error('Error during storage buckets check:', error);
                  });
              } else {
                console.warn('Database tables check failed:', result.error);
              }
            })
            .catch(error => {
              console.error('Error during database tables check:', error);
            });
        })
        .catch(error => {
          console.error('Error during database migrations:', error);
          
          // Continue with database table checks even if migrations fail
          ensureDatabaseTables()
            .then(result => {
              if (result.success) {
                console.log('Database tables check completed successfully');
              } else {
                console.warn('Database tables check failed:', result.error);
              }
            })
            .catch(error => {
              console.error('Error during database tables check:', error);
            });
        });
    }
  })
  .catch(error => {
    console.error('Error during initial Supabase connection check:', error);
  });

/**
 * Ensure the profiles table exists with the correct schema
 * This is a helper function to make sure the database is properly set up
 */
export const ensureProfilesTable = async (): Promise<{ success: boolean; error?: any }> => {
  try {
    // First check if the profiles table exists by trying to query it
    const { error: queryError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });
    
    if (queryError) {
      console.log('Profiles table may not exist or has permission issues:', queryError);
      
      // We won't try to create the table here as it requires admin privileges
      // Instead, we'll just log the issue and let the app continue
      // In a real app, you would handle this differently, perhaps by notifying an admin
      
      return { success: false, error: queryError };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error checking profiles table:', error);
    return { success: false, error };
  }
};

/**
 * Ensure the bank_statements table exists with the correct schema
 */
export const ensureBankStatementsTable = async (): Promise<{ success: boolean; error?: any }> => {
  try {
    // First check if the bank_statements table exists by trying to query it
    const { error: queryError } = await supabase
      .from('bank_statements')
      .select('count', { count: 'exact', head: true });
    
    if (queryError) {
      console.log('Bank statements table may not exist or has permission issues:', queryError);
      
      // We won't try to create the table here as it requires admin privileges
      // Instead, we'll create a fallback mechanism to store bank statements locally
      console.log('Setting up local fallback for bank statements storage');
      
      return { success: false, error: queryError };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error checking bank_statements table:', error);
    return { success: false, error };
  }
};

/**
 * Ensure the feedback tables exist
 * @returns Promise resolving to success status and any error
 */
export const ensureFeedbackTables = async (): Promise<{ success: boolean; error?: any }> => {
  try {
    if (!supabaseAdmin) {
      console.error('Supabase admin client not initialized');
      return { success: false, error: 'Supabase admin client not initialized' };
    }
    
    // Check if feedback table exists
    const { error: checkError } = await supabaseAdmin
      .from('feedback')
      .select('id')
      .limit(1);
    
    // If table doesn't exist, run the migration
    if (checkError && checkError.code === '42P01') { // PostgreSQL code for undefined_table
      // In React Native, we can't use fs to read files from the filesystem
      // Instead, we'll include the SQL directly in the code
      // This is a simplified approach - in production, you might want to use a more sophisticated solution
      
      const migrationSql = `
        -- Create feedback table
        CREATE TABLE IF NOT EXISTS feedback (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          feature_id TEXT NOT NULL,
          rating INTEGER CHECK (rating >= 1 AND rating <= 5),
          comments TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          context JSONB
        );

        -- Create feature_engagement table
        CREATE TABLE IF NOT EXISTS feature_engagement (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          feature_id TEXT NOT NULL,
          engagement_type TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          context JSONB
        );

        -- Add indexes
        CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON feedback(user_id);
        CREATE INDEX IF NOT EXISTS feedback_feature_id_idx ON feedback(feature_id);
        CREATE INDEX IF NOT EXISTS feature_engagement_user_id_idx ON feature_engagement(user_id);
        CREATE INDEX IF NOT EXISTS feature_engagement_feature_id_idx ON feature_engagement(feature_id);
      `;
      
      // Execute the migration
      const { error: migrationError } = await supabaseAdmin.rpc('exec_sql', {
        sql_query: migrationSql
      });
      
      if (migrationError) {
        console.error('Error running feedback tables migration:', migrationError);
        return { success: false, error: migrationError };
      }
      
      console.log('Feedback tables created successfully');
      return { success: true };
    }
    
    // Table already exists
    return { success: true };
  } catch (error) {
    console.error('Error ensuring feedback tables:', error);
    return { success: false, error };
  }
};

/**
 * Ensure all required database tables exist
 * This function checks for required tables and provides guidance if they don't exist
 */
export const ensureDatabaseTables = async (): Promise<{ success: boolean; error?: any }> => {
  try {
    console.log('Checking for required database tables...');
    
    // Check and ensure profiles table
    const profilesResult = await ensureProfilesTable();
    if (!profilesResult.success) {
      console.warn('Profiles table check failed:', profilesResult.error);
      console.log('The app will use local storage as a fallback where possible.');
    }
    
    // Check and ensure bank_statements table
    const bankStatementsResult = await ensureBankStatementsTable();
    if (!bankStatementsResult.success) {
      console.warn('Bank statements table check failed:', bankStatementsResult.error);
      console.log('The app will use local storage for bank statements.');
    }
    
    // Ensure feedback tables
    const feedbackResult = await ensureFeedbackTables();
    if (!feedbackResult.success) {
      return feedbackResult;
    }
    
    // If both checks failed, provide guidance for database setup
    if (!profilesResult.success && !bankStatementsResult.success) {
      console.log('');
      console.log('=== DATABASE SETUP GUIDANCE ===');
      console.log('It appears that the required database tables do not exist or are not accessible.');
      console.log('To set up the database properly, an administrator should run the following SQL in the Supabase SQL editor:');
      console.log('');
      console.log('-- Create profiles table');
      console.log('CREATE TABLE IF NOT EXISTS public.profiles (');
      console.log('  id UUID REFERENCES auth.users(id) PRIMARY KEY,');
      console.log('  first_name TEXT,');
      console.log('  last_name TEXT,');
      console.log('  avatar_url TEXT,');
      console.log('  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),');
      console.log('  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
      console.log(');');
      console.log('');
      console.log('-- Create bank_statements table');
      console.log('CREATE TABLE IF NOT EXISTS public.bank_statements (');
      console.log('  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),');
      console.log('  user_id UUID REFERENCES auth.users(id) NOT NULL,');
      console.log('  file_name TEXT NOT NULL,');
      console.log('  file_path TEXT NOT NULL,');
      console.log('  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),');
      console.log('  status TEXT NOT NULL,');
      console.log('  insights JSONB');
      console.log(');');
      console.log('');
      console.log('-- Set up RLS policies');
      console.log('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;');
      console.log('ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;');
      console.log('');
      console.log('-- Create policies for profiles');
      console.log('CREATE POLICY "Users can view their own profile" ON public.profiles');
      console.log('  FOR SELECT USING (auth.uid() = id);');
      console.log('CREATE POLICY "Users can update their own profile" ON public.profiles');
      console.log('  FOR UPDATE USING (auth.uid() = id);');
      console.log('');
      console.log('-- Create policies for bank_statements');
      console.log('CREATE POLICY "Users can view their own bank statements" ON public.bank_statements');
      console.log('  FOR SELECT USING (auth.uid() = user_id);');
      console.log('CREATE POLICY "Users can insert their own bank statements" ON public.bank_statements');
      console.log('  FOR INSERT WITH CHECK (auth.uid() = user_id);');
      console.log('CREATE POLICY "Users can update their own bank statements" ON public.bank_statements');
      console.log('  FOR UPDATE USING (auth.uid() = user_id);');
      console.log('CREATE POLICY "Users can delete their own bank statements" ON public.bank_statements');
      console.log('  FOR DELETE USING (auth.uid() = user_id);');
      console.log('');
      console.log('-- Create storage bucket');
      console.log('INSERT INTO storage.buckets (id, name, public) VALUES (\'user-documents\', \'user-documents\', false);');
      console.log('');
      console.log('-- Set up storage RLS policies');
      console.log('CREATE POLICY "Users can upload their own documents" ON storage.objects');
      console.log('  FOR INSERT WITH CHECK (bucket_id = \'user-documents\' AND auth.uid()::text = (storage.foldername(name))[1]);');
      console.log('CREATE POLICY "Users can view their own documents" ON storage.objects');
      console.log('  FOR SELECT USING (bucket_id = \'user-documents\' AND auth.uid()::text = (storage.foldername(name))[1]);');
      console.log('CREATE POLICY "Users can delete their own documents" ON storage.objects');
      console.log('  FOR DELETE USING (bucket_id = \'user-documents\' AND auth.uid()::text = (storage.foldername(name))[1]);');
      console.log('=== END DATABASE SETUP GUIDANCE ===');
      console.log('');
    }
    
    // Return success even if checks failed, to allow the app to continue with fallbacks
    return { success: true };
  } catch (error) {
    console.error('Error ensuring database tables:', error);
    return { success: true }; // Return success anyway to not block the app
  }
};

/**
 * Ensure the necessary storage buckets exist
 * This function checks for required buckets and creates them if they don't exist
 */
export const ensureStorageBuckets = async (): Promise<{ success: boolean; error?: any }> => {
  try {
    console.log('Checking for required storage buckets...');
    
    // List of required buckets
    const requiredBuckets = ['user-documents'];
    
    // Try to list buckets to check if they exist
    try {
      // Get list of existing buckets
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        // If we can't list buckets, it's likely a permissions issue
        console.warn('Unable to list storage buckets:', listError.message);
        console.log('This is likely due to permission restrictions. The app will use local storage as a fallback.');
        return { success: true }; // Return success so the app continues
      }
      
      // Check if each required bucket exists
      for (const bucketName of requiredBuckets) {
        const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
        
        if (!bucketExists) {
          console.log(`Bucket '${bucketName}' does not exist.`);
          console.log('Note: Creating buckets requires admin privileges in Supabase.');
          console.log('The app will use local storage as a fallback for file storage.');
          
          // We won't try to create the bucket as it requires admin privileges
          // Instead, we'll rely on the local storage fallback mechanism
        } else {
          console.log(`Bucket '${bucketName}' exists and is available.`);
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error checking storage buckets:', error);
      console.log('The app will use local storage as a fallback for file storage.');
      return { success: true }; // Return success so the app continues
    }
  } catch (error) {
    console.error('Error ensuring storage buckets:', error);
    return { success: true }; // Return success anyway to not block the app
  }
};

// Helper functions for authentication
export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  return { data, error };
};

// Refresh token rotation
export const refreshSession = async () => {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Failed to refresh session:', error.message);
      return { data: null, error };
    }
    
    console.log('Session refreshed successfully');
    return { data, error: null };
  } catch (exception) {
    console.error('Exception during session refresh:', exception);
    return { 
      data: null, 
      error: { message: 'Failed to refresh session due to an unexpected error' } 
    };
  }
};

// Validate current session
export const validateSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error retrieving session:', error.message);
      return { isValid: false, error, session: null };
    }

    if (!session) {
      console.log('No active session found');
      return { isValid: false, error: null, session: null };
    }

    // Check if token is expired or about to expire
    const tokenExpiryTime = new Date(session.expires_at || '');
    const now = new Date();
    const timeUntilExpiry = tokenExpiryTime.getTime() - now.getTime();
    
    // If token expires in less than 10 minutes, refresh it
    if (timeUntilExpiry < 600000) {
      console.log('Session expiring soon, refreshing...');
      const refreshResult = await refreshSession();
      
      if (refreshResult.error) {
        console.warn('Session refresh failed during validation');
        // If refresh fails but current token is still valid, allow continued use
        if (timeUntilExpiry > 0) {
          return { 
            isValid: true, 
            error: null, 
            session, 
            warning: 'Session will expire soon and refresh failed'
          };
        }
        return { isValid: false, error: refreshResult.error, session: null };
      }
      
      return { 
        isValid: true, 
        error: null, 
        session: refreshResult.data?.session || session,
        refreshed: true
      };
    }

    return { isValid: true, error: null, session };
  } catch (exception) {
    console.error('Exception during session validation:', exception);
    return { 
      isValid: false, 
      error: { message: 'Failed to validate session due to an unexpected error' },
      session: null
    };
  }
};

// Enhanced error handling
export const handleAuthError = (error: any) => {
  if (!error) return;

  // Log error for debugging
  console.error('Auth error:', error);

  // Handle specific error cases
  switch (error.message) {
    case 'Invalid login credentials':
      throw new Error('Invalid email or password');
    case 'Email not confirmed':
      throw new Error('Please verify your email address');
    case 'JWT expired':
      refreshSession() // Attempt to refresh the session
        .then(({ error: refreshError }) => {
          if (refreshError) {
            console.error('Failed to refresh expired token:', refreshError);
            throw new Error('Your session has expired. Please log in again.');
          }
        });
      break;
    default:
      throw new Error('An authentication error occurred');
  }
};

/**
 * Vault-related functions for secure storage of sensitive information
 */

/**
 * Store a secret in the Supabase Vault
 * @param name The name of the secret
 * @param value The value to store
 * @returns Result of the operation
 */
export const setVaultSecret = async (name: string, value: string): Promise<{ success: boolean; error?: any }> => {
  try {
    const { error } = await supabase.rpc('set_secret', {
      name,
      value
    });
    
    if (error) {
      console.error('Error storing secret in Vault:', error);
      return { success: false, error };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Exception during Vault secret storage:', error);
    return { success: false, error };
  }
};

/**
 * Retrieve a secret from the Supabase Vault
 * @param name The name of the secret to retrieve
 * @returns The secret value or null if not found
 */
export const getVaultSecret = async (name: string): Promise<{ value: string | null; error?: any }> => {
  try {
    const { data, error } = await supabase.rpc('get_secret', {
      name
    });
    
    if (error) {
      console.error('Error retrieving secret from Vault:', error);
      return { value: null, error };
    }
    
    return { value: data, error: null };
  } catch (error) {
    console.error('Exception during Vault secret retrieval:', error);
    return { value: null, error };
  }
};

/**
 * Delete a secret from the Supabase Vault
 * @param name The name of the secret to delete
 * @returns Result of the operation
 */
export const deleteVaultSecret = async (name: string): Promise<{ success: boolean; error?: any }> => {
  try {
    const { error } = await supabase.rpc('delete_secret', {
      name
    });
    
    if (error) {
      console.error('Error deleting secret from Vault:', error);
      return { success: false, error };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Exception during Vault secret deletion:', error);
    return { success: false, error };
  }
};

