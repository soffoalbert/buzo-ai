import { createUserProfile, loadUserProfile } from '../services/userService';
import { generateUUID } from '../utils/helpers';

/**
 * Initialize a test user for development purposes
 */
export const initTestUser = async (): Promise<void> => {
  try {
    // Check if a user already exists
    const existingUser = await loadUserProfile();
    
    if (existingUser) {
      console.log('Test user already exists:', existingUser.name);
      return;
    }
    
    // Create a test user
    const testUser = await createUserProfile(
      'test@buzo.app',
      'Test User',
      {
        id: generateUUID(),
        achievements: [],
        friends: [],
      }
    );
    
    console.log('Test user created successfully:', testUser.name);
  } catch (error) {
    console.error('Error initializing test user:', error);
  }
};

export default initTestUser; 