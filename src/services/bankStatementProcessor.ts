import * as FileSystem from 'expo-file-system';
import { supabase } from '../api/supabaseClient';
import { getApiKey as getManagerApiKey } from './apiKeyManager';
import { getGlobalApiKey } from './devApiKeyManager';
import { getVaultSecret } from '../api/supabaseClient';
import { getBankStatementById, BankStatement } from './bankStatementService';
import { getUserId } from './authService';
import { Alert } from 'react-native';
import { extractTextFromPdf, extractTextFromPdfWithFallback, preprocessBankStatementText } from './pdfTextExtractor';

// Define the transaction category types
export type TransactionCategory = 
  'groceries' | 
  'transportation' | 
  'housing' | 
  'utilities' | 
  'dining' | 
  'entertainment' | 
  'shopping' | 
  'healthcare' | 
  'education' | 
  'savings' | 
  'income' | 
  'other';

// Define the Transaction interface
export interface Transaction {
  id: string;
  user_id: string;
  statement_id: string;
  date: string;
  description: string;
  amount: number;
  category: TransactionCategory;
  is_expense: boolean;
  created_at: string;
  updated_at: string;
}

// Define the BankStatementAnalysis interface
export interface BankStatementAnalysis {
  id: string;
  statement_id: string;
  user_id: string;
  total_income: number;
  total_expenses: number;
  category_breakdown: Record<TransactionCategory, number>;
  insights: string[];
  processed_date: string;
}

// Whether to use global API keys (for development)
const USE_GLOBAL_API_KEYS = true;

// Vault secret name for OpenAI API key
const VAULT_SECRET_NAME = 'OPENAI_API_KEY';

/**
 * Get the API key from various sources
 * Prioritizes global API key during development
 */
const getApiKey = async (): Promise<string | null> => {
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
 * Helper function to ensure TypeScript recognizes a string is not null
 * Returns a properly typed string that TypeScript can understand
 */
const ensureString = (value: string | null): string => {
  if (value === null || value === undefined) {
    throw new Error('String value is null or undefined');
  }
  return value;
};

/**
 * Helper function to safely read a file from FileSystem
 */
const safeReadFile = async (path: string | null, options: FileSystem.ReadingOptions): Promise<string> => {
  if (!path) {
    throw new Error('File path is null or undefined');
  }
  return await FileSystem.readAsStringAsync(path, options);
};

/**
 * Helper function to safely create a signed URL
 */
const safeCreateSignedUrl = async (path: string | null, expirySeconds: number) => {
  if (!path) {
    throw new Error('File path is null or undefined');
  }
  return await supabase.storage
    .from('user-documents')
    .createSignedUrl(path, expirySeconds);
};

// Mark bank statement processing as coming soon
export const processBankStatement = async (statementId: string): Promise<Transaction[]> => {
  console.log('Bank statement processing is coming soon!', { statementId });
  // Return an empty array of transactions
  return [];
};

/**
 * Update the status of a bank statement
 * @param statementId ID of the statement to update
 * @param status New status
 */
const updateStatementStatus = async (statementId: string, status: 'pending' | 'processing' | 'processed' | 'error'): Promise<void> => {
  try {
    const userId = await getUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    // Check if this is a local statement
    const localStatementsJson = await FileSystem.readAsStringAsync(
      `${FileSystem.documentDirectory}localBankStatements.json`,
      { encoding: FileSystem.EncodingType.UTF8 }
    ).catch(() => '[]');
    
    const localStatements = JSON.parse(localStatementsJson);
    const localStatementIndex = localStatements.findIndex(
      (s: BankStatement) => s.id === statementId && s.user_id === userId
    );
    
    if (localStatementIndex >= 0) {
      // Update local statement
      localStatements[localStatementIndex].status = status;
      await FileSystem.writeAsStringAsync(
        `${FileSystem.documentDirectory}localBankStatements.json`,
        JSON.stringify(localStatements),
        { encoding: FileSystem.EncodingType.UTF8 }
      );
    } else {
      // Update in Supabase
      const { error } = await supabase
        .from('bank_statements')
        .update({ status })
        .eq('id', statementId)
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error updating bank statement status:', error);
      }
    }
  } catch (error) {
    console.error('Error updating statement status:', error);
  }
};

