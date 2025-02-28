import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Animated,
  Linking,
  Image,
  Vibration,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';

// Import services and utilities
import { logoutUser } from '../services/authService';
import { notifyAuthStateChanged } from '../utils/authStateManager';
import { getUserPreferences, updateUserPreferences } from '../services/userService';
import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import Button from '../components/Button';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Define the type for user preferences
type UserPreferences = {
  notificationsEnabled: boolean;
  darkModeEnabled: boolean;
  biometricsEnabled: boolean;
  budgetAlerts: boolean;
  savingsReminders: boolean;
  financialTips: boolean;
  dataUsage: 'low' | 'medium' | 'high';
  subscriptionTier: 'free' | 'premium';
  language: string;
  currency: string;
};

// Default preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  notificationsEnabled: true,
  darkModeEnabled: false,
  biometricsEnabled: false,
  budgetAlerts: true,
  savingsReminders: true,
  financialTips: true,
  dataUsage: 'medium',
  subscriptionTier: 'free',
  language: 'English',
  currency: 'ZAR',
};

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [error, setError] = useState<string | null>(null);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  
  // Simple haptic feedback
  const triggerHaptic = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Vibration.vibrate(10);
    }
  };
  
  // Handle back button press
  const handleBackPress = () => {
    triggerHaptic();
    navigation.goBack();
    return true;
  };
  
  // Add hardware back button handler for Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => {
        BackHandler.removeEventListener('hardwareBackPress', handleBackPress);
      };
    }
  }, []);
  
  // Load user preferences
  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // In a real app, this would fetch from your backend
      const userPrefs = await getUserPreferences();
      
      if (userPrefs) {
        setPreferences(userPrefs);
      }
      
      // Start animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
      
    } catch (err) {
      console.error('Failed to load preferences:', err);
      setError('Failed to load your preferences. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Save user preferences
  const savePreferences = async (newPreferences: UserPreferences) => {
    try {
      setIsSaving(true);
      setError(null);
      
      // In a real app, this would save to your backend
      await updateUserPreferences(newPreferences);
      
      // Show success feedback
      triggerHaptic();
      
    } catch (err) {
      console.error('Failed to save preferences:', err);
      setError('Failed to save your preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);
  
  // Toggle notification settings
  const handleToggleNotifications = async (value: boolean) => {
    triggerHaptic();
    
    // Request notification permissions if enabling
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'To receive notifications, you need to enable them in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => Linking.openSettings() 
            }
          ]
        );
        return;
      }
    }
    
    const newPreferences = { ...preferences, notificationsEnabled: value };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };
  
  // Toggle dark mode
  const handleToggleDarkMode = (value: boolean) => {
    triggerHaptic();
    const newPreferences = { ...preferences, darkModeEnabled: value };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
    // In a real app, you would apply the theme change here
  };
  
  // Toggle biometric authentication
  const handleToggleBiometrics = async (value: boolean) => {
    triggerHaptic();
    
    if (value) {
      // Check if device supports biometrics
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) {
        Alert.alert(
          'Incompatible Device',
          'Your device does not support biometric authentication.'
        );
        return;
      }
      
      // Check if biometrics are enrolled
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        Alert.alert(
          'Biometrics Not Set Up',
          'Please set up biometric authentication in your device settings first.'
        );
        return;
      }
      
      // Authenticate to confirm
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable biometric login',
      });
      
      if (!result.success) {
        return;
      }
    }
    
    const newPreferences = { ...preferences, biometricsEnabled: value };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };
  
  // Toggle budget alerts
  const handleToggleBudgetAlerts = (value: boolean) => {
    triggerHaptic();
    const newPreferences = { ...preferences, budgetAlerts: value };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };
  
  // Toggle savings reminders
  const handleToggleSavingsReminders = (value: boolean) => {
    triggerHaptic();
    const newPreferences = { ...preferences, savingsReminders: value };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };
  
  // Toggle financial tips
  const handleToggleFinancialTips = (value: boolean) => {
    triggerHaptic();
    const newPreferences = { ...preferences, financialTips: value };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };
  
  // Handle data usage change
  const handleDataUsageChange = (value: 'low' | 'medium' | 'high') => {
    triggerHaptic();
    const newPreferences = { ...preferences, dataUsage: value };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };
  
  // Handle subscription upgrade
  const handleUpgradeSubscription = () => {
    triggerHaptic();
    Alert.alert(
      'Upgrade to Premium',
      'Enjoy advanced features like personalized financial coaching, detailed spending analysis, priority customer support, and an ad-free experience.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Upgrade for R49.99/month', 
          onPress: () => {
            // In a real app, this would initiate the payment process
            Alert.alert('Coming Soon', 'This feature will be available in the next update.');
          } 
        }
      ]
    );
  };
  
  // Handle language change
  const handleLanguageChange = () => {
    triggerHaptic();
    Alert.alert(
      'Select Language',
      'Choose your preferred language',
      [
        { text: 'English', onPress: () => {
          const newPreferences = { ...preferences, language: 'English' };
          setPreferences(newPreferences);
          savePreferences(newPreferences);
        }},
        { text: 'Zulu', onPress: () => {
          const newPreferences = { ...preferences, language: 'Zulu' };
          setPreferences(newPreferences);
          savePreferences(newPreferences);
        }},
        { text: 'Xhosa', onPress: () => {
          const newPreferences = { ...preferences, language: 'Xhosa' };
          setPreferences(newPreferences);
          savePreferences(newPreferences);
        }},
        { text: 'Afrikaans', onPress: () => {
          const newPreferences = { ...preferences, language: 'Afrikaans' };
          setPreferences(newPreferences);
          savePreferences(newPreferences);
        }},
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };
  
  // Handle currency change
  const handleCurrencyChange = () => {
    triggerHaptic();
    Alert.alert(
      'Select Currency',
      'Choose your preferred currency',
      [
        { text: 'South African Rand (ZAR)', onPress: () => {
          const newPreferences = { ...preferences, currency: 'ZAR' };
          setPreferences(newPreferences);
          savePreferences(newPreferences);
        }},
        { text: 'US Dollar (USD)', onPress: () => {
          const newPreferences = { ...preferences, currency: 'USD' };
          setPreferences(newPreferences);
          savePreferences(newPreferences);
        }},
        { text: 'Euro (EUR)', onPress: () => {
          const newPreferences = { ...preferences, currency: 'EUR' };
          setPreferences(newPreferences);
          savePreferences(newPreferences);
        }},
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };
  
  // Handle password change
  const handleChangePassword = () => {
    triggerHaptic();
    Alert.alert(
      'Change Password',
      'You will receive an email with instructions to reset your password.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send Email', 
          onPress: () => {
            // In a real app, this would send a password reset email
            Alert.alert('Email Sent', 'Check your inbox for password reset instructions.');
          } 
        }
      ]
    );
  };
  
  // Handle help center
  const handleHelpCenter = () => {
    triggerHaptic();
    Linking.openURL('https://buzo.ai/help');
  };
  
  // Handle contact support
  const handleContactSupport = () => {
    triggerHaptic();
    Linking.openURL('mailto:support@buzo.ai');
  };
  
  // Handle privacy policy
  const handlePrivacyPolicy = () => {
    triggerHaptic();
    Linking.openURL('https://buzo.ai/privacy');
  };
  
  // Handle terms of service
  const handleTermsOfService = () => {
    triggerHaptic();
    Linking.openURL('https://buzo.ai/terms');
  };
  
  // Handle delete account
  const handleDeleteAccount = () => {
    triggerHaptic();
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Account', 
          style: 'destructive',
          onPress: () => {
            // In a real app, this would delete the user's account
            Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
            // Then log out
            logoutUser();
            notifyAuthStateChanged();
          } 
        }
      ]
    );
  };
  
  // Render a setting item with a switch
  const renderSwitchItem = (
    icon: string, 
    title: string, 
    value: boolean, 
    onValueChange: (value: boolean) => void,
    description?: string,
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingIconContainer}>
        <Ionicons name={icon as any} size={24} color={colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primaryLight }}
        thumbColor={value ? colors.primary : '#f4f3f4'}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
  
  // Render a setting item with a button
  const renderButtonItem = (
    icon: string, 
    title: string, 
    onPress: () => void,
    description?: string,
    buttonColor?: string,
  ) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.settingIconContainer}>
        <Ionicons name={icon as any} size={24} color={buttonColor || colors.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, buttonColor ? { color: buttonColor } : null]}>{title}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
  
  // Render a radio option for data usage
  const renderDataUsageOption = (
    label: string, 
    value: 'low' | 'medium' | 'high', 
    description: string
  ) => (
    <TouchableOpacity 
      style={styles.dataUsageOption} 
      onPress={() => handleDataUsageChange(value)}
      activeOpacity={0.7}
    >
      <View style={styles.radioContainer}>
        <View style={styles.radioOuter}>
          {preferences.dataUsage === value && <View style={styles.radioInner} />}
        </View>
      </View>
      <View style={styles.dataUsageContent}>
        <Text style={styles.dataUsageLabel}>{label}</Text>
        <Text style={styles.dataUsageDescription}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
  
  // Render the subscription card
  const renderSubscriptionCard = () => (
    <View style={styles.subscriptionCard}>
      <View style={styles.subscriptionHeader}>
        <Text style={styles.subscriptionTitle}>
          {preferences.subscriptionTier === 'free' ? 'Free Plan' : 'Premium Plan'}
        </Text>
        {preferences.subscriptionTier === 'premium' && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>PREMIUM</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.subscriptionDescription}>
        {preferences.subscriptionTier === 'free' 
          ? 'Access to essential budgeting, expense tracking, and educational resources.'
          : 'Enjoy advanced features like personalized financial coaching, detailed spending analysis, priority customer support, and an ad-free experience.'}
      </Text>
      
      {preferences.subscriptionTier === 'free' && (
        <Button
          title="Upgrade to Premium"
          onPress={handleUpgradeSubscription}
          variant="primary"
          size="medium"
          fullWidth
          style={styles.upgradeButton}
        />
      )}
    </View>
  );
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>
      
      {/* Error message if any */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {/* Settings content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.animatedContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }
          ]}
        >
          {/* Account Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            {renderButtonItem(
              'person-outline',
              'Edit Profile',
              () => navigation.navigate('EditProfile'),
              'Update your personal information'
            )}
            {renderButtonItem(
              'key-outline',
              'Change Password',
              handleChangePassword,
              'Update your account password'
            )}
            {renderSwitchItem(
              'finger-print-outline',
              'Biometric Authentication',
              preferences.biometricsEnabled,
              handleToggleBiometrics,
              'Use fingerprint or face ID to log in'
            )}
          </View>
          
          {/* Subscription Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subscription</Text>
            {renderSubscriptionCard()}
          </View>
          
          {/* Notifications Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            {renderSwitchItem(
              'notifications-outline',
              'Enable Notifications',
              preferences.notificationsEnabled,
              handleToggleNotifications,
              'Receive important updates and alerts'
            )}
            
            {preferences.notificationsEnabled && (
              <>
                {renderSwitchItem(
                  'wallet-outline',
                  'Budget Alerts',
                  preferences.budgetAlerts,
                  handleToggleBudgetAlerts,
                  'Get notified when approaching budget limits'
                )}
                {renderSwitchItem(
                  'trending-up-outline',
                  'Savings Reminders',
                  preferences.savingsReminders,
                  handleToggleSavingsReminders,
                  'Receive reminders about your savings goals'
                )}
                {renderSwitchItem(
                  'bulb-outline',
                  'Financial Tips',
                  preferences.financialTips,
                  handleToggleFinancialTips,
                  'Get personalized financial advice'
                )}
              </>
            )}
          </View>
          
          {/* Appearance Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appearance</Text>
            {renderSwitchItem(
              'moon-outline',
              'Dark Mode',
              preferences.darkModeEnabled,
              handleToggleDarkMode,
              'Switch between light and dark themes'
            )}
            {renderButtonItem(
              'language-outline',
              'Language',
              handleLanguageChange,
              `Current: ${preferences.language}`
            )}
            {renderButtonItem(
              'cash-outline',
              'Currency',
              handleCurrencyChange,
              `Current: ${preferences.currency}`
            )}
          </View>
          
          {/* Data Usage Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Usage</Text>
            <View style={styles.dataUsageContainer}>
              {renderDataUsageOption(
                'Low',
                'low',
                'Minimal data usage, basic features only'
              )}
              {renderDataUsageOption(
                'Medium',
                'medium',
                'Balanced data usage with most features'
              )}
              {renderDataUsageOption(
                'High',
                'high',
                'Full experience with all features'
              )}
            </View>
          </View>
          
          {/* Support Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            {renderButtonItem(
              'help-circle-outline',
              'Help Center',
              handleHelpCenter,
              'Find answers to common questions'
            )}
            {renderButtonItem(
              'mail-outline',
              'Contact Support',
              handleContactSupport,
              'Get help from our support team'
            )}
          </View>
          
          {/* Legal Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Legal</Text>
            {renderButtonItem(
              'shield-outline',
              'Privacy Policy',
              handlePrivacyPolicy
            )}
            {renderButtonItem(
              'document-text-outline',
              'Terms of Service',
              handleTermsOfService
            )}
          </View>
          
          {/* Danger Zone */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>
            {renderButtonItem(
              'trash-outline',
              'Delete Account',
              handleDeleteAccount,
              'Permanently delete your account and all data',
              colors.error
            )}
          </View>
          
          {/* App Info */}
          <View style={styles.appInfo}>
            <Image 
              source={require('./assets/logo.png')} 
              style={styles.appLogo}
              resizeMode="contain"
            />
            <Text style={styles.appVersion}>Buzo AI v1.0.0</Text>
            <Text style={styles.appCopyright}>© 2023 Buzo AI. All rights reserved.</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...textStyles.body1,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...textStyles.h2,
  },
  headerRight: {
    width: 24, // To balance the header
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
  },
  errorText: {
    color: colors.error,
    ...textStyles.body2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  animatedContainer: {
    flex: 1,
  },
  section: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  sectionTitle: {
    ...textStyles.subtitle1,
    marginBottom: spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    ...textStyles.body1,
  },
  settingDescription: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
  subscriptionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  subscriptionTitle: {
    ...textStyles.h3,
  },
  premiumBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  premiumBadgeText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
  },
  subscriptionDescription: {
    ...textStyles.body2,
    marginBottom: spacing.lg,
  },
  upgradeButton: {
    marginTop: spacing.md,
  },
  dataUsageContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  dataUsageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dataUsageOption_last: {
    borderBottomWidth: 0,
  },
  radioContainer: {
    marginRight: spacing.md,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  dataUsageContent: {
    flex: 1,
  },
  dataUsageLabel: {
    ...textStyles.body1,
  },
  dataUsageDescription: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: spacing.xxxl,
    marginBottom: spacing.xl,
  },
  appLogo: {
    width: 60,
    height: 60,
    marginBottom: spacing.md,
  },
  appVersion: {
    ...textStyles.body2,
    color: colors.textSecondary,
  },
  appCopyright: {
    ...textStyles.caption,
    marginTop: spacing.xs,
  },
});

export default SettingsScreen; 