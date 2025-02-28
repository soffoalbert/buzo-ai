import { Expense, PaymentMethod } from '../models/Expense';
import { generateUUID } from './helpers';
import { subDays, format, addDays } from 'date-fns';

// Categories with realistic expense amounts
const EXPENSE_CATEGORIES = [
  { id: 'groceries', name: 'Groceries', minAmount: 50, maxAmount: 800 },
  { id: 'transport', name: 'Transport', minAmount: 30, maxAmount: 500 },
  { id: 'dining', name: 'Dining', minAmount: 100, maxAmount: 600 },
  { id: 'utilities', name: 'Utilities', minAmount: 200, maxAmount: 1500 },
  { id: 'housing', name: 'Housing', minAmount: 1500, maxAmount: 8000 },
  { id: 'entertainment', name: 'Entertainment', minAmount: 100, maxAmount: 800 },
  { id: 'health', name: 'Health', minAmount: 150, maxAmount: 2000 },
  { id: 'education', name: 'Education', minAmount: 200, maxAmount: 3000 },
  { id: 'shopping', name: 'Shopping', minAmount: 100, maxAmount: 1500 },
  { id: 'other', name: 'Other', minAmount: 50, maxAmount: 500 },
];

// Common expense titles by category
const EXPENSE_TITLES: Record<string, string[]> = {
  groceries: [
    'Weekly groceries', 'Woolworths', 'Pick n Pay', 'Checkers', 'Spar', 
    'Fruit and vegetables', 'Meat and dairy', 'Pantry essentials'
  ],
  transport: [
    'Uber ride', 'Fuel', 'Car service', 'Train ticket', 'Bus fare', 
    'Taxi', 'Car wash', 'Parking fee', 'Toll fee'
  ],
  dining: [
    'Lunch with colleagues', 'Dinner out', 'Coffee shop', 'Restaurant', 
    'Fast food', 'Takeaway', 'Breakfast meeting'
  ],
  utilities: [
    'Electricity bill', 'Water bill', 'Internet', 'Mobile phone', 
    'Gas bill', 'TV subscription', 'Streaming service'
  ],
  housing: [
    'Rent payment', 'Mortgage', 'Home insurance', 'Property tax', 
    'Home repairs', 'Furniture', 'Cleaning service'
  ],
  entertainment: [
    'Movie tickets', 'Concert', 'Sports event', 'Game subscription', 
    'Music streaming', 'Books', 'Hobbies'
  ],
  health: [
    'Doctor visit', 'Medication', 'Gym membership', 'Health insurance', 
    'Dental care', 'Eye care', 'Therapy session'
  ],
  education: [
    'Course fee', 'Textbooks', 'School supplies', 'Tuition', 
    'Online learning', 'Workshop', 'Certification'
  ],
  shopping: [
    'Clothing', 'Electronics', 'Home goods', 'Gifts', 
    'Accessories', 'Shoes', 'Personal care'
  ],
  other: [
    'Miscellaneous', 'Donation', 'Subscription', 'Service fee', 
    'Membership', 'Gift', 'Unexpected expense'
  ],
};

// Payment methods
const PAYMENT_METHODS = [
  PaymentMethod.CASH,
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.DEBIT_CARD,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.MOBILE_PAYMENT,
];

/**
 * Generate a random number between min and max (inclusive)
 */
const getRandomNumber = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Get a random item from an array
 */
const getRandomItem = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

/**
 * Generate a random expense amount within the category's typical range
 */
const getRandomAmount = (categoryId: string): number => {
  const category = EXPENSE_CATEGORIES.find(cat => cat.id === categoryId);
  if (!category) {
    return getRandomNumber(50, 500);
  }
  
  // Generate a random amount with 2 decimal places
  const amount = getRandomNumber(category.minAmount * 100, category.maxAmount * 100) / 100;
  return parseFloat(amount.toFixed(2));
};

/**
 * Generate a random expense title for a category
 */
const getRandomTitle = (categoryId: string): string => {
  const titles = EXPENSE_TITLES[categoryId] || EXPENSE_TITLES.other;
  return getRandomItem(titles);
};

/**
 * Generate a random date between startDate and endDate
 */
const getRandomDate = (startDate: Date, endDate: Date): Date => {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return new Date(randomTime);
};

/**
 * Generate a single mock expense
 */