/**
 * Extract transactions from a bank statement using GPT-4o
 * @param fileContent Base64 encoded file content or extracted text
 * @param fileType Type of file (pdf or text)
 * @param statementId ID of the bank statement
 * @param userId ID of the user
 * @returns Promise resolving to an array of transactions
 */
const extractTransactionsWithGPT = async (
  fileContent: string,
  fileType: 'pdf' | 'text',
  statementId: string,
  userId: string,
  filePath?: string
): Promise<Omit<Transaction, 'category' | 'id' | 'created_at' | 'updated_at'>[]> => {
  try {
    // Get API key
    const apiKey = await getApiKey();
    
    // Check if API key exists and is not the default placeholder key
    if (!apiKey || apiKey === 'sk-yourTestApiKeyHere' || apiKey.startsWith('sk-yourT')) {
      console.log("No valid API key available, using mock data for demonstration");
      // Return mock data for testing/demo when no API key is available
      return getMockTransactionData(userId, statementId);
    }
    
    // We'll use GPT-4o to extract transactions
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    // Create the prompt specifically for bank statement transaction extraction
    const prompt = `
      You are a financial data extractor. 
      I'm providing you with a bank statement ${fileType === 'text' ? 'text' : 'PDF'}.
      
      Your task is to extract all transactions from this statement accurately.
      
      For each transaction, extract:
      1. Date (in YYYY-MM-DD format)
      2. Description/Merchant name
      3. Amount (as a numeric value, positive for deposits/income, negative for withdrawals/expenses)
      
      Format your response as a JSON array of objects with the following structure:
      [
        {
          "date": "YYYY-MM-DD",
          "description": "Transaction description",
          "amount": 123.45,
          "is_expense": true/false
        }
      ]
      
      Where "is_expense" is true for withdrawals and false for deposits.
      
      Important guidelines:
      - Ensure all dates are in YYYY-MM-DD format
      - Extract ALL transactions visible in the document
      - Do not make up or hallucinate transactions
      - Ensure the amount is a number (not a string)
      - Include the negative sign for expense amounts
      - Set is_expense based on whether the amount is negative or a withdrawal
    `;
    
    // Create the request payload based on the input type
    let payload;
    
    if (fileType === 'text') {
      // Using extracted text - standard chat completion without Vision API
      payload = {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a financial data extraction assistant that accurately extracts transaction data from bank statements."
          },
          {
            role: "user",
            content: `${prompt}\n\nHere is the extracted bank statement text:\n\n${fileContent}`
          }
        ],
        max_tokens: 4000
      };
      
      console.log("Using extracted text for transaction processing");
    } else {
      // Using PDF as image with Vision API
      payload = {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a financial data extraction assistant that accurately extracts transaction data from bank statements."
          },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  // Use the correct format for PDFs in the Vision API
                  url: `data:application/pdf;base64,${fileContent}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000
      };
      
      console.log("Using Vision API for transaction processing");
    }
    
    // Make the API request
    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('First API attempt failed:', errorData);
        
        // If we were using extracted text and it failed, try the Vision API
        if (fileType === 'text') {
          console.log("Text-based approach failed, trying Vision API");
          
          const visionPayload = {
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "You are a financial data extraction assistant that accurately extracts transaction data from bank statements."
              },
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:application/pdf;base64,${fileContent}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 4000
          };
          
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(visionPayload)
          });
          
          if (!response.ok) {
            throw new Error(`Vision API fallback failed: ${await response.text()}`);
          }
        } 
        // If we were using Vision API with PNG and it failed, try with JPEG
        else {
          console.log("Trying with different MIME type (jpeg)");
          const secondPayload = {
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "You are a financial data extraction assistant that accurately extracts transaction data from bank statements."
              },
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${fileContent}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 4000
          };
          
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(secondPayload)
          });
          
          if (!response.ok) {
            throw new Error(`JPEG fallback failed: ${await response.text()}`);
          }
        }
      }
    } catch (fetchError) {
      console.error('All API attempts failed:', fetchError);
      console.log("Falling back to mock data");
      return getMockTransactionData(userId, statementId);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Extract JSON from the response
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
    const jsonString = jsonMatch ? jsonMatch[1] : content;
    
    try {
      // Parse the extracted transactions
      const extractedTransactions = JSON.parse(jsonString);
      
      // Validate and format transactions
      return extractedTransactions.map((transaction: any) => ({
        user_id: userId,
        statement_id: statementId,
        date: transaction.date,
        description: transaction.description,
        amount: parseFloat(transaction.amount),
        is_expense: transaction.is_expense === true || parseFloat(transaction.amount) < 0
      }));
    } catch (parseError) {
      console.error('Error parsing transaction data:', parseError);
      
      // Try to extract any JSON-like content from the response
      try {
        const anyJson = content.match(/\[\s*\{.*\}\s*\]/s);
        if (anyJson) {
          const extractedTransactions = JSON.parse(anyJson[0]);
          
          return extractedTransactions.map((transaction: any) => ({
            user_id: userId,
            statement_id: statementId,
            date: transaction.date || new Date().toISOString().split('T')[0],
            description: transaction.description || 'Unknown transaction',
            amount: parseFloat(transaction.amount) || 0,
            is_expense: transaction.is_expense === true || parseFloat(transaction.amount) < 0
          }));
        }
      } catch (secondParseError) {
        console.error('Failed second parse attempt:', secondParseError);
      }
      
      // Fall back to mock data as a last resort
      console.log("All parsing attempts failed, using mock data");
      return getMockTransactionData(userId, statementId);
    }
  } catch (error) {
    console.error('Error extracting transactions with AI:', error);
    // Fall back to mock data
    return getMockTransactionData(userId, statementId);
  }
};

/**
 * Categorize transactions using GPT
 * @param transactions Array of transactions to categorize
 * @returns Promise resolving to categorized transactions
 */
const categorizeTransactions = async (
  transactions: Omit<Transaction, 'category' | 'id' | 'created_at' | 'updated_at'>[]
): Promise<Transaction[]> => {
  try {
    // Get API key
    const apiKey = await getApiKey();
    
    // Check if API key exists and is not the default placeholder key
    if (!apiKey || apiKey === 'sk-yourTestApiKeyHere' || apiKey.startsWith('sk-yourT')) {
      console.log("No valid API key available, using mock categorization");
      // Return mock categorized data for testing/demo
      const categorized: Transaction[] = transactions.map(transaction => {
        let category: TransactionCategory = 'other';
        
        // Simple rule-based categorization
        const description = transaction.description.toLowerCase();
        
        if (description.includes('salary') || 
            description.includes('payment received') || 
            description.includes('transfer from')) {
          category = 'income';
        } else if (description.includes('grocery') || 
                  description.includes('food') || 
                  description.includes('woolworths') || 
                  description.includes('checkers') || 
                  description.includes('pick n pay') || 
                  description.includes('spar')) {
          category = 'groceries';
        } else if (description.includes('uber') || 
                  description.includes('bolt') || 
                  description.includes('taxify') || 
                  description.includes('petrol') || 
                  description.includes('fuel')) {
          category = 'transportation';
        } else if (description.includes('rent') || 
                  description.includes('mortgage') || 
                  description.includes('home loan')) {
          category = 'housing';
        } else if (description.includes('electricity') || 
                  description.includes('water') || 
                  description.includes('vodacom') || 
                  description.includes('mtn') || 
                  description.includes('telkom') || 
                  description.includes('cell c')) {
          category = 'utilities';
        } else if (description.includes('restaurant') || 
                  description.includes('steers') || 
                  description.includes('nandos') || 
                  description.includes('kfc')) {
          category = 'dining';
        } else if (description.includes('movie') || 
                  description.includes('netflix') || 
                  description.includes('showmax') || 
                  description.includes('cinema')) {
          category = 'entertainment';
        } else if (description.includes('clicks') || 
                  description.includes('dischem') || 
                  description.includes('pharmacy') || 
                  description.includes('doctor')) {
          category = 'healthcare';
        } else if (description.includes('university') || 
                  description.includes('college') || 
                  description.includes('school') || 
                  description.includes('tuition')) {
          category = 'education';
        } else if (description.includes('savings') || 
                  description.includes('investment')) {
          category = 'savings';
        } else if (description.includes('mall') || 
                  description.includes('clothing') || 
                  description.includes('takealot') || 
                  description.includes('online shopping')) {
          category = 'shopping';
        }
        
        return {
          id: crypto.randomUUID ? crypto.randomUUID() : `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          user_id: transaction.user_id,
          statement_id: transaction.statement_id,
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          category,
          is_expense: transaction.is_expense,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });
      
      return categorized;
    }
    
    // Group transactions in batches of 50 to avoid token limits
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < transactions.length; i += batchSize) {
      batches.push(transactions.slice(i, i + batchSize));
    }
    
    let categorizedTransactions: Transaction[] = [];
    
    // Process each batch
    for (const batch of batches) {
      const apiUrl = 'https://api.openai.com/v1/chat/completions';
      
      // Create the prompt
      const prompt = `
        Categorize the following bank transactions into these categories:
        - groceries
        - transportation
        - housing
        - utilities
        - dining
        - entertainment
        - shopping
        - healthcare
        - education
        - savings
        - income
        - other
        
        Here are the transactions:
        ${JSON.stringify(batch, null, 2)}
        
        For each transaction, return the original transaction with an added "category" field.
        The response should be a JSON array of objects with all the original fields plus the category.
        
        Rules for categorization:
        1. Use the transaction description to determine the most appropriate category
        2. For deposits or positive amounts, check if they are salary/income related
        3. For unclear transactions, use "other" category
        4. Be specific - don't default to "other" if a more specific category applies
      `;
      
      // Make the API request
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a financial categorization assistant that accurately categorizes bank transactions."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 4000
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`AI API request failed: ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Extract JSON from the response
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      
      try {
        // Parse the categorized transactions
        const batchCategorized = JSON.parse(jsonString);
        
        // Add additional fields and validate
        const formattedBatch = batchCategorized.map((transaction: any) => ({
          id: crypto.randomUUID ? crypto.randomUUID() : `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          user_id: transaction.user_id,
          statement_id: transaction.statement_id,
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          category: transaction.category as TransactionCategory,
          is_expense: transaction.is_expense,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        
        categorizedTransactions = [...categorizedTransactions, ...formattedBatch];
      } catch (parseError) {
        console.error('Error parsing categorized transactions:', parseError);
        throw new Error('Failed to parse categorized transactions from AI response');
      }
    }
    
    return categorizedTransactions;
  } catch (error) {
    console.error('Error categorizing transactions:', error);
    
    // Fallback: assign "other" category if AI categorization fails
    return transactions.map(transaction => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      user_id: transaction.user_id,
      statement_id: transaction.statement_id,
      date: transaction.date,
      description: transaction.description,
      amount: transaction.amount,
      category: 'other' as TransactionCategory,
      is_expense: transaction.is_expense,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  }
};

