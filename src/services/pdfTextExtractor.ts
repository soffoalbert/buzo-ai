import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

/**
 * Extract text from a PDF file
 * Note: This version doesn't actually extract text, but prepares
 * the PDF to be processed by the OpenAI Vision API
 * 
 * @param filePath Path to the PDF file
 * @returns Promise resolving to the extracted text
 */
export const extractTextFromPdf = async (filePath: string): Promise<string> => {
  try {
    // Show informative message
    console.log('Preparing PDF for OpenAI Vision API...');
    
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    // For now, we're not actually extracting text
    // Instead, we'll throw to trigger the OpenAI Vision API fallback
    throw new Error('PDF text extraction not implemented - falling back to Vision API');
  } catch (error) {
    console.error('Error preparing PDF:', error);
    throw error;
  }
};

/**
 * Extract text from a PDF file using alternative methods as a fallback
 * This is useful for scanned PDFs where text extraction isn't reliable
 * @param filePath Path to the PDF file
 * @returns Promise resolving to the extracted text
 */
export const extractTextFromPdfWithFallback = async (filePath: string): Promise<string> => {
  try {
    // First try normal text extraction (which will always throw in this implementation)
    await extractTextFromPdf(filePath);
    
    // This code should never be reached in current implementation
    return "Fallback not needed - this should never be reached";
  } catch (error) {
    console.log('Using OpenAI Vision API for PDF processing...');
    
    // Inform the user
    Alert.alert(
      "Processing PDF",
      "We're analyzing your PDF bank statement with our advanced AI system.",
      [{ text: "OK" }]
    );
    
    // Re-throw to trigger the Vision API in the calling code
    throw error;
  }
};

/**
 * Preprocess bank statement text for better analysis
 * @param pdfText The extracted text from a PDF
 * @returns Processed text optimized for transaction extraction
 */
export const preprocessBankStatementText = (pdfText: string): string => {
  // For now, just return the original text since we're using Vision API directly
  return pdfText;
}; 