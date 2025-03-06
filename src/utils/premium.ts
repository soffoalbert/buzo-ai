import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Check if the user has premium status
 * @returns Promise<boolean> True if the user has premium status
 */
export const isUserPremium = async (): Promise<boolean> => {
  try {
    const premiumStatus = await AsyncStorage.getItem('user_premium_status');
    return premiumStatus === 'true';
  } catch (error) {
    console.error('Error checking premium status:', error);
    return false;
  }
};

/**
 * Set the user's premium status
 * @param isPremium Whether the user has premium status
 */
export const setUserPremiumStatus = async (isPremium: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem('user_premium_status', isPremium ? 'true' : 'false');
  } catch (error) {
    console.error('Error setting premium status:', error);
  }
};

/**
 * Get the expiry date of the user's premium subscription
 * @returns Promise<string | null> The expiry date or null if not found
 */
export const getPremiumExpiryDate = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('premium_expiry_date');
  } catch (error) {
    console.error('Error getting premium expiry date:', error);
    return null;
  }
}; 