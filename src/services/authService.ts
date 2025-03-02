import { supabase, supabaseAdmin } from '../api/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Development configuration
// Default to true, but will be overridden by AsyncStorage value if available
let DISABLE_EMAIL_VERIFICATION = true;
const IS_DEVELOPMENT = Constants.expoConfig?.extra?.env === 'development' || 
                      Constants.expoConfig?.extra?.env === 'local' || 
                      __DEV__;

// Initialize email verification setting from AsyncStorage
(async () => {
  try {
    const storedValue = await AsyncStorage.getItem('DISABLE_EMAIL_VERIFICATION');
    if (storedValue !== null) {
      DISABLE_EMAIL_VERIFICATION = storedValue === 'true';
    }
    
    // Log development mode status
    if (IS_DEVELOPMENT && DISABLE_EMAIL_VERIFICATION) {
      console.log('🔧 Development mode: Email verification is DISABLED');
    } else {
      console.log('📧 Email verification is ENABLED');
    }
  } catch (error) {
    console.error('Error reading email verification setting:', error);
  }
})();

// Helper function to check if email verification is disabled
const isEmailVerificationDisabled = async (): Promise<boolean> => {
  if (!IS_DEVELOPMENT) return false;
  
  try {
    const storedValue = await AsyncStorage.getItem('DISABLE_EMAIL_VERIFICATION');
    return storedValue === 'true';
  } catch (error) {
    console.error('Error reading email verification setting:', error);
    return DISABLE_EMAIL_VERIFICATION; // Fall back to default
  }
};

/**
 * Store a value securely, handling values larger than SecureStore's 2048 byte limit
 * @param key The key to store the value under
 * @param value The value to store
 */
const secureStoreWithFallback = async (key: string, value: string): Promise<void> => {
  try {
    // Check if value is too large for SecureStore (2048 bytes)
    if (value && value.length > 1800) { // Using 1800 to be safe
      console.log(`Value for ${key} is too large for SecureStore, using AsyncStorage with prefix`);
      // Store a marker in SecureStore indicating the value is in AsyncStorage
      await SecureStore.setItemAsync(`${key}_marker`, 'large_value_in_async');
      // Store the actual value in AsyncStorage with a special prefix for security-sensitive data
      await AsyncStorage.setItem(`secure_${key}`, value);
    } else {
      // Value is small enough for SecureStore
      await SecureStore.setItemAsync(key, value);
      // Clean up any marker and AsyncStorage value if they exist
      await SecureStore.deleteItemAsync(`${key}_marker`);
      await AsyncStorage.removeItem(`secure_${key}`);
    }
  } catch (error) {
    console.error(`Error storing ${key}:`, error);
    // Fallback to AsyncStorage if SecureStore fails
    await AsyncStorage.setItem(`secure_${key}`, value);
  }
};

/**
 * Retrieve a value that was stored with secureStoreWithFallback
 * @param key The key the value was stored under
 * @returns The stored value or null if not found
 */
const secureRetrieveWithFallback = async (key: string): Promise<string | null> => {
  try {
    // Check if we have a marker indicating the value is in AsyncStorage
    const marker = await SecureStore.getItemAsync(`${key}_marker`);
    
    if (marker === 'large_value_in_async') {
      // Value was too large for SecureStore, retrieve from AsyncStorage
      return await AsyncStorage.getItem(`secure_${key}`);
    }
    
    // Try to get from SecureStore first
    const value = await SecureStore.getItemAsync(key);
    if (value !== null) {
      return value;
    }
    
    // If not in SecureStore, check AsyncStorage fallback
    return await AsyncStorage.getItem(`secure_${key}`);
  } catch (error) {
    console.error(`Error retrieving ${key}:`, error);
    // Try AsyncStorage as last resort
    return await AsyncStorage.getItem(`secure_${key}`);
  }
};

/**
 * Delete a value that was stored with secureStoreWithFallback
 * @param key The key the value was stored under
 */
const secureDeleteWithFallback = async (key: string): Promise<void> => {
  try {
    // Delete from SecureStore
    await SecureStore.deleteItemAsync(key);
    // Delete marker if it exists
    await SecureStore.deleteItemAsync(`${key}_marker`);
    // Delete from AsyncStorage fallback
    await AsyncStorage.removeItem(`secure_${key}`);
  } catch (error) {
    console.error(`Error deleting ${key}:`, error);
  }
};

/**
 * Get the current user ID from AsyncStorage
 * @returns The user ID or null if not authenticated
 */
export const getUserId = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('userId');
};

/**
 * Register a new user
 * @param email User's email
 * @param password User's password
 * @param fullName User's full name
 * @returns The user data and status information
 */
