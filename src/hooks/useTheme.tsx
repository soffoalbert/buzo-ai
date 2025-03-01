import { useContext, createContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import theme, { colors as lightColors } from '../utils/theme';
import React from 'react';

// Create dark mode colors based on light colors
const darkColors = {
  // Primary brand colors
  primary: lightColors.primary,
  primaryDark: lightColors.primaryDark,
  primaryLight: lightColors.primaryLight,
  
  // Secondary brand colors
  secondary: lightColors.secondary,
  secondaryDark: lightColors.secondaryDark,
  secondaryLight: lightColors.secondaryLight,
  
  // Accent colors
  accent: lightColors.accent,
  accentDark: lightColors.accentDark,
  accentLight: lightColors.accentLight,
  
  // Neutral colors - inverted for dark mode
  background: '#121212',
  card: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  border: '#333333',
  
  // Semantic colors
  success: lightColors.success,
  warning: lightColors.warning,
  error: lightColors.error,
  info: lightColors.info,
  
  // Utility colors
  white: lightColors.white,
  black: lightColors.black,
  transparent: lightColors.transparent,
};

// Theme context
type ThemeContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
  colors: typeof lightColors;
  spacing: typeof theme.spacing;
  textStyles: typeof theme.textStyles;
  borderRadius: typeof theme.borderRadius;
  shadows: typeof theme.shadows;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme provider component
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const colorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(colorScheme === 'dark');
  
  // Update theme when system theme changes
  useEffect(() => {
    setIsDarkMode(colorScheme === 'dark');
  }, [colorScheme]);
  
  // Toggle theme function
  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };
  
  // Create theme value
  const themeValue: ThemeContextType = {
    isDarkMode,
    toggleTheme,
    colors: isDarkMode ? darkColors : lightColors,
    spacing: theme.spacing,
    textStyles: {
      ...theme.textStyles,
      // Override text colors for dark mode
      ...(isDarkMode && {
        h1: { ...theme.textStyles.h1, color: darkColors.text },
        h2: { ...theme.textStyles.h2, color: darkColors.text },
        h3: { ...theme.textStyles.h3, color: darkColors.text },
        h4: { ...theme.textStyles.h4, color: darkColors.text },
        subtitle1: { ...theme.textStyles.subtitle1, color: darkColors.text },
        subtitle2: { ...theme.textStyles.subtitle2, color: darkColors.text },
        body1: { ...theme.textStyles.body1, color: darkColors.text },
        body2: { ...theme.textStyles.body2, color: darkColors.text },
        caption: { ...theme.textStyles.caption, color: darkColors.textSecondary },
        button: { ...theme.textStyles.button, color: darkColors.white },
      }),
    },
    borderRadius: theme.borderRadius,
    shadows: theme.shadows,
  };
  
  return React.createElement(
    ThemeContext.Provider,
    { value: themeValue },
    children
  );
};

// Hook to use the theme
export const useTheme = () => {
  const context = useContext(ThemeContext);
  
  // If no provider is found, return default light theme
  if (context === undefined) {
    return {
      isDarkMode: false,
      toggleTheme: () => {},
      colors: lightColors,
      spacing: theme.spacing,
      textStyles: theme.textStyles,
      borderRadius: theme.borderRadius,
      shadows: theme.shadows,
    };
  }
  
  return context;
};

export default useTheme; 