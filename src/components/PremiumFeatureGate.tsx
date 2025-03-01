import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, textStyles, borderRadius } from '../utils/theme';
import subscriptionService, { PremiumFeature } from '../services/subscriptionService';

interface PremiumFeatureGateProps {
  feature: PremiumFeature;
  children: React.ReactNode;
  fallbackComponent?: React.ReactNode;
  showUpgradeButton?: boolean;
  upgradeCTA?: string;
  limitMessage?: string;
}

/**
 * A component that gates access to premium features
 * If the user has access to the feature, the children are rendered
 * Otherwise, a fallback component is rendered
 */
const PremiumFeatureGate: React.FC<PremiumFeatureGateProps> = ({
  feature,
  children,
  fallbackComponent,
  showUpgradeButton = true,
  upgradeCTA = 'Upgrade to Premium',
  limitMessage
}) => {
  const navigation = useNavigation<any>();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [remainingUses, setRemainingUses] = useState<number | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        setIsLoading(true);
        const access = await subscriptionService.hasFeatureAccess(feature);
        setHasAccess(access);

        // For features with limited free access, get remaining usage
        if (feature === PremiumFeature.RECEIPT_SCANNING) {
          const remaining = await subscriptionService.getRemainingReceiptScans();
          setRemainingUses(remaining);
        }
      } catch (error) {
        console.error('Error checking feature access:', error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [feature]);

  const handleUpgrade = () => {
    navigation.navigate('Subscription');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  // If user has access, render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // If there's a custom fallback component, use it
  if (fallbackComponent) {
    return <>{fallbackComponent}</>;
  }

  // Otherwise, render the default premium gate UI
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={28} color={colors.primary} />
        </View>
        
        <Text style={styles.title}>Premium Feature</Text>
        
        {limitMessage ? (
          <Text style={styles.message}>{limitMessage}</Text>
        ) : (
          <Text style={styles.message}>
            This feature is available exclusively to Premium subscribers.
          </Text>
        )}
        
        {remainingUses !== null && remainingUses > 0 && (
          <Text style={styles.remainingText}>
            You have {remainingUses} {remainingUses === 1 ? 'use' : 'uses'} remaining this month.
          </Text>
        )}
        
        {showUpgradeButton && (
          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
            <Text style={styles.upgradeButtonText}>{upgradeCTA}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.cardAlt,
    padding: spacing.medium,
    margin: spacing.small,
    overflow: 'hidden',
  },
  content: {
    alignItems: 'center',
    padding: spacing.small,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.large,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLightest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.small,
  },
  title: {
    ...textStyles.heading,
    fontSize: 18,
    marginBottom: spacing.xsmall,
    color: colors.primary,
  },
  message: {
    ...textStyles.body,
    textAlign: 'center',
    marginBottom: spacing.medium,
    color: colors.textSecondary,
  },
  remainingText: {
    ...textStyles.bodyBold,
    color: colors.primary,
    marginBottom: spacing.medium,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.small,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.small,
    width: '100%',
  },
  upgradeButtonText: {
    ...textStyles.buttonText,
    color: colors.white,
  },
});

export default PremiumFeatureGate; 