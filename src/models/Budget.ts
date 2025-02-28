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
}

export interface BudgetCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

// Default budget categories
export const DEFAULT_BUDGET_CATEGORIES: BudgetCategory[] = [
  { id: '1', name: 'Housing', color: '#4F46E5', icon: 'home-outline' },
  { id: '2', name: 'Food', color: '#10B981', icon: 'restaurant-outline' },
  { id: '3', name: 'Transport', color: '#F59E0B', icon: 'car-outline' },
  { id: '4', name: 'Entertainment', color: '#3B82F6', icon: 'film-outline' },
  { id: '5', name: 'Utilities', color: '#EF4444', icon: 'flash-outline' },
  { id: '6', name: 'Shopping', color: '#10B981', icon: 'cart-outline' },
  { id: '7', name: 'Savings', color: '#6366F1', icon: 'wallet-outline' },
  { id: '8', name: 'Education', color: '#8B5CF6', icon: 'school-outline' },
  { id: '9', name: 'Healthcare', color: '#EC4899', icon: 'medical-outline' },
  { id: '10', name: 'Other', color: '#6B7280', icon: 'ellipsis-horizontal-outline' },
]; 