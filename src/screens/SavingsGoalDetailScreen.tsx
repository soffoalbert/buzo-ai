import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
  Animated,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Dimensions,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import ProgressBar from '../components/ProgressBar';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import AIRecommendationCard from '../components/AIRecommendationCard';
import Chart from '../components/Chart';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import { SavingsGoal, SavingsMilestone, SAVINGS_CATEGORIES } from '../models/SavingsGoal';
import { formatCurrency, calculatePercentage, calculateDaysLeft, formatDate } from '../utils/helpers';

const { width } = Dimensions.get('window');

const SavingsGoalDetailScreen = () => {
  // Mock data based on the screenshot
  const [savingsGoal, setSavingsGoal] = useState<SavingsGoal>({
    id: '1',
    title: 'Emergency fund 2025',
    description: 'Emergency Fund',
    targetAmount: 50000,
    currentAmount: 1000,
    startDate: '2025-01-03',
    targetDate: '2025-03-31',
    category: '1',
    isCompleted: false,
    isShared: false,
    milestones: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [contribution, setContribution] = useState('');
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneAmount, setMilestoneAmount] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [lastSynced, setLastSynced] = useState('5m ago');
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  
  // Animation values
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const syncButtonScale = useRef(new Animated.Value(1)).current;
  const addButtonScale = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  
  const navigation = useNavigation();
  
  // Get category info
  const category = SAVINGS_CATEGORIES.find(c => c.id === savingsGoal.category) || SAVINGS_CATEGORIES[0];
  
  // Calculate progress percentage
  const progress = calculatePercentage(savingsGoal.currentAmount, savingsGoal.targetAmount);
  
  // Calculate days left
  const daysLeft = calculateDaysLeft(savingsGoal.targetDate);
  
  // Daily recommendation
  const dailyAmount = Math.ceil(
    (savingsGoal.targetAmount - savingsGoal.currentAmount) / daysLeft
  );

  // Animate progress on mount and when progress changes
  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false
    }).start();
  }, [progress]);

  // Handle back navigation
  const handleBack = () => {
    navigation.goBack();
  };

  // Handle add contribution
  const handleAddContribution = () => {
    if (!contribution || isNaN(parseFloat(contribution))) {
      Alert.alert('Invalid Amount', 'Please enter a valid contribution amount');
      return;
    }

    const amount = parseFloat(contribution);
    const updatedGoal = {
      ...savingsGoal,
      currentAmount: savingsGoal.currentAmount + amount,
      updatedAt: new Date().toISOString()
    };

    // Animate add button
    Animated.sequence([
      Animated.timing(addButtonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(addButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();

    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setSavingsGoal(updatedGoal);
    setContribution('');
  };

  // Handle sync
  const handleSync = () => {
    // Animate sync button
    Animated.sequence([
      Animated.timing(syncButtonScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(syncButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Update last synced
    setLastSynced('just now');
  };

  // Handle scroll for header opacity
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: headerOpacity } } }],
    { useNativeDriver: false }
  );

  // Handle add milestone
  const handleAddMilestone = () => {
    if (!milestoneTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter a milestone title');
      return;
    }

    if (!milestoneAmount || isNaN(parseFloat(milestoneAmount))) {
      Alert.alert('Invalid Amount', 'Please enter a valid milestone amount');
      return;
    }

    const amount = parseFloat(milestoneAmount);
    if (amount > savingsGoal.targetAmount) {
      Alert.alert('Invalid Amount', 'Milestone amount cannot exceed the target amount');
      return;
    }

    const newMilestone: SavingsMilestone = {
      id: Date.now().toString(),
      title: milestoneTitle,
      targetAmount: amount,
      isCompleted: savingsGoal.currentAmount >= amount
    };

    const updatedMilestones = [...(savingsGoal.milestones || []), newMilestone];
    
    setSavingsGoal({
      ...savingsGoal,
      milestones: updatedMilestones,
      updatedAt: new Date().toISOString()
    });

    // Reset form
    setMilestoneTitle('');
    setMilestoneAmount('');
    setShowMilestoneModal(false);
    
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Create chart data for visualization
  const createChartData = () => {
    // For this example, we'll create a simple line chart showing savings progress over time
    return {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      datasets: [
        {
          data: [
            0,
            savingsGoal.currentAmount * 0.4,
            savingsGoal.currentAmount * 0.7,
            savingsGoal.currentAmount,
            savingsGoal.currentAmount * 1.4,
            savingsGoal.targetAmount
          ],
          color: () => category.color || colors.primary,
          strokeWidth: 2
        }
      ],
      legend: ["Projected Savings"]
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <Animated.View style={[
        styles.header,
        {
          backgroundColor: headerOpacity.interpolate({
            inputRange: [0, 100],
            outputRange: ['transparent', colors.background]
          }),
          shadowOpacity: headerOpacity.interpolate({
            inputRange: [0, 100],
            outputRange: [0, 0.1]
          })
        }
      ]}>
        <TouchableOpacity 
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <Animated.Text 
          style={[
            styles.headerTitle,
            {
              opacity: headerOpacity.interpolate({
                inputRange: [50, 100],
                outputRange: [0, 1]
              })
            }
          ]}
        >
          Savings Goal Details
        </Animated.Text>
      </Animated.View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Savings Goal Card */}
        <View style={styles.goalHeaderContainer}>
          <LinearGradient
            colors={[category.color + '40', 'transparent']}
            style={styles.goalGradient}
          >
            <View style={styles.goalIconContainer}>
              <Ionicons 
                name={category.icon as any || "medkit-outline"} 
                size={28} 
                color="#FFFFFF" 
              />
            </View>
            
            <View style={styles.goalTitleContainer}>
              <Text style={styles.goalTitle}>{savingsGoal.title}</Text>
              <Text style={styles.goalSubtitle}>{savingsGoal.description}</Text>
            </View>
          </LinearGradient>
        </View>
        
        {/* Progress Info */}
        <View style={styles.progressInfoContainer}>
          <View style={styles.amountRow}>
            <Text style={styles.currentAmount}>
              {formatCurrency(savingsGoal.currentAmount)}
            </Text>
            <Text style={styles.targetAmount}>
              of {formatCurrency(savingsGoal.targetAmount)}
            </Text>
          </View>
          
          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View 
                style={[
                  styles.progressBarFill,
                  {
                    width: progressAnimation.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%']
                    }),
                    backgroundColor: category.color || colors.primary
                  }
                ]}
              />
            </View>
            <Text style={styles.progressPercentage}>{progress.toFixed(0)}%</Text>
          </View>
          
          {/* Date Information */}
          <View style={styles.dateInfoContainer}>
            <View style={styles.dateColumn}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <Text style={styles.dateValue}>
                {formatDate(savingsGoal.startDate, 'short')}
              </Text>
            </View>
            
            <View style={styles.dateColumn}>
              <Text style={styles.dateLabel}>Target Date</Text>
              <Text style={styles.dateValue}>
                {formatDate(savingsGoal.targetDate, 'short')}
              </Text>
            </View>
            
            <View style={styles.dateColumn}>
              <Text style={styles.dateLabel}>Days Left</Text>
              <Text style={styles.dateValue}>{daysLeft}</Text>
            </View>
          </View>
        </View>
        
        {/* Contribution Input */}
        <View style={styles.contributionContainer}>
          <TextInput
            style={styles.contributionInput}
            placeholder="Enter contribution amount"
            value={contribution}
            onChangeText={setContribution}
            keyboardType="numeric"
            placeholderTextColor="#9CA3AF"
          />
          
          <Animated.View style={{ transform: [{ scale: addButtonScale }] }}>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={handleAddContribution}
              activeOpacity={0.7}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
        
        {/* Savings Visualization */}
        <Card
          title="Savings Progress"
          style={styles.chartCard}
          variant="savings"
        >
          <Chart
            type="line"
            data={createChartData()}
            height={200}
            formatYLabel={(value) => `R${parseInt(value) / 1000}k`}
          />
        </Card>
        
        {/* Milestones Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Milestones</Text>
            <TouchableOpacity 
              style={styles.addMilestoneButton}
              onPress={() => setShowMilestoneModal(true)}
            >
              <Ionicons name="add-circle" size={28} color={colors.primary} />
              <Text style={styles.addMilestoneText}>Add</Text>
            </TouchableOpacity>
          </View>
          
          {savingsGoal.milestones && savingsGoal.milestones.length > 0 ? (
            <FlatList
              data={savingsGoal.milestones}
              renderItem={({ item }) => (
                <Card
                  title={item.title}
                  amount={item.targetAmount}
                  progress={calculatePercentage(
                    Math.min(savingsGoal.currentAmount, item.targetAmount),
                    item.targetAmount
                  )}
                  variant="savings"
                  style={styles.milestoneCard}
                  rightComponent={
                    item.isCompleted && (
                      <View style={styles.completedBadge}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                      </View>
                    )
                  }
                />
              )}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              contentContainerStyle={{marginTop: 8}}
            />
          ) : (
            <View style={styles.emptyMilestones}>
              <Ionicons name="flag-outline" size={48} color="#9CA3AF" style={styles.emptyIcon} />
              <Text style={styles.emptyText}>
                No milestones yet. Add milestones to break down your savings goal into achievable steps!
              </Text>
            </View>
          )}
        </View>
        
        {/* Recommendations */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          
          <AIRecommendationCard 
            recommendation={{
              id: '1',
              content: `To reach your goal by the target date, you should save about R ${dailyAmount.toFixed(2)} daily.`,
              type: 'savings',
              timestamp: new Date().toISOString()
            }}
          />
          
          <Card
            style={styles.tipsCard}
            variant="savings"
          >
            <View style={styles.tipContent}>
              <Ionicons name="bulb-outline" size={24} color={colors.accent} style={styles.tipIcon} />
              <Text style={styles.tipText}>
                Set up automatic transfers to consistently build your emergency fund without having to think about it.
              </Text>
            </View>
          </Card>
        </View>
      </ScrollView>
      
      {/* Milestone Modal */}
      <Modal
        visible={showMilestoneModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMilestoneModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Milestone</Text>
              <TouchableOpacity
                onPress={() => setShowMilestoneModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalForm}>
              <Input
                label="Milestone Title"
                placeholder="E.g., First month's savings"
                value={milestoneTitle}
                onChangeText={setMilestoneTitle}
                containerStyle={styles.inputContainer}
                required
              />
              
              <Input
                label="Target Amount"
                placeholder="Amount to reach"
                value={milestoneAmount}
                onChangeText={setMilestoneAmount}
                keyboardType="numeric"
                containerStyle={styles.inputContainer}
                leftIcon={<Text style={styles.currencyIcon}>R</Text>}
                required
              />
              
              <View style={styles.modalFooter}>
                <Button
                  title="Cancel"
                  onPress={() => setShowMilestoneModal(false)}
                  variant="outline"
                  style={styles.modalButton}
                />
                
                <Button
                  title="Add Milestone"
                  onPress={handleAddMilestone}
                  variant="primary"
                  style={[styles.modalButton, styles.modalPrimaryButton]}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E8F5E9',
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  onlineStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  online: {
    backgroundColor: '#10B981',
  },
  offline: {
    backgroundColor: '#EF4444',
  },
  onlineStatusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  syncTimeText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  syncButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 32,
  },
  goalHeaderContainer: {
    marginTop: 60,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  goalGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  goalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  goalTitleContainer: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  goalSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  progressInfoContainer: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currentAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  targetAmount: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 8,
  },
  progressBarContainer: {
    marginTop: 12,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    alignSelf: 'flex-end',
    fontSize: 14,
    fontWeight: '500',
    color: '#4F46E5',
    marginTop: 4,
  },
  dateInfoContainer: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  dateColumn: {
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 4,
  },
  contributionContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
  },
  contributionInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    marginRight: 8,
  },
  addButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  chartCard: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  sectionContainer: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  addMilestoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addMilestoneText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4F46E5',
    marginLeft: 4,
  },
  milestoneCard: {
    marginBottom: 12,
  },
  completedBadge: {
    marginLeft: 8,
  },
  emptyMilestones: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  tipsCard: {
    marginTop: 12,
  },
  tipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  tipIcon: {
    marginRight: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    padding: 8,
  },
  modalForm: {
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  currencyIcon: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  modalPrimaryButton: {
    backgroundColor: '#4F46E5',
  },
});

export default SavingsGoalDetailScreen;