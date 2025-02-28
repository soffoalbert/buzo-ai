// Import the Vault functions from supabaseClient
import { getVaultSecret } from '../api/supabaseClient';
import { trackFeatureEngagement } from '../services/feedbackService';
import { FeedbackContext } from '../models/Feedback';
// Keep the apiKeyManager imports for fallback
import { getApiKey as getManagerApiKey, setApiKey as setManagerApiKey, clearApiKey as clearManagerApiKey } from './apiKeyManager';
// Import the global API key manager for development
import { getGlobalApiKey } from './devApiKeyManager';
// Import user service to get user preferences and profile
import { getUserPreferences, loadUserProfile } from './userService';
// Import for location data - using require to avoid TypeScript errors
import * as Location from 'expo-location';
// Import economic data service
import { getEconomicContext, getEconomicTips, getProvincialEconomicData } from './economicDataService';

// Base URL for OpenAI API
const API_URL = 'https://api.openai.com/v1/chat/completions';

// Import types from FinancialInsights component
import { FinancialInsight } from '../components/FinancialInsights';
// No default API key - we'll use the apiKeyManager instead

// Whether to use global API keys (for development)
const USE_GLOBAL_API_KEYS = true;

// Add spending patterns analysis
interface SpendingPatterns {
  frequentCategories: string[];
  unusualExpenses: Array<{
    category: string;
    amount: number;
    date: string;
    percentageAboveAverage: number;
  }>;
  recurringExpenses: Array<{
    category: string;
    averageAmount: number;
    frequency: 'daily' | 'weekly' | 'monthly';
  }>;
  savingsRate?: number; // Percentage of income saved
}

