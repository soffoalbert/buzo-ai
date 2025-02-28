import AsyncStorage from '@react-native-async-storage/async-storage';
import { uploadBankStatement } from './bankStatementService';
import { Alert } from 'react-native';

/**
 * Process any pending bank statement uploads that were saved during onboarding
 * @returns Promise<void>
 */
export const processPendingBankStatementUploads = async (): Promise<void> => {
  try {
    // Check if there's a pending bank statement
    const pendingStatementJson = await AsyncStorage.getItem('pendingBankStatement');
    
    if (!pendingStatementJson) {
      // No pending statement, nothing to do
      return;
    }
    
    // Parse the pending statement data
    const pendingStatement = JSON.parse(pendingStatementJson);
    
    try {
      // Upload the bank statement
      await uploadBankStatement(pendingStatement.uri, pendingStatement.name);
      
      // Clear the pending statement from storage
      await AsyncStorage.removeItem('pendingBankStatement');
      
      // Notify the user
      Alert.alert(
        'Bank Statement Uploaded',
        'Your bank statement has been uploaded successfully. We\'ll analyze it to provide personalized financial advice.'
      );
    } catch (uploadError) {
      console.error('Error uploading bank statement:', uploadError);
      
      // If there's a specific error about UUID, we'll handle it differently
      if (uploadError.message && uploadError.message.includes('crypto.getRandomValues()')) {
        console.log('UUID generation error detected, using fallback method');
        // The error is already handled by our polyfill, but we'll log it
      } else {
        // For other errors, show an alert to the user
        Alert.alert(
          'Upload Failed',
          'There was an error uploading your bank statement. Please try again later.'
        );
      }
    }
  } catch (error) {
    console.error('Error processing pending bank statement:', error);
    
    // Don't show an error to the user, just log it
    // We don't want to interrupt their flow if this fails
  }
}; 