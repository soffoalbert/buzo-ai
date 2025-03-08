import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../api/supabaseClient';
import { isOnline } from '../offlineStorage';
import { generateUUID } from '../../utils/helpers';

// Cache for user ID to handle offline authentication
let cachedUserId: string | null = null;

/**
 * Get the user ID with offline support
 * This function will try multiple sources to get a valid user ID:
 * 1. If online, get from Supabase auth and cache it
 * 2. If offline, use the cached user ID
 * 3. If no cached ID, try to get from AsyncStorage
 * 4. If all else fails, generate a temporary ID
 */
export async function getUserId(): Promise<string> {
  try {
    // If we're online, get the current user and update cache
    const online = await isOnline();
    
    if (online) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        cachedUserId = user.id;
        return user.id;
      }
    }
    
    // If offline or couldn't get user online, use cached user ID
    if (cachedUserId) {
      return cachedUserId;
    }
    
    // If no cached user ID, try to get from AsyncStorage as fallback
    const userString = await AsyncStorage.getItem('supabase.auth.token');
    if (userString) {
      try {
        const userData = JSON.parse(userString);
        if (userData?.currentSession?.user?.id) {
          cachedUserId = userData.currentSession.user.id;
          return userData.currentSession.user.id;
        }
      } catch (parseError) {
        console.error('Error parsing stored user data:', parseError);
      }
    }
    
    // If all else fails, generate a temporary ID
    // This allows offline operation but will need reconciliation when online
    const tempId = `offline_${generateUUID()}`;
    console.warn(`Could not get authenticated user ID. Using temporary ID: ${tempId}`);
    return tempId;
  } catch (error) {
    console.error('Error in getUserId:', error);
    // Generate a temporary ID as last resort
    const tempId = `offline_${generateUUID()}`;
    console.warn(`Error getting user ID. Using temporary ID: ${tempId}`);
    return tempId;
  }
}

/**
 * Initialize the offline user ID cache
 * Call this at app startup to ensure we have a user ID ready for offline use
 */
export async function initializeUserIdCache(): Promise<void> {
  try {
    // Try to get and cache a valid user ID
    await getUserId();
    console.log('User ID cached successfully for offline use');
  } catch (error) {
    console.error('Error initializing user ID cache:', error);
  }
} 