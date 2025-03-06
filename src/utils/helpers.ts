/**
 * Generate a UUID v4
 * @returns A random UUID string
 */
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Format a number as currency
 * @param amount Amount to format
 * @param locale Locale to use for formatting (default: 'en-ZA')
 * @param currency Currency code to use (default: 'ZAR')
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number,
  locale: string = 'en-ZA',
  currency: string = 'ZAR'
): string => {
  try {
    // For South African Rand, use a specific format
    if (currency === 'ZAR') {
      return `R ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
    }
    
    // For other currencies, use Intl.NumberFormat
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    console.warn('Error formatting currency:', error);
    // Fallback to simple format
    return `${currency} ${amount.toFixed(2)}`;
  }
};

/**
 * Format date to a readable string
 * @param date Date to format (string or Date object)
 * @param format Format style ('short', 'medium', 'long', 'full')
 * @param locale Locale to use for formatting
 * @returns Formatted date string
 */
export const formatDate = (
  date: string | Date,
  format: 'short' | 'medium' | 'long' | 'full' = 'medium',
  locale = 'en-ZA'
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, { dateStyle: format }).format(dateObj);
};

/**
 * Truncate text to a specified length with ellipsis
 * @param text Text to truncate
 * @param maxLength Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

/**
 * Calculate percentage
 * @param value Current value
 * @param total Total value
 * @returns Percentage as a number between 0-100
 */
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
};

/**
 * Group array items by a key
 * @param array Array to group
 * @param keyGetter Function to extract the key to group by
 * @returns Map of grouped items
 */
export const groupBy = <T, K extends string | number | symbol>(
  array: T[],
  keyGetter: (item: T) => K
): Record<string, T[]> => {
  return array.reduce((acc, item) => {
    const key = keyGetter(item);
    const keyStr = String(key);
    if (!acc[keyStr]) {
      acc[keyStr] = [];
    }
    acc[keyStr].push(item);
    return acc;
  }, {} as Record<string, T[]>);
};

/**
 * Deep clone an object
 * @param obj Object to clone
 * @returns Cloned object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 * @param value Value to check
 * @returns Boolean indicating if value is empty
 */
export const isEmpty = (value: any): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

/**
 * Calculate the number of days left until a target date
 * @param targetDate Target date string in ISO format
 * @returns Number of days left (0 if date is in the past)
 */
export const calculateDaysLeft = (targetDate: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day
  
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0); // Reset time to start of day
  
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

/**
 * Formats a currency value to be more readable, especially for large numbers.
 * Large numbers will be abbreviated (K for thousands, M for millions, etc.)
 * 
 * @param value The number to format
 * @param currency The currency symbol (defaults to 'R')
 * @param decimals The number of decimal places to show
 * @returns Formatted currency string
 */
export const formatCurrencyAbbreviated = (value: number, currency: string = 'R', decimals: number = 2): string => {
  // Handle special cases
  if (value === null || value === undefined || isNaN(value)) {
    return `${currency} 0.00`;
  }
  
  // For large numbers, use abbreviations
  if (value >= 1000000) {
    // Format as millions (M)
    return `${currency} ${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 10000) {
    // Format as thousands (K) with 1 decimal for numbers over 10K
    return `${currency} ${(value / 1000).toFixed(1)}K`;
  } else if (value >= 1000) {
    // Format as thousands for numbers between 1K and 10K
    return `${currency} ${(value / 1000).toFixed(decimals)}K`;
  }
  
  // For smaller numbers, use standard formatting
  return `${currency} ${value.toFixed(decimals)}`;
};

/**
 * Get appropriate icon name for a budget category
 * @param category The budget category
 * @returns The icon name to use from Ionicons
 */
export const getCategoryIcon = (category: string = ''): string => {
  // Convert to lowercase for case-insensitive matching
  const lowerCategory = category.toLowerCase();
  
  // Map categories to appropriate icons
  if (lowerCategory.includes('food') || lowerCategory.includes('grocery') || lowerCategory.includes('restaurant')) {
    return 'restaurant-outline';
  }
  if (lowerCategory.includes('transport') || lowerCategory.includes('car') || lowerCategory.includes('uber')) {
    return 'car-outline';
  }
  if (lowerCategory.includes('house') || lowerCategory.includes('rent') || lowerCategory.includes('mortgage')) {
    return 'home-outline';
  }
  if (lowerCategory.includes('util') || lowerCategory.includes('electric') || lowerCategory.includes('water')) {
    return 'flash-outline';
  }
  if (lowerCategory.includes('entertain') || lowerCategory.includes('fun') || lowerCategory.includes('movie')) {
    return 'film-outline';
  }
  if (lowerCategory.includes('shop') || lowerCategory.includes('cloth') || lowerCategory.includes('fashion')) {
    return 'shirt-outline';
  }
  if (lowerCategory.includes('health') || lowerCategory.includes('medical') || lowerCategory.includes('doctor')) {
    return 'medical-outline';
  }
  if (lowerCategory.includes('educ') || lowerCategory.includes('school') || lowerCategory.includes('tuition')) {
    return 'school-outline';
  }
  if (lowerCategory.includes('sav') || lowerCategory.includes('invest')) {
    return 'wallet-outline';
  }
  if (lowerCategory.includes('subscript') || lowerCategory.includes('member')) {
    return 'card-outline';
  }
  if (lowerCategory.includes('pet') || lowerCategory.includes('animal')) {
    return 'paw-outline';
  }
  if (lowerCategory.includes('child') || lowerCategory.includes('kid') || lowerCategory.includes('baby')) {
    return 'people-outline';
  }
  if (lowerCategory.includes('tech') || lowerCategory.includes('gadget') || lowerCategory.includes('phone')) {
    return 'hardware-chip-outline';
  }
  if (lowerCategory.includes('travel') || lowerCategory.includes('vacation') || lowerCategory.includes('holiday')) {
    return 'airplane-outline';
  }
  if (lowerCategory.includes('gift') || lowerCategory.includes('present') || lowerCategory.includes('donat')) {
    return 'gift-outline';
  }
  
  // Default icon
  return 'wallet-outline';
};

/**
 * Format a category name for display
 * @param category The budget category
 * @returns A formatted category name
 */
export const formatCategory = (category: string = ''): string => {
  if (!category) return 'Uncategorized';
  
  // Split words by underscores, hyphens, or camelCase
  const words = category
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ');
  
  // Capitalize each word and join with spaces
  return words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}; 