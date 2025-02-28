export interface SavingsGoal {
  id: string;
  title: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  startDate: string;
  targetDate: string;
  category?: string;
  icon?: string;
  color?: string;
  isCompleted: boolean;
  isShared: boolean;
  sharedWith?: string[]; // User IDs
  milestones?: SavingsMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface SavingsMilestone {
  id: string;
  title: string;
  targetAmount: number;
  isCompleted: boolean;
  completedDate?: string;
}

// Savings goal categories
export const SAVINGS_CATEGORIES = [
  { id: '1', name: 'Emergency Fund', icon: 'medkit-outline', color: '#EF4444' },
  { id: '2', name: 'Education', icon: 'school-outline', color: '#8B5CF6' },
  { id: '3', name: 'Travel', icon: 'airplane-outline', color: '#3B82F6' },
  { id: '4', name: 'Home', icon: 'home-outline', color: '#10B981' },
  { id: '5', name: 'Vehicle', icon: 'car-outline', color: '#F59E0B' },
  { id: '6', name: 'Retirement', icon: 'umbrella-outline', color: '#6366F1' },
  { id: '7', name: 'Wedding', icon: 'heart-outline', color: '#EC4899' },
  { id: '8', name: 'Electronics', icon: 'laptop-outline', color: '#6B7280' },
  { id: '9', name: 'Other', icon: 'ellipsis-horizontal-outline', color: '#9CA3AF' },
];

// Savings tips
export const SAVINGS_TIPS = [
  'Set up automatic transfers to your savings account on payday',
  'Challenge yourself to a no-spend day once a week',
  'Use the 50/30/20 rule: 50% needs, 30% wants, 20% savings',
  'Save all your R5 and R10 coins in a jar',
  'Cancel unused subscriptions and add that money to savings',
  'Try the 24-hour rule: wait 24 hours before making non-essential purchases',
  'Pack lunch instead of eating out to save on daily expenses',
  'Use cashback apps and loyalty programs to maximize savings',
  'Set specific, measurable, achievable, relevant, and time-bound (SMART) savings goals',
  'Review your budget monthly and adjust your savings strategy as needed',
]; 