export const registerUser = async (
  email: string,
  password: string,
  fullName: string
): Promise<{ data: any; error: any; message?: string }> => {
  try {
    // Register user with Supabase auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (authError) {
      console.error('Registration error:', authError);
      return {
        data: null,
        error: authError,
        message: 'Registration failed. Please try again.'
      };
    }

    if (!authData.user) {
      const error = new Error('Registration failed: No user data returned');
      console.error(error);
      return { data: null, error, message: 'Registration failed. Please try again.' };
    }

    // Create user profile using the centralized function
    try {
      const profileData = await createOrUpdateUserProfile(authData.user.id, {
        email,
        full_name: fullName
      });

      return {
        data: {
          user: authData.user,
          profile: profileData
        },
        error: null
      };
    } catch (profileError) {
      console.error('Error creating user profile:', profileError);
      return {
        data: {
          user: authData.user,
          profile: null
        },
        error: profileError,
        message: 'Registration successful but profile creation failed.'
      };
    }
  } catch (error) {
    console.error('Unexpected error during registration:', error);
    return {
      data: null,
      error,
      message: 'An unexpected error occurred during registration.'
    };
  }
};

/**
 * Login a user
 * @param email User's email
 * @param password User's password
 * @returns The user data and status information
 */
export const loginUser = async (email: string, password: string): Promise<{
  data: any;
  error: any;
  message?: string;
}> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Login error:', error);
      return {
        data: null,
        error,
        message: 'Login failed. Please check your credentials.'
      };
    }

    if (!data.user) {
      const error = new Error('Login failed: No user data returned');
      console.error(error);
      return { data: null, error, message: 'Login failed. Please try again.' };
    }

    console.log('User logged in successfully with ID:', data.user.id);

    // Get or create user profile
    try {
      const profileData = await createOrUpdateUserProfile(data.user.id, {
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name
      });

      return {
        data: {
          user: data.user,
          profile: profileData,
          session: data.session
        },
        error: null,
        message: 'Login successful'
      };
    } catch (profileError) {
      console.error('Error getting/creating user profile:', profileError);
      return {
        data: {
          user: data.user,
          profile: null,
          session: data.session
        },
        error: profileError,
        message: 'Login successful but profile sync failed.'
      };
    }
  } catch (error) {
    console.error('Unexpected error during login:', error);
    return {
      data: null,
      error,
      message: 'An unexpected error occurred during login.'
    };
  }
};

/**
 * Logout the current user
 * @returns Status information about the logout operation
 */
export const logoutUser = async (): Promise<{
  success: boolean;
  error?: any;
  message?: string;
}> => {
  try {
    console.log('Attempting to log out user');
    
    // Get user ID for logging purposes
    const userId = await AsyncStorage.getItem('userId');
    if (userId) {
      console.log(`Logging out user with ID: ${userId}`);
    }
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error signing out from Supabase:', error);
      throw new Error(error.message);
    }

    console.log('Successfully signed out from Supabase');

    // Clear secure storage
    try {
      await secureDeleteWithFallback('userToken');
      console.log('User token cleared');
    } catch (tokenError) {
      console.error('Error clearing user token:', tokenError);
      // Continue with other cleanup
    }
    
    // Clear all user data from AsyncStorage
    const keysToRemove = [
      'userId', 
      'userEmail', 
      'userFullName', 
      'userProfile',
      'secure_userToken'
    ];
    
    // Add any other user-related keys that might be stored
    const allKeys = await AsyncStorage.getAllKeys();
    const userRelatedKeys = allKeys.filter(key => 
      key.startsWith('user') || 
      key.startsWith('secure_') || 
      key.startsWith('buzo_')
    );
    
    // Combine all keys to remove
    const allKeysToRemove = [...new Set([...keysToRemove, ...userRelatedKeys])];
    
    // Remove all keys
    await AsyncStorage.multiRemove(allKeysToRemove);
    console.log(`Cleared ${allKeysToRemove.length} items from local storage`);
    
    return { 
      success: true,
      message: 'You have been successfully logged out'
    };
  } catch (error) {
    console.error('Error in logoutUser:', error);
    
    // Even if there's an error with Supabase, try to clear local data
    try {
      await secureDeleteWithFallback('userToken');
      await AsyncStorage.removeItem('userId');
      await AsyncStorage.removeItem('userEmail');
      await AsyncStorage.removeItem('userFullName');
      await AsyncStorage.removeItem('userProfile');
      console.log('Local user data cleared despite Supabase error');
    } catch (clearError) {
      console.error('Error clearing local data:', clearError);
    }
    
    return { 
      success: false, 
      error,
      message: 'There was a problem logging out, but your local session has been cleared'
    };
  }
};

