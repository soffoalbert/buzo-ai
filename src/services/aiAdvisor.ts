import * as SecureStore from 'expo-secure-store';

// API key storage key
const API_KEY_STORAGE_KEY = 'buzo_openai_api_key';

// Base URL for OpenAI API
const API_URL = 'https://api.openai.com/v1/chat/completions';

// Import types from FinancialInsights component
import { FinancialInsight } from '../components/FinancialInsights';

// Default API key (replace with your actual OpenAI API key)
const DEFAULT_API_KEY = process.env.OPENAI_API_KEY;

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
}

// Interface for advice request
interface AdviceRequest {
  type: 'budget' | 'expense' | 'savings' | 'general';
  financialData: FinancialData;
  question?: string;
}

/**
 * Set the OpenAI API key securely
 * @param apiKey The OpenAI API key
 */
export const setApiKey = async (apiKey: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey);
  } catch (error) {
    console.error('Error storing API key:', error);
    throw error;
  }
};

/**
 * Get the stored OpenAI API key
 * @returns The stored API key or the default key if not found
 */
export const getApiKey = async (): Promise<string | null> => {
  try {
    // First try to get a user-provided key
    const userKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
    
    // If user has provided a key, use that, otherwise use the default key
    return userKey || DEFAULT_API_KEY;
  } catch (error) {
    console.error('Error retrieving API key:', error);
    // Return the default key as fallback
    return DEFAULT_API_KEY;
  }
};

/**
 * Clear the stored OpenAI API key
 */
export const clearApiKey = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing API key:', error);
    throw error;
  }
};

/**
 * Get personalized financial advice based on user data
 * @param request The advice request containing financial data and question
 * @returns The AI-generated advice
 */
export const getFinancialAdvice = async (request: AdviceRequest): Promise<string> => {
  try {
    // Get API key (will use default key if user hasn't provided one)
    const apiKey = await getApiKey();
    
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
            content: 'You are Buzo, a helpful and friendly financial advisor for young South Africans. Provide clear, actionable advice tailored to their financial situation. Use simple language and avoid jargon. Focus on practical tips that can be implemented immediately. Be encouraging and positive, but realistic.'
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
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error getting financial advice:', error);
    
    // If there's an error with the API call, fall back to rule-based advice
    return generateFallbackAdvice(request.financialData, request.type, request.question);
  }
};

/**
 * Create a prompt for budget advice
 * @param financialData User's financial data
 * @param question Optional specific question
 * @returns Formatted prompt for the AI
 */
