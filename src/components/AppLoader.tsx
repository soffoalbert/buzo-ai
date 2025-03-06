import React from 'react';
import { ActivityIndicator, StyleSheet, View, Text } from 'react-native';
import { colors, spacing, textStyles } from '../utils/theme';

interface AppLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

const AppLoader: React.FC<AppLoaderProps> = ({ message = 'Loading...', fullScreen = true }) => {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 1000,
  },
  message: {
    ...textStyles.body,
    marginTop: spacing.sm,
    color: colors.text,
  },
});

export default AppLoader; 