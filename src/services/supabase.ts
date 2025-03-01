import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Get Supabase URL and key from environment variables or constants
// In a real app, these would be stored in a secure way (e.g., .env file)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project-url.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

// Initialize Supabase client with React Native AsyncStorage
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Define API endpoints for receipt validation
export const RECEIPT_VALIDATION_ENDPOINT = `${SUPABASE_URL}/functions/v1/validate-receipt`;

// Helper function to get platform-specific headers for purchase validation
export const getPlatformHeaders = () => {
  return {
    'Content-Type': 'application/json',
    'Platform': Platform.OS,
  };
};

export default supabase; 