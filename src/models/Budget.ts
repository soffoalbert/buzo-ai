export interface Budget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  category: string;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
  user_id?: string;
  // Integration fields
  linkedExpenses?: string[]; // Array of expense IDs
  savingsAllocation?: number; // Amount allocated to savings from this budget
  linkedSavingsGoals?: string[]; // Array of savings goal IDs this budget contributes to
  autoSavePercentage?: number; // Percentage of budget to automatically allocate to savings
  remainingAmount?: number; // Amount left in budget (amount - spent - savingsAllocation)
  alerts?: string[]; // Array of alert thresholds that have been sent (e.g., '50', '75', '90', '100')
}

export interface BudgetCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  defaultSavingsPercentage?: number; // Default savings percentage for this category
}

// Default budget categories
export const DEFAULT_BUDGET_CATEGORIES: BudgetCategory[] = [
  { id: '1', name: 'Housing', color: '#4F46E5', icon: 'home-outline', defaultSavingsPercentage: 0 },
  { id: '2', name: 'Food', color: '#10B981', icon: 'restaurant-outline', defaultSavingsPercentage: 5 },
  { id: '3', name: 'Transport', color: '#F59E0B', icon: 'car-outline', defaultSavingsPercentage: 10 },
  { id: '4', name: 'Entertainment', color: '#3B82F6', icon: 'film-outline', defaultSavingsPercentage: 20 },
  { id: '5', name: 'Utilities', color: '#EF4444', icon: 'flash-outline', defaultSavingsPercentage: 5 },
  { id: '6', name: 'Shopping', color: '#10B981', icon: 'cart-outline', defaultSavingsPercentage: 15 },
  { id: '7', name: 'Savings', color: '#6366F1', icon: 'wallet-outline', defaultSavingsPercentage: 100 },
  { id: '8', name: 'Education', color: '#8B5CF6', icon: 'school-outline', defaultSavingsPercentage: 10 },
  { id: '9', name: 'Healthcare', color: '#EC4899', icon: 'medical-outline', defaultSavingsPercentage: 5 },
  { id: '10', name: 'Other', color: '#6B7280', icon: 'ellipsis-horizontal-outline', defaultSavingsPercentage: 10 },
]; 