// Interface for financial data
interface FinancialData {
  income?: number;
  expenses?: Array<{
    category: string;
    amount: number;
    date: string;
    title: string;
  }>;
  budgets?: Array<{
    category: string;
    limit: number;
    spent: number;
  }>;
  savingsGoals?: Array<{
    title: string;
    target: number;
    current: number;
    deadline: string;
    priority?: 'low' | 'medium' | 'high';
  }>;
  // Add historical data for trends
  historicalExpenses?: Array<{
    month: string;
    totalAmount: number;
    categories: Record<string, number>;
  }>;
  historicalIncome?: Array<{
    month: string;
    amount: number;
  }>;
  // Add user profile data
  userProfile?: {
    age?: number;
    occupation?: string;
    financialGoals?: string[];
    riskTolerance?: 'low' | 'medium' | 'high';
    financialInterests?: string[];
    financialChallenges?: string[];
  };
  // Add location data for local economic context
  locationData?: {
    city?: string;
    province?: string;
    country?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  // Add spending patterns analysis
  spendingPatterns?: SpendingPatterns;
}

// Interface for advice request
interface AdviceRequest {
  type: 'budget' | 'expense' | 'savings' | 'general';
  financialData: FinancialData;
  question?: string;
}

// Vault secret name for OpenAI API key
const VAULT_SECRET_NAME = 'OPENAI_API_KEY';

/**
 * Set the OpenAI API key securely
 * @param apiKey The OpenAI API key
 */
export const setApiKey = async (apiKey: string): Promise<void> => {
  try {
    // Use the API key manager instead of directly using SecureStore
    await setManagerApiKey(apiKey);
  } catch (error) {
    console.error('Error storing API key:', error);
    throw error;
  }
};

/**
 * Get the API key from various sources
 * Prioritizes global API key during development
 */
export const getApiKey = async (): Promise<string | null> => {
  // First try to get the global API key if enabled
  if (USE_GLOBAL_API_KEYS) {
    try {
      const globalApiKey = await getGlobalApiKey();
      if (globalApiKey) {
        return globalApiKey;
      }
    } catch (error) {
      console.warn('Error getting global API key, falling back to user key:', error);
    }
  }
  
  // Try to get from Vault first
  try {
    const { value: vaultKey, error: vaultError } = await getVaultSecret('OPENAI_API_KEY');
    if (vaultKey && !vaultError) {
      return vaultKey;
    }
    if (vaultError) {
      console.warn('Error getting API key from Vault:', vaultError);
    }
  } catch (error) {
    console.warn('Error getting API key from Vault, falling back to apiKeyManager:', error);
  }
  
  // Fall back to apiKeyManager
  return getManagerApiKey();
};

/**
 * Clear the stored OpenAI API key
 */
export const clearApiKey = async (): Promise<void> => {
  try {
    // Use the API key manager instead of directly using SecureStore
    await clearManagerApiKey();
  } catch (error) {
    console.error('Error clearing API key:', error);
    throw error;
  }
};

/**
 * Generate fallback advice when AI is unavailable
 * @param financialData User's financial data
 * @param type Type of advice requested
 * @param question Optional specific question
 * @returns Basic rule-based advice
 */
const generateFallbackAdvice = (
  financialData: FinancialData, 
  type: AdviceRequest['type'], 
  question?: string
): string => {
  let advice = "I'm currently unable to provide personalized advice, but here are some general tips:\n\n";
  
  switch (type) {
    case 'budget':
      advice += "• Aim to follow the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings.\n";
      advice += "• Track all your expenses to identify areas where you can cut back.\n";
      advice += "• Review and adjust your budget monthly based on your actual spending.\n";
      break;
    
    case 'expense':
      advice += "• Look for recurring subscriptions you don't use and cancel them.\n";
      advice += "• Consider buying groceries in bulk to save money.\n";
      advice += "• Use public transport or carpooling when possible to reduce transport costs.\n";
      break;
    
    case 'savings':
      advice += "• Set up automatic transfers to your savings account on payday.\n";
      advice += "• Start with an emergency fund covering 3-6 months of expenses.\n";
      advice += "• Consider tax-free savings accounts for long-term goals.\n";
      break;
    
    case 'general':
    default:
      advice += "• Pay off high-interest debt first before focusing on savings.\n";
      advice += "• Build an emergency fund for unexpected expenses.\n";
      advice += "• Start investing early, even with small amounts.\n";
      advice += "• Continuously educate yourself about personal finance.\n";
      break;
  }
  
  return advice;
};

/**
 * Get personalized financial advice based on user data
 * @param request The advice request containing financial data and question
 * @returns The AI-generated advice
 */
export const getFinancialAdvice = async (request: AdviceRequest): Promise<string> => {
  try {
    // Get API key from Vault with fallbacks
    const apiKey = await getApiKey();
    
    // If no API key is available, return a message asking the user to set one
    if (!apiKey) {
      return "To get personalized financial advice, please set your OpenAI API key in the settings. " +
             "You can get an API key from https://platform.openai.com/api-keys.";
    }
    
    // Create a prompt based on the request type and data
    let prompt = '';
    
    switch (request.type) {
      case 'budget':
        prompt = createBudgetPrompt(request.financialData, request.question);
        break;
      case 'expense':
        prompt = createExpensePrompt(request.financialData, request.question);
        break;
      case 'savings':
        prompt = createSavingsPrompt(request.financialData, request.question);
        break;
      case 'general':
      default:
        prompt = createGeneralPrompt(request.financialData, request.question);
        break;
    }
    
    // Get user preferences for cultural context
    const userPreferences = await getUserPreferences();
    
    // Get economic context based on user's location
    let economicContext = '';
    if (request.financialData.locationData?.province) {
      economicContext = getEconomicContext(request.financialData.locationData.province);
    } else {
      economicContext = getEconomicContext();
    }
    
    // Get economic tips
    const economicTips = getEconomicTips();
    
    // Generate a unique ID for this recommendation
    const recommendationId = generateRecommendationId(request.type);
    
    // Call the OpenAI API
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are Buzo, a helpful and friendly financial advisor for young South Africans. 
            Provide clear, actionable advice tailored to their financial situation and cultural context.
            
            Consider these South African specific factors in your advice:
            - Local economic conditions (inflation rate, unemployment rate, interest rates)
            - Cultural norms around money management in South African communities
            - Common financial challenges for South African youth (high unemployment, "black tax" family obligations)
            - Local financial products and services available in South Africa
            - South African tax implications and regulations
            - Local cost of living variations between provinces
            
            Current economic context: ${economicContext}
            
            Relevant economic tips:
            ${economicTips.join('\n')}
            
            Use simple language and avoid jargon. Focus on practical tips that can be implemented immediately.
            Be encouraging and positive, but realistic about the challenges young South Africans face.
            
            User's currency preference: ${userPreferences.currency}
            User's language preference: ${userPreferences.language}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      
      // Check for API key related errors
      if (errorData.error?.code === 'invalid_api_key' || 
          errorData.error?.type === 'authentication_error' ||
          response.status === 401) {
        // Clear the invalid API key
        await clearApiKey();
        return "Your OpenAI API key appears to be invalid. Please update your API key in the settings. " +
               "You can get a new API key from https://platform.openai.com/api-keys.";
      }
      
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    const advice = data.choices[0].message.content.trim();
    
    // Track this AI recommendation for analytics
    try {
      await trackFeatureEngagement(
        recommendationId,
        FeedbackContext.AI_RECOMMENDATION,
        {
          adviceType: request.type,
          hasQuestion: !!request.question,
          promptLength: prompt.length,
          responseLength: advice.length
        }
      );
    } catch (error) {
      // Silently fail - analytics should not interrupt user experience
      console.warn('Error tracking AI recommendation:', error);
    }
    
    return advice;
  } catch (error) {
    console.error('Error getting financial advice:', error);
    
    // If there's an error with the API call, fall back to rule-based advice
    return generateFallbackAdvice(request.financialData, request.type, request.question);
  }
};

/**
 * Generate a unique ID for an AI recommendation
 * @param type The type of advice
 * @returns A unique recommendation ID
 */
const generateRecommendationId = (type: AdviceRequest['type']): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `rec_${type}_${timestamp}_${random}`;
};

