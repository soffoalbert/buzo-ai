import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Linking,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import * as Haptics from 'expo-haptics';
import PremiumBanner from '../components/PremiumBanner';

import { 
  getUserSubscription, 
  hasPremiumAccess, 
  processSubscriptionPayment,
  cancelPremiumSubscription,
  getPremiumFeatures
} from '../services/subscriptionService';
import { SubscriptionInfo, SubscriptionTier } from '../models/User';

type SubscriptionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const MONTHLY_PRICE = 49.99;
const ANNUAL_PRICE = 499.99;
const CURRENCY = 'R';

const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<SubscriptionScreenNavigationProp>();
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Trigger haptic feedback
  const triggerHaptic = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      // Android
      Vibration.vibrate(20);
    }
  };
  
  // Fetch subscription data
  const fetchSubscriptionData = useCallback(async () => {
    setIsLoading(true);
    try {
      const subscriptionData = await getUserSubscription();
      const premiumStatus = await hasPremiumAccess();
      
      setSubscription(subscriptionData);
      setIsPremium(premiumStatus);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
      Alert.alert('Error', 'Failed to load subscription information. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Refresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchSubscriptionData();
    }, [fetchSubscriptionData])
  );
  
  // Handle subscription purchase
  const handleSubscribe = async () => {
    triggerHaptic();
    
    // Show confirmation dialog
    Alert.alert(
      'Confirm Subscription',
      `You are about to subscribe to Buzo Premium for ${CURRENCY}${selectedPlan === 'monthly' ? MONTHLY_PRICE : ANNUAL_PRICE}/${selectedPlan === 'monthly' ? 'month' : 'year'}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Subscribe', 
          onPress: async () => {
            setIsProcessing(true);
            try {
              // In a real app, this would open a payment gateway
              // For now, we'll simulate a successful payment
              const amount = selectedPlan === 'monthly' ? MONTHLY_PRICE : ANNUAL_PRICE;
              const description = `Buzo Premium - ${selectedPlan === 'monthly' ? 'Monthly' : 'Annual'} Subscription`;
              
              const transaction = await processSubscriptionPayment(
                amount,
                'ZAR',
                'credit_card', // This would come from the payment gateway
                description
              );
              
              if (transaction) {
                Alert.alert(
                  'Subscription Successful',
                  'Thank you for subscribing to Buzo Premium! You now have access to all premium features.',
                  [{ text: 'OK' }]
                );
                
                // Refresh subscription data
                await fetchSubscriptionData();
              } else {
                Alert.alert(
                  'Subscription Failed',
                  'There was an error processing your subscription. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('Error processing subscription:', error);
              Alert.alert(
                'Subscription Error',
                'There was an error processing your subscription. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };
  
  // Handle subscription cancellation
  const handleCancelSubscription = () => {
    triggerHaptic();
    
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your premium subscription? You will still have access until the end of your current billing period.',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel', 
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const success = await cancelPremiumSubscription();
              
              if (success) {
                Alert.alert(
                  'Subscription Cancelled',
                  'Your subscription has been cancelled. You will still have access to premium features until the end of your current billing period.',
                  [{ text: 'OK' }]
                );
                
                // Refresh subscription data
                await fetchSubscriptionData();
              } else {
                Alert.alert(
                  'Cancellation Failed',
                  'There was an error cancelling your subscription. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('Error cancelling subscription:', error);
              Alert.alert(
                'Cancellation Error',
                'There was an error cancelling your subscription. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };
  
  // Render premium features
  const renderFeatures = () => {
    const features = getPremiumFeatures();
    
    return (
      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>Premium Features</Text>
        
        {features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <View style={styles.featureIconContainer}>
              <Ionicons name={feature.icon as any} size={24} color={colors.primary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };
  
  // Render subscription plans
  const renderSubscriptionPlans = () => {
    return (
      <View style={styles.plansContainer}>
        <Text style={styles.plansTitle}>Choose Your Plan</Text>
        
        <View style={styles.planOptions}>
          {/* Monthly Plan */}
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedPlan === 'monthly' && styles.selectedPlan
            ]}
            onPress={() => {
              triggerHaptic();
              setSelectedPlan('monthly');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.planHeader}>
              <Text style={styles.planTitle}>Monthly</Text>
              {selectedPlan === 'monthly' && (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>Selected</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.planPrice}>
              {CURRENCY}{MONTHLY_PRICE}
              <Text style={styles.planPeriod}>/month</Text>
            </Text>
            
            <Text style={styles.planDescription}>
              Flexible monthly billing with no long-term commitment
            </Text>
          </TouchableOpacity>
          
          {/* Annual Plan */}
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedPlan === 'annual' && styles.selectedPlan
            ]}
            onPress={() => {
              triggerHaptic();
              setSelectedPlan('annual');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.planHeader}>
              <Text style={styles.planTitle}>Annual</Text>
              {selectedPlan === 'annual' && (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>Selected</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.planPrice}>
              {CURRENCY}{ANNUAL_PRICE}
              <Text style={styles.planPeriod}>/year</Text>
            </Text>
            
            <Text style={styles.planDescription}>
              Save 17% compared to monthly billing
            </Text>
            
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsBadgeText}>Best Value</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  // Render current subscription details
  const renderCurrentSubscription = () => {
    if (!subscription || !isPremium) {
      return null;
    }
    
    const endDate = subscription.endDate ? new Date(subscription.endDate) : null;
    const formattedEndDate = endDate ? endDate.toLocaleDateString() : 'N/A';
    
    return (
      <View style={styles.currentSubscriptionContainer}>
        <View style={styles.currentSubscriptionHeader}>
          <Text style={styles.currentSubscriptionTitle}>Current Subscription</Text>
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>Premium</Text>
          </View>
        </View>
        
        <View style={styles.subscriptionDetails}>
          <View style={styles.subscriptionDetailItem}>
            <Text style={styles.subscriptionDetailLabel}>Status:</Text>
            <Text style={styles.subscriptionDetailValue}>Active</Text>
          </View>
          
          <View style={styles.subscriptionDetailItem}>
            <Text style={styles.subscriptionDetailLabel}>Renewal Date:</Text>
            <Text style={styles.subscriptionDetailValue}>{formattedEndDate}</Text>
          </View>
          
          <View style={styles.subscriptionDetailItem}>
            <Text style={styles.subscriptionDetailLabel}>Auto-Renew:</Text>
            <Text style={styles.subscriptionDetailValue}>
              {subscription.autoRenew ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancelSubscription}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>
            {subscription.autoRenew ? 'Cancel Subscription' : 'Subscription will end on renewal date'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar style="auto" />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading subscription information...</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buzo Premium</Text>
        <View style={styles.headerRight} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Banner */}
        <View style={styles.premiumBanner}>
          <PremiumBanner />
        </View>
        
        {/* Current Subscription (if premium) */}
        {renderCurrentSubscription()}
        
        {/* Subscription Plans (if not premium) */}
        {!isPremium && renderSubscriptionPlans()}
        
        {/* Premium Features */}
        {renderFeatures()}
        
        {/* Subscribe Button (if not premium) */}
        {!isPremium && (
          <TouchableOpacity
            style={styles.subscribeButton}
            onPress={handleSubscribe}
            activeOpacity={0.7}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.subscribeButtonText}>
                Subscribe Now
              </Text>
            )}
          </TouchableOpacity>
        )}
        
        {/* Terms and Privacy */}
        <View style={styles.termsContainer}>
          <Text style={styles.termsText}>
            By subscribing, you agree to our{' '}
            <Text 
              style={styles.termsLink}
              onPress={() => Linking.openURL('https://buzo.app/terms')}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text 
              style={styles.termsLink}
              onPress={() => Linking.openURL('https://buzo.app/privacy')}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  headerRight: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: spacing.xl * 2,
  },
  premiumBanner: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  currentSubscriptionContainer: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  currentSubscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  currentSubscriptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  premiumBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  premiumBadgeText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 12,
  },
  subscriptionDetails: {
    marginBottom: spacing.md,
  },
  subscriptionDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subscriptionDetailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  subscriptionDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  cancelButton: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '500',
  },
  plansContainer: {
    margin: spacing.lg,
  },
  plansTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  planOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planCard: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.xs,
    ...shadows.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  selectedPlan: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  selectedBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 4,
    borderRadius: borderRadius.sm,
  },
  selectedBadgeText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 10,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  planPeriod: {
    fontSize: 14,
    fontWeight: 'normal',
    color: colors.textSecondary,
  },
  planDescription: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  savingsBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderBottomLeftRadius: borderRadius.md,
  },
  savingsBadgeText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 10,
  },
  featuresContainer: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  subscribeButton: {
    margin: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  subscribeButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  termsContainer: {
    marginHorizontal: spacing.lg,
  },
  termsText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  termsLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});

export default SubscriptionScreen; 