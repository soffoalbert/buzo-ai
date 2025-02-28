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