const createBudgetPrompt = (financialData: FinancialData, question?: string): string => {
  const { income, budgets } = financialData;
  
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
  const { expenses } = financialData;
  
  let prompt = `I need advice on my expenses. `;
  
  if (expenses && expenses.length > 0) {
    prompt += `My recent expenses are: `;
    expenses.forEach(expense => {
      prompt += `${expense.title} (${expense.category}): R${expense.amount} on ${expense.date}, `;
    });
    prompt = prompt.slice(0, -2) + '. ';
  }
  
  if (question) {
    prompt += `Specifically, I want to know: ${question}`;
  } else {
    prompt += `Can you identify any spending patterns or areas where I could cut back?`;
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
  const { income, savingsGoals } = financialData;
  
  let prompt = `I need advice on my savings goals. `;
  
  if (income) {
    prompt += `My monthly income is R${income}. `;
  }
  
  if (savingsGoals && savingsGoals.length > 0) {
    prompt += `My savings goals are: `;
    savingsGoals.forEach(goal => {
      prompt += `${goal.title}: R${goal.current} saved of R${goal.target} target by ${goal.deadline}, `;
    });
    prompt = prompt.slice(0, -2) + '. ';
  }
  
  if (question) {
    prompt += `Specifically, I want to know: ${question}`;
  } else {
    prompt += `Can you suggest strategies to help me reach my savings goals faster?`;
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
  const { income, expenses, budgets, savingsGoals } = financialData;
  
  let prompt = `I need general financial advice. `;
  
  if (income) {
    prompt += `My monthly income is R${income}. `;
  }
  
  if (expenses && expenses.length > 0) {
    prompt += `I have ${expenses.length} recorded expenses in the last month. `;
  }
  
  if (budgets && budgets.length > 0) {
    prompt += `I have budgets for ${budgets.map(b => b.category).join(', ')}. `;
  }
  
  if (savingsGoals && savingsGoals.length > 0) {
    prompt += `I'm saving for ${savingsGoals.map(g => g.title).join(', ')}. `;
  }
  
  if (question) {
    prompt += `Specifically, I want to know: ${question}`;
  } else {
    prompt += `Can you provide some general financial tips that would be helpful for a young person in South Africa?`;
  }
  
  return prompt;
};

/**
 * Generate personalized financial insights based on user data
 * @param financialData User's financial data
 * @returns Array of financial insights
 */
export const generateFinancialInsights = async (financialData: FinancialData): Promise<FinancialInsight[]> => {
  try {
    // In a production app, this would call the OpenAI API to generate insights
    // For now, we'll generate insights based on simple rules
    
    const insights: FinancialInsight[] = [];
    const now = new Date();
    
    // Check budget utilization
    if (financialData.budgets && financialData.budgets.length > 0) {
      for (const budget of financialData.budgets) {
        const utilization = (budget.spent / budget.limit) * 100;
        
        // High budget utilization warning
        if (utilization > 90 && utilization < 100) {
          insights.push({
            id: `budget-warning-${budget.category}`,
            title: `${budget.category} budget almost depleted`,
            description: `You've used ${utilization.toFixed(0)}% of your ${budget.category} budget. Consider adjusting your spending for the rest of the month.`,
            type: 'warning',
            priority: 'high',
            category: budget.category,
            actionable: true,
            action: {
              label: 'View budget',
              screen: 'BudgetScreen',
              params: { category: budget.category },
            },
            createdAt: now.toISOString(),
            read: false,
          });
        }
        
        // Budget exceeded warning
        if (utilization >= 100) {
          insights.push({
            id: `budget-exceeded-${budget.category}`,
            title: `${budget.category} budget exceeded`,
            description: `You've exceeded your ${budget.category} budget by R${(budget.spent - budget.limit).toFixed(2)}. Try to avoid additional expenses in this category.`,
            type: 'warning',
            priority: 'high',
            category: budget.category,
            actionable: true,
            action: {
              label: 'View budget',
              screen: 'BudgetScreen',
              params: { category: budget.category },
            },
            createdAt: now.toISOString(),
            read: false,
          });
        }
        
        // Low budget utilization tip
        if (utilization < 30 && budget.category !== 'Savings') {
          insights.push({
            id: `budget-underused-${budget.category}`,
            title: `${budget.category} budget underutilized`,
            description: `You've only used ${utilization.toFixed(0)}% of your ${budget.category} budget. Consider reallocating some funds to savings or debt repayment.`,
            type: 'tip',
            priority: 'medium',
            category: budget.category,
            actionable: true,
            action: {
              label: 'Adjust budget',
              screen: 'BudgetScreen',
              params: { category: budget.category },
            },
            createdAt: now.toISOString(),
            read: false,
          });
        }
      }
    }
    
    // Check savings goals progress
    if (financialData.savingsGoals && financialData.savingsGoals.length > 0) {
      for (const goal of financialData.savingsGoals) {
        const progress = (goal.current / goal.target) * 100;
        const deadline = new Date(goal.deadline);
        const timeLeft = deadline.getTime() - now.getTime();
        const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
        
        // Savings goal milestone achievement
        if (progress >= 50 && progress < 75) {
          insights.push({
            id: `savings-milestone-${goal.title}`,
            title: `Halfway to your ${goal.title} goal!`,
            description: `You're ${progress.toFixed(0)}% of the way to your ${goal.title} savings goal. Keep it up!`,
            type: 'achievement',
            priority: 'medium',
            category: 'Savings',
            actionable: true,
            action: {
              label: 'View goal',
              screen: 'SavingsScreen',
              params: { goalId: goal.title },
            },
            createdAt: now.toISOString(),
            read: false,
          });
        }
        
        // Savings goal almost complete
        if (progress >= 75 && progress < 100) {
          insights.push({
            id: `savings-almost-${goal.title}`,
            title: `Almost there: ${goal.title}`,
            description: `You're ${progress.toFixed(0)}% of the way to your ${goal.title} savings goal. Just R${(goal.target - goal.current).toFixed(2)} to go!`,
            type: 'achievement',
            priority: 'high',
            category: 'Savings',
            actionable: true,
            action: {
              label: 'View goal',
              screen: 'SavingsScreen',
              params: { goalId: goal.title },
            },
            createdAt: now.toISOString(),
            read: false,
          });
        }
        
        // Savings goal deadline approaching
        if (daysLeft > 0 && daysLeft <= 30 && progress < 90) {
          insights.push({
            id: `savings-deadline-${goal.title}`,
            title: `${goal.title} deadline approaching`,
            description: `Your ${goal.title} savings goal deadline is in ${daysLeft} days, but you're only ${progress.toFixed(0)}% there. Consider increasing your contributions.`,
            type: 'warning',
            priority: 'high',
            category: 'Savings',
            actionable: true,
            action: {
              label: 'View goal',
              screen: 'SavingsScreen',
              params: { goalId: goal.title },
            },
            createdAt: now.toISOString(),
            read: false,
          });
        }
      }
    }
    
    // Analyze expense patterns
    if (financialData.expenses && financialData.expenses.length > 0) {
      // Group expenses by category
      const categoryTotals: Record<string, number> = {};
      for (const expense of financialData.expenses) {
        categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
      }
      
      // Find the highest spending category
      let highestCategory = '';
      let highestAmount = 0;
      for (const [category, amount] of Object.entries(categoryTotals)) {
        if (amount > highestAmount) {
          highestCategory = category;
          highestAmount = amount;
        }
      }
      
      // High spending in a category
      if (highestCategory && highestAmount > 0) {
        // Only add this insight if the highest category is not savings or investments
        if (!['Savings', 'Investments'].includes(highestCategory)) {
          insights.push({
            id: `high-spending-${highestCategory}`,
            title: `High spending on ${highestCategory}`,
            description: `You've spent R${highestAmount.toFixed(2)} on ${highestCategory} recently. This is your highest spending category.`,
            type: 'recommendation',
            priority: 'medium',
            category: highestCategory,
            actionable: true,
            action: {
              label: 'View expenses',
              screen: 'ExpensesScreen',
              params: { category: highestCategory },
            },
            createdAt: now.toISOString(),
            read: false,
          });
        }
      }
      
      // Check for frequent small expenses (e.g., coffee, snacks)
      const smallExpenses = financialData.expenses.filter(e => e.amount < 100);
      if (smallExpenses.length >= 10) {
        insights.push({
          id: 'small-expenses',
          title: 'Small expenses adding up',
          description: `You've made ${smallExpenses.length} small purchases recently, totaling R${smallExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}. These small expenses can add up quickly.`,
          type: 'tip',
          priority: 'medium',
          actionable: true,
          action: {
            label: 'View expenses',
            screen: 'ExpensesScreen',
            params: { minAmount: 0, maxAmount: 100 },
          },
          createdAt: now.toISOString(),
          read: false,
        });
      }
    }
    
    // Analyze income vs. expenses
    if (financialData.income && financialData.expenses) {
      const totalExpenses = financialData.expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const savingsRate = ((financialData.income - totalExpenses) / financialData.income) * 100;
      
      // Low savings rate
      if (savingsRate < 10 && savingsRate >= 0) {
        insights.push({
          id: 'low-savings-rate',
          title: 'Increase your savings rate',
          description: `You're currently saving only ${savingsRate.toFixed(1)}% of your income. Financial experts recommend saving at least 20% of your income.`,
          type: 'recommendation',
          priority: 'high',
          category: 'Savings',
          actionable: true,
          action: {
            label: 'View budget',
            screen: 'BudgetScreen',
            params: {},
          },
          createdAt: now.toISOString(),
          read: false,
        });
      }
      
      // Negative savings rate (spending more than earning)
      if (savingsRate < 0) {
        insights.push({
          id: 'negative-savings',
          title: 'Spending exceeds income',
          description: `You're spending more than you earn. Consider reducing expenses or finding additional income sources to avoid debt.`,
          type: 'warning',
          priority: 'high',
          actionable: true,
          action: {
            label: 'View expenses',
            screen: 'ExpensesScreen',
            params: {},
          },
          createdAt: now.toISOString(),
          read: false,
        });
      }
      
      // Good savings rate achievement
      if (savingsRate >= 20) {
        insights.push({
          id: 'good-savings-rate',
          title: 'Excellent savings rate',
          description: `You're saving ${savingsRate.toFixed(1)}% of your income. Great job maintaining financial discipline!`,
          type: 'achievement',
          priority: 'medium',
          category: 'Savings',
          actionable: false,
          createdAt: now.toISOString(),
          read: false,
        });
      }
    }
    
    // Add general financial tips
    const generalTips = [
      {
        id: 'tip-emergency-fund',
        title: 'Build an emergency fund',
        description: 'Aim to save 3-6 months of living expenses in an easily accessible account for emergencies.',
        type: 'tip' as const,
        priority: 'medium' as const,
        category: 'Savings',
        actionable: true,
        action: {
          label: 'Create savings goal',
          screen: 'SavingsScreen',
          params: { createNew: true, suggested: 'Emergency Fund' },
        },
        createdAt: now.toISOString(),
        read: false,
      },
      {
        id: 'tip-50-30-20',
        title: 'Try the 50/30/20 budget rule',
        description: 'Allocate 50% of income to needs, 30% to wants, and 20% to savings and debt repayment.',
        type: 'tip' as const,
        priority: 'low' as const,
        category: 'Budget',
        actionable: true,
        action: {
          label: 'Adjust budget',
          screen: 'BudgetScreen',
          params: {},
        },
        createdAt: now.toISOString(),
        read: false,
      },
      {
        id: 'tip-automate-savings',
        title: 'Automate your savings',
        description: 'Set up automatic transfers to your savings account on payday to make saving effortless.',
        type: 'tip' as const,
        priority: 'low' as const,
        category: 'Savings',
        actionable: false,
        createdAt: now.toISOString(),
        read: false,
      },
    ];
    
    // Add 1-2 general tips if we have few insights
    if (insights.length < 3) {
      insights.push(...generalTips.slice(0, 3 - insights.length));
    }
    
    // Sort insights by priority and date
    return insights.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
  } catch (error) {
    console.error('Error generating financial insights:', error);
    return [];
  }
};

/**
 * Get financial insights with AI-powered analysis
 * @param financialData User's financial data
 * @returns Array of financial insights
 */
export const getAIFinancialInsights = async (financialData: FinancialData): Promise<FinancialInsight[]> => {
  try {
    const apiKey = await getApiKey();
    
    if (!apiKey) {
      // Fall back to rule-based insights if no API key
      return generateFinancialInsights(financialData);
    }

    // Create a prompt for generating insights
    const prompt = createInsightsPrompt(financialData);

    // Call the OpenAI API
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a financial insights generator for young South Africans. 
            Analyze financial data and generate personalized insights, tips, warnings, achievements, and recommendations.
            Your response should be in JSON format as an array of insight objects with the following structure:
            [
              {
                "id": "unique-id",
                "title": "Short, catchy title",
                "description": "Detailed explanation (1-2 sentences)",
                "type": "tip|warning|achievement|recommendation",
                "priority": "high|medium|low",
                "category": "Category name or null",
                "actionable": true|false,
                "action": {
                  "label": "Action button text",
                  "screen": "ScreenName",
                  "params": {}
                } or null if not actionable,
                "createdAt": "ISO date string",
                "read": false
              }
            ]
            Generate 3-5 high-quality, personalized insights based on the data provided.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const insightsText = data.choices[0].message.content.trim();
    
    try {
      // Parse the JSON response
      const parsedInsights = JSON.parse(insightsText);
      
      // Ensure the response is an array of insights
      if (Array.isArray(parsedInsights)) {
        return parsedInsights;
      } else if (parsedInsights.insights && Array.isArray(parsedInsights.insights)) {
        return parsedInsights.insights;
      } else {
        throw new Error('Invalid insights format');
      }
    } catch (parseError) {
      console.error('Error parsing insights:', parseError);
      // Fall back to rule-based insights
      return generateFinancialInsights(financialData);
    }
  } catch (error) {
    console.error('Error getting AI financial insights:', error);
    // Fall back to rule-based insights
    return generateFinancialInsights(financialData);
  }
};

/**
 * Create a prompt for generating financial insights
 * @param financialData User's financial data
 * @returns Formatted prompt for the AI
 */
const createInsightsPrompt = (financialData: FinancialData): string => {
  const { income, expenses, budgets, savingsGoals, historicalExpenses, historicalIncome } = financialData;
  
  let prompt = `I need personalized financial insights based on my data. `;
  
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
  
  if (expenses && expenses.length > 0) {
    prompt += `My recent expenses are: `;
    expenses.forEach(expense => {
      prompt += `${expense.title} (${expense.category}): R${expense.amount} on ${expense.date}, `;
    });
    prompt = prompt.slice(0, -2) + '. ';
  }
  
  if (savingsGoals && savingsGoals.length > 0) {
    prompt += `My savings goals are: `;
    savingsGoals.forEach(goal => {
      prompt += `${goal.title}: R${goal.current} saved of R${goal.target} target by ${goal.deadline}, `;
    });
    prompt = prompt.slice(0, -2) + '. ';
  }
  
  if (historicalExpenses && historicalExpenses.length > 0) {
    prompt += `My historical monthly expenses are: `;
    historicalExpenses.forEach(month => {
      prompt += `${month.month}: R${month.totalAmount}, `;
    });
    prompt = prompt.slice(0, -2) + '. ';
  }
  
  if (historicalIncome && historicalIncome.length > 0) {
    prompt += `My historical monthly income is: `;
    historicalIncome.forEach(month => {
      prompt += `${month.month}: R${month.amount}, `;
    });
    prompt = prompt.slice(0, -2) + '. ';
  }
  
  prompt += `Please analyze this data and generate personalized financial insights, including tips, warnings, achievements, and recommendations. Focus on actionable advice that can help me improve my financial health.`;
  
  return prompt;
};

/**
 * Generate fallback advice when the API call fails
 * @param financialData User's financial data
 * @param type Type of advice requested
 * @param question Optional question from the user
 * @returns Rule-based financial advice
 */
const generateFallbackAdvice = (
  financialData: FinancialData, 
  type: AdviceRequest['type'], 
  question?: string
): string => {
  // Default response if we can't determine specific advice
  let advice = "I'm sorry, I couldn't connect to my knowledge base at the moment. Here are some general financial tips:\n\n" +
    "• Create a budget and track your expenses regularly\n" +
    "• Try to save at least 10-20% of your income\n" +
    "• Build an emergency fund covering 3-6 months of expenses\n" +
    "• Reduce unnecessary expenses and focus on needs before wants\n" +
    "• Consider low-cost investment options for long-term goals";
  
  // If we have financial data, try to provide more specific advice
  if (financialData) {
    const { expenses, budgets, savingsGoals } = financialData;
    
    // Check if user is overspending in any category
    if (budgets && budgets.length > 0) {
      const overspentCategories = budgets.filter(b => b.spent > b.limit);
      
      if (overspentCategories.length > 0) {
        const categories = overspentCategories.map(c => c.category).join(', ');
        advice = `I notice you're overspending in these categories: ${categories}. Consider reviewing your expenses in these areas and finding ways to reduce costs.`;
        return advice;
      }
    }
    
    // Check if user has savings goals that need attention
    if (savingsGoals && savingsGoals.length > 0) {
      const behindGoals = savingsGoals.filter(g => {
        const deadline = new Date(g.deadline);
        const today = new Date();
        const timeLeft = deadline.getTime() - today.getTime();
        const daysLeft = timeLeft / (1000 * 3600 * 24);
        
        // Calculate expected progress based on time elapsed
        const totalDays = (deadline.getTime() - new Date(g.deadline).getTime()) / (1000 * 3600 * 24);
        const expectedProgress = (totalDays - daysLeft) / totalDays;
        const actualProgress = g.current / g.target;
        
        return actualProgress < expectedProgress * 0.8; // 20% behind schedule
      });
      
      if (behindGoals.length > 0) {
        const goalNames = behindGoals.map(g => g.title).join(', ');
        advice = `You might need to focus more on these savings goals: ${goalNames}. Try increasing your contributions to stay on track.`;
        return advice;
      }
    }
  }
  
  // Type-specific generic advice if we don't have enough data for personalized advice
  switch (type) {
    case 'budget':
      advice = "To improve your budget, try using the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings and debt repayment. Review your expenses regularly and look for areas where you can cut back.";
      break;
    case 'expense':
      advice = "To reduce expenses, consider meal planning to save on food costs, use public transportation when possible, review and cancel unused subscriptions, and look for more affordable alternatives for regular purchases.";
      break;
    case 'savings':
      advice = "To boost your savings, set up automatic transfers to your savings account on payday, challenge yourself to no-spend days, save windfalls like bonuses or tax refunds, and consider a side hustle for extra income.";
      break;
  }
  
  return advice;
};

export default {
  setApiKey,
  getApiKey,
  clearApiKey,
  getFinancialAdvice,
}; 