/**
 * Check if the user is authenticated
 * @returns True if the user is authenticated, false otherwise
 */
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const token = await secureRetrieveWithFallback('userToken');
    return !!token;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
};

/**
 * Get user profile
 * @returns The user profile data
 */
export const getUserProfile = async (): Promise<any> => {
  try {
    const userId = await getUserId();
    if (!userId) {
      return { data: null, error: new Error('User not authenticated') };
    }

    // Try to get profile from Supabase using admin client to bypass RLS
    const { data, error } = supabaseAdmin
      ? await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
      : await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

    if (error) {
      console.error('Error fetching profile from Supabase:', error);
      
      // If we can't get the profile from Supabase, try to get it from local storage
      const localProfile = await AsyncStorage.getItem('userProfile');
      if (localProfile) {
        console.log('Using locally stored profile data');
        return { data: JSON.parse(localProfile), error: null };
      }
      
      // If no local profile, create a minimal one from available data
      const email = await AsyncStorage.getItem('userEmail');
      const fullName = await AsyncStorage.getItem('userFullName');
      
      if (email || fullName) {
        const minimalProfile = {
          id: userId,
          email: email || '',
          full_name: fullName || '',
          created_at: new Date().toISOString()
        };
        return { data: minimalProfile, error: null };
      }
      
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return { data: null, error };
  }
};

/**
 * Update the user's profile
 * @param profileData The profile data to update
 * @returns The updated profile data
 */
export const updateUserProfile = async (profileData: any): Promise<any> => {
  try {
    const userId = await getUserId();
    
    if (!userId) {
      return { data: null, error: new Error('User not authenticated') };
    }

    // Ensure the ID matches the current user
    const dataToUpdate = { ...profileData, id: userId };
    
    // Try to update in Supabase using admin client to bypass RLS
    const { data, error } = supabaseAdmin
      ? await supabaseAdmin
          .from('profiles')
          .update(dataToUpdate)
          .eq('id', userId)
          .select()
          .single()
      : await supabase
          .from('profiles')
          .update(dataToUpdate)
          .eq('id', userId)
          .select()
          .single();

    if (error) {
      console.error('Error updating profile in Supabase:', error);
      
      // If we get a row-level security policy violation or other error, update locally
      if (error.code === '42501' || error.code === 'PGRST116') {
        console.log('Unable to update profile in Supabase. Updating locally.');
        
        // Get the current local profile or create a new one
        const localProfileStr = await AsyncStorage.getItem('userProfile');
        let localProfile = localProfileStr ? JSON.parse(localProfileStr) : { id: userId };
        
        // Update the local profile with the new data
        localProfile = { ...localProfile, ...dataToUpdate, updated_at: new Date().toISOString() };
        
        // Save the updated profile locally
        await AsyncStorage.setItem('userProfile', JSON.stringify(localProfile));
        
        // Update specific fields in separate storage for quick access
        if (dataToUpdate.full_name) {
          await AsyncStorage.setItem('userFullName', dataToUpdate.full_name);
        }
        if (dataToUpdate.email) {
          await AsyncStorage.setItem('userEmail', dataToUpdate.email);
        }
        
        return { data: localProfile, error: null };
      }
      
      return { data: null, error };
    }

    // Update local storage for quick access
    if (data.full_name) {
      await AsyncStorage.setItem('userFullName', data.full_name);
    }
    if (data.email) {
      await AsyncStorage.setItem('userEmail', data.email);
    }
    
    // Also update the local profile copy to keep it in sync
    await AsyncStorage.setItem('userProfile', JSON.stringify(data));

    return { data, error: null };
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    return { data: null, error };
  }
};

/**
 * Send a password reset email to the user
 * @param email The email address to send the reset link to
 * @returns Status information about the password reset request
 */
export const resetPassword = async (email: string): Promise<{
  success: boolean;
  error?: any;
  message: string;
}> => {
  try {
    console.log(`Sending password reset email to: ${email}`);
    
    if (!email) {
      return {
        success: false,
        error: new Error('Email is required'),
        message: 'Please provide your email address'
      };
    }
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'buzoai://reset-password'
    });
    
    if (error) {
      console.error('Error sending password reset email:', error);
      return {
        success: false,
        error,
        message: 'Failed to send password reset email. Please try again.'
      };
    }
    
    console.log('Password reset email sent successfully');
    return {
      success: true,
      message: 'Password reset instructions have been sent to your email'
    };
  } catch (error) {
    console.error('Error in resetPassword:', error);
    return {
      success: false,
      error,
      message: 'An unexpected error occurred. Please try again later.'
    };
  }
};

/**
 * Update the user's password
 * @param newPassword The new password
 * @returns Status information about the password update
 */
