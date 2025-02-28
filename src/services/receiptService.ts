import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { saveData, loadData } from './offlineStorage';
import { generateUUID } from '../utils/helpers';

// Storage keys
const RECEIPTS_STORAGE_KEY = 'buzo_receipts';
const PENDING_OCR_STORAGE_KEY = 'buzo_pending_ocr';

// Types
export interface ReceiptData {
  id: string;
  imageUri: string;
  extractedData: ExtractedReceiptData | null;
  createdAt: string;
  updatedAt: string;
  status: 'pending' | 'processed' | 'failed';
}

export interface ExtractedReceiptData {
  merchant: string;
  date: string;
  total: number;
  items?: {
    name: string;
    price: number;
    quantity?: number;
  }[];
  taxAmount?: number;
  receiptNumber?: string;
  paymentMethod?: string;
  currency?: string;
}

/**
 * Process a receipt image using OCR
 * @param imageUri URI of the image to process
 * @param base64Data Optional base64 data of the image
 * @returns Promise resolving to the extracted data
 */
export const processReceiptImage = async (
  imageUri: string,
  base64Data?: string | null
): Promise<ExtractedReceiptData> => {
  try {
    // Create a unique ID for this receipt
    const receiptId = generateUUID();
    
    // Get base64 data if not provided
    let imageBase64 = base64Data;
    if (!imageBase64) {
      if (imageUri.startsWith('file://') || imageUri.startsWith('content://')) {
        imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        throw new Error('Invalid image URI format');
      }
    }
    
    // In a real implementation, we would send the image to an OCR service
    // For now, we'll simulate OCR processing with a delay and mock data
    
    // Save the receipt to pending OCR storage
    const pendingReceipt: ReceiptData = {
      id: receiptId,
      imageUri,
      extractedData: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending',
    };
    
    await savePendingOCR(pendingReceipt);
    
    // Simulate OCR processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock OCR result based on current date and time to make it look realistic
    const now = new Date();
    const randomAmount = Math.floor(Math.random() * 500) + 50; // Random amount between 50 and 550
    const cents = Math.floor(Math.random() * 99); // Random cents
    const totalAmount = randomAmount + (cents / 100);
    
    // Generate random items
    const numItems = Math.floor(Math.random() * 5) + 1; // 1-5 items
    const items = [];
    const itemNames = [
      'Milk', 'Bread', 'Eggs', 'Coffee', 'Sugar', 'Rice', 
      'Pasta', 'Chicken', 'Beef', 'Fish', 'Vegetables', 
      'Fruits', 'Cereal', 'Juice', 'Water', 'Snacks'
    ];
    
    let itemsTotal = 0;
    for (let i = 0; i < numItems; i++) {
      const itemPrice = Math.floor(Math.random() * 100) + 10 + (Math.floor(Math.random() * 99) / 100);
      const quantity = Math.floor(Math.random() * 3) + 1;
      const itemName = itemNames[Math.floor(Math.random() * itemNames.length)];
      
      items.push({
        name: itemName,
        price: itemPrice,
        quantity
      });
      
      itemsTotal += itemPrice * quantity;
    }
    
    // Adjust the last item to make the total match
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      const difference = totalAmount - itemsTotal;
      lastItem.price = lastItem.price + (difference / lastItem.quantity);
    }
    
    // Generate merchant names
    const merchants = [
      'Shoprite', 'Pick n Pay', 'Woolworths', 'Checkers', 
      'Spar', 'Game', 'Makro', 'Food Lover\'s Market',
      'OK Foods', 'U-Save', 'Boxer'
    ];
    
    const extractedData: ExtractedReceiptData = {
      merchant: merchants[Math.floor(Math.random() * merchants.length)],
      date: now.toISOString().split('T')[0],
      total: totalAmount,
      items,
      taxAmount: totalAmount * 0.15, // 15% VAT
      receiptNumber: `R${Math.floor(Math.random() * 10000)}`,
      paymentMethod: Math.random() > 0.5 ? 'Card' : 'Cash',
      currency: 'ZAR',
    };
    
    // Update the receipt in storage
    const updatedReceipt: ReceiptData = {
      ...pendingReceipt,
      extractedData,
      updatedAt: new Date().toISOString(),
      status: 'processed',
    };
    
    await saveReceipt(updatedReceipt);
    await removePendingOCR(receiptId);
    
    return extractedData;
  } catch (error) {
    console.error('Error processing receipt image:', error);
    throw new Error('Failed to process receipt image');
  }
};

/**
 * Save a receipt to storage
 * @param receipt Receipt data to save
 * @returns Promise resolving to the saved receipt
 */
export const saveReceipt = async (receipt: ReceiptData): Promise<ReceiptData> => {
  try {
    const receipts = await loadReceipts();
    const existingIndex = receipts.findIndex(r => r.id === receipt.id);
    
    if (existingIndex >= 0) {
      receipts[existingIndex] = receipt;
    } else {
      receipts.push(receipt);
    }
    
    await saveData(RECEIPTS_STORAGE_KEY, receipts);
    return receipt;
  } catch (error) {
    console.error('Error saving receipt:', error);
    throw new Error('Failed to save receipt');
  }
};

/**
 * Load all receipts from storage
 * @returns Promise resolving to array of receipts
 */
export const loadReceipts = async (): Promise<ReceiptData[]> => {
  try {
    const receipts = await loadData<ReceiptData[]>(RECEIPTS_STORAGE_KEY);
    return receipts || [];
  } catch (error) {
    console.error('Error loading receipts:', error);
    return [];
  }
};

