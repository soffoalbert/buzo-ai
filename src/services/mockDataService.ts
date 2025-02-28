import { Expense } from '../models/Expense';
import { saveData, loadData } from './offlineStorage';
import { generateRealisticExpenses } from '../utils/mockData';
import { subDays } from 'date-fns';

// Storage keys
const MOCK_DATA_ENABLED_KEY = 'buzo_mock_data_enabled';
const MOCK_EXPENSES_KEY = 'buzo_mock_expenses';

/**
 * Check if mock data is enabled
 */
export const isMockDataEnabled = async (): Promise<boolean> => {
  try {
    const enabled = await loadData<boolean>(MOCK_DATA_ENABLED_KEY);
    return enabled === true;
  } catch (error) {
    console.error('Error checking mock data status:', error);
    return false;
  }
};

/**
 * Enable or disable mock data
 */
export const setMockDataEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await saveData(MOCK_DATA_ENABLED_KEY, enabled);
    
    // If enabling mock data, generate it if it doesn't exist
    if (enabled) {
      const existingMockData = await loadMockExpenses();
      if (!existingMockData || existingMockData.length === 0) {
        await generateAndSaveMockExpenses();
      }
    }
  } catch (error) {
    console.error('Error setting mock data status:', error);
    throw new Error('Failed to set mock data status');
  }
};

/**
 * Load mock expenses from storage
 */
export const loadMockExpenses = async (): Promise<Expense[]> => {
  try {
    const expenses = await loadData<Expense[]>(MOCK_EXPENSES_KEY);
    return expenses || [];
  } catch (error) {
    console.error('Error loading mock expenses:', error);
    return [];
  }
};

/**
 * Save mock expenses to storage
 */
export const saveMockExpenses = async (expenses: Expense[]): Promise<void> => {
  try {
    await saveData(MOCK_EXPENSES_KEY, expenses);
  } catch (error) {
    console.error('Error saving mock expenses:', error);
    throw new Error('Failed to save mock expenses');
  }
};

/**
 * Generate and save realistic mock expenses
 */
export const generateAndSaveMockExpenses = async (days: number = 180): Promise<Expense[]> => {
  try {
    // Generate realistic expenses for the past X days
    const startDate = subDays(new Date(), days);
    const mockExpenses = generateRealisticExpenses(days, startDate);
    
    // Save the generated expenses
    await saveMockExpenses(mockExpenses);
    
    return mockExpenses;
  } catch (error) {
    console.error('Error generating mock expenses:', error);
    throw new Error('Failed to generate mock expenses');
  }
};

/**
 * Reset mock data (clear and regenerate)
 */
export const resetMockData = async (): Promise<void> => {
  try {
    await generateAndSaveMockExpenses();
  } catch (error) {
    console.error('Error resetting mock data:', error);
    throw new Error('Failed to reset mock data');
  }
}; 