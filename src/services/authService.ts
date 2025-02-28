import { supabase } from '../api/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

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
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error('Registration failed');
    }

    // Create a user profile in the profiles table
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      full_name: fullName,
      email,
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      throw new Error(profileError.message);
    }

    // Store user data in secure storage
    await SecureStore.setItemAsync('userToken', authData.session?.access_token || '');
    await AsyncStorage.setItem('userId', authData.user.id);
    await AsyncStorage.setItem('userEmail', email);
    await AsyncStorage.setItem('userFullName', fullName);

    return authData;
  } catch (error) {
    console.error('Error in registerUser:', error);
    throw error;
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
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Login failed');
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
    await SecureStore.setItemAsync('userToken', data.session?.access_token || '');
    await AsyncStorage.setItem('userId', data.user.id);
    await AsyncStorage.setItem('userEmail', email);
    
    if (profileData) {
      await AsyncStorage.setItem('userFullName', profileData.full_name);
    }

    return data;
  } catch (error) {
    console.error('Error in loginUser:', error);
    throw error;
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
    await SecureStore.deleteItemAsync('userToken');
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
    const token = await SecureStore.getItemAsync('userToken');
    return !!token;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
};

/**
 * Get the current user's profile
 * @returns The user profile data
 */
export const getUserProfile = async (): Promise<any> => {
  try {
    const userId = await getUserId();
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    throw error;
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
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Update local storage if full_name was updated
    if (profileData.full_name) {
      await AsyncStorage.setItem('userFullName', profileData.full_name);
    }

    return data;
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    throw error;
  }
}; 