/**
 * Create a prompt for budget advice
 * @param financialData User's financial data
 * @param question Optional specific question
 * @returns Formatted prompt for the AI
 */
const createBudgetPrompt = (financialData: FinancialData, question?: string): string => {
  const { income, budgets, spendingPatterns, userProfile, locationData } = financialData;
  
  let prompt = `I need advice on my budget. `;
  
  if (income) {
    prompt += `My monthly income is R${income}. `;
  }
  
  if (budgets && budgets.length > 0) {
    prompt += `My current budget allocations are: `;
    budgets.forEach(budget => {
      prompt += `${budget.category}: R${budget.limit} (spent R${budget.spent} so far), `;
    });
    prompt = prompt.slice(0, -2) + '. ';
  }
  
  // Add spending patterns if available
  if (spendingPatterns) {
    if (spendingPatterns.frequentCategories && spendingPatterns.frequentCategories.length > 0) {
      prompt += `I spend most frequently on: ${spendingPatterns.frequentCategories.join(', ')}. `;
    }
    
    if (spendingPatterns.savingsRate !== undefined) {
      prompt += `My current savings rate is ${spendingPatterns.savingsRate}% of my income. `;
    }
    
    if (spendingPatterns.recurringExpenses && spendingPatterns.recurringExpenses.length > 0) {
      prompt += `My recurring expenses include: `;
      spendingPatterns.recurringExpenses.forEach(expense => {
        prompt += `${expense.category} (R${expense.averageAmount} ${expense.frequency}), `;
      });
      prompt = prompt.slice(0, -2) + '. ';
    }
  }
  
  // Add user profile if available
  if (userProfile) {
    if (userProfile.age) {
      prompt += `I am ${userProfile.age} years old. `;
    }
    
    if (userProfile.occupation) {
      prompt += `I work as a ${userProfile.occupation}. `;
    }
    
    if (userProfile.financialGoals && userProfile.financialGoals.length > 0) {
      prompt += `My financial goals include: ${userProfile.financialGoals.join(', ')}. `;
    }
    
    if (userProfile.financialChallenges && userProfile.financialChallenges.length > 0) {
      prompt += `My financial challenges include: ${userProfile.financialChallenges.join(', ')}. `;
    }
  }
  
  // Add location data if available
  if (locationData && locationData.city) {
    prompt += `I live in ${locationData.city}`;
    if (locationData.province) {
      prompt += `, ${locationData.province}`;
    }
    prompt += `. `;
  }
  
  if (question) {
    prompt += `Specifically, I want to know: ${question}`;
  } else {
    prompt += `Can you suggest improvements to my budget? Are there categories where I'm spending too much or too little?`;
  }
  
  return prompt;
};

