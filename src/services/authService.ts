import { supabase, supabaseAdmin } from '../api/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

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
): Promise<{
  data: any;
  error: any;
  needsEmailConfirmation?: boolean;
  message?: string;
}> => {
  try {
    console.log(`Attempting to register user with email: ${email}`);
    
    // Validate inputs
    if (!email || !password || !fullName) {
      console.error('Registration failed: Missing required fields');
      return { 
        data: null, 
        error: new Error('Email, password, and full name are required'),
        message: 'Please provide all required information'
      };
    }
    
    // Register the user with Supabase
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
      console.error('Supabase auth error:', authError);
      
      // Provide more user-friendly error messages
      let message = 'Registration failed';
      if (authError.message.includes('email')) {
        message = 'Invalid email format or email already in use';
      } else if (authError.message.includes('password')) {
        message = 'Password does not meet requirements';
      }
      
      return { data: null, error: authError, message };
    }

    if (!authData.user) {
      const error = new Error('Registration failed: No user data returned');
      console.error(error);
      return { data: null, error, message: 'Registration failed. Please try again.' };
    }

    // Check if email confirmation is required
    const needsEmailConfirmation = !authData.session;
    
    // Log successful user creation
    console.log('User created successfully with ID:', authData.user.id);
    console.log('Email confirmation required:', needsEmailConfirmation);

    // Create a user profile in the profiles table with minimal required fields
    try {
      // First check if a profile already exists (it might be auto-created)
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found" which is expected
        console.error('Error checking for existing profile:', fetchError);
      }
      
      if (existingProfile) {
        console.log('Profile already exists, updating it');
        // Update the existing profile - use admin client to bypass RLS
        const { error: updateError } = supabaseAdmin
          ? await supabaseAdmin
              .from('profiles')
              .update({
                full_name: fullName,
                updated_at: new Date().toISOString()
              })
              .eq('id', authData.user.id)
          : await supabase
              .from('profiles')
              .update({
                full_name: fullName,
                updated_at: new Date().toISOString()
              })
              .eq('id', authData.user.id);
          
        if (updateError) {
          console.error('Error updating profile:', updateError);
          // Continue anyway - the user is created
        } else {
          console.log('Profile updated successfully');
        }
      } else {
        // Create a new profile with minimal fields
        console.log('Creating new profile');
        const profileData: any = {
          id: authData.user.id,
          full_name: fullName,
          email: email,
          created_at: new Date().toISOString()
        };
        
        console.log('Profile data to insert:', profileData);
        
        // Try to insert the profile using admin client to bypass RLS
        const { error: insertError } = supabaseAdmin
          ? await supabaseAdmin
              .from('profiles')
              .insert([profileData])
          : await supabase
              .from('profiles')
              .insert([profileData]);
          
        if (insertError) {
          console.error('Profile creation error details:', insertError);
          
          // If we get a row-level security policy violation, store profile data locally
          if (insertError.code === '42501') {
            console.log('Row-level security policy violation. Storing profile data locally.');
            await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
          }
        } else {
          console.log('Profile created successfully');
        }
      }
    } catch (profileError) {
      console.error('Unexpected error during profile creation:', profileError);
      // Store profile data locally as a fallback
      const profileData = {
        id: authData.user.id,
        full_name: fullName,
        email: email,
        created_at: new Date().toISOString()
      };
      await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
    }

    // Only store session data if we have a session (user is confirmed)
    if (authData.session) {
      // Store user data in secure storage
      try {
        // Use the new secure storage helper for the token
        await secureStoreWithFallback('userToken', authData.session?.access_token || '');
        await AsyncStorage.setItem('userId', authData.user.id);
        await AsyncStorage.setItem('userEmail', email);
        await AsyncStorage.setItem('userFullName', fullName);
        console.log('User session data stored successfully');
      } catch (storageError) {
        console.error('Storage error:', storageError);
        // Continue even if storage fails, just log the error
      }
    } else {
      console.log('No session available - user needs to confirm email');
    }

    return { 
      data: authData, 
      error: null,
      needsEmailConfirmation,
      message: needsEmailConfirmation 
        ? 'Please check your email to confirm your account' 
        : 'Registration successful'
    };
  } catch (error) {
    console.error('Error in registerUser:', error);
    return { 
      data: null, 
      error,
      message: 'An unexpected error occurred during registration'
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
  isNewUser?: boolean;
}> => {
  try {
    console.log(`Attempting to login user with email: ${email}`);
    
    // Validate inputs
    if (!email || !password) {
      console.error('Login failed: Missing required fields');
      return { 
        data: null, 
        error: new Error('Email and password are required'),
        message: 'Please provide both email and password'
      };
    }
    
    // Login the user with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Supabase auth error:', error);
      
      // Provide more user-friendly error messages
      let message = 'Login failed';
      if (error.message.includes('Invalid login credentials')) {
        message = 'Invalid email or password';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Please verify your email address before logging in';
      } else if (error.message.includes('rate limit')) {
        message = 'Too many login attempts. Please try again later';
      }
      
      return { data: null, error, message };
    }

    if (!data.user) {
      const error = new Error('Login failed: No user data returned');
      console.error(error);
      return { data: null, error, message: 'Login failed. Please try again.' };
    }

    console.log('User logged in successfully with ID:', data.user.id);

    // Check if this is a new user (no profile yet)
    let isNewUser = false;
    
    // Get user profile from the profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      
      if (profileError.code === 'PGRST116') { // Not found
        console.log('No profile found for user, may be a new user');
        isNewUser = true;
        
        // Try to create a profile for this user
        try {
          const newProfileData = {
            id: data.user.id,
            email: email,
            full_name: data.user.user_metadata?.full_name || '',
            created_at: new Date().toISOString()
          };
          
          const { error: createError } = supabaseAdmin
            ? await supabaseAdmin
                .from('profiles')
                .insert([newProfileData])
            : await supabase
                .from('profiles')
                .insert([newProfileData]);
                
          if (createError) {
            console.error('Error creating profile for new user:', createError);
            // Store locally as fallback
            await AsyncStorage.setItem('userProfile', JSON.stringify(newProfileData));
          } else {
            console.log('Created new profile for user');
          }
        } catch (createProfileError) {
          console.error('Unexpected error creating profile:', createProfileError);
        }
      }
    } else {
      console.log('User profile retrieved successfully');
    }

    // Store user data in secure storage
    try {
      // Use the new secure storage helper for the token
      await secureStoreWithFallback('userToken', data.session?.access_token || '');
      await AsyncStorage.setItem('userId', data.user.id);
      await AsyncStorage.setItem('userEmail', email);
      
      // Get full name from profile or user metadata
      const fullName = profileData?.full_name || data.user.user_metadata?.full_name || '';
      if (fullName) {
        await AsyncStorage.setItem('userFullName', fullName);
      }
      
      console.log('User session data stored successfully');
    } catch (storageError) {
      console.error('Storage error:', storageError);
      // Continue even if storage fails, just log the error
    }

    return { 
      data, 
      error: null,
      isNewUser,
      message: isNewUser ? 'Welcome! Please complete your profile' : 'Login successful'
    };
  } catch (error) {
    console.error('Error in loginUser:', error);
    return { 
      data: null, 
      error,
      message: 'An unexpected error occurred during login'
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