export const generateMockExpense = (
  startDate: Date = subDays(new Date(), 90),
  endDate: Date = new Date()
): Expense => {
  const categoryId = getRandomItem(EXPENSE_CATEGORIES).id;
  const date = getRandomDate(startDate, endDate);
  const now = new Date().toISOString();
  
  return {
    id: generateUUID(),
    title: getRandomTitle(categoryId),
    amount: getRandomAmount(categoryId),
    date: format(date, 'yyyy-MM-dd'),
    category: categoryId,
    description: Math.random() > 0.7 ? `Mock expense for ${categoryId}` : undefined,
    paymentMethod: Math.random() > 0.3 ? getRandomItem(PAYMENT_METHODS) : undefined,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Generate multiple mock expenses
 */
export const generateMockExpenses = (
  count: number,
  startDate: Date = subDays(new Date(), 90),
  endDate: Date = new Date()
): Expense[] => {
  const expenses: Expense[] = [];
  
  for (let i = 0; i < count; i++) {
    expenses.push(generateMockExpense(startDate, endDate));
  }
  
  // Sort by date (newest first)
  return expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

/**
 * Generate a realistic set of expenses with patterns
 * This creates more realistic data with:
 * - Regular expenses (rent, utilities) on specific days
 * - Weekend spikes for entertainment and dining
 * - Grocery shopping patterns
 * - Occasional large expenses
 */
export const generateRealisticExpenses = (
  days: number = 90,
  startDate: Date = subDays(new Date(), 90)
): Expense[] => {
  const expenses: Expense[] = [];
  const endDate = addDays(startDate, days);
  const now = new Date().toISOString();
  
  // Current date for iteration
  let currentDate = new Date(startDate);
  
  // Generate expenses for each day in the range
  while (currentDate <= endDate) {
    const dayOfMonth = currentDate.getDate();
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    // Monthly rent/mortgage (1st of month)
    if (dayOfMonth === 1) {
      expenses.push({
        id: generateUUID(),
        title: 'Monthly Rent',
        amount: 5500,
        date: dateStr,
        category: 'housing',
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        createdAt: now,
        updatedAt: now,
      });
    }
    
    // Utilities (15th of month)
    if (dayOfMonth === 15) {
      expenses.push({
        id: generateUUID(),
        title: 'Electricity Bill',
        amount: getRandomNumber(800, 1200),
        date: dateStr,
        category: 'utilities',
        paymentMethod: PaymentMethod.DEBIT_CARD,
        createdAt: now,
        updatedAt: now,
      });
      
      expenses.push({
        id: generateUUID(),
        title: 'Internet Subscription',
        amount: 799,
        date: dateStr,
        category: 'utilities',
        paymentMethod: PaymentMethod.CREDIT_CARD,
        createdAt: now,
        updatedAt: now,
      });
    }
    
    // Weekly grocery shopping (usually Saturdays)
    if (dayOfWeek === 6) {
      expenses.push({
        id: generateUUID(),
        title: 'Weekly Groceries',
        amount: getRandomNumber(450, 750),
        date: dateStr,
        category: 'groceries',
        paymentMethod: PaymentMethod.DEBIT_CARD,
        createdAt: now,
        updatedAt: now,
      });
    }
    
    // Transport (weekdays)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // 70% chance of transport expense on weekdays
      if (Math.random() < 0.7) {
        expenses.push({
          id: generateUUID(),
          title: getRandomItem(['Fuel', 'Uber', 'Taxi fare', 'Bus ticket']),
          amount: getRandomNumber(50, 200),
          date: dateStr,
          category: 'transport',
          paymentMethod: getRandomItem([PaymentMethod.CASH, PaymentMethod.DEBIT_CARD, PaymentMethod.MOBILE_PAYMENT]),
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    
    // Dining and entertainment (more likely on weekends)
    const diningProbability = isWeekend ? 0.8 : 0.3;
    if (Math.random() < diningProbability) {
      expenses.push({
        id: generateUUID(),
        title: getRandomItem(EXPENSE_TITLES.dining),
        amount: getRandomNumber(150, 450),
        date: dateStr,
        category: 'dining',
        paymentMethod: getRandomItem([PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD]),
        createdAt: now,
        updatedAt: now,
      });
    }
    
    const entertainmentProbability = isWeekend ? 0.6 : 0.1;
    if (Math.random() < entertainmentProbability) {
      expenses.push({
        id: generateUUID(),
        title: getRandomItem(EXPENSE_TITLES.entertainment),
        amount: getRandomNumber(100, 350),
        date: dateStr,
        category: 'entertainment',
        paymentMethod: getRandomItem([PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD, PaymentMethod.MOBILE_PAYMENT]),
        createdAt: now,
        updatedAt: now,
      });
    }
    
    // Occasional shopping
    if (Math.random() < 0.2) {
      expenses.push({
        id: generateUUID(),
        title: getRandomItem(EXPENSE_TITLES.shopping),
        amount: getRandomNumber(200, 800),
        date: dateStr,
        category: 'shopping',
        paymentMethod: PaymentMethod.CREDIT_CARD,
        createdAt: now,
        updatedAt: now,
      });
    }
    
    // Occasional health expenses
    if (Math.random() < 0.05) {
      expenses.push({
        id: generateUUID(),
        title: getRandomItem(EXPENSE_TITLES.health),
        amount: getRandomNumber(200, 1000),
        date: dateStr,
        category: 'health',
        paymentMethod: PaymentMethod.CREDIT_CARD,
        createdAt: now,
        updatedAt: now,
      });
    }
    
    // Very occasional large expenses
    if (Math.random() < 0.02) {
      const categories = ['education', 'shopping', 'other'];
      const category = getRandomItem(categories);
      expenses.push({
        id: generateUUID(),
        title: getRandomItem(EXPENSE_TITLES[category]),
        amount: getRandomNumber(1000, 3000),
        date: dateStr,
        category,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        createdAt: now,
        updatedAt: now,
      });
    }
    
    // Move to next day
    currentDate = addDays(currentDate, 1);
  }
  
  return expenses;
}; 