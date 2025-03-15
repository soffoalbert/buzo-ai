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
// Location services have been disabled, import commented out
// import * as Location from 'expo-location';
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
    // Note: Location services are now disabled for privacy reasons
    // The following fallback is used to provide general economic context
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
  // Location services are completely disabled for the AI Advisor flow
  // This function now always returns null and never attempts to use location services
  return null;
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

/**
 * Generates financial insights based on user's financial data
 * @param financialData User's financial data including income, expenses, budgets, and savings goals
 * @returns Array of financial insights
 */
export const generateFinancialInsights = async (
  financialData: FinancialData
): Promise<FinancialInsight[]> => {
  try {
    const insights: FinancialInsight[] = [];
    const { income, expenses, budgets, savingsGoals } = financialData;
    
    // Analyze spending patterns
    const spendingPatterns = analyzeSpendingPatterns(expenses, income);
    
    // Generate insights based on spending patterns
    if (spendingPatterns.frequentCategories.length > 0) {
      insights.push({
        id: `frequent-categories-${Date.now()}`,
        title: 'Top Spending Categories',
        description: `Your top spending categories are ${spendingPatterns.frequentCategories.join(', ')}. Consider setting budget limits for these categories.`,
        type: 'tip',
        priority: 'medium',
        category: 'spending',
        actionable: true,
        action: {
          label: 'Set Budget',
          screen: 'Budget',
        },
        createdAt: new Date().toISOString(),
      });
    }
    
    // Add insights for unusual expenses
    if (spendingPatterns.unusualExpenses.length > 0) {
      const topUnusual = spendingPatterns.unusualExpenses[0];
      insights.push({
        id: `unusual-expense-${Date.now()}`,
        title: 'Unusual Expense Detected',
        description: `You spent ${topUnusual.amount} on ${topUnusual.category}, which is ${topUnusual.percentageAboveAverage}% above your average for this category.`,
        type: 'warning',
        priority: 'high',
        category: 'spending',
        actionable: false,
        createdAt: new Date().toISOString(),
      });
    }
    
    // Add insights for recurring expenses
    if (spendingPatterns.recurringExpenses.length > 0) {
      insights.push({
        id: `recurring-expenses-${Date.now()}`,
        title: 'Recurring Expenses',
        description: `You have ${spendingPatterns.recurringExpenses.length} recurring expenses. Review them to identify potential savings.`,
        type: 'recommendation',
        priority: 'medium',
        category: 'spending',
        actionable: true,
        action: {
          label: 'Review Expenses',
          screen: 'Expenses',
        },
        createdAt: new Date().toISOString(),
      });
    }
    
    // Add savings rate insight
    if (spendingPatterns.savingsRate !== undefined) {
      const savingsRate = spendingPatterns.savingsRate;
      let savingsInsight: FinancialInsight;
      
      if (savingsRate < 10) {
        savingsInsight = {
          id: `low-savings-${Date.now()}`,
          title: 'Low Savings Rate',
          description: `Your current savings rate is ${savingsRate}%. Financial experts recommend saving at least 20% of your income.`,
          type: 'warning',
          priority: 'high',
          category: 'savings',
          actionable: true,
          action: {
            label: 'Create Savings Goal',
            screen: 'Savings',
          },
          createdAt: new Date().toISOString(),
        };
      } else if (savingsRate < 20) {
        savingsInsight = {
          id: `moderate-savings-${Date.now()}`,
          title: 'Moderate Savings Rate',
          description: `Your current savings rate is ${savingsRate}%. You're on the right track, but consider increasing it to 20% or more.`,
          type: 'tip',
          priority: 'medium',
          category: 'savings',
          actionable: true,
          action: {
            label: 'Increase Savings',
            screen: 'Savings',
          },
          createdAt: new Date().toISOString(),
        };
      } else {
        savingsInsight = {
          id: `good-savings-${Date.now()}`,
          title: 'Excellent Savings Rate',
          description: `Your current savings rate is ${savingsRate}%. Great job maintaining a healthy savings habit!`,
          type: 'achievement',
          priority: 'low',
          category: 'savings',
          actionable: false,
          createdAt: new Date().toISOString(),
        };
      }
      
      insights.push(savingsInsight);
    }
    
    // Add budget-related insights
    if (budgets && budgets.length > 0) {
      const overBudgetCategories = budgets.filter(budget => budget.spent > budget.limit);
      
      if (overBudgetCategories.length > 0) {
        insights.push({
          id: `over-budget-${Date.now()}`,
          title: 'Budget Alert',
          description: `You've exceeded your budget in ${overBudgetCategories.length} categories. Review your spending to stay on track.`,
          type: 'warning',
          priority: 'high',
          category: 'budget',
          actionable: true,
          action: {
            label: 'Review Budgets',
            screen: 'Budget',
          },
          createdAt: new Date().toISOString(),
        });
      }
      
      const nearBudgetCategories = budgets.filter(budget => 
        budget.spent > budget.limit * 0.8 && budget.spent <= budget.limit
      );
      
      if (nearBudgetCategories.length > 0) {
        insights.push({
          id: `near-budget-${Date.now()}`,
          title: 'Approaching Budget Limit',
          description: `You're approaching your budget limit in ${nearBudgetCategories.length} categories. Monitor your spending carefully.`,
          type: 'tip',
          priority: 'medium',
          category: 'budget',
          actionable: true,
          action: {
            label: 'View Budgets',
            screen: 'Budget',
          },
          createdAt: new Date().toISOString(),
        });
      }
    }
    
    // Add savings goal insights
    if (savingsGoals && savingsGoals.length > 0) {
      const upcomingGoals = savingsGoals.filter(goal => {
        const deadline = new Date(goal.deadline);
        const now = new Date();
        const monthsRemaining = (deadline.getFullYear() - now.getFullYear()) * 12 + 
                               (deadline.getMonth() - now.getMonth());
        
        return monthsRemaining <= 3 && goal.current < goal.target;
      });
      
      if (upcomingGoals.length > 0) {
        insights.push({
          id: `upcoming-goals-${Date.now()}`,
          title: 'Upcoming Savings Deadline',
          description: `You have ${upcomingGoals.length} savings goals with deadlines in the next 3 months. Increase your contributions to meet your targets.`,
          type: 'recommendation',
          priority: 'high',
          category: 'savings',
          actionable: true,
          action: {
            label: 'View Goals',
            screen: 'Savings',
          },
          createdAt: new Date().toISOString(),
        });
      }
      
      const completedGoals = savingsGoals.filter(goal => goal.current >= goal.target);
      
      if (completedGoals.length > 0) {
        insights.push({
          id: `completed-goals-${Date.now()}`,
          title: 'Savings Goal Achieved',
          description: `Congratulations! You've reached ${completedGoals.length} of your savings goals. Consider setting new goals to continue building wealth.`,
          type: 'achievement',
          priority: 'medium',
          category: 'savings',
          actionable: true,
          action: {
            label: 'Set New Goal',
            screen: 'Savings',
          },
          createdAt: new Date().toISOString(),
        });
      }
    }
    
    return insights;
  } catch (error) {
    console.error('Error generating financial insights:', error);
    return [];
  }
};

