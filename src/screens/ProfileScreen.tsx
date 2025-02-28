import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';

const ProfileScreen: React.FC = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  
  // Mock user data
  const userData = {
    name: 'Thabo Mokoena',
    email: 'thabo.mokoena@example.com',
    joinDate: 'June 2023',
  };
  
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
              await SecureStore.deleteItemAsync('userToken');
              // In a real app, navigation would be handled by the auth state change
              console.log('User logged out');
            } catch (error) {
              console.error('Error logging out:', error);
            }
          },
        },
      ]
    );
  };
  
  const handleOpenAIAdvisor = () => {
    // In a real app, this would navigate to the AI Advisor screen
    console.log('Opening AI Advisor');
  };
  
  const renderSettingItem = (
    icon: string, 
    title: string, 
    value?: boolean, 
    onValueChange?: (value: boolean) => void,
    onPress?: () => void,
  ) => (
    <TouchableOpacity 
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingIconContainer}>
        <Ionicons name={icon as any} size={22} color={colors.primary} />
      </View>
      <Text style={styles.settingTitle}>{title}</Text>
      {onValueChange && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: `${colors.primary}80` }}
          thumbColor={value ? colors.primary : colors.card}
        />
      )}
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{userData.name.charAt(0)}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userData.name}</Text>
            <Text style={styles.userEmail}>{userData.email}</Text>
            <Text style={styles.userJoinDate}>Member since {userData.joinDate}</Text>
          </View>
        </View>
        
        {/* AI Advisor Card */}
        <TouchableOpacity style={styles.aiAdvisorCard} onPress={handleOpenAIAdvisor}>
          <View style={styles.aiAdvisorContent}>
            <Ionicons name="chatbubble-ellipses" size={24} color={colors.white} />
            <View style={styles.aiAdvisorTextContainer}>
              <Text style={styles.aiAdvisorTitle}>Ask Buzo</Text>
              <Text style={styles.aiAdvisorDescription}>
                Get personalized financial advice from your AI assistant
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color={colors.white} />
        </TouchableOpacity>
        
        {/* Settings Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.sectionCard}>
            {renderSettingItem(
              'notifications-outline', 
              'Push Notifications', 
              notificationsEnabled, 
              setNotificationsEnabled
            )}
            {renderSettingItem(
              'moon-outline', 
              'Dark Mode', 
              darkModeEnabled, 
              setDarkModeEnabled
            )}
            {renderSettingItem(
              'finger-print-outline', 
              'Biometric Authentication', 
              biometricsEnabled, 
              setBiometricsEnabled
            )}
            {renderSettingItem(
              'lock-closed-outline', 
              'Change Password', 
              undefined, 
              undefined, 
              () => console.log('Change password')
            )}
          </View>
        </View>
        
        {/* Account Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionCard}>
            {renderSettingItem(
              'person-outline', 
              'Edit Profile', 
              undefined, 
              undefined, 
              () => console.log('Edit profile')
            )}
            {renderSettingItem(
              'cloud-download-outline', 
              'Export Data', 
              undefined, 
              undefined, 
              () => console.log('Export data')
            )}
            {renderSettingItem(
              'help-circle-outline', 
              'Help & Support', 
              undefined, 
              undefined, 
              () => console.log('Help & support')
            )}
            {renderSettingItem(
              'document-text-outline', 
              'Terms & Privacy Policy', 
              undefined, 
              undefined, 
              () => console.log('Terms & privacy')
            )}
          </View>
        </View>
        
        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        
        {/* App Version */}
        <Text style={styles.versionText}>Buzo v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: textStyles.h2.fontSize,
    fontWeight: textStyles.h2.fontWeight as any,
    lineHeight: textStyles.h2.lineHeight,
    color: textStyles.h2.color,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 600,
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
  aiAdvisorCard: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  aiAdvisorContent: {
    flexDirection: 'row',
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
    opacity: 0.8,
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
    ...shadows.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  settingTitle: {
    flex: 1,
    fontSize: textStyles.body1.fontSize,
    fontWeight: textStyles.body1.fontWeight as any,
    lineHeight: textStyles.body1.lineHeight,
    color: textStyles.body1.color,
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
    ...shadows.sm,
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