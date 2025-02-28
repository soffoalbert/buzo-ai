import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { logoutUser, getUserProfile } from '../services/authService';
import { notifyAuthStateChanged } from '../utils/authStateManager';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Mock user data as fallback
const MOCK_USER_DATA = {
  name: 'Thabo Mokoena',
  email: 'thabo.mokoena@example.com',
  joinDate: 'June 2023',
  avatarUrl: null,
};

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const isFocused = useIsFocused();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(MOCK_USER_DATA);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Use refs for animation values to prevent recreation on re-renders
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  
  // Simple haptic feedback using Vibration API
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
  
  // Fetch user profile data
  const fetchUserProfile = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);
      
      // Try to get user profile
      let profile;
      try {
        profile = await getUserProfile();
      } catch (err) {
        console.error('Error fetching profile:', err);
        // Fall back to mock data
        profile = null;
      }
      
      if (profile) {
        setUserData({
          name: profile.full_name || 'Buzo User',
          email: profile.email || '',
          joinDate: profile.created_at 
            ? new Date(profile.created_at).toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
              })
            : 'New Member',
          avatarUrl: profile.avatar_url,
        });
      } else {
        // Use mock data if profile fetch fails
        console.log('Using mock user data');
        setUserData(MOCK_USER_DATA);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      setError('Could not load profile data');
      // Fallback to mock data
      setUserData(MOCK_USER_DATA);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
      setIsInitialLoad(false);
    }
  }, []);
  
  // Start animations
  const startAnimations = useCallback(() => {
    // Reset animation values
    fadeAnim.setValue(0);
    translateY.setValue(20);
    
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateY]);
  
  // Initial load effect
  useEffect(() => {
    if (isInitialLoad) {
      fetchUserProfile(true);
    }
  }, [fetchUserProfile, isInitialLoad]);
  
  // Handle screen focus/unfocus
  useFocusEffect(
    useCallback(() => {
      console.log('Profile screen focused');
      
      // If not initial load, refresh data without showing loading screen
      if (!isInitialLoad) {
        fetchUserProfile(false);
      }
      
      // Start animations when screen comes into focus
      startAnimations();
      
      return () => {
        console.log('Profile screen unfocused');
        // No need to reset animations here as they'll be reset in startAnimations
      };
    }, [fetchUserProfile, isInitialLoad, startAnimations])
  );
  
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoggingOut(true);
              triggerHaptic();
              
              // Use the proper logout function from authService
              const { success, error, message } = await logoutUser();
              
              if (success) {
                console.log('User logged out successfully');
                
                // Notify the app about auth state change using the utility
                notifyAuthStateChanged();
                
                // No need to manually navigate - the auth state change will trigger
                // the AppNavigator to show the auth screens automatically
              } else {
                console.error('Error logging out:', error);
                Alert.alert('Logout Error', message || 'There was a problem logging out. Please try again.');
              }
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert('Logout Error', 'An unexpected error occurred. Please try again.');
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };
  
  const handleOpenAIAdvisor = () => {
    triggerHaptic();
    // Show a message that this feature is coming soon
    Alert.alert(
      'Coming Soon',
      'The AI Advisor feature will be available in the next update!',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handleNavigateToBankStatements = () => {
    triggerHaptic();
    try {
      navigation.navigate('BankStatements');
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Navigation Error', 'Could not open Bank Statements. This feature may not be available yet.');
    }
  };
  
  const handleToggleNotifications = (value: boolean) => {
    triggerHaptic();
    setNotificationsEnabled(value);
  };
  
  const handleToggleDarkMode = (value: boolean) => {
    triggerHaptic();
    setDarkModeEnabled(value);
  };
  
  const handleToggleBiometrics = (value: boolean) => {
    triggerHaptic();
    setBiometricsEnabled(value);
  };
  
  const handleChangePassword = () => {
    triggerHaptic();
    // Show a message that this feature is coming soon
    Alert.alert(
      'Coming Soon',
      'The Change Password feature will be available in the next update!',
      [{ text: 'OK', style: 'default' }]
    );
  };
  
  const handleHelpCenter = () => {
    triggerHaptic();
    // Show a message that this feature is coming soon
    Alert.alert(
      'Coming Soon',
      'The Help Center will be available in the next update!',
      [{ text: 'OK', style: 'default' }]
    );
  };
  
  const handleContactSupport = () => {
    triggerHaptic();
    Linking.openURL('mailto:support@buzo.app?subject=Support%20Request').catch(err => {
      console.error('Error opening mail client:', err);
      Alert.alert('Error', 'Could not open email client.');
    });
  };
  
  const handleRateApp = () => {
    triggerHaptic();
    // Open App Store or Play Store based on platform
    const storeUrl = Platform.OS === 'ios' 
      ? 'https://apps.apple.com/app/buzo-ai/id123456789'
      : 'https://play.google.com/store/apps/details?id=com.buzo.app';
    
    Linking.openURL(storeUrl).catch(err => {
      console.error('Error opening store:', err);
      Alert.alert('Error', 'Could not open app store.');
    });
  };
  
  const handleEditProfile = () => {
    triggerHaptic();
    // Show a message that this feature is coming soon
    Alert.alert(
      'Coming Soon',
      'The Edit Profile feature will be available in the next update!',
      [{ text: 'OK', style: 'default' }]
    );
  };
  
  const renderSettingItem = (
    icon: string, 
    title: string, 
    value?: boolean, 
    onValueChange?: (value: boolean) => void,
    onPress?: () => void,
    description?: string,
  ) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={title}
      accessibilityRole={onValueChange ? "switch" : "button"}
      accessibilityState={{ checked: value }}
      accessibilityHint={description || `Tap to ${onValueChange ? 'toggle' : 'open'} ${title}`}
    >
      <View style={styles.settingItemLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon as any} size={22} color={colors.primary} />
        </View>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingItemText}>{title}</Text>
          {description && (
            <Text style={styles.settingItemDescription}>{description}</Text>
          )}
        </View>
      </View>
      {onValueChange ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: `${colors.primary}80` }}
          thumbColor={value ? colors.primary : colors.textSecondary}
          ios_backgroundColor={colors.border}
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );
  
  // Show loading screen only on initial load
  if (isLoading && isInitialLoad) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }
  
  if (error && isInitialLoad) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => fetchUserProfile(true)}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  // Main content - always render this if not in initial loading state
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBackPress}
          activeOpacity={0.7}
          accessible={true}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          accessibilityHint="Navigate to the previous screen"
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerRight} />
      </View>
      
      {/* Show a loading indicator at the top during background refresh */}
      {isLoading && !isInitialLoad && (
        <View style={styles.refreshIndicator}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info Card */}
        <Animated.View 
          style={[
            styles.userCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }
          ]}
        >
          <View style={styles.userCardContent}>
            <View style={styles.avatarContainer}>
              {userData.avatarUrl ? (
                <Image 
                  source={{ uri: userData.avatarUrl }} 
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatarText}>{userData.name.charAt(0)}</Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userData.name}</Text>
              <Text style={styles.userEmail}>{userData.email}</Text>
              <Text style={styles.userJoinDate}>Member since {userData.joinDate}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.editProfileButton}
            onPress={handleEditProfile}
            activeOpacity={0.7}
            accessible={true}
            accessibilityLabel="Edit profile"
            accessibilityRole="button"
          >
            <Text style={styles.editProfileText}>Edit</Text>
          </TouchableOpacity>
        </Animated.View>
        
        {/* AI Advisor Card */}
        <Animated.View 
          style={[
            styles.aiAdvisorCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.aiAdvisorTouchable}
            onPress={handleOpenAIAdvisor}
            activeOpacity={0.9}
            accessible={true}
            accessibilityLabel="Ask Buzo AI assistant"
            accessibilityRole="button"
            accessibilityHint="Get personalized financial advice from your AI assistant"
          >
            <View style={styles.aiAdvisorContent}>
              <View style={styles.aiIconContainer}>
                <Ionicons name="chatbubble-ellipses" size={24} color={colors.white} />
              </View>
              <View style={styles.aiAdvisorTextContainer}>
                <Text style={styles.aiAdvisorTitle}>Ask Buzo</Text>
                <Text style={styles.aiAdvisorDescription}>
                  Get personalized financial advice from your AI assistant
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.white} />
          </TouchableOpacity>
        </Animated.View>
        
        {/* Financial Documents Section */}
        <Animated.View 
          style={[
            styles.sectionContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }
          ]}
        >
          <Text style={styles.sectionTitle}>Financial Documents</Text>
          <View style={styles.sectionCard}>
            {renderSettingItem(
              'document-text-outline', 
              'Bank Statements', 
              undefined, 
              undefined,
              handleNavigateToBankStatements,
              'View and manage your uploaded bank statements'
            )}
          </View>
        </Animated.View>
        
        {/* Settings Section */}
        <Animated.View 
          style={[
            styles.sectionContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }
          ]}
        >
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.sectionCard}>
            {renderSettingItem(
              'notifications-outline', 
              'Push Notifications', 
              notificationsEnabled, 
              handleToggleNotifications,
              undefined,
              'Receive alerts about your finances'
            )}
            {renderSettingItem(
              'moon-outline', 
              'Dark Mode', 
              darkModeEnabled, 
              handleToggleDarkMode,
              undefined,
              'Switch to dark theme'
            )}
            {renderSettingItem(
              'finger-print-outline', 
              'Biometric Authentication', 
              biometricsEnabled, 
              handleToggleBiometrics,
              undefined,
              'Use fingerprint or Face ID to login'
            )}
            {renderSettingItem(
              'lock-closed-outline', 
              'Change Password', 
              undefined, 
              undefined, 
              handleChangePassword,
              'Update your account password'
            )}
          </View>
        </Animated.View>
        
        {/* Support Section */}
        <Animated.View 
          style={[
            styles.sectionContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }
          ]}
        >
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.sectionCard}>
            {renderSettingItem(
              'help-circle-outline', 
              'Help Center', 
              undefined, 
              undefined, 
              handleHelpCenter,
              'Find answers to common questions'
            )}
            {renderSettingItem(
              'mail-outline', 
              'Contact Support', 
              undefined, 
              undefined, 
              handleContactSupport,
              'Get help from our support team'
            )}
            {renderSettingItem(
              'star-outline', 
              'Rate the App', 
              undefined, 
              undefined, 
              handleRateApp,
              'Share your feedback on the app store'
            )}
          </View>
        </Animated.View>
        
        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          disabled={isLoggingOut}
          activeOpacity={0.7}
          accessible={true}
          accessibilityLabel="Logout"
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoggingOut }}
          accessibilityHint="Log out of your account"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </Text>
        </TouchableOpacity>
        
        {/* App Version */}
        <Text style={styles.versionText}>Version 1.0.0</Text>
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
    marginTop: spacing.md,
    fontSize: textStyles.body2.fontSize,
    color: colors.textSecondary,
  },
  refreshIndicator: {
    height: 2,
    width: '100%',
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  errorText: {
    marginTop: spacing.md,
    fontSize: textStyles.body1.fontSize,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: textStyles.button.fontSize,
    fontWeight: textStyles.button.fontWeight as any,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: textStyles.h2.fontSize,
    fontWeight: textStyles.h2.fontWeight as any,
    lineHeight: textStyles.h2.lineHeight,
    color: textStyles.h2.color,
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    width: 40, // Same width as backButton for balanced layout
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  userCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    ...shadows.sm,
  },
  avatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.white,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    lineHeight: textStyles.h3.lineHeight,
    color: textStyles.h3.color,
  },
  userEmail: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: textStyles.body2.fontWeight as any,
    lineHeight: textStyles.body2.lineHeight,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  userJoinDate: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    lineHeight: textStyles.caption.lineHeight,
    color: colors.textSecondary,
  },
  editProfileButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '10',
  },
  editProfileText: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: '600',
    color: colors.primary,
  },
  aiAdvisorCard: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
    overflow: 'hidden',
  },
  aiAdvisorTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  aiAdvisorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiAdvisorTextContainer: {
    marginLeft: spacing.md,
  },
  aiAdvisorTitle: {
    fontSize: textStyles.h4.fontSize,
    fontWeight: textStyles.h4.fontWeight as any,
    lineHeight: textStyles.h4.lineHeight,
    color: colors.white,
  },
  aiAdvisorDescription: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: textStyles.body2.fontWeight as any,
    lineHeight: textStyles.body2.lineHeight,
    color: colors.white,
    opacity: 0.9,
  },
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: textStyles.subtitle1.fontSize,
    fontWeight: textStyles.subtitle1.fontWeight as any,
    lineHeight: textStyles.subtitle1.lineHeight,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.md,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingItemText: {
    fontSize: textStyles.body1.fontSize,
    fontWeight: textStyles.body1.fontWeight as any,
    lineHeight: textStyles.body1.lineHeight,
    color: textStyles.body1.color,
  },
  settingItemDescription: {
    fontSize: textStyles.caption.fontSize,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  logoutText: {
    fontSize: textStyles.subtitle1.fontSize,
    fontWeight: textStyles.subtitle1.fontWeight as any,
    lineHeight: textStyles.subtitle1.lineHeight,
    color: colors.error,
    marginLeft: spacing.sm,
  },
  versionText: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    lineHeight: textStyles.caption.lineHeight,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default ProfileScreen; 