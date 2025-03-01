/**
 * Formats a date to a localized string format
 * @param date The date to format
 * @param options Intl.DateTimeFormatOptions to customize the format
 * @returns A formatted date string
 */
export const formatDate = (date: Date, options?: Intl.DateTimeFormatOptions): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  
  const mergedOptions = options ? { ...defaultOptions, ...options } : defaultOptions;
  
  return date.toLocaleDateString(undefined, mergedOptions);
};

/**
 * Formats a date to include time
 * @param date The date to format
 * @returns A formatted date and time string
 */
export const formatDateTime = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  
  return date.toLocaleDateString(undefined, options);
};

/**
 * Calculates the difference between two dates in days
 * @param date1 The first date
 * @param date2 The second date (defaults to current date)
 * @returns The number of days between the dates
 */
export const daysBetween = (date1: Date, date2: Date = new Date()): number => {
  const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
  const diffDays = Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
  return diffDays;
};

/**
 * Adds days to a date
 * @param date The starting date
 * @param days Number of days to add
 * @returns A new date with the days added
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Adds months to a date
 * @param date The starting date
 * @param months Number of months to add
 * @returns A new date with the months added
 */
export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

/**
 * Adds years to a date
 * @param date The starting date
 * @param years Number of years to add
 * @returns A new date with the years added
 */
export const addYears = (date: Date, years: number): Date => {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
};

/**
 * Checks if a date is today
 * @param date The date to check
 * @returns True if the date is today, false otherwise
 */
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

/**
 * Checks if a date is in the past
 * @param date The date to check
 * @returns True if the date is in the past, false otherwise
 */
export const isPast = (date: Date): boolean => {
  return date.getTime() < new Date().getTime();
};

/**
 * Checks if a date is in the future
 * @param date The date to check
 * @returns True if the date is in the future, false otherwise
 */
export const isFuture = (date: Date): boolean => {
  return date.getTime() > new Date().getTime();
}; 