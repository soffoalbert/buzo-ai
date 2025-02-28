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
}

// Payment methods
export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  MOBILE_PAYMENT = 'mobile_payment',
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
} 