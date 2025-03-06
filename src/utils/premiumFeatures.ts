import { hasPremiumAccess } from '../services/subscriptionService';
import { Alert } from 'react-native';
import Constants from 'expo-constants';

// Check if we're running in Expo or development mode
const IS_EXPO = Constants.expoConfig !== undefined;
const IS_DEVELOPMENT = Constants.expoConfig?.extra?.env === 'development' || 
                       Constants.expoConfig?.extra?.env === 'local' || 
                       __DEV__;

/**
 * Premium feature types
 */
export enum PremiumFeatureType {
  PERSONALIZED_COACHING = 'personalized_coaching',
  DETAILED_ANALYTICS = 'detailed_analytics',
  PRIORITY_SUPPORT = 'priority_support',
  AD_FREE = 'ad_free',
  ADVANCED_BUDGETING = 'advanced_budgeting',
  UNLIMITED_SAVINGS_GOALS = 'unlimited_savings_goals'
}

/**
 * Check if a feature is premium
 * @param featureType The type of feature to check
 * @returns True if the feature is premium, false otherwise
 */
export const isPremiumFeature = (featureType: PremiumFeatureType): boolean => {
  switch (featureType) {
    case PremiumFeatureType.PERSONALIZED_COACHING:
    case PremiumFeatureType.DETAILED_ANALYTICS:
    case PremiumFeatureType.PRIORITY_SUPPORT:
    case PremiumFeatureType.AD_FREE:
    case PremiumFeatureType.ADVANCED_BUDGETING:
    case PremiumFeatureType.UNLIMITED_SAVINGS_GOALS:
      return true;
    default:
      return false;
  }
};

/**
 * Get the premium feature name
 * @param featureType The type of feature
 * @returns The feature name
 */
export const getPremiumFeatureName = (featureType: PremiumFeatureType): string => {
  switch (featureType) {
    case PremiumFeatureType.PERSONALIZED_COACHING:
      return 'Personalized Financial Coaching';
    case PremiumFeatureType.DETAILED_ANALYTICS:
      return 'Detailed Spending Analysis';
    case PremiumFeatureType.PRIORITY_SUPPORT:
      return 'Priority Customer Support';
    case PremiumFeatureType.AD_FREE:
      return 'Ad-Free Experience';
    case PremiumFeatureType.ADVANCED_BUDGETING:
      return 'Advanced Budget Tools';
    case PremiumFeatureType.UNLIMITED_SAVINGS_GOALS:
      return 'Unlimited Savings Goals';
    default:
      return 'Premium Feature';
  }
};

/**
 * Check if the user has access to a premium feature
 * @param featureType The type of feature to check
 * @returns A promise that resolves to true if the user has access, false otherwise
 */
export const hasAccessToFeature = async (featureType: PremiumFeatureType): Promise<boolean> => {
  // When running in Expo, automatically grant access to all features
  if (IS_EXPO || IS_DEVELOPMENT) {
    console.log(`🔓 Expo/Dev mode: Access granted to premium feature "${getPremiumFeatureName(featureType)}"`);
    return true;
  }
  
  // If it's not a premium feature, everyone has access
  if (!isPremiumFeature(featureType)) {
    return true;
  }
  
  // Check if the user has premium access
  return await hasPremiumAccess();
};

/**
 * Show a premium feature upsell alert
 * @param featureType The type of feature
 * @param navigation The navigation object to navigate to the subscription screen
 */
export const showPremiumFeatureUpsell = (
  featureType: PremiumFeatureType,
  navigation: any
): void => {
  // Don't show upsell alerts in Expo/development mode
  if (IS_EXPO || IS_DEVELOPMENT) {
    console.log('🔓 Expo/Dev mode: Premium upsell suppressed, granting access');
    return;
  }
  
  const featureName = getPremiumFeatureName(featureType);
  
  Alert.alert(
    'Premium Feature',
    `${featureName} is a premium feature. Upgrade to Buzo Premium to access this and other advanced features.`,
    [
      { text: 'Not Now', style: 'cancel' },
      { 
        text: 'View Premium Plans', 
        onPress: () => {
          navigation.navigate('SubscriptionScreen');
        }
      }
    ]
  );
};

/**
 * Wrapper function to access a premium feature
 * @param featureType The type of feature
 * @param navigation The navigation object
 * @param onAccess Callback function to execute if the user has access
 */
export const accessPremiumFeature = async (
  featureType: PremiumFeatureType,
  navigation: any,
  onAccess: () => void
): Promise<void> => {
  // In Expo or development mode, always grant access to premium features
  if (IS_EXPO || IS_DEVELOPMENT) {
    console.log(`🔓 Expo/Dev mode: Access granted to premium feature "${getPremiumFeatureName(featureType)}"`);
    onAccess();
    return;
  }
  
  const hasAccess = await hasAccessToFeature(featureType);
  
  if (hasAccess) {
    onAccess();
  } else {
    showPremiumFeatureUpsell(featureType, navigation);
  }
}; 