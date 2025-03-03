import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetworkManager from '../utils/NetworkManager';
import { colors, spacing, borderRadius } from '../utils/theme';

interface OfflineBannerProps {
  customStyle?: object;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({ customStyle }) => {
  // Use NetworkManager to determine if device is online
  const isOnline = NetworkManager.useNetworkStatus();
  
  // If online, don't render anything
  if (isOnline) {
    return null;
  }
  
  return (
    <View style={[styles.container, customStyle]}>
      <Ionicons name="cloud-offline-outline" size={18} color={colors.white} />
      <Text style={styles.text}>You're offline. Changes will sync when you reconnect.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.textSecondary || '#6c757d',
    paddingVertical: 8,
    paddingHorizontal: spacing.medium,
    marginHorizontal: spacing.medium,
    marginBottom: spacing.medium,
    borderRadius: borderRadius.small,
  },
  text: {
    color: colors.white,
    marginLeft: spacing.small,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default OfflineBanner; 