/**
 * Create a prompt for expense advice
 * @param financialData User's financial data
 * @param question Optional specific question
 * @returns Formatted prompt for the AI
 */
const createExpensePrompt = (financialData: FinancialData, question?: string): string => {
  const { expenses, spendingPatterns, userProfile, locationData } = financialData;
  
  let prompt = `I need advice on my expenses. `;
  
  if (expenses && expenses.length > 0) {
    prompt += `My recent expenses include: `;
    expenses.slice(0, 5).forEach(expense => {
      prompt += `${expense.title} (${expense.category}): R${expense.amount} on ${expense.date}, `;
    });
    prompt = prompt.slice(0, -2) + '. ';
  }
  
  // Add spending patterns if available
  if (spendingPatterns) {
    if (spendingPatterns.unusualExpenses && spendingPatterns.unusualExpenses.length > 0) {
      prompt += `I've had some unusual expenses recently: `;
      spendingPatterns.unusualExpenses.forEach(expense => {
        prompt += `${expense.category}: R${expense.amount} (${expense.percentageAboveAverage}% above my average), `;
      });
      prompt = prompt.slice(0, -2) + '. ';
    }
  }
  
  // Add user profile if available
  if (userProfile) {
    if (userProfile.financialChallenges && userProfile.financialChallenges.length > 0) {
      prompt += `My financial challenges include: ${userProfile.financialChallenges.join(', ')}. `;
    }
  }
  
  // Add location data if available
  if (locationData && locationData.city) {
    prompt += `I live in ${locationData.city}`;
    if (locationData.province) {
      prompt += `, ${locationData.province}`;
    }
    prompt += `. `;
  }
  
  if (question) {
    prompt += `Specifically, I want to know: ${question}`;
  } else {
    prompt += `Can you suggest ways to reduce my expenses? Are there any concerning spending patterns?`;
  }
  
  return prompt;
};

/**
 * Create a prompt for savings advice
 * @param financialData User's financial data
 * @param question Optional specific question
 * @returns Formatted prompt for the AI
 */
const createSavingsPrompt = (financialData: FinancialData, question?: string): string => {
  const { income, savingsGoals, spendingPatterns, userProfile, locationData } = financialData;
  
  let prompt = `I need advice on my savings goals. `;
  
  if (income) {
    prompt += `My monthly income is R${income}. `;
  }
  
  if (savingsGoals && savingsGoals.length > 0) {
    prompt += `My savings goals are: `;
    savingsGoals.forEach(goal => {
      const progress = (goal.current / goal.target) * 100;
      prompt += `${goal.title}: R${goal.current} saved of R${goal.target} target (${progress.toFixed(1)}% complete, deadline: ${goal.deadline})`;
      if (goal.priority) {
        prompt += ` - ${goal.priority} priority`;
      }
      prompt += `, `;
    });
    prompt = prompt.slice(0, -2) + '. ';
  }
  
  // Add spending patterns if available
  if (spendingPatterns && spendingPatterns.savingsRate !== undefined) {
    prompt += `My current savings rate is ${spendingPatterns.savingsRate}% of my income. `;
  }
  
  // Add user profile if available
  if (userProfile) {
    if (userProfile.age) {
      prompt += `I am ${userProfile.age} years old. `;
    }
    
    if (userProfile.riskTolerance) {
      prompt += `My risk tolerance is ${userProfile.riskTolerance}. `;
    }
    
    if (userProfile.financialGoals && userProfile.financialGoals.length > 0) {
      prompt += `My financial goals include: ${userProfile.financialGoals.join(', ')}. `;
    }
  }
  
  // Add location data if available
  if (locationData && locationData.city) {
    prompt += `I live in ${locationData.city}`;
    if (locationData.province) {
      prompt += `, ${locationData.province}`;
    }
    prompt += `. `;
  }
  
  if (question) {
    prompt += `Specifically, I want to know: ${question}`;
  } else {
    prompt += `Can you suggest strategies to reach my savings goals faster? Are my goals realistic given my income and expenses?`;
  }
  
  return prompt;
};

