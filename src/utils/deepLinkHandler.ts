import { Linking } from 'react-native';
import { verifyEmail, updatePassword } from '../services/authService';
import { notifyAuthStateChanged } from './authStateManager';

/**
 * Deep link handler for authentication-related links
 * This handles email verification, password reset, and other auth-related deep links
 */

/**
 * Initialize deep link handling
 * Call this function in your app's entry point
 */
const initDeepLinkHandling = () => {
  // Handle deep links when the app is already running
  // The addEventListener API changed in newer versions of React Native
  // This approach works with both older and newer versions
  try {
    // For newer versions of React Native
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Handle deep links that launched the app
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });
    
    // Return a cleanup function that can be called when the app is unmounted
    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  } catch (error) {
    // Fallback for older versions of React Native
    Linking.addListener('url', handleDeepLink);
    
    // Handle deep links that launched the app
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });
    
    // Return a cleanup function for older versions
    return () => {
      try {
        Linking.removeAllListeners('url');
      } catch (e) {
        console.error('Error removing link listeners:', e);
      }
    };
  }
};

/**
 * Handle a deep link URL
 * @param event The deep link event containing the URL
 */
const handleDeepLink = async (event: { url: string }) => {
  try {
    const { url } = event;
    console.log('Deep link received:', url);

    // Parse the URL
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    
    // Extract token from URL parameters
    const params = new URLSearchParams(parsedUrl.search);
    const token = params.get('token');
    
    // If there's no token, this might be a regular app launch URL
    // or a deep link that doesn't require a token
    if (!token) {
      // Handle non-token deep links here if needed
      // For example, navigating to specific screens based on the path
      if (path.includes('profile')) {
        console.log('Navigating to profile screen');
        // Navigation would be handled here in a real implementation
      } else if (path.includes('settings')) {
        console.log('Navigating to settings screen');
        // Navigation would be handled here in a real implementation
      } else {
        console.log('No specific action for this deep link path');
      }
      return;
    }

    // Handle different deep link paths that require tokens
    if (path.includes('verify-email')) {
      await handleEmailVerification(token);
    } else if (path.includes('reset-password')) {
      await handlePasswordReset(token);
    }
  } catch (error) {
    console.error('Error handling deep link:', error);
  }
};

/**
 * Handle email verification deep link
 * @param token The verification token
 */
const handleEmailVerification = async (token: string) => {
  try {
    const { success, message } = await verifyEmail(token);
    
    if (success) {
      console.log('Email verification successful');
      // Notify the app about auth state change
      notifyAuthStateChanged();
    } else {
      console.error('Email verification failed:', message);
    }
  } catch (error) {
    console.error('Error verifying email:', error);
  }
};

/**
 * Handle password reset deep link
 * @param token The password reset token
 */
const handlePasswordReset = async (token: string) => {
  // In a real app, you would navigate to a password reset screen
  // and use the token to update the password
  console.log('Password reset token received:', token);
  
  // For now, just log the token
  // In a real implementation, you would navigate to a screen where the user
  // can enter a new password, then call updatePassword with the token
};

// Export the functions as a default object
const deepLinkHandler = {
  initDeepLinkHandling,
};

export default deepLinkHandler; 