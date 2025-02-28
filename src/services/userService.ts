import { User, UserPreferences, DEFAULT_USER_PREFERENCES } from '../models/User';
import { saveData, loadData, removeData } from './offlineStorage';
import { generateUUID } from '../utils/helpers';

// Storage keys
const USER_STORAGE_KEY = 'buzo_user';

/**
 * Save user profile to local storage
 * @param user User profile to save
 * @returns Promise resolving to the saved user
 */
export const saveUserProfile = async (user: User): Promise<User> => {
  try {
    await saveData(USER_STORAGE_KEY, user);
    return user;
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw new Error('Failed to save user profile');
  }
};

/**
 * Load user profile from local storage
 * @returns Promise resolving to the user profile or null if not found
 */
export const loadUserProfile = async (): Promise<User | null> => {
  try {
    const user = await loadData<User>(USER_STORAGE_KEY);
    return user;
  } catch (error) {
    console.error('Error loading user profile:', error);
    return null;
  }
};

/**
 * Create a new user profile
 * @param email User email
 * @param name User name
 * @param additionalData Additional user data
 * @returns Promise resolving to the created user
 */
export const createUserProfile = async (
  email: string,
  name: string,
  additionalData?: Partial<User>
): Promise<User> => {
  const now = new Date().toISOString();
  
  const newUser: User = {
    id: generateUUID(),
    email,
    name,
    joinDate: now,
    lastActive: now,
    preferences: DEFAULT_USER_PREFERENCES,
    ...additionalData
  };
  
  await saveUserProfile(newUser);
  return newUser;
};

/**
 * Update user profile
 * @param userData Partial user data to update
 * @returns Promise resolving to the updated user
 */
export const updateUserProfile = async (userData: Partial<User>): Promise<User> => {
  const currentUser = await loadUserProfile();
  
  if (!currentUser) {
    throw new Error('User profile not found');
  }
  
  const updatedUser: User = {
    ...currentUser,
    ...userData,
    lastActive: new Date().toISOString(),
  };
  
  await saveUserProfile(updatedUser);
  return updatedUser;
};

/**
 * Update user preferences
 * @param preferences Partial preferences to update
 * @returns Promise resolving to the updated user
 */
export const updateUserPreferences = async (
  preferences: Partial<UserPreferences>
): Promise<User> => {
  const currentUser = await loadUserProfile();
  
  if (!currentUser) {
    throw new Error('User profile not found');
  }
  
  const updatedUser: User = {
    ...currentUser,
    preferences: {
      ...currentUser.preferences,
      ...preferences,
    },
    lastActive: new Date().toISOString(),
  };
  
  await saveUserProfile(updatedUser);
  return updatedUser;
};

/**
 * Delete user profile
 * @returns Promise resolving to boolean indicating success
 */
export const deleteUserProfile = async (): Promise<boolean> => {
  try {
    await removeData(USER_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error deleting user profile:', error);
    return false;
  }
};

/**
 * Check if user is logged in
 * @returns Promise resolving to boolean indicating if user is logged in
 */
export const isUserLoggedIn = async (): Promise<boolean> => {
  const user = await loadUserProfile();
  return user !== null;
};

/**
 * Add an achievement to user profile
 * @param achievementId Achievement ID to add
 * @param isShared Whether the achievement is shared
 * @returns Promise resolving to the updated user
 */
export const addUserAchievement = async (
  achievement: Omit<User['achievements'][0], 'dateEarned' | 'isShared'>,
  isShared = false
): Promise<User> => {
  const currentUser = await loadUserProfile();
  
  if (!currentUser) {
    throw new Error('User profile not found');
  }
  
  const newAchievement = {
    ...achievement,
    dateEarned: new Date().toISOString(),
    isShared,
  };
  
  const updatedUser: User = {
    ...currentUser,
    achievements: [
      ...(currentUser.achievements || []),
      newAchievement,
    ],
    lastActive: new Date().toISOString(),
  };
  
  await saveUserProfile(updatedUser);
  return updatedUser;
}; 