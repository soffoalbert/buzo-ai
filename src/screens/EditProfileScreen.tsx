import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Image,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import * as ImagePicker from 'expo-image-picker';
import { loadUserProfile, updateUserProfile, createUserProfile } from '../services/userService';
import { User, DEFAULT_USER_PREFERENCES } from '../models/User';
import { generateUUID } from '../utils/helpers';

type EditProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation<EditProfileScreenNavigationProp>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Simple haptic feedback using Vibration API
  const triggerHaptic = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Vibration.vibrate(10);
    }
  };

  // Fetch user profile data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        
        // First try to get the user from Supabase session
        const { supabase } = await import('../api/supabaseClient');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionData?.session?.user) {
          const user = sessionData.session.user;
          console.log('Found authenticated user in Supabase session:', user.id);
          
          // Create a profile from the session data
          const profile: User = {
            id: user.id,
            name: user.user_metadata?.full_name || 'New User',
            email: user.email || 'user@example.com',
            joinDate: user.created_at || new Date().toISOString(),
            lastActive: new Date().toISOString(),
            preferences: DEFAULT_USER_PREFERENCES,
            // Add other fields from user metadata if available
            phoneNumber: user.phone || '',
            profilePicture: user.user_metadata?.avatar_url || null,
          };
          
          // Set user data from profile
          setUserData(profile);
          setName(profile.name || '');
          setEmail(profile.email || '');
          setPhoneNumber(profile.phoneNumber || '');
          setDateOfBirth(profile.dateOfBirth || '');
          setProfilePicture(profile.profilePicture || null);
          
          setIsLoading(false);
          return;
        }
        
        // If no session user, fall back to local storage
        console.log('No authenticated user in Supabase session, falling back to local storage');
        let profile = await loadUserProfile();
        
        // If no profile exists, create a default one
        if (!profile) {
          console.log('No user profile found, creating default profile');
          try {
            const email = 'user@buzo.app';
            const name = 'Buzo User';
            
            profile = await createUserProfile(email, name, {
              preferences: DEFAULT_USER_PREFERENCES,
            });
          } catch (createError) {
            console.error('Error creating default profile:', createError);
            // Create a local profile object if createUserProfile fails
            const now = new Date().toISOString();
            profile = {
              id: generateUUID(),
              name: 'Buzo User',
              email: 'user@buzo.app',
              joinDate: now,
              lastActive: now,
              preferences: DEFAULT_USER_PREFERENCES,
            };
          }
        }
        
        if (profile) {
          // Set user data from profile
          setUserData(profile);
          setName(profile.name || '');
          setEmail(profile.email || '');
          setPhoneNumber(profile.phoneNumber || '');
          setDateOfBirth(profile.dateOfBirth || '');
          setProfilePicture(profile.profilePicture || null);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        
        // Create a fallback profile if everything fails
        const now = new Date().toISOString();
        const fallbackProfile: User = {
          id: generateUUID(),
          name: 'Buzo User',
          email: 'user@buzo.app',
          joinDate: now,
          lastActive: now,
          preferences: DEFAULT_USER_PREFERENCES,
        };
        
        setUserData(fallbackProfile);
        setName(fallbackProfile.name);
        setEmail(fallbackProfile.email);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Check for changes in form data
  useEffect(() => {
    if (!userData) return;

    const hasUserDataChanged = 
      name !== userData.name ||
      email !== userData.email ||
      phoneNumber !== (userData.phoneNumber || '') ||
      dateOfBirth !== (userData.dateOfBirth || '') ||
      profilePicture !== (userData.profilePicture || null);

    setHasChanges(hasUserDataChanged);
  }, [name, email, phoneNumber, dateOfBirth, profilePicture, userData]);

  // Handle back button press
  const handleBackPress = () => {
    triggerHaptic();
    
    if (hasChanges) {
      Alert.alert(
        'Discard Changes',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // Handle image picker
  const handlePickImage = async () => {
    triggerHaptic();
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions to change your profile picture.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Could not select image');
    }
  };

  // Handle save profile
  const handleSaveProfile = async () => {
    if (!userData) return;
    
    triggerHaptic();
    
    // Basic validation
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    
    try {
      setIsSaving(true);
      
      // First update the Supabase user metadata
      try {
        const { supabase } = await import('../api/supabaseClient');
        
        // Update user metadata in Supabase
        const { data, error } = await supabase.auth.updateUser({
          email: email, // Note: This will trigger email verification if email is changed
          data: {
            full_name: name,
            // Add other metadata fields as needed
            phone: phoneNumber || undefined,
            date_of_birth: dateOfBirth || undefined,
            avatar_url: profilePicture || undefined,
          }
        });
        
        if (error) {
          console.error('Error updating Supabase user:', error);
          // Continue with local update even if Supabase update fails
        } else {
          console.log('Supabase user updated successfully:', data.user.id);
        }
      } catch (supabaseError) {
        console.error('Error updating Supabase user:', supabaseError);
        // Continue with local update even if Supabase update fails
      }
      
      // Update local user profile
      const updatedUser = await updateUserProfile({
        ...userData,
        name,
        email,
        phoneNumber: phoneNumber || undefined,
        dateOfBirth: dateOfBirth || undefined,
        profilePicture: profilePicture || undefined,
      });
      
      setIsSaving(false);
      Alert.alert(
        'Success',
        'Your profile has been updated successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      setIsSaving(false);
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      {/* Header */}
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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.headerRight} />
      </View>
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Picture */}
          <View style={styles.profilePictureContainer}>
            <View style={styles.avatarContainer}>
              {profilePicture ? (
                <Image 
                  source={{ uri: profilePicture }} 
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatarText}>{name.charAt(0)}</Text>
              )}
            </View>
            <TouchableOpacity 
              style={styles.changePhotoButton}
              onPress={handlePickImage}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel="Change profile picture"
              accessibilityRole="button"
            >
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>
          
          {/* Form Fields */}
          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
                accessible={true}
                accessibilityLabel="Full name input field"
                accessibilityHint="Enter your full name"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                accessible={true}
                accessibilityLabel="Email input field"
                accessibilityHint="Enter your email address"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Enter your phone number"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                accessible={true}
                accessibilityLabel="Phone number input field"
                accessibilityHint="Enter your phone number"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Date of Birth (Optional)</Text>
              <TextInput
                style={styles.input}
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                accessible={true}
                accessibilityLabel="Date of birth input field"
                accessibilityHint="Enter your date of birth in YYYY-MM-DD format"
              />
              <Text style={styles.inputHelp}>Format: YYYY-MM-DD</Text>
            </View>
          </View>
          
          {/* Save Button */}
          <TouchableOpacity 
            style={[
              styles.saveButton,
              (!hasChanges || isSaving) && styles.saveButtonDisabled
            ]}
            onPress={handleSaveProfile}
            disabled={!hasChanges || isSaving}
            activeOpacity={0.7}
            accessible={true}
            accessibilityLabel="Save profile changes"
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasChanges || isSaving }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '600',
    color: colors.white,
  },
  changePhotoButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '10',
  },
  changePhotoText: {
    fontSize: textStyles.button.fontSize,
    fontWeight: '600',
    color: colors.primary,
  },
  formContainer: {
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: textStyles.body1.fontSize,
    color: colors.text,
    backgroundColor: colors.white,
  },
  inputHelp: {
    fontSize: textStyles.caption.fontSize,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  saveButtonDisabled: {
    backgroundColor: colors.primary + '80',
  },
  saveButtonText: {
    color: colors.white,
    fontSize: textStyles.button.fontSize,
    fontWeight: textStyles.button.fontWeight as any,
  },
});

export default EditProfileScreen; 