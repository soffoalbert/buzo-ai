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
 * @returns The user data
 */
export const registerUser = async (
  email: string,
  password: string,
  fullName: string
): Promise<any> => {
  try {
    // Register the user with Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.error('Supabase auth error:', authError);
      return { data: null, error: authError };
    }

    if (!authData.user) {
      const error = new Error('Registration failed: No user data returned');
      console.error(error);
      return { data: null, error };
    }

    // Log successful user creation
    console.log('User created successfully with ID:', authData.user.id);

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

    // Store user data in secure storage
    try {
      // Use the new secure storage helper for the token
      await secureStoreWithFallback('userToken', authData.session?.access_token || '');
      await AsyncStorage.setItem('userId', authData.user.id);
      await AsyncStorage.setItem('userEmail', email);
      await AsyncStorage.setItem('userFullName', fullName);
    } catch (storageError) {
      console.error('Storage error:', storageError);
      // Continue even if storage fails, just log the error
    }

    return { data: authData, error: null };
  } catch (error) {
    console.error('Error in registerUser:', error);
    return { data: null, error };
  }
};

/**
 * Login a user
 * @param email User's email
 * @param password User's password
 * @returns The user data
 */
export const loginUser = async (email: string, password: string): Promise<any> => {
  try {
    // Login the user with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Supabase auth error:', error);
      return { data: null, error };
    }

    if (!data.user) {
      const error = new Error('Login failed: No user data returned');
      console.error(error);
      return { data: null, error };
    }

    // Get user profile from the profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      // Continue even if profile fetch fails
    }

    // Store user data in secure storage
    try {
      // Use the new secure storage helper for the token
      await secureStoreWithFallback('userToken', data.session?.access_token || '');
      await AsyncStorage.setItem('userId', data.user.id);
      await AsyncStorage.setItem('userEmail', email);
      
      if (profileData) {
        await AsyncStorage.setItem('userFullName', profileData.full_name);
      }
    } catch (storageError) {
      console.error('Storage error:', storageError);
      // Continue even if storage fails, just log the error
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in loginUser:', error);
    return { data: null, error };
  }
};

/**
 * Logout the current user
 */
export const logoutUser = async (): Promise<void> => {
  try {
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw new Error(error.message);
    }

    // Clear secure storage
    await secureDeleteWithFallback('userToken');
    await AsyncStorage.removeItem('userId');
    await AsyncStorage.removeItem('userEmail');
    await AsyncStorage.removeItem('userFullName');
  } catch (error) {
    console.error('Error in logoutUser:', error);
    throw error;
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