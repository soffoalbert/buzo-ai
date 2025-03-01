import * as FileSystem from 'expo-file-system';
import { supabase } from '../api/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { generateUUID } from '../utils/uuidPolyfill';
import { getUserId } from './authService';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the BankStatement type
export interface BankStatement {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string | null;
  upload_date: string;
  status: 'pending' | 'processing' | 'processed' | 'error';
  insights?: string;
}

// Local storage keys
const LOCAL_BANK_STATEMENTS_KEY = 'local_bank_statements';

/**
 * Upload a bank statement to Supabase storage
 * @param fileUri The local URI of the file to upload
 * @param fileName The name of the file
 * @returns The uploaded bank statement object
 */
export const uploadBankStatement = async (fileUri: string, fileName: string): Promise<BankStatement> => {
  // Return a mock bank statement with a "coming soon" message
  const mockStatement: BankStatement = {
    id: 'coming-soon',
    user_id: 'user',
    file_name: fileName,
    file_path: null,
    upload_date: new Date().toISOString(),
    status: 'pending',
    insights: 'Bank statement upload and processing is coming soon!'
  };
  
  console.log('Bank statement upload is coming soon!', { fileUri, fileName });
  
  return mockStatement;
};

/**
 * Check if Supabase storage is available and the required bucket exists
 * @returns Promise<boolean> True if Supabase storage is available
 */
const checkSupabaseStorageAvailability = async (): Promise<boolean> => {
  try {
    // Try to list buckets to see if we have access
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.warn('Unable to access Supabase storage:', error.message);
      return false;
    }
    
    // Check if the user-documents bucket exists
    const bucketExists = buckets?.some(bucket => bucket.name === 'user-documents');
    if (!bucketExists) {
      console.warn('The user-documents bucket does not exist in Supabase storage');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking Supabase storage availability:', error);
    return false;
  }
};

/**
 * Save a bank statement locally when Supabase storage is not available
 * @param userId The user ID
 * @param fileName The name of the file
 * @param fileUri The local URI of the file
 * @param fileContent The base64 content of the file
 * @returns A locally saved bank statement object
 */
const saveStatementLocally = async (
  userId: string, 
  fileName: string, 
  fileUri: string,
  fileContent: string
): Promise<BankStatement> => {
  try {
    console.log('Saving bank statement locally as fallback');
    
    // Generate a unique ID for the statement
    const statementId = generateUUID();
    
    // Create a local file path in the app's documents directory
    const localFilePath = `${FileSystem.documentDirectory}bank-statements/${userId}_${statementId}_${fileName}`;
    
    // Ensure the directory exists
    const dirPath = `${FileSystem.documentDirectory}bank-statements`;
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }
    
    // Write the file to local storage
    await FileSystem.writeAsStringAsync(localFilePath, fileContent, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Create a bank statement object
    const newStatement: BankStatement = {
      id: statementId,
      user_id: userId,
      file_name: fileName,
      file_path: localFilePath,
      upload_date: new Date().toISOString(),
      status: 'pending',
    };
    
    // Get existing local statements
    const existingStatementsJson = await AsyncStorage.getItem(LOCAL_BANK_STATEMENTS_KEY);
    const existingStatements: BankStatement[] = existingStatementsJson 
      ? JSON.parse(existingStatementsJson) 
      : [];
    
    // Add the new statement
    existingStatements.push(newStatement);
    
    // Save the updated list
    await AsyncStorage.setItem(LOCAL_BANK_STATEMENTS_KEY, JSON.stringify(existingStatements));
    
    console.log('Bank statement saved locally successfully');
    return newStatement;
  } catch (error) {
    console.error('Error saving bank statement locally:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to save bank statement locally: ${errorMessage}`);
  }
};

/**
 * Get all bank statements for the current user
 * @returns Array of bank statements
 */
export const getUserBankStatements = async (): Promise<BankStatement[]> => {
  // Return an empty array since the feature is coming soon
  return [];
};

/**
 * Delete a bank statement
 * @param statementId The ID of the bank statement to delete
 */
export const deleteBankStatement = async (statementId: string): Promise<void> => {
  console.log('Bank statement deletion is coming soon!', { statementId });
  return;
};

/**
 * Get a single bank statement by ID
 * @param statementId The ID of the bank statement to retrieve
 * @returns The bank statement object
 */
export const getBankStatementById = async (statementId: string): Promise<BankStatement> => {
  // Return a mock bank statement with a "coming soon" message
  const mockStatement: BankStatement = {
    id: statementId,
    user_id: 'user',
    file_name: 'statement.pdf',
    file_path: null,
    upload_date: new Date().toISOString(),
    status: 'pending',
    insights: 'Bank statement upload and processing is coming soon!'
  };
  
  return mockStatement;
};

/**
 * Get the download URL for a bank statement
 * @param filePath The path of the file in storage
 * @returns The download URL
 */
export const getBankStatementDownloadUrl = async (filePath: string): Promise<string> => {
  try {
    if (!filePath) {
      throw new Error('No file path provided');
    }
    
    // Check if this is a local file path
    if (filePath.startsWith(FileSystem.documentDirectory || '')) {
      // For local files, we can just return the URI directly
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error('Local file does not exist');
      }
      return filePath;
    }
    
    // For Supabase files, create a signed URL
    try {
      const { data, error } = await supabase.storage
        .from('user-documents')
        .createSignedUrl(filePath, 60); // URL valid for 60 seconds

      if (error) {
        throw new Error(`Error creating signed URL: ${error.message}`);
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error creating Supabase signed URL:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in getBankStatementDownloadUrl:', error);
    throw error;
  }
}; 