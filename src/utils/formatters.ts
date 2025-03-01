/**
 * Format a number as currency (South African Rand by default)
 * @param amount The amount to format
 * @param currency The currency code (default: 'ZAR')
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currency: string = 'ZAR'): string => {
  try {
    // Handle negative values
    const isNegative = amount < 0;
    const absoluteAmount = Math.abs(amount);
    
    // Format the number with the Intl.NumberFormat
    const formatter = new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    
    // Return the formatted string
    return isNegative 
      ? `-${formatter.format(absoluteAmount)}` 
      : formatter.format(absoluteAmount);
  } catch (error) {
    // Fallback formatting in case Intl.NumberFormat fails
    return `R ${amount.toFixed(2)}`;
  }
};

/**
 * Format a date string to a localized date
 * @param dateString The date string to format
 * @param format The format to use (short, medium, long)
 * @returns Formatted date string
 */
export const formatDate = (
  dateString: string, 
  format: 'short' | 'medium' | 'long' = 'medium'
): string => {
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    
    let options: Intl.DateTimeFormatOptions;
    
    switch (format) {
      case 'short':
        options = { day: 'numeric', month: 'numeric', year: '2-digit' };
        break;
      case 'long':
        options = { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        };
        break;
      case 'medium':
      default:
        options = { day: 'numeric', month: 'short', year: 'numeric' };
        break;
    }
    
    return new Intl.DateTimeFormat('en-ZA', options).format(date);
  } catch (error) {
    // Fallback formatting in case of error
    return dateString;
  }
};

/**
 * Format a number with thousands separators
 * @param number The number to format
 * @param decimalPlaces Number of decimal places
 * @returns Formatted number string
 */
export const formatNumber = (
  number: number, 
  decimalPlaces: number = 0
): string => {
  try {
    return new Intl.NumberFormat('en-ZA', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(number);
  } catch (error) {
    // Fallback formatting in case of error
    return number.toFixed(decimalPlaces);
  }
};

/**
 * Format a percentage
 * @param value The value to format as percentage (0.1 = 10%)
 * @param decimalPlaces Number of decimal places
 * @returns Formatted percentage string
 */
export const formatPercentage = (
  value: number, 
  decimalPlaces: number = 0
): string => {
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'percent',
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(value);
  } catch (error) {
    // Fallback formatting in case of error
    return `${(value * 100).toFixed(decimalPlaces)}%`;
  }
};

/**
 * Truncate a string to a maximum length and add ellipsis if needed
 * @param str The string to truncate
 * @param maxLength Maximum length of the string
 * @returns Truncated string
 */
export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) {
    return str;
  }
  
  return `${str.substring(0, maxLength)}...`;
}; 