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
  file_path: string;
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
  try {
    // Get the current user ID
    const userId = await getUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Generate a unique file path using UUID
    const fileExtension = fileName.split('.').pop();
    let uniqueId;
    
    try {
      // Try to use the uuid library first (with our polyfill)
      uniqueId = uuidv4();
      console.log('Successfully generated UUID using uuidv4');
    } catch (error) {
      console.log('UUID generation with uuidv4 failed, using fallback method', error);
      // Fall back to our custom UUID generator
      uniqueId = generateUUID();
      console.log('Successfully generated UUID using fallback method');
    }
    
    const filePath = `bank-statements/${userId}/${uniqueId}.${fileExtension}`;

    // Read the file as base64
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }

    // Read the file content
    const fileContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Check if we should try Supabase or go straight to local storage
    const shouldTrySupabase = await checkSupabaseStorageAvailability();
    
    if (shouldTrySupabase) {
      try {
        // Try to upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('user-documents')
          .upload(filePath, fileContent, {
            contentType: fileExtension === 'pdf' ? 'application/pdf' : `image/${fileExtension}`,
            upsert: false,
          });

        if (uploadError) {
          // If there's an error with Supabase storage, use local storage fallback
          console.warn(`Error uploading to Supabase: ${uploadError.message}. Using local storage fallback.`);
          return await saveStatementLocally(userId, fileName, fileUri, fileContent);
        }

        // Try to create a record in the bank_statements table
        const newStatement: Omit<BankStatement, 'id'> = {
          user_id: userId,
          file_name: fileName,
          file_path: filePath,
          upload_date: new Date().toISOString(),
          status: 'pending',
        };

        const { data, error } = await supabase
          .from('bank_statements')
          .insert([newStatement])
          .select()
          .single();

        if (error) {
          // If there was an error inserting the record, try to delete the uploaded file
          try {
            await supabase.storage.from('user-documents').remove([filePath]);
          } catch (removeError) {
            console.error('Error removing file after database error:', removeError);
          }
          
          // Use local storage fallback
          console.warn(`Error creating bank statement record: ${error.message}. Using local storage fallback.`);
          return await saveStatementLocally(userId, fileName, fileUri, fileContent);
        }

        return data as BankStatement;
      } catch (supabaseError) {
        // If there's any error with Supabase operations, use local storage fallback
        console.error('Supabase operation failed:', supabaseError);
        return await saveStatementLocally(userId, fileName, fileUri, fileContent);
      }
    } else {
      // Skip Supabase and go straight to local storage
      console.log('Skipping Supabase storage attempt due to known issues. Using local storage directly.');
      return await saveStatementLocally(userId, fileName, fileUri, fileContent);
    }
  } catch (error) {
    console.error('Error in uploadBankStatement:', error);
    throw error;
  }
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
  try {
    // Get the current user ID
    const userId = await getUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    let statements: BankStatement[] = [];
    let supabaseError = null;

    // Try to get statements from Supabase
    try {
      // Query the bank_statements table
      const { data, error } = await supabase
        .from('bank_statements')
        .select('*')
        .eq('user_id', userId)
        .order('upload_date', { ascending: false });

      if (error) {
        console.warn(`Error fetching bank statements from Supabase: ${error.message}`);
        supabaseError = error;
      } else if (data) {
        statements = [...data as BankStatement[]];
      }
    } catch (error) {
      console.warn('Failed to fetch bank statements from Supabase:', error);
      supabaseError = error;
    }

    // Get locally stored statements
    try {
      const localStatementsJson = await AsyncStorage.getItem(LOCAL_BANK_STATEMENTS_KEY);
      if (localStatementsJson) {
        const allLocalStatements = JSON.parse(localStatementsJson) as BankStatement[];
        // Filter for current user's statements
        const userLocalStatements = allLocalStatements.filter(
          statement => statement.user_id === userId
        );
        
        // Add local statements to the list
        statements = [...statements, ...userLocalStatements];
      }
    } catch (error) {
      console.error('Error fetching local bank statements:', error);
      // If we couldn't get Supabase statements either, throw an error
      if (supabaseError) {
        throw new Error('Failed to fetch bank statements from both Supabase and local storage');
      }
    }

    // Sort statements by upload date (newest first)
    statements.sort((a, b) => 
      new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime()
    );

    return statements;
  } catch (error) {
    console.error('Error in getUserBankStatements:', error);
    throw error;
  }
};

