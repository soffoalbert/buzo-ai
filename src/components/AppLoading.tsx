import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LoadingSpinner from './LoadingSpinner';
import { colors, spacing, textStyles } from '../utils/theme';

interface AppLoadingProps {
  message?: string;
}

/**
 * A loading screen component for the app that uses our modern LoadingSpinner
 */
const AppLoading: React.FC<AppLoadingProps> = ({ message = 'Loading...' }) => {
  return (
    <View style={styles.container}>
      <LoadingSpinner size={150} color={colors.primary} />
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
    padding: spacing.lg,
  },
  message: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default AppLoading; 