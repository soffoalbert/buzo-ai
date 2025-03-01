import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation';
import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import * as Haptics from 'expo-haptics';
import PremiumBanner from '../components/PremiumBanner';

import { 
  getUserSubscription, 
  hasPremiumAccess, 
  cancelPremiumSubscription,
  getPremiumFeatures,
  FREE_PLAN_LIMITS
} from '../services/subscriptionService';
import { 
  initializeIAP, 
  getSubscriptionProducts, 
  requestSubscription, 
  restorePurchases,
  openStoreForSubscriptionManagement,
  SubscriptionProduct
} from '../services/appStorePaymentService';
import { SubscriptionInfo, SubscriptionTier } from '../models/User';
import { getProducts, purchaseSubscription } from '../services/appStorePaymentService';
import { getUserPurchaseValidations, PurchaseValidation } from '../services/receiptValidationService';
import { formatDate } from '../utils/dateUtils';

type SubscriptionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SubscriptionScreenProps {
  navigation: SubscriptionScreenNavigationProp;
  route: RouteProp<RootStackParamList, 'Subscription'>;
}

const { width, height } = Dimensions.get('window');

const MONTHLY_PRICE = 49.99;
const ANNUAL_PRICE = 499.99;
const CURRENCY = 'R';

const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [subscriptionProducts, setSubscriptionProducts] = useState<SubscriptionProduct[]>([]);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseValidation[]>([]);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const animatedCardValues = useRef([
    new Animated.Value(0),
    new Animated.Value(0)
  ]).current;
  
  // Run entrance animations when component mounts
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    ]).start();
    
    // Staggered animation for cards
    Animated.stagger(200, [
      Animated.timing(animatedCardValues[0], {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(animatedCardValues[1], {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // Initialize IAP when component mounts
  useEffect(() => {
    const setupIAP = async () => {
      await initializeIAP();
      const products = await getSubscriptionProducts();
      setSubscriptionProducts(products);
    };
    
    setupIAP();
  }, []);

  // Enhanced haptic feedback
  const triggerHaptic = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
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
      
      // Get subscription end date
      const endDate = await getSubscriptionEndDate();
      if (endDate) {
        setExpiryDate(endDate);
      }
      
      // Get purchase history from server validations
      const validations = await getUserPurchaseValidations();
      setPurchaseHistory(validations);
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
    
    // Get the product ID based on selected plan
    const productId = selectedPlan === 'monthly' 
      ? subscriptionProducts.find(p => p.period === 'month')?.productId
      : subscriptionProducts.find(p => p.period === 'year')?.productId;
    
    if (!productId) {
      Alert.alert('Error', 'Selected subscription plan not available. Please try again.');
      return;
    }
    
    // Show confirmation dialog
    const selectedProduct = subscriptionProducts.find(p => p.productId === productId);
    if (!selectedProduct) {
      Alert.alert('Error', 'Product information not available. Please try again.');
      return;
    }
    
    Alert.alert(
      'Confirm Subscription',
      `You are about to subscribe to Buzo Premium for ${selectedProduct.priceString}/${selectedProduct.period === 'month' ? 'month' : 'year'}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Subscribe', 
          onPress: async () => {
            setIsProcessing(true);
            try {
              // Request the subscription through the app store
              const success = await requestSubscription(productId);
              
              if (success) {
                // The subscription process is handled by the purchaseUpdatedListener in the appStorePaymentService
                // We'll refresh the subscription data after a short delay to reflect changes
                setTimeout(async () => {
                  await fetchSubscriptionData();
                  setIsProcessing(false);
                },
                2000);
              } else {
                setIsProcessing(false);
                Alert.alert(
                  'Subscription Interrupted',
                  'The subscription process was interrupted. Please try again.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('Error initiating subscription:', error);
              setIsProcessing(false);
              Alert.alert(
                'Subscription Error',
                'There was an error processing your subscription. Please try again.',
                [{ text: 'OK' }]
              );
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
      'Subscriptions must be canceled through the App Store or Google Play Store.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Go to Subscription Settings', 
          onPress: () => {
            openStoreForSubscriptionManagement();
          }
        }
      ]
    );
  };

  // Handle restore purchases
  const handleRestorePurchases = async () => {
    triggerHaptic();
    setIsProcessing(true);
    
    try {
      const restored = await restorePurchases();
      
      if (restored) {
        Alert.alert(
          'Purchases Restored',
          'Your premium subscription has been restored.',
          [{ text: 'OK' }]
        );
        
        // Refresh premium status
        const premium = await hasPremiumAccess();
        setIsPremium(premium);
        
        // Refresh expiry date
        const endDate = await getSubscriptionEndDate();
        if (endDate) {
          setExpiryDate(endDate);
        }
        
        // Refresh purchase history
        const validations = await getUserPurchaseValidations();
        setPurchaseHistory(validations);
      } else {
        Alert.alert(
          'No Purchases Found',
          'We couldn\'t find any previous purchases to restore.',
          [{ text: 'OK' }]
        );
      }
      
      // Refresh subscription data
      await fetchSubscriptionData();
    } catch (error) {
      console.error('Error restoring purchases:', error);
      Alert.alert(
        'Restore Failed',
        'There was an error restoring your purchases. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Render premium features
  const renderFeatures = () => {
    const features = getPremiumFeatures();
    
    return (
      <View style={styles.featuresContainer}>
        <Text style={styles.sectionTitle}>Premium Features</Text>
        
        {features.map((feature, index) => (
          <Animated.View 
            key={index} 
            style={[
              styles.featureItem,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: translateY.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 15 * (index + 1)]
                    })
                  }
                ]
              }
            ]}
          >
            <View style={styles.featureIconContainer}>
              <Ionicons name={feature.icon as any} size={24} color={colors.primary} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    );
  };
  
  // Render comparison table
  const renderComparisonTable = () => {
    const comparisonFeatures = [
      {
        name: 'Savings Goals',
        free: `Limited (${FREE_PLAN_LIMITS.MAX_SAVINGS_GOALS})`,
        premium: 'Unlimited',
        icon: 'trending-up-outline'
      },
      {
        name: 'Budget Categories',
        free: `Limited (${FREE_PLAN_LIMITS.MAX_BUDGETS})`,
        premium: 'Unlimited',
        icon: 'wallet-outline'
      },
      {
        name: 'Receipt Scanning',
        free: `${FREE_PLAN_LIMITS.MAX_RECEIPT_SCANS_PER_MONTH}/month`,
        premium: 'Unlimited',
        icon: 'camera-outline'
      },
      {
        name: 'Bank Statement Analysis',
        free: `${FREE_PLAN_LIMITS.MAX_BANK_STATEMENTS_PER_MONTH}/month`,
        premium: 'Unlimited',
        icon: 'document-text-outline'
      },
      {
        name: 'Personalized Coaching',
        free: 'Not available',
        premium: 'Included',
        icon: 'person-outline'
      },
      {
        name: 'Detailed Analytics',
        free: 'Basic',
        premium: 'Advanced',
        icon: 'analytics-outline'
      },
      {
        name: 'Financial Tips',
        free: 'Weekly',
        premium: 'Daily',
        icon: 'bulb-outline'
      },
      {
        name: 'Priority Support',
        free: 'Not available',
        premium: 'Included',
        icon: 'headset-outline'
      },
      {
        name: 'Ad-Free Experience',
        free: 'Ads shown',
        premium: 'No ads',
        icon: 'shield-checkmark-outline'
      },
      {
        name: 'Custom Categories',
        free: 'Not available',
        premium: 'Included',
        icon: 'options-outline'
      }
    ];
    
    return (
      <Animated.View 
        style={[
          styles.comparisonContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY }, { scale: scaleAnim }]
          }
        ]}
      >
        <Text style={styles.sectionTitle}>Plan Comparison</Text>
        
        {/* Header Row */}
        <View style={styles.comparisonHeaderRow}>
          <Text style={[styles.comparisonHeaderCell, styles.featureCell]}>Feature</Text>
          <Text style={[styles.comparisonHeaderCell, styles.freeCell]}>Free</Text>
          <Text style={[styles.comparisonHeaderCell, styles.premiumCell]}>Premium</Text>
        </View>
        
        {/* Feature Rows */}
        {comparisonFeatures.map((feature, index) => (
          <Animated.View 
            key={index} 
            style={[
              styles.comparisonRow,
              index === comparisonFeatures.length - 1 && styles.comparisonRowLast,
              {
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                }),
                transform: [{ 
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })
                }]
              }
            ]}
          >
            <View style={[styles.comparisonCell, styles.featureCell]}>
              <Ionicons name={feature.icon as any} size={18} color={colors.text} style={styles.featureIcon} />
              <Text style={styles.featureName}>{feature.name}</Text>
            </View>
            <View style={[styles.comparisonCell, styles.freeCell]}>
              <Text 
                style={[
                  styles.planValue,
                  feature.free.includes('Not') && styles.notAvailableText
                ]}
              >
                {feature.free}
              </Text>
            </View>
            <View style={[styles.comparisonCell, styles.premiumCell]}>
              <Text style={[styles.planValue, styles.premiumValue]}>
                {feature.premium}
              </Text>
            </View>
          </Animated.View>
        ))}
      </Animated.View>
    );
  };
  
  // Render subscription plans
  const renderSubscriptionPlans = () => {
    // Use actual subscription products from the store if available
    const monthlyProduct = subscriptionProducts.find(p => p.period === 'month');
    const annualProduct = subscriptionProducts.find(p => p.period === 'year');
    
    return (
      <View style={styles.subscriptionPlansContainer}>
        <Text style={styles.subscriptionPlansTitle}>Choose Your Plan</Text>
        
        <View style={styles.planCardsContainer}>
          <Animated.View style={{
            flex: 1,
            opacity: animatedCardValues[0],
            transform: [{ 
              translateY: animatedCardValues[0].interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0]
              })
            }]
          }}>
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
                {monthlyProduct?.priceString || `R${MONTHLY_PRICE}`}
                <Text style={styles.planPeriod}>/month</Text>
              </Text>
              
              <Text style={styles.planDescription}>
                Access all premium features
              </Text>
            </TouchableOpacity>
          </Animated.View>
          
          <Animated.View style={{
            flex: 1,
            opacity: animatedCardValues[1],
            transform: [{ 
              translateY: animatedCardValues[1].interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0]
              })
            }]
          }}>
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
                {annualProduct?.priceString || `R${ANNUAL_PRICE}`}
                <Text style={styles.planPeriod}>/year</Text>
              </Text>
              
              <Text style={styles.planDescription}>
                Save 17% compared to monthly billing
              </Text>
              
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsBadgeText}>Best Value</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
        
        <TouchableOpacity
          style={[
            styles.subscribeButton,
            isProcessing && styles.subscribeButtonDisabled
          ]}
          onPress={handleSubscribe}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          <Text style={styles.subscribeButtonText}>
            {isProcessing ? 'Processing...' : 'Subscribe Now'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestorePurchases}
          disabled={isProcessing}
        >
          <Text style={styles.restoreButtonText}>
            Restore Purchases
          </Text>
        </TouchableOpacity>
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
            <Ionicons name="star" size={14} color={colors.white} style={{ marginRight: 4 }} />
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
        
        {subscription.autoRenew && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelSubscription}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>
              Cancel Subscription
            </Text>
          </TouchableOpacity>
        )}

        {!subscription.autoRenew && (
          <View style={styles.expirationContainer}>
            <Ionicons name="information-circle-outline" size={20} color={colors.secondary} />
            <Text style={styles.expirationText}>
              Your subscription will end on {formattedEndDate}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar style="auto" />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading subscription details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityHint="Navigates to the previous screen"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Premium Experience</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Current subscription with enhanced UI */}
        {subscription && (
          <Animated.View 
            style={[
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
            ]}
          >
            {renderCurrentSubscription()}
          </Animated.View>
        )}
        
        {/* Premium Banner */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }}
        >
          <View style={styles.premiumIntroContainer}>
            <Ionicons 
              name="diamond" 
              size={60} 
              color={colors.primary} 
              style={styles.premiumIcon}
            />
            <Text style={styles.premiumIntroTitle}>
              Unlock Your Financial Potential
            </Text>
            <Text style={styles.premiumIntroText}>
              Upgrade to Buzo Premium for exclusive features designed to accelerate your financial growth and literacy.
            </Text>
          </View>
        </Animated.View>
        
        {/* Enhanced Features Section */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY }]
          }}
        >
          {renderFeatures()}
        </Animated.View>
        
        {/* Enhanced Comparison Table */}
        {renderComparisonTable()}
        
        {/* Enhanced Subscription Plans */}
        {!isPremium && (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY }]
            }}
          >
            {renderSubscriptionPlans()}
          </Animated.View>
        )}

        {/* Purchase History */}
        {purchaseHistory.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>Purchase History</Text>
            {purchaseHistory.map((purchase) => (
              <View key={purchase.id} style={styles.historyItem}>
                <Text style={styles.historyProduct}>{purchase.product_id}</Text>
                <Text style={styles.historyDate}>
                  Purchased: {formatDate(new Date(purchase.purchase_date))}
                </Text>
                <Text 
                  style={[
                    styles.historyStatus, 
                    purchase.is_valid ? styles.validStatus : styles.invalidStatus
                  ]}
                >
                  {purchase.is_valid ? 'Valid' : 'Expired'}
                </Text>
                {purchase.expiration_date && (
                  <Text style={styles.historyExpiry}>
                    Expires: {formatDate(new Date(purchase.expiration_date))}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          By subscribing, you agree to our Terms of Service and Privacy Policy. 
          Your subscription will automatically renew unless auto-renew is turned off 
          at least 24 hours before the end of the current period. You can manage your
          subscriptions in your App Store or Google Play Store account settings.
        </Text>
      </ScrollView>
      
      {/* Processing Overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.processingText}>Processing your request...</Text>
          </View>
        </View>
      )}
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
    paddingVertical: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.lg,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  backButton: {
    padding: 8,
    borderRadius: borderRadius.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  premiumIntroContainer: {
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    ...shadows.md,
  },
  premiumIcon: {
    width: 80,
    height: 80,
    marginBottom: spacing.md,
  },
  premiumIntroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  premiumIntroText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  currentSubscriptionContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.md,
  },
  currentSubscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  currentSubscriptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: borderRadius.sm,
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  subscriptionDetails: {
    marginBottom: spacing.md,
  },
  subscriptionDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subscriptionDetailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  subscriptionDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  expirationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  expirationText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.secondary,
    flex: 1,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  featuresContainer: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    ...shadows.md,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  comparisonContainer: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    ...shadows.md,
  },
  comparisonHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  comparisonRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  comparisonRowLast: {
    borderBottomWidth: 0,
  },
  comparisonHeaderCell: {
    flex: 1,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  comparisonCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  featureCell: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  freeCell: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  premiumCell: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    backgroundColor: colors.primaryLight,
  },
  featureIcon: {
    marginRight: spacing.xs,
  },
  featureName: {
    fontSize: 14,
    color: colors.text,
  },
  planValue: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.text,
  },
  premiumValue: {
    color: colors.primary,
    fontWeight: '600',
  },
  notAvailableText: {
    color: colors.textSecondary,
  },
  subscriptionPlansContainer: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
  },
  subscriptionPlansTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  planCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  planCard: {
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.xs,
    ...shadows.md,
    position: 'relative',
    overflow: 'hidden',
  },
  selectedPlan: {
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadows.md,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  selectedBadge: {
    backgroundColor: colors.primary,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: borderRadius.sm,
  },
  selectedBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  planPeriod: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  planDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  savingsBadge: {
    position: 'absolute',
    top: 10,
    right: -30,
    backgroundColor: colors.secondary,
    paddingVertical: 4,
    paddingHorizontal: 30,
    transform: [{ rotate: '45deg' }],
  },
  savingsBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  subscribeButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  subscribeButtonDisabled: {
    backgroundColor: colors.textSecondary,
  },
  subscribeButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  restoreButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    lineHeight: 18,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  processingContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.lg,
    width: '80%',
  },
  processingText: {
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.md,
    fontWeight: '500',
  },
  historyContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    margin: spacing.md,
    padding: spacing.md,
    ...shadows.md,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  historyItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  historyProduct: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  historyDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  historyStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    marginVertical: spacing.xs,
  },
  validStatus: {
    color: colors.success,
  },
  invalidStatus: {
    color: colors.error,
  },
  historyExpiry: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});

export default SubscriptionScreen; 