/**
 * Save transactions to the database
 * @param transactions Array of transactions to save
 */
const saveTransactions = async (transactions: Transaction[]): Promise<void> => {
  try {
    // Get the current user ID
    const userId = await getUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    // Insert transactions in batches to avoid payload size limits
    const batchSize = 50;
    
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('transactions')
        .insert(batch);
      
      if (error) {
        console.error('Error saving transactions batch:', error);
        throw new Error(`Failed to save transactions: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error saving transactions:', error);
    throw error;
  }
};

/**
 * Generate analysis for a bank statement
 * @param statementId ID of the bank statement
 * @param transactions Array of transactions from the statement
 */
const generateStatementAnalysis = async (
  statementId: string,
  transactions: Transaction[]
): Promise<BankStatementAnalysis> => {
  try {
    // Get user ID
    const userId = await getUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    // Calculate total income and expenses
    const totalIncome = transactions
      .filter(t => !t.is_expense)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    
    const totalExpenses = transactions
      .filter(t => t.is_expense)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    
    // Calculate category breakdown
    const categoryBreakdown: Record<TransactionCategory, number> = {
      groceries: 0,
      transportation: 0,
      housing: 0,
      utilities: 0,
      dining: 0,
      entertainment: 0,
      shopping: 0,
      healthcare: 0,
      education: 0,
      savings: 0,
      income: 0,
      other: 0
    };
    
    transactions.forEach(transaction => {
      if (transaction.is_expense) {
        categoryBreakdown[transaction.category] += Math.abs(transaction.amount);
      } else if (transaction.category === 'income') {
        categoryBreakdown.income += Math.abs(transaction.amount);
      }
    });
    
    // Generate insights using GPT
    const insights = await generateInsightsWithGPT(transactions, totalIncome, totalExpenses, categoryBreakdown);
    
    // Create analysis object
    const analysis: BankStatementAnalysis = {
      id: crypto.randomUUID ? crypto.randomUUID() : `analysis-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      statement_id: statementId,
      user_id: userId,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      category_breakdown: categoryBreakdown,
      insights,
      processed_date: new Date().toISOString()
    };
    
    // Save analysis to database
    const { error } = await supabase
      .from('bank_statement_analyses')
      .insert([analysis]);
    
    if (error) {
      console.error('Error saving bank statement analysis:', error);
      throw new Error(`Failed to save analysis: ${error.message}`);
    }
    
    return analysis;
  } catch (error) {
    console.error('Error generating statement analysis:', error);
    throw error;
  }
};

/**
 * Generate insights for bank statement transactions using GPT
 * @param transactions Array of categorized transactions
 * @param totalIncome Total income from transactions
 * @param totalExpenses Total expenses from transactions
 * @param categoryBreakdown Breakdown of expenses by category
 * @returns Promise resolving to array of insights
 */
const generateInsightsWithGPT = async (
  transactions: Transaction[],
  totalIncome: number,
  totalExpenses: number,
  categoryBreakdown: Record<TransactionCategory, number>
): Promise<string[]> => {
  try {
    // Get API key
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.log("No API key available, providing generic insights");
      
      // Generate some basic insights based on the data
      const insights: string[] = [];
      
      // Income vs expenses
      if (totalIncome > totalExpenses) {
        const savingsRate = Math.round(((totalIncome - totalExpenses) / totalIncome) * 100);
        insights.push(`You saved R${(totalIncome - totalExpenses).toFixed(2)} this period (${savingsRate}% of income).`);
        
        if (savingsRate < 10) {
          insights.push("Your savings rate is below the recommended 10%. Try to increase your savings for better financial security.");
        } else if (savingsRate >= 20) {
          insights.push("Great job! You're saving more than 20% of your income, which is excellent for financial stability.");
        }
      } else {
        insights.push(`Your expenses exceeded your income by R${(totalExpenses - totalIncome).toFixed(2)} this period.`);
        insights.push("Your expenses are higher than your income. Focus on reducing non-essential expenses to create a balanced budget.");
      }
      
      // Top spending categories
      const categories = Object.entries(categoryBreakdown)
        .filter(([category]) => category !== 'income')
        .sort(([, a], [, b]) => b - a);
      
      if (categories.length > 0) {
        const [topCategory, topAmount] = categories[0];
        const topPercentage = totalExpenses > 0 ? Math.round((topAmount as number / totalExpenses) * 100) : 0;
        insights.push(`Your highest spending category was ${topCategory} at R${(topAmount as number).toFixed(2)} (${topPercentage}% of expenses).`);
        
        if (topPercentage > 30 && topCategory !== 'housing') {
          insights.push(`You're spending a significant portion of your budget on ${topCategory}. Consider finding ways to reduce this expense.`);
        }
      }
      
      // Check discretionary spending
      if (categoryBreakdown.dining > 0 && categoryBreakdown.entertainment > 0) {
        const discretionarySpending = categoryBreakdown.dining + categoryBreakdown.entertainment;
        const discretionaryPercentage = totalExpenses > 0 ? Math.round((discretionarySpending / totalExpenses) * 100) : 0;
        
        insights.push(`You spent R${discretionarySpending.toFixed(2)} on dining and entertainment (${discretionaryPercentage}% of expenses).`);
        
        if (discretionaryPercentage > 20) {
          insights.push("Your spending on dining and entertainment is quite high. Consider cooking at home more often to increase your savings.");
        }
      }
      
      // Add some generic advice
      insights.push("Consider creating a budget with the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings and debt repayment.");
      insights.push("Set up automatic transfers to your savings account on payday to build your emergency fund.");
      
      return insights;
    }
    
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    // Create the prompt
    const prompt = `
      Analyze these bank statement transactions and provide 3-5 helpful financial insights for a young South African user.
      
      Transaction Summary:
      - Total Income: R${totalIncome.toFixed(2)}
      - Total Expenses: R${totalExpenses.toFixed(2)}
      - Saving Rate: ${totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0}%
      
      Expense Breakdown by Category:
      ${Object.entries(categoryBreakdown)
        .filter(([category, amount]) => amount > 0)
        .map(([category, amount]) => `- ${category}: R${amount.toFixed(2)} (${totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0}%)`)
        .join('\n')}
      
      Top 10 Transactions:
      ${transactions
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
        .slice(0, 10)
        .map(t => `- ${t.date}: ${t.description} - R${Math.abs(t.amount).toFixed(2)} (${t.category})`)
        .join('\n')}
      
      Provide concise, actionable insights that will help the user understand their spending patterns and make better financial decisions.
      Each insight should be on a new line and should be specific to the data provided.
      
      Focus on:
      1. Spending patterns and potential areas to save
      2. Income vs expenses ratio and financial health
      3. Category-specific insights (e.g., "You spend X% on dining")
      4. Practical budgeting advice based on their actual spending
      
      Format as a simple array of insight strings.
    `;
    
    // Make the API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a financial insights assistant for young South Africans, providing practical and culturally relevant advice."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 2000
      })
    });
    
    if (!response.ok) {
      return generateBasicInsights(totalIncome, totalExpenses, categoryBreakdown);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Extract insights as separate lines, clean up any bullets or numbering
    const insights = content
      .split('\n')
      .filter((line: string) => line.trim().length > 0)
      .map((line: string) => line.replace(/^[•\-\d.)\s]+/, '').trim())
      .filter((line: string) => line.length > 10); // Filter out any too-short lines
    
    return insights;
  } catch (error) {
    console.error('Error generating insights with AI:', error);
    return generateBasicInsights(totalIncome, totalExpenses, categoryBreakdown);
  }
};

