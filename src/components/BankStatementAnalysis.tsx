import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, textStyles, borderRadius } from '../utils/theme';

interface BankStatementAnalysisProps {
  statementId: string;
  onError?: (error: string) => void;
}

const BankStatementAnalysis: React.FC<BankStatementAnalysisProps> = () => {
  return (
    <View style={styles.container}>
      <View style={styles.comingSoonContainer}>
        <Ionicons name="time-outline" size={64} color={colors.primary} />
        <Text style={styles.comingSoonTitle}>Coming Soon!</Text>
        <Text style={styles.comingSoonDescription}>
          We're working hard to bring you advanced bank statement analysis. This feature will be available in a future update.
        </Text>
      </View>
      
      <View style={styles.featuresList}>
        <Text style={styles.featuresTitle}>Planned Features:</Text>
        
        <View style={styles.featureItem}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.featureText}>Transaction categorization</Text>
        </View>
        
        <View style={styles.featureItem}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.featureText}>Spending pattern analysis</Text>
        </View>
        
        <View style={styles.featureItem}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.featureText}>Income and expense tracking</Text>
        </View>
        
        <View style={styles.featureItem}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.featureText}>Personalized financial insights</Text>
        </View>
        
        <View style={styles.featureItem}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.featureText}>Visual charts and graphs</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.medium,
    backgroundColor: colors.background,
  },
  comingSoonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.large,
    backgroundColor: colors.highlight,
    borderRadius: borderRadius.medium,
    marginVertical: spacing.medium,
  },
  comingSoonTitle: {
    ...textStyles.heading,
    color: colors.primary,
    marginVertical: spacing.medium,
  },
  comingSoonDescription: {
    ...textStyles.body,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  featuresList: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginVertical: spacing.medium,
  },
  featuresTitle: {
    ...textStyles.subheading,
    marginBottom: spacing.medium,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  featureText: {
    ...textStyles.body,
    marginLeft: spacing.small,
  },
});

export default BankStatementAnalysis; 