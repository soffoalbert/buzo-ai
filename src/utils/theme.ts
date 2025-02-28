// Theme configuration for Buzo AI

// Color palette
export const colors = {
  // Primary brand colors
  primary: '#4F46E5', // Indigo
  primaryDark: '#3730A3',
  primaryLight: '#818CF8',
  
  // Secondary brand colors
  secondary: '#10B981', // Emerald
  secondaryDark: '#059669',
  secondaryLight: '#34D399',
  
  // Accent colors
  accent: '#F59E0B', // Amber
  accentDark: '#D97706',
  accentLight: '#FBBF24',
  
  // Neutral colors
  background: '#FFFFFF',
  card: '#F9FAFB',
  text: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  
  // Semantic colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Utility colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

// Spacing scale (in pixels)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Text styles
export const textStyles = {
  h1: {
    fontSize: 32,
    fontWeight: 700,
    lineHeight: 40,
    color: colors.text,
  },
  h2: {
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 32,
    color: colors.text,
  },
  h3: {
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 28,
    color: colors.text,
  },
  h4: {
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 24,
    color: colors.text,
  },
  subtitle1: {
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 24,
    color: colors.text,
  },
  subtitle2: {
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 20,
    color: colors.text,
  },
  body1: {
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 24,
    color: colors.text,
  },
  body2: {
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 20,
    color: colors.text,
  },
  caption: {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  button: {
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 24,
    color: colors.white,
  },
};

// Border radius values
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 9999,
};

// Shadow styles
export const shadows = {
  sm: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Export the theme object
const theme = {
  colors,
  spacing,
  textStyles,
  borderRadius,
  shadows,
};

export default theme; 