/**
 * Create a prompt for general financial advice
 * @param financialData User's financial data
 * @param question Optional specific question
 * @returns Formatted prompt for the AI
 */
const createGeneralPrompt = (financialData: FinancialData, question?: string): string => {
  const { income, expenses, budgets, savingsGoals, spendingPatterns, userProfile, locationData } = financialData;
  
  let prompt = `I need general financial advice. `;
  
  if (income) {
    prompt += `My monthly income is R${income}. `;
  }
  
  if (expenses && expenses.length > 0) {
    let totalExpenses = 0;
    expenses.forEach(expense => {
      totalExpenses += expense.amount;
    });
    prompt += `My total expenses for the last month were R${totalExpenses}. `;
  }
  
  if (budgets && budgets.length > 0) {
    let overBudgetCategories = budgets.filter(budget => budget.spent > budget.limit);
    if (overBudgetCategories.length > 0) {
      prompt += `I'm over budget in these categories: `;
      overBudgetCategories.forEach(budget => {
        const overBy = budget.spent - budget.limit;
        prompt += `${budget.category} (over by R${overBy}), `;
      });
      prompt = prompt.slice(0, -2) + '. ';
    }
  }
  
  if (savingsGoals && savingsGoals.length > 0) {
    const totalSaved = savingsGoals.reduce((sum, goal) => sum + goal.current, 0);
    const totalTarget = savingsGoals.reduce((sum, goal) => sum + goal.target, 0);
    const overallProgress = (totalSaved / totalTarget) * 100;
    
    prompt += `Overall, I've saved R${totalSaved} of my R${totalTarget} savings targets (${overallProgress.toFixed(1)}% progress). `;
  }
  
  // Add spending patterns if available
  if (spendingPatterns) {
    if (spendingPatterns.savingsRate !== undefined) {
      prompt += `My current savings rate is ${spendingPatterns.savingsRate}% of my income. `;
    }
    
    if (spendingPatterns.frequentCategories && spendingPatterns.frequentCategories.length > 0) {
      prompt += `I spend most frequently on: ${spendingPatterns.frequentCategories.join(', ')}. `;
    }
  }
  
  // Add user profile if available
  if (userProfile) {
    if (userProfile.age) {
      prompt += `I am ${userProfile.age} years old. `;
    }
    
    if (userProfile.occupation) {
      prompt += `I work as a ${userProfile.occupation}. `;
    }
    
    if (userProfile.financialGoals && userProfile.financialGoals.length > 0) {
      prompt += `My financial goals include: ${userProfile.financialGoals.join(', ')}. `;
    }
    
    if (userProfile.financialChallenges && userProfile.financialChallenges.length > 0) {
      prompt += `My financial challenges include: ${userProfile.financialChallenges.join(', ')}. `;
    }
  }
  
  // Add location data if available
  if (locationData && locationData.city) {
    prompt += `I live in ${locationData.city}`;
    if (locationData.province) {
      prompt += `, ${locationData.province}`;
    }
    prompt += `. `;
  }
  
  if (question) {
    prompt += `Specifically, I want to know: ${question}`;
  } else {
    prompt += `What's your assessment of my financial health? What should I focus on improving?`;
  }
  
  return prompt;
};

/**
 * Get user's location data
 * @returns Promise resolving to location data or null if not available
 */
