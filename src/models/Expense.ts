export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  description?: string;
  receiptImage?: string; // Base64 encoded image or URI
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  tags?: string[];
  paymentMethod?: PaymentMethod;
  createdAt: string;
  updatedAt: string;
  // Integration fields
  budgetId?: string; // Associated budget ID
  impactsSavingsGoal?: boolean; // Whether this expense affects any savings goals
  linkedSavingsGoals?: string[]; // Array of affected savings goal IDs
  savingsContribution?: number; // If this is a savings contribution, the amount contributed
  isAutomatedSaving?: boolean; // Whether this is an automated savings transfer
  user_id?: string;
}

// Payment methods
export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  MOBILE_PAYMENT = 'mobile_payment',
  AUTOMATED_SAVING = 'automated_saving', // New payment method for automated savings
  OTHER = 'other',
}

// Expense filters
export interface ExpenseFilters {
  startDate?: string;
  endDate?: string;
  categories?: string[];
  minAmount?: number;
  maxAmount?: number;
  searchQuery?: string;
  paymentMethods?: PaymentMethod[];
  tags?: string[];
  budgetIds?: string[]; // Filter by associated budgets
  savingsGoalIds?: string[]; // Filter by associated savings goals
  includeAutomatedSavings?: boolean; // Whether to include automated savings transfers
}

// Expense statistics
export interface ExpenseStatistics {
  totalAmount: number;
  categoryBreakdown: {
    [category: string]: number;
  };
  dailyExpenses: {
    date: string;
    amount: number;
    count: number;
  }[];
  monthlyComparison: {
    month: string;
    amount: number;
  }[];
  weeklyComparison: {
    week: string;
    amount: number;
  }[];
  paymentMethodBreakdown: {
    [method: string]: number;
  };
  averageAmount: number;
  expenseFrequency: number;
  expenseCount: number;
  // Integration statistics
  savingsProgress: {
    totalSaved: number;
    goalProgress: {
      [goalId: string]: {
        currentAmount: number;
        targetAmount: number;
        percentage: number;
      }
    }
  };
  budgetImpact: {
    [budgetId: string]: {
      allocated: number;
      spent: number;
      remaining: number;
      savingsAllocated: number;
    }
  };
} 