import { DeviceEventEmitter } from 'react-native';
import { isAuthenticated } from '../services/authService';

/**
 * Auth state manager utility to handle authentication state changes consistently across the app
 */

/**
 * Notify the app that the authentication state has changed
 * This will trigger a re-check of the auth state in the AppNavigator
 */
export const notifyAuthStateChanged = () => {
  console.log('Notifying app of auth state change');
  DeviceEventEmitter.emit('AUTH_STATE_CHANGED');
};

/**
 * Check if the user is currently authenticated
 * @returns Promise<boolean> True if the user is authenticated, false otherwise
 */
export const checkAuthState = async (): Promise<boolean> => {
  try {
    return await isAuthenticated();
  } catch (error) {
    console.error('Error checking auth state:', error);
    return false;
  }
};

/**
 * Subscribe to auth state changes
 * @param callback Function to call when auth state changes
 * @returns Subscription object that should be removed when no longer needed
 */
export const subscribeToAuthStateChanges = (callback: () => void) => {
  return DeviceEventEmitter.addListener('AUTH_STATE_CHANGED', callback);
};

/**
 * Unsubscribe from auth state changes
 * @param subscription Subscription object returned from subscribeToAuthStateChanges
 */
export const unsubscribeFromAuthStateChanges = (subscription: any) => {
  if (subscription && typeof subscription.remove === 'function') {
    subscription.remove();
  }
}; 