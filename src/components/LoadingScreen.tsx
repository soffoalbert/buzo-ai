import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors, textStyles, spacing } from '../utils/theme';

type LoadingScreenProps = {
  message?: string;
};

/**
 * A full-screen loading component to display during authentication state changes
 * or other app-wide loading states
 */
const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Loading...' 
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  message: {
    marginTop: spacing.md,
    fontSize: textStyles.body1.fontSize,
    fontWeight: textStyles.body1.fontWeight as any,
    lineHeight: textStyles.body1.lineHeight,
    color: colors.textPrimary,
  },
});

export default LoadingScreen; 