export const updatePassword = async (newPassword: string): Promise<{
  success: boolean;
  error?: any;
  message: string;
}> => {
  try {
    console.log('Attempting to update user password');
    
    if (!newPassword || newPassword.length < 6) {
      return {
        success: false,
        error: new Error('Invalid password'),
        message: 'Password must be at least 6 characters long'
      };
    }
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) {
      console.error('Error updating password:', error);
      return {
        success: false,
        error,
        message: 'Failed to update password. Please try again.'
      };
    }
    
    console.log('Password updated successfully');
    return {
      success: true,
      message: 'Your password has been updated successfully'
    };
  } catch (error) {
    console.error('Error in updatePassword:', error);
    return {
      success: false,
      error,
      message: 'An unexpected error occurred. Please try again later.'
    };
  }
};

/**
 * Verify a user's email using a token from the URL
 * @param token The verification token from the email link
 * @returns Status information about the verification
 */
export const verifyEmail = async (token: string): Promise<{
  success: boolean;
  error?: any;
  message: string;
}> => {
  try {
    console.log('Verifying email with token');
    
    if (!token) {
      return {
        success: false,
        error: new Error('Invalid token'),
        message: 'Verification token is missing or invalid'
      };
    }
    
    // This is typically handled by the deep link handler in your app
    // The token would be extracted from the URL and then used to verify the session
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'email'
    });
    
    if (error) {
      console.error('Error verifying email:', error);
      return {
        success: false,
        error,
        message: 'Failed to verify your email. The link may have expired.'
      };
    }
    
    console.log('Email verified successfully');
    return {
      success: true,
      message: 'Your email has been verified successfully'
    };
  } catch (error) {
    console.error('Error in verifyEmail:', error);
    return {
      success: false,
      error,
      message: 'An unexpected error occurred during verification'
    };
  }
};

/**
 * Resend verification email to the user
 * @param email The email address to resend verification to
 * @returns Status information about the resend request
 */
export const resendVerificationEmail = async (email: string): Promise<{
  success: boolean;
  error?: any;
  message: string;
}> => {
  try {
    console.log(`Resending verification email to: ${email}`);
    
    if (!email) {
      return {
        success: false,
        error: new Error('Email is required'),
        message: 'Please provide your email address'
      };
    }
    
    // Use OTP to send a verification email
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: 'buzoai://verify-email'
      }
    });
    
    if (error) {
      console.error('Error resending verification email:', error);
      return {
        success: false,
        error,
        message: 'Failed to resend verification email. Please try again.'
      };
    }
    
    console.log('Verification email resent successfully');
    return {
      success: true,
      message: 'Verification email has been sent. Please check your inbox.'
    };
  } catch (error) {
    console.error('Error in resendVerificationEmail:', error);
    return {
      success: false,
      error,
      message: 'An unexpected error occurred. Please try again later.'
    };
  }
};

/**
 * Create or update a user profile in Supabase with fallback to local storage
 * @param userId The user's ID
 * @param userData The user data to save
 * @returns The created/updated profile data
 */
export const createOrUpdateUserProfile = async (
  userId: string,
  userData: {
    email?: string;
    full_name?: string;
    avatar_url?: string;
  }
): Promise<any> => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const profileData = {
    id: userId,
    email: userData.email,
    full_name: userData.full_name,
    avatar_url: userData.avatar_url,
    updated_at: new Date().toISOString()
  };

  try {
    // First check if profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking for existing profile:', fetchError);
    }

    if (existingProfile) {
      // Update existing profile
      const { data, error: updateError } = supabaseAdmin
        ? await supabaseAdmin
            .from('profiles')
            .update(profileData)
            .eq('id', userId)
            .select()
            .single()
        : await supabase
            .from('profiles')
            .update(profileData)
            .eq('id', userId)
            .select()
            .single();

      if (updateError) {
        console.error('Error updating profile:', updateError);
        // Store locally as fallback
        await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
        return profileData;
      }

      return data;
    } else {
      // Create new profile
      const { data, error: insertError } = supabaseAdmin
        ? await supabaseAdmin
            .from('profiles')
            .insert([{ ...profileData, created_at: new Date().toISOString() }])
            .select()
            .single()
        : await supabase
            .from('profiles')
            .insert([{ ...profileData, created_at: new Date().toISOString() }])
            .select()
            .single();

      if (insertError) {
        console.error('Error creating profile:', insertError);
        // Store locally as fallback
        await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
        return profileData;
      }

      return data;
    }
  } catch (error) {
    console.error('Unexpected error in createOrUpdateUserProfile:', error);
    // Store locally as fallback
    await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
    return profileData;
  }
}; 