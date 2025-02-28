import { Alert } from 'react-native';
import testOfflineMode from './testOfflineMode';
import testNotifications from './testNotifications';
import { getApiKey, setApiKey } from '../services/aiAdvisor';
import { isOnline } from '../services/offlineStorage';
import syncService from '../services/syncService';
import { checkSupabaseConnection, checkVaultAvailability } from '../api/supabaseClient';

/**
 * Comprehensive testing utility for Buzo AI
 * This helps test all major flows in the app for end-to-end testing
 */

/**
 * Test the offline functionality
 */
export const testOfflineFunctionality = async (): Promise<void> => {
  try {
    // Check current online status
    const online = await isOnline();
    console.log(`Current online status: ${online ? 'Online' : 'Offline'}`);
    
    // Create test data
    await testOfflineMode.addMultipleMockItems(3);
    console.log('Created test data for offline testing');
    
    // Simulate going offline
    Alert.alert(
      'Offline Testing',
      'Please turn on Airplane mode now to simulate offline mode, then press OK',
      [
        {
          text: 'OK',
          onPress: async () => {
            // Check if we're actually offline
            const nowOffline = !(await isOnline());
            
            if (nowOffline) {
              Alert.alert('Success', 'Device is now offline. Try using the app and creating data.');
              
              // Schedule another alert to remind to go back online
              setTimeout(() => {
                Alert.alert(
                  'Offline Testing',
                  'When ready to test sync, please turn off Airplane mode, then press OK',
                  [
                    {
                      text: 'OK',
                      onPress: async () => {
                        // Check if we're back online
                        const backOnline = await isOnline();
                        
                        if (backOnline) {
                          // Trigger sync
                          await syncService.performFullSync();
                          Alert.alert('Success', 'Device is back online and sync has been triggered.');
                        } else {
                          Alert.alert('Error', 'Device is still offline. Please turn off Airplane mode.');
                        }
                      }
                    }
                  ]
                );
              }, 10000); // 10 seconds
            } else {
              Alert.alert('Error', 'Device is still online. Please turn on Airplane mode to test offline functionality.');
            }
          }
        }
      ]
    );
  } catch (error) {
    console.error('Error testing offline functionality:', error);
    Alert.alert('Error', 'Failed to test offline functionality');
  }
};

/**
 * Test the notification system
 */
export const testNotificationSystem = async (): Promise<void> => {
  try {
    await testNotifications.sendAllTestNotifications();
    Alert.alert('Success', 'All test notifications have been sent. Check your device notifications.');
  } catch (error) {
    console.error('Error testing notifications:', error);
    Alert.alert('Error', 'Failed to test notifications');
  }
};

/**
 * Test the Supabase integration
 */
export const testSupabaseIntegration = async (): Promise<void> => {
  try {
    // Check Supabase connection
    const isConnected = await checkSupabaseConnection();
    console.log(`Supabase connection: ${isConnected ? 'Connected' : 'Disconnected'}`);
    
    // Check Vault availability
    const vaultAvailable = await checkVaultAvailability();
    console.log(`Vault availability: ${vaultAvailable ? 'Available' : 'Unavailable'}`);
    
    Alert.alert(
      'Supabase Integration Test',
      `Connection: ${isConnected ? '✅' : '❌'}\nVault: ${vaultAvailable ? '✅' : '❌'}`,
      [
        {
          text: 'OK',
          onPress: () => {
            if (!isConnected) {
              Alert.alert('Warning', 'Supabase connection failed. Check your internet connection and Supabase configuration.');
            } else if (!vaultAvailable) {
              Alert.alert('Warning', 'Vault is not available. API keys will be stored using the fallback method.');
            }
          }
        }
      ]
    );
  } catch (error) {
    console.error('Error testing Supabase integration:', error);
    Alert.alert('Error', 'Failed to test Supabase integration');
  }
};

/**
 * Test the OpenAI integration
 */
export const testOpenAIIntegration = async (): Promise<void> => {
  try {
    // Check if API key is set
    const apiKey = await getApiKey();
    
    if (!apiKey) {
      Alert.alert(
        'OpenAI Integration Test',
        'No API key found. Would you like to set a test API key?',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Set Test Key',
            onPress: async () => {
              // This is just a placeholder - it won't work as a real key
              // In a real test, you would use a valid test key
              await setApiKey('sk-test-key');
              Alert.alert('Success', 'Test API key set. Please test the AI Advisor functionality.');
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'OpenAI Integration Test',
        'API key is set. Please test the AI Advisor functionality to verify it works correctly.'
      );
    }
  } catch (error) {
    console.error('Error testing OpenAI integration:', error);
    Alert.alert('Error', 'Failed to test OpenAI integration');
  }
};

/**
 * Run all tests
 */
export const runAllTests = async (): Promise<void> => {
  Alert.alert(
    'Run All Tests',
    'This will run all tests in sequence. Continue?',
    [
      {
        text: 'Cancel',
        style: 'cancel'
      },
      {
        text: 'Continue',
        onPress: async () => {
          try {
            // Test Supabase first
            await testSupabaseIntegration();
            
            // Then test OpenAI
            await testOpenAIIntegration();
            
            // Then test notifications
            await testNotificationSystem();
            
            // Finally test offline functionality
            await testOfflineFunctionality();
            
            Alert.alert('Success', 'All tests have been initiated. Follow the prompts to complete testing.');
          } catch (error) {
            console.error('Error running all tests:', error);
            Alert.alert('Error', 'Failed to run all tests');
          }
        }
      }
    ]
  );
};

export default {
  testOfflineFunctionality,
  testNotificationSystem,
  testSupabaseIntegration,
  testOpenAIIntegration,
  runAllTests
}; 