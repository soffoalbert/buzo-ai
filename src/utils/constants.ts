// Define the time periods for filtering
export const TIME_PERIODS = [
  { id: 'week', label: 'Week', days: 7 },
  { id: 'month', label: 'Month', days: 30 },
  { id: '3months', label: '3 Months', days: 90 },
  { id: '6months', label: '6 Months', days: 180 },
  { id: 'year', label: 'Year', days: 365 },
];

// Define the expense categories with colors
export const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Food', name: 'Food', color: '#FF5733', icon: 'restaurant-outline' },
  { id: 'transportation', label: 'Transportation', name: 'Transportation', color: '#33FF57', icon: 'car-outline' },
  { id: 'housing', label: 'Housing', name: 'Housing', color: '#3357FF', icon: 'home-outline' },
  { id: 'utilities', label: 'Utilities', name: 'Utilities', color: '#F3FF33', icon: 'flash-outline' },
  { id: 'entertainment', label: 'Entertainment', name: 'Entertainment', color: '#FF33F3', icon: 'film-outline' },
  { id: 'health', label: 'Health', name: 'Health', color: '#33FFF3', icon: 'fitness-outline' },
  { id: 'education', label: 'Education', name: 'Education', color: '#FF8C33', icon: 'school-outline' },
  { id: 'shopping', label: 'Shopping', name: 'Shopping', color: '#8C33FF', icon: 'bag-outline' },
  { id: 'personal', label: 'Personal', name: 'Personal', color: '#FF3333', icon: 'person-outline' },
  { id: 'other', label: 'Other', name: 'Other', color: '#33FFFF', icon: 'ellipsis-horizontal-outline' },
]; 