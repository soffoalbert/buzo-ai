import * as FileSystem from 'expo-file-system';
import { supabase } from '../api/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { getUserId } from './authService';

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

    // Generate a unique file path
    const fileExtension = fileName.split('.').pop();
    const filePath = `bank-statements/${userId}/${uuidv4()}.${fileExtension}`;

    // Read the file as base64
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }

    // Read the file content
    const fileContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('user-documents')
      .upload(filePath, fileContent, {
        contentType: fileExtension === 'pdf' ? 'application/pdf' : `image/${fileExtension}`,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Error uploading file: ${uploadError.message}`);
    }

    // Create a record in the bank_statements table
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
      // If there was an error inserting the record, delete the uploaded file
      await supabase.storage.from('user-documents').remove([filePath]);
      throw new Error(`Error creating bank statement record: ${error.message}`);
    }

    return data as BankStatement;
  } catch (error) {
    console.error('Error in uploadBankStatement:', error);
    throw error;
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

    // Query the bank_statements table
    const { data, error } = await supabase
      .from('bank_statements')
      .select('*')
      .eq('user_id', userId)
      .order('upload_date', { ascending: false });

    if (error) {
      throw new Error(`Error fetching bank statements: ${error.message}`);
    }

    return data as BankStatement[];
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

    // Get the file path from the bank_statements table
    const { data, error: fetchError } = await supabase
      .from('bank_statements')
      .select('file_path')
      .eq('id', statementId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      throw new Error(`Error fetching bank statement: ${fetchError.message}`);
    }

    if (!data) {
      throw new Error('Bank statement not found');
    }

    // Delete the file from storage
    const { error: storageError } = await supabase.storage
      .from('user-documents')
      .remove([data.file_path]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
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

    // Query the bank_statements table
    const { data, error } = await supabase
      .from('bank_statements')
      .select('*')
      .eq('id', statementId)
      .eq('user_id', userId)
      .single();

    if (error) {
      throw new Error(`Error fetching bank statement: ${error.message}`);
    }

    if (!data) {
      throw new Error('Bank statement not found');
    }

    return data as BankStatement;
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
    const { data, error } = await supabase.storage
      .from('user-documents')
      .createSignedUrl(filePath, 60); // URL valid for 60 seconds

    if (error) {
      throw new Error(`Error creating signed URL: ${error.message}`);
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error in getBankStatementDownloadUrl:', error);
    throw error;
  }
}; 