/**
 * Gets AI-powered financial insights using OpenAI API
 * @param financialData User's financial data
 * @returns Array of AI-generated financial insights
 */
export const getAIFinancialInsights = async (
  financialData: FinancialData
): Promise<FinancialInsight[]> => {
  try {
    // Get API key
    const apiKey = await getApiKey();
    
    if (!apiKey) {
      throw new Error('No API key available');
    }
    
    // Prepare the prompt for OpenAI
    const prompt = `
      Based on the following financial data, generate 5 personalized financial insights:
      
      Income: ${financialData.income || 'Not provided'}
      
      Expenses: ${JSON.stringify(financialData.expenses?.slice(0, 10) || [])}
      
      Budgets: ${JSON.stringify(financialData.budgets || [])}
      
      Savings Goals: ${JSON.stringify(financialData.savingsGoals || [])}
      
      Generate insights that are actionable, specific, and helpful for financial planning.
      Each insight should include:
      - A title
      - A detailed description
      - A type (tip, warning, achievement, or recommendation)
      - A priority (high, medium, or low)
      - A category (spending, saving, budget, income, or debt)
      - Whether it's actionable
      - An action if applicable (with a label and screen to navigate to)
      
      Format the response as a JSON array of objects.
    `;
    
    // Call OpenAI API
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a financial advisor assistant that generates personalized financial insights based on user data.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse the response and format as FinancialInsight[]
    let aiInsights: FinancialInsight[] = [];
    
    try {
      const content = data.choices[0].message.content;
      // Extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      
      const parsedInsights = JSON.parse(jsonString);
      
      // Format and validate each insight
      aiInsights = parsedInsights.map((insight: any, index: number) => ({
        id: `ai-insight-${Date.now()}-${index}`,
        title: insight.title || 'Financial Insight',
        description: insight.description || 'No description provided',
        type: ['tip', 'warning', 'achievement', 'recommendation'].includes(insight.type) 
          ? insight.type 
          : 'tip',
        priority: ['high', 'medium', 'low'].includes(insight.priority) 
          ? insight.priority 
          : 'medium',
        category: insight.category || 'general',
        actionable: Boolean(insight.actionable),
        action: insight.action ? {
          label: insight.action.label || 'Take Action',
          screen: mapScreenName(insight.action.screen),
          params: insight.action.params || {}
        } : undefined,
        createdAt: new Date().toISOString(),
      }));
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      // Fall back to rule-based insights
      return generateFinancialInsights(financialData);
    }
    
    // Track feature engagement
    trackFeatureEngagement('ai_insights', FeedbackContext.INSIGHTS);
    
    return aiInsights;
  } catch (error) {
    console.error('Error getting AI financial insights:', error);
    throw error;
  }
};

/**
 * Maps API response screen names to actual navigation screen names
 * @param screenName The screen name from the API response
 * @returns The correct navigation screen name
 */
const mapScreenName = (screenName: string | undefined): string => {
  if (!screenName) return 'Home';
  
  // Map common screen names to their correct navigation targets
  const screenMap: Record<string, string> = {
    'BudgetScreen': 'Budget',
    'ExpensesScreen': 'Expenses',
    'SavingsScreen': 'Savings',
    'HomeScreen': 'Home',
    'SettingsScreen': 'Settings',
    'ProfileScreen': 'Profile',
    'InsightsScreen': 'Insights',
    'EducationScreen': 'Learn',
    'LearnScreen': 'Learn',
    'AnalyticsScreen': 'ExpenseAnalytics',
    'ExpenseAnalyticsScreen': 'ExpenseAnalytics',
    'Savings Goals': 'Savings',
    'SavingsGoals': 'Savings',
    'Budgets': 'Budget',
  };
  
  return screenMap[screenName] || screenName;
};

export default {
  getFinancialAdvice,
  getUserLocationData,
  analyzeSpendingPatterns,
  generateFinancialInsights,
  getAIFinancialInsights,
  setApiKey,
  getApiKey,
  clearApiKey
}; 