/**
 * Get a receipt by ID
 * @param id Receipt ID
 * @returns Promise resolving to the receipt or null if not found
 */
export const getReceiptById = async (id: string): Promise<ReceiptData | null> => {
  try {
    const receipts = await loadReceipts();
    return receipts.find(receipt => receipt.id === id) || null;
  } catch (error) {
    console.error('Error getting receipt:', error);
    return null;
  }
};

/**
 * Delete a receipt
 * @param id Receipt ID to delete
 * @returns Promise resolving to boolean indicating success
 */
export const deleteReceipt = async (id: string): Promise<boolean> => {
  try {
    const receipts = await loadReceipts();
    const updatedReceipts = receipts.filter(receipt => receipt.id !== id);
    
    if (receipts.length === updatedReceipts.length) {
      return false; // No receipt was deleted
    }
    
    await saveData(RECEIPTS_STORAGE_KEY, updatedReceipts);
    
    // Also try to delete the image file if it's local
    const receipt = receipts.find(r => r.id === id);
    if (receipt && receipt.imageUri.startsWith('file://')) {
      try {
        await FileSystem.deleteAsync(receipt.imageUri);
      } catch (fileError) {
        console.warn('Could not delete receipt image file:', fileError);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting receipt:', error);
    return false;
  }
};

/**
 * Save a receipt to pending OCR storage
 * @param receipt Receipt data to save
 * @returns Promise resolving to the saved receipt
 */
export const savePendingOCR = async (receipt: ReceiptData): Promise<ReceiptData> => {
  try {
    const pendingReceipts = await loadPendingOCR();
    const existingIndex = pendingReceipts.findIndex(r => r.id === receipt.id);
    
    if (existingIndex >= 0) {
      pendingReceipts[existingIndex] = receipt;
    } else {
      pendingReceipts.push(receipt);
    }
    
    await saveData(PENDING_OCR_STORAGE_KEY, pendingReceipts);
    return receipt;
  } catch (error) {
    console.error('Error saving pending OCR:', error);
    throw new Error('Failed to save pending OCR');
  }
};

/**
 * Load all pending OCR receipts from storage
 * @returns Promise resolving to array of pending OCR receipts
 */
export const loadPendingOCR = async (): Promise<ReceiptData[]> => {
  try {
    const pendingReceipts = await loadData<ReceiptData[]>(PENDING_OCR_STORAGE_KEY);
    return pendingReceipts || [];
  } catch (error) {
    console.error('Error loading pending OCR:', error);
    return [];
  }
};

/**
 * Remove a receipt from pending OCR storage
 * @param id Receipt ID to remove
 * @returns Promise resolving to boolean indicating success
 */
export const removePendingOCR = async (id: string): Promise<boolean> => {
  try {
    const pendingReceipts = await loadPendingOCR();
    const updatedPendingReceipts = pendingReceipts.filter(receipt => receipt.id !== id);
    
    if (pendingReceipts.length === updatedPendingReceipts.length) {
      return false; // No receipt was removed
    }
    
    await saveData(PENDING_OCR_STORAGE_KEY, updatedPendingReceipts);
    return true;
  } catch (error) {
    console.error('Error removing pending OCR:', error);
    return false;
  }
};

/**
 * Create an expense from receipt data
 * @param receiptData Extracted receipt data
 * @param receiptImageUri URI of the receipt image
 * @returns Object with expense data ready to be created
 */
export const createExpenseFromReceipt = (
  receiptData: ExtractedReceiptData,
  receiptImageUri: string
) => {
  return {
    title: receiptData.merchant || 'Receipt Expense',
    amount: receiptData.total,
    date: receiptData.date || new Date().toISOString().split('T')[0],
    category: guessCategory(receiptData),
    description: `Receipt from ${receiptData.merchant || 'store'}`,
    receiptImage: receiptImageUri,
    // Add any other fields needed for expenses
  };
};

/**
 * Guess the expense category based on receipt data
 * @param receiptData Extracted receipt data
 * @returns Best guess at the expense category
 */
const guessCategory = (receiptData: ExtractedReceiptData): string => {
  // Simple category guessing logic based on merchant name and items
  const merchantLower = (receiptData.merchant || '').toLowerCase();
  
  // Check for grocery stores
  if (
    merchantLower.includes('shoprite') ||
    merchantLower.includes('pick n pay') ||
    merchantLower.includes('checkers') ||
    merchantLower.includes('spar') ||
    merchantLower.includes('woolworths') ||
    merchantLower.includes('food') ||
    merchantLower.includes('market')
  ) {
    return 'Groceries';
  }
  
  // Check for restaurants
  if (
    merchantLower.includes('restaurant') ||
    merchantLower.includes('cafe') ||
    merchantLower.includes('coffee') ||
    merchantLower.includes('kfc') ||
    merchantLower.includes('mcdonald') ||
    merchantLower.includes('steers') ||
    merchantLower.includes('nando')
  ) {
    return 'Dining';
  }
  
  // Check for pharmacies
  if (
    merchantLower.includes('pharmacy') ||
    merchantLower.includes('clicks') ||
    merchantLower.includes('dischem')
  ) {
    return 'Health';
  }
  
  // Check for fuel
  if (
    merchantLower.includes('fuel') ||
    merchantLower.includes('petrol') ||
    merchantLower.includes('gas') ||
    merchantLower.includes('engen') ||
    merchantLower.includes('caltex') ||
    merchantLower.includes('shell') ||
    merchantLower.includes('bp')
  ) {
    return 'Transport';
  }
  
  // Default to shopping
  return 'Shopping';
}; 