/**
 * Generate basic insights without using GPT
 * @param totalIncome Total income
 * @param totalExpenses Total expenses
 * @param categoryBreakdown Breakdown by category
 * @returns Array of basic insights
 */
const generateBasicInsights = (
  totalIncome: number,
  totalExpenses: number,
  categoryBreakdown: Record<TransactionCategory, number>
): string[] => {
  const insights = [];
  
  // Income vs expenses
  if (totalIncome > totalExpenses) {
    insights.push(`You saved R${(totalIncome - totalExpenses).toFixed(2)} this period (${Math.round(((totalIncome - totalExpenses) / totalIncome) * 100)}% of income).`);
  } else if (totalExpenses > totalIncome) {
    insights.push(`Your expenses exceeded your income by R${(totalExpenses - totalIncome).toFixed(2)} this period.`);
  }
  
  // Top spending categories
  const categories = Object.entries(categoryBreakdown)
    .filter(([category]) => category !== 'income')
    .sort(([, a], [, b]) => b - a);
  
  if (categories.length > 0) {
    const [topCategory, topAmount] = categories[0];
    insights.push(`Your highest spending category was ${topCategory} at R${topAmount.toFixed(2)} (${totalExpenses > 0 ? Math.round((topAmount / totalExpenses) * 100) : 0}% of expenses).`);
  }
  
  if (categories.length > 1) {
    const [, , thirdCategory, fourthCategory, fifthCategory] = categories;
    
    if (categoryBreakdown.dining > 0 && categoryBreakdown.entertainment > 0) {
      const discretionarySpending = categoryBreakdown.dining + categoryBreakdown.entertainment;
      insights.push(`You spent R${discretionarySpending.toFixed(2)} on dining and entertainment (${totalExpenses > 0 ? Math.round((discretionarySpending / totalExpenses) * 100) : 0}% of expenses).`);
    }
  }
  
  // Add a generic budgeting tip
  insights.push('Consider creating a budget with the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings and debt repayment.');
  
  return insights;
};