export const getUserLocationData = async (): Promise<FinancialData['locationData'] | null> => {
  try {
    // Request permission to access location
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('Location permission denied');
      return null;
    }
    
    // Get current location
    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;
    
    // Reverse geocode to get address details
    const [addressInfo] = await Location.reverseGeocodeAsync({ latitude, longitude });
    
    if (!addressInfo) {
      return {
        coordinates: { latitude, longitude }
      };
    }
    
    // Get provincial economic data if available
    const province = addressInfo.region || undefined;
    const provincialData = province ? getProvincialEconomicData(province) : undefined;
    
    return {
      city: addressInfo.city || addressInfo.subregion || undefined,
      province: addressInfo.region || undefined,
      country: addressInfo.country || undefined,
      coordinates: { latitude, longitude }
    };
  } catch (error) {
    console.error('Error getting location data:', error);
    return null;
  }
};

/**
 * Analyze spending patterns from expense data
 * @param expenses Array of expenses
 * @param income User's income
 * @returns Spending patterns analysis
 */
export const analyzeSpendingPatterns = (
  expenses: FinancialData['expenses'] = [],
  income?: number
): SpendingPatterns => {
  if (!expenses || expenses.length === 0) {
    return {
      frequentCategories: [],
      unusualExpenses: [],
      recurringExpenses: []
    };
  }
  
  // Group expenses by category
  const expensesByCategory: Record<string, number[]> = {};
  expenses.forEach(expense => {
    if (!expensesByCategory[expense.category]) {
      expensesByCategory[expense.category] = [];
    }
    expensesByCategory[expense.category].push(expense.amount);
  });
  
  // Calculate category frequencies
  const categoryFrequency: Record<string, number> = {};
  Object.keys(expensesByCategory).forEach(category => {
    categoryFrequency[category] = expensesByCategory[category].length;
  });
  
  // Sort categories by frequency
  const frequentCategories = Object.keys(categoryFrequency)
    .sort((a, b) => categoryFrequency[b] - categoryFrequency[a])
    .slice(0, 3);
  
  // Find unusual expenses (significantly above average for the category)
  const unusualExpenses: SpendingPatterns['unusualExpenses'] = [];
  Object.keys(expensesByCategory).forEach(category => {
    const amounts = expensesByCategory[category];
    const average = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    
    expenses
      .filter(expense => expense.category === category && expense.amount > average * 1.5)
      .forEach(expense => {
        unusualExpenses.push({
          category: expense.category,
          amount: expense.amount,
          date: expense.date,
          percentageAboveAverage: Math.round(((expense.amount - average) / average) * 100)
        });
      });
  });
  
  // Identify recurring expenses
  const recurringExpenses: SpendingPatterns['recurringExpenses'] = [];
  Object.keys(expensesByCategory).forEach(category => {
    const amounts = expensesByCategory[category];
    if (amounts.length >= 3) {
      const averageAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
      
      // Simple heuristic: if we have 3+ expenses in a category with similar amounts, consider it recurring
      const similarAmounts = amounts.filter(amount => 
        Math.abs(amount - averageAmount) / averageAmount < 0.2
      );
      
      if (similarAmounts.length >= 3) {
        recurringExpenses.push({
          category,
          averageAmount: Math.round(averageAmount),
          frequency: 'monthly' // Assuming monthly for now
        });
      }
    }
  });
  
  // Calculate savings rate if income is provided
  let savingsRate: number | undefined = undefined;
  if (income && income > 0) {
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    savingsRate = Math.round(((income - totalExpenses) / income) * 100);
    // Cap at 100% and floor at 0%
    savingsRate = Math.min(100, Math.max(0, savingsRate));
  }
  
  return {
    frequentCategories,
    unusualExpenses,
    recurringExpenses,
    savingsRate
  };
};

export default {
  getFinancialAdvice,
  getUserLocationData,
  analyzeSpendingPatterns,
  setApiKey,
  getApiKey,
  clearApiKey
}; 