/**
 * Delete a bank statement
 * @param statementId The ID of the bank statement to delete
 */
export const deleteBankStatement = async (statementId: string): Promise<void> => {
  try {
    // Get the current user ID
    const userId = await getUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    let isLocalStatement = false;
    let localFilePath = '';
    let supabaseError = null;

    // Check if this is a local statement first
    try {
      const localStatementsJson = await AsyncStorage.getItem(LOCAL_BANK_STATEMENTS_KEY);
      if (localStatementsJson) {
        const localStatements = JSON.parse(localStatementsJson) as BankStatement[];
        const statementIndex = localStatements.findIndex(
          s => s.id === statementId && s.user_id === userId
        );
        
        if (statementIndex >= 0) {
          isLocalStatement = true;
          localFilePath = localStatements[statementIndex].file_path;
          
          // Remove from local storage array
          localStatements.splice(statementIndex, 1);
          await AsyncStorage.setItem(LOCAL_BANK_STATEMENTS_KEY, JSON.stringify(localStatements));
          
          // Delete the local file
          try {
            const fileInfo = await FileSystem.getInfoAsync(localFilePath);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(localFilePath);
            }
          } catch (fileError) {
            console.error('Error deleting local file:', fileError);
            // Continue even if file deletion fails
          }
          
          console.log('Local bank statement deleted successfully');
          return; // Exit early as we've handled the local statement
        }
      }
    } catch (error) {
      console.error('Error checking local bank statements:', error);
      // Continue to try Supabase deletion
    }

    // If not a local statement, try Supabase
    try {
      // Get the file path from the bank_statements table
      const { data, error: fetchError } = await supabase
        .from('bank_statements')
        .select('file_path')
        .eq('id', statementId)
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        console.warn(`Error fetching bank statement from Supabase: ${fetchError.message}`);
        supabaseError = fetchError;
        throw new Error('Bank statement not found in Supabase');
      }

      if (!data) {
        throw new Error('Bank statement not found');
      }

      // Delete the file from storage
      const { error: storageError } = await supabase.storage
        .from('user-documents')
        .remove([data.file_path]);

      if (storageError) {
        console.error('Error deleting file from Supabase storage:', storageError);
        // Continue with deleting the record even if file deletion fails
      }

      // Delete the record from the bank_statements table
      const { error: deleteError } = await supabase
        .from('bank_statements')
        .delete()
        .eq('id', statementId)
        .eq('user_id', userId);

      if (deleteError) {
        throw new Error(`Error deleting bank statement record: ${deleteError.message}`);
      }
      
      console.log('Supabase bank statement deleted successfully');
    } catch (error) {
      // If this is not a local statement and we couldn't delete from Supabase
      if (!isLocalStatement) {
        console.error('Error deleting bank statement from Supabase:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error in deleteBankStatement:', error);
    throw error;
  }
};

/**
 * Get a single bank statement by ID
 * @param statementId The ID of the bank statement to retrieve
 * @returns The bank statement object
 */
export const getBankStatementById = async (statementId: string): Promise<BankStatement> => {
  try {
    // Get the current user ID
    const userId = await getUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    let statement: BankStatement | null = null;
    let supabaseError = null;

    // Try to get the statement from Supabase
    try {
      // Query the bank_statements table
      const { data, error } = await supabase
        .from('bank_statements')
        .select('*')
        .eq('id', statementId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.warn(`Error fetching bank statement from Supabase: ${error.message}`);
        supabaseError = error;
      } else if (data) {
        statement = data as BankStatement;
      }
    } catch (error) {
      console.warn('Failed to fetch bank statement from Supabase:', error);
      supabaseError = error;
    }

    // If not found in Supabase, check local storage
    if (!statement) {
      try {
        const localStatementsJson = await AsyncStorage.getItem(LOCAL_BANK_STATEMENTS_KEY);
        if (localStatementsJson) {
          const localStatements = JSON.parse(localStatementsJson) as BankStatement[];
          statement = localStatements.find(
            s => s.id === statementId && s.user_id === userId
          ) || null;
        }
      } catch (error) {
        console.error('Error fetching local bank statement:', error);
        // If we couldn't get the Supabase statement either, throw an error
        if (supabaseError) {
          throw new Error('Failed to fetch bank statement from both Supabase and local storage');
        }
      }
    }

    if (!statement) {
      throw new Error('Bank statement not found');
    }

    return statement;
  } catch (error) {
    console.error('Error in getBankStatementById:', error);
    throw error;
  }
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