// Mark bank statement analysis as coming soon
export const getBankStatementAnalysis = async (statementId: string): Promise<BankStatementAnalysis | null> => {
  console.log('Bank statement analysis is coming soon!', { statementId });
  // Return null to indicate feature is not available
  return null;
};

// Mark bank statement transactions as coming soon
export const getBankStatementTransactions = async (statementId: string): Promise<Transaction[]> => {
  console.log('Bank statement transactions are coming soon!', { statementId });
  // Return an empty array of transactions
  return [];
};

/**
 * Create Supabase tables for bank statement processing if they don't exist
 */
export const setupBankStatementProcessingTables = async (): Promise<void> => {
  try {
    // Check if we're signed in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Not signed in, so we can't create tables
      return;
    }

    // Only proceed if the user has admin rights (you'd need to implement this check)
    // const isAdmin = await checkUserIsAdmin();
    // if (!isAdmin) return;
    
    // Create the transactions table if it doesn't exist
    const { error: txError } = await supabase.rpc('create_transactions_table_if_not_exists');
    
    if (txError) {
      console.error('Error creating transactions table:', txError);
    }
    
    // Create the bank_statement_analyses table if it doesn't exist
    const { error: analysisError } = await supabase.rpc('create_bank_statement_analyses_table_if_not_exists');
    
    if (analysisError) {
      console.error('Error creating bank_statement_analyses table:', analysisError);
    }
  } catch (error) {
    console.error('Error setting up bank statement processing tables:', error);
  }
};

/**
 * Get mock transaction data for testing and development
 */
const getMockTransactionData = (
  userId: string, 
  statementId: string
): Omit<Transaction, 'category' | 'id' | 'created_at' | 'updated_at'>[] => {
  return [
    {
      user_id: userId,
      statement_id: statementId,
      date: '2023-07-01',
      description: 'SALARY PAYMENT',
      amount: 12500.00,
      is_expense: false
    },
    {
      user_id: userId,
      statement_id: statementId,
      date: '2023-07-03',
      description: 'WOOLWORTHS SANDTON',
      amount: -875.50,
      is_expense: true
    },
    {
      user_id: userId,
      statement_id: statementId,
      date: '2023-07-05',
      description: 'UBER TRIP',
      amount: -145.00,
      is_expense: true
    },
    {
      user_id: userId,
      statement_id: statementId,
      date: '2023-07-07',
      description: 'NETFLIX SUBSCRIPTION',
      amount: -169.00,
      is_expense: true
    },
    {
      user_id: userId,
      statement_id: statementId,
      date: '2023-07-10',
      description: 'VODACOM AIRTIME',
      amount: -299.00,
      is_expense: true
    },
    {
      user_id: userId,
      statement_id: statementId,
      date: '2023-07-15',
      description: 'ATM WITHDRAWAL',
      amount: -1000.00,
      is_expense: true
    },
    {
      user_id: userId,
      statement_id: statementId,
      date: '2023-07-18',
      description: 'STEERS TAKEOUT',
      amount: -129.90,
      is_expense: true
    },
    {
      user_id: userId,
      statement_id: statementId,
      date: '2023-07-20',
      description: 'CLICKS PHARMACY',
      amount: -243.50,
      is_expense: true
    },
    {
      user_id: userId,
      statement_id: statementId,
      date: '2023-07-25',
      description: 'TRANSFER FROM SAVINGS',
      amount: 500.00,
      is_expense: false
    },
    {
      user_id: userId,
      statement_id: statementId,
      date: '2023-07-28',
      description: 'RENT PAYMENT',
      amount: -4500.00,
      is_expense: true
    }
  ];
};


export default {
  processBankStatement,
  getBankStatementAnalysis,
  getBankStatementTransactions,
  setupBankStatementProcessingTables
};
