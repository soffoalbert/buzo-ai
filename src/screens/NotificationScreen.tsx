import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  FlatList,
  RefreshControl,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { format, isToday, isYesterday } from 'date-fns';
import * as Haptics from 'expo-haptics';

// Import services and utilities
import notificationService, {
  NotificationHistoryItem,
  NotificationType,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../services/notifications';
import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import Button from '../components/Button';
import testNotifications from '../utils/testNotifications';

const { width, height } = Dimensions.get('window');

type NotificationScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const NotificationScreen: React.FC = () => {
  const navigation = useNavigation<NotificationScreenNavigationProp>();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<NotificationHistoryItem[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [showQuietHoursModal, setShowQuietHoursModal] = useState(false);
  const [startHour, setStartHour] = useState('22');
  const [startMinute, setStartMinute] = useState('00');
  const [endHour, setEndHour] = useState('07');
  const [endMinute, setEndMinute] = useState('00');
  const [showSettings, setShowSettings] = useState(false);

  // Animation values
  const translateY = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const settingsHeight = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.9)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  
  // Trigger haptic feedback
  const triggerHaptic = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Vibration.vibrate(20);
    }
  };

  // Fetch notifications and preferences
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const notificationHistory = await notificationService.getNotificationHistory();
      setNotifications(notificationHistory);
      
      const userPrefs = await notificationService.getNotificationPreferences();
      setPreferences(userPrefs);
      
      // Set quiet hours time inputs
      if (userPrefs.quietHoursStart) {
        const [hr, min] = userPrefs.quietHoursStart.split(':');
        setStartHour(hr);
        setStartMinute(min);
      }
      
      if (userPrefs.quietHoursEnd) {
        const [hr, min] = userPrefs.quietHoursEnd.split(':');
        setEndHour(hr);
        setEndMinute(min);
      }
    } catch (error) {
      console.error('Error fetching notification data:', error);
      Alert.alert('Error', 'Failed to load notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Animate elements when component mounts
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true
      })
    ]).start();
  }, []);
  
  // Animate settings panel
  useEffect(() => {
    Animated.timing(settingsHeight, {
      toValue: showSettings ? 1 : 0,
      duration: 300,
      useNativeDriver: false
    }).start();
  }, [showSettings]);
  
  // Refresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );
  
  // Handle pull-to-refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchData().then(() => setRefreshing(false));
  };
  
  // Handle back button press
  const handleBackPress = () => {
    triggerHaptic();
    navigation.goBack();
  };
  
  // Handle notification press
  const handleNotificationPress = async (notification: NotificationHistoryItem) => {
    triggerHaptic();
    
    // Mark as read if not already
    if (!notification.read) {
      await notificationService.markNotificationAsRead(notification.id);
      
      // Update local state
      setNotifications(prev => 
        prev.map(item => 
          item.id === notification.id ? { ...item, read: true } : item
        )
      );
    }
    
    // Navigate to the appropriate screen based on notification type
    switch (notification.type) {
      case NotificationType.BUDGET_ALERT:
        navigation.navigate('ExpenseAnalytics');
        break;
      case NotificationType.SAVINGS_MILESTONE:
        navigation.navigate('AIAdvisor');
        break;
      case NotificationType.EXPENSE_REMINDER:
        navigation.navigate('ExpensesScreen');
        break;
      case NotificationType.FINANCIAL_TIP:
        navigation.navigate('BankStatements');
        break;
      default:
        // Do nothing
        break;
    }
  };
  
  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    triggerHaptic();
    
    if (notifications.filter(n => !n.read).length === 0) {
      Alert.alert('No Unread Notifications', 'All notifications are already marked as read.');
      return;
    }
    
    try {
      await notificationService.markAllNotificationsAsRead();
      
      // Update local state
      setNotifications(prev => 
        prev.map(item => ({ ...item, read: true }))
      );
      
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark notifications as read. Please try again.');
    }
  };
  
  // Handle clear all notifications
  const handleClearAll = async () => {
    triggerHaptic();
    
    if (notifications.length === 0) {
      Alert.alert('No Notifications', 'There are no notifications to clear.');
      return;
    }
    
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationService.clearNotificationHistory();
              setNotifications([]);
              Alert.alert('Success', 'All notifications have been cleared');
            } catch (error) {
              console.error('Error clearing notifications:', error);
              Alert.alert('Error', 'Failed to clear notifications. Please try again.');
            }
          }
        }
      ]
    );
  };
  
  // Toggle notification preference
  const handleTogglePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    triggerHaptic();
    
    try {
      // Create updated preferences object
      const updatedPreferences = {
        ...preferences,
        [key]: value
      };
      
      // Save to service
      await notificationService.updateNotificationPreferences(updatedPreferences);
      
      // Update local state
      setPreferences(updatedPreferences);
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      Alert.alert('Error', 'Failed to update notification preferences. Please try again.');
    }
  };
  
  // Save quiet hours settings
  const handleSaveQuietHours = async () => {
    triggerHaptic();
    
    try {
      // Validate time inputs
      const startHourNum = parseInt(startHour, 10);
      const startMinuteNum = parseInt(startMinute, 10);
      const endHourNum = parseInt(endHour, 10);
      const endMinuteNum = parseInt(endMinute, 10);
      
      if (
        isNaN(startHourNum) || startHourNum < 0 || startHourNum > 23 ||
        isNaN(startMinuteNum) || startMinuteNum < 0 || startMinuteNum > 59 ||
        isNaN(endHourNum) || endHourNum < 0 || endHourNum > 23 ||
        isNaN(endMinuteNum) || endMinuteNum < 0 || endMinuteNum > 59
      ) {
        Alert.alert('Invalid Time', 'Please enter valid times in 24-hour format.');
        return;
      }
      
      // Format time strings
      const formattedStartHour = startHourNum.toString().padStart(2, '0');
      const formattedStartMinute = startMinuteNum.toString().padStart(2, '0');
      const formattedEndHour = endHourNum.toString().padStart(2, '0');
      const formattedEndMinute = endMinuteNum.toString().padStart(2, '0');
      
      const quietHoursStart = `${formattedStartHour}:${formattedStartMinute}`;
      const quietHoursEnd = `${formattedEndHour}:${formattedEndMinute}`;
      
      // Create updated preferences object
      const updatedPreferences = {
        ...preferences,
        quietHoursStart,
        quietHoursEnd
      };
      
      // Save to service
      await notificationService.updateNotificationPreferences(updatedPreferences);
      
      // Update local state
      setPreferences(updatedPreferences);
      
      // Close modal
      setShowQuietHoursModal(false);
      
      Alert.alert('Success', 'Quiet hours updated successfully');
    } catch (error) {
      console.error('Error updating quiet hours:', error);
      Alert.alert('Error', 'Failed to update quiet hours. Please try again.');
    }
  };
  
  // Send test notifications
  const handleSendTestNotifications = async () => {
    triggerHaptic();
    
    try {
      await testNotifications.sendAllTestNotifications();
      setTimeout(() => fetchData(), 500);
      Alert.alert('Success', 'Test notifications have been added');
    } catch (error) {
      console.error('Error adding test notifications:', error);
      Alert.alert('Error', 'Failed to add test notifications. Please try again.');
    }
  };
  
  // Navigate to settings
  const handleNavigateToSettings = () => {
    triggerHaptic();
    setShowSettings(!showSettings);
  };
  
  // Format notification timestamp
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return `Today, ${format(date, 'h:mm a')}`;
    } else if (isYesterday(date)) {
      return `Yesterday, ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, yyyy h:mm a');
    }
  };
  
  // Get notification icon based on type
  const getNotificationIcon = (type: NotificationType): any => {
    switch (type) {
      case NotificationType.BUDGET_ALERT:
        return 'alert-circle-outline';
      case NotificationType.SAVINGS_MILESTONE:
        return 'trophy-outline';
      case NotificationType.EXPENSE_REMINDER:
        return 'calendar-outline';
      case NotificationType.FINANCIAL_TIP:
        return 'bulb-outline';
      default:
        return 'notifications-outline';
    }
  };
  
  // Render notification item
  const renderNotificationItem = ({ item }: { item: NotificationHistoryItem }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.read && styles.unreadItem]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: item.read ? colors.card : colors.primaryLight }]}>
        <Ionicons name={getNotificationIcon(item.type)} size={24} color={item.read ? colors.textSecondary : colors.primary} />
      </View>
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationTitle, !item.read && styles.unreadText]}>{item.title}</Text>
        <Text style={styles.notificationBody} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.notificationTime}>{formatTimestamp(item.timestamp)}</Text>
      </View>
      {!item.read && <View style={styles.unreadIndicator} />}
    </TouchableOpacity>
  );
  
  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Ionicons name="notifications-off-outline" size={60} color={colors.textSecondary} />
      <Text style={styles.emptyStateTitle}>No notifications yet</Text>
      <Text style={styles.emptyStateText}>
        When you receive notifications, they will appear here
      </Text>
      <Button 
        title="Send Test Notifications" 
        onPress={handleSendTestNotifications}
        style={styles.testButton}
      />
    </View>
  );
  
  // Render quiet hours modal
  const renderQuietHoursModal = () => (
    <Modal
      visible={showQuietHoursModal}
      animationType="none"
      transparent={true}
      onRequestClose={() => setShowQuietHoursModal(false)}
    >
      <View style={styles.modalOverlay}>
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              opacity: modalOpacity,
              transform: [{ scale: modalScale }]
            }
          ]}
        >
          <Text style={styles.modalTitle}>Set Quiet Hours</Text>
          <Text style={styles.modalSubtitle}>Notifications will be silenced during these hours</Text>
          
          <View style={styles.timeInputContainer}>
            <Text style={styles.timeLabel}>Start Time:</Text>
            <View style={styles.timeInputRow}>
              <TextInput
                style={styles.timeInput}
                value={startHour}
                onChangeText={setStartHour}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="HH"
              />
              <Text style={styles.timeSeparator}>:</Text>
              <TextInput
                style={styles.timeInput}
                value={startMinute}
                onChangeText={setStartMinute}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="MM"
              />
            </View>
          </View>
          
          <View style={styles.timeInputContainer}>
            <Text style={styles.timeLabel}>End Time:</Text>
            <View style={styles.timeInputRow}>
              <TextInput
                style={styles.timeInput}
                value={endHour}
                onChangeText={setEndHour}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="HH"
              />
              <Text style={styles.timeSeparator}>:</Text>
              <TextInput
                style={styles.timeInput}
                value={endMinute}
                onChangeText={setEndMinute}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="MM"
              />
            </View>
          </View>
          
          <Text style={styles.timeHint}>
            *Use 24-hour format (00:00 - 23:59)
          </Text>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowQuietHoursModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleSaveQuietHours}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );

  // Render notification settings
  const renderNotificationSettings = () => {
    return (
      <Animated.View style={[
        styles.settingsContainer,
        {
          maxHeight: settingsHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1000]
          }),
          opacity: settingsHeight
        }
      ]}>
        <Text style={styles.settingsTitle}>Notification Settings</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Enable Notifications</Text>
            <Text style={styles.settingDescription}>
              Turn on/off all notifications from Buzo
            </Text>
          </View>
          <Switch
            value={preferences.enabled}
            onValueChange={(value) => handleTogglePreference('enabled', value)}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={preferences.enabled ? colors.primary : colors.text}
            ios_backgroundColor={colors.border}
          />
        </View>
        
        <View style={styles.settingSeparator} />
        
        <Text style={styles.settingsSectionTitle}>Notification Types</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Budget Alerts</Text>
            <Text style={styles.settingDescription}>
              Alerts when you're approaching your budget limits
            </Text>
          </View>
          <Switch
            value={preferences.budgetAlerts}
            onValueChange={(value) => handleTogglePreference('budgetAlerts', value)}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={preferences.budgetAlerts ? colors.primary : colors.text}
            ios_backgroundColor={colors.border}
          />
        </View>
        
        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Savings Milestones</Text>
            <Text style={styles.settingDescription}>
              Celebrate when you reach savings milestones
            </Text>
          </View>
          <Switch
            value={preferences.savingsMilestones}
            onValueChange={(value) => handleTogglePreference('savingsMilestones', value)}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={preferences.savingsMilestones ? colors.primary : colors.text}
            ios_backgroundColor={colors.border}
          />
        </View>
        
        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Expense Reminders</Text>
            <Text style={styles.settingDescription}>
              Reminders to record your regular expenses
            </Text>
          </View>
          <Switch
            value={preferences.expenseReminders}
            onValueChange={(value) => handleTogglePreference('expenseReminders', value)}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={preferences.expenseReminders ? colors.primary : colors.text}
            ios_backgroundColor={colors.border}
          />
        </View>
        
        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Financial Tips</Text>
            <Text style={styles.settingDescription}>
              Helpful financial tips and advice
            </Text>
          </View>
          <Switch
            value={preferences.financialTips}
            onValueChange={(value) => handleTogglePreference('financialTips', value)}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={preferences.financialTips ? colors.primary : colors.text}
            ios_backgroundColor={colors.border}
          />
        </View>
        
        <View style={styles.settingSeparator} />
        
        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingTitle}>Quiet Hours</Text>
            <Text style={styles.settingDescription}>
              Silence notifications during specified hours
            </Text>
          </View>
          <Switch
            value={preferences.quietHoursEnabled}
            onValueChange={(value) => handleTogglePreference('quietHoursEnabled', value)}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={preferences.quietHoursEnabled ? colors.primary : colors.text}
            ios_backgroundColor={colors.border}
          />
        </View>
        
        {preferences.quietHoursEnabled && (
          <TouchableOpacity
            style={styles.quietHoursButton}
            onPress={() => {
              triggerHaptic();
              setShowQuietHoursModal(true);
              
              // Animate modal opening
              modalScale.setValue(0.9);
              modalOpacity.setValue(0);
              
              Animated.parallel([
                Animated.timing(modalScale, {
                  toValue: 1,
                  duration: 300,
                  useNativeDriver: true
                }),
                Animated.timing(modalOpacity, {
                  toValue: 1,
                  duration: 300,
                  useNativeDriver: true
                })
              ]).start();
            }}
          >
            <View style={styles.quietHoursButtonContent}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <Text style={styles.quietHoursButtonText}>
                {preferences.quietHoursStart} - {preferences.quietHoursEnd}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
        
        <View style={styles.settingSeparator} />
        
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleMarkAllAsRead}
          >
            <Ionicons name="checkmark-circle-outline" size={24} color={colors.primary} />
            <Text style={styles.actionButtonText}>Mark All as Read</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleClearAll}
          >
            <Ionicons name="trash-outline" size={24} color={colors.error} />
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Clear All Notifications</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };
  
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar style="auto" />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleBackPress} 
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityHint="Navigates to the previous screen"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity 
          onPress={handleNavigateToSettings}
          style={styles.settingsButton}
          accessibilityLabel="Notification settings"
          accessibilityHint="Opens notification settings panel"
        >
          <Ionicons 
            name={showSettings ? "close" : "settings-outline"} 
            size={24} 
            color={colors.primary} 
          />
        </TouchableOpacity>
      </View>
      
      {/* Settings Panel */}
      {renderNotificationSettings()}
      
      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item, index) => `notification-${item.id}-${index}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />
      
      {/* Quiet Hours Modal */}
      {renderQuietHoursModal()}
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
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.md,
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
  settingsButton: {
    padding: 8,
    borderRadius: borderRadius.sm,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  unreadItem: {
    backgroundColor: colors.white,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    ...shadows.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  unreadText: {
    fontWeight: '700',
    color: colors.text,
  },
  notificationBody: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  unreadIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
    alignSelf: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  testButton: {
    marginTop: spacing.md,
  },
  settingsContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.md,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  settingSeparator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  quietHoursButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  quietHoursButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quietHoursButtonText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  actionButtonsContainer: {
    marginTop: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: spacing.sm,
    fontWeight: '500',
  },
  deleteButton: {
    borderColor: colors.error,
  },
  deleteButtonText: {
    color: colors.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    width: '85%',
    ...shadows.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  timeInputContainer: {
    marginBottom: spacing.md,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.text,
    width: 60,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeSeparator: {
    fontSize: 20,
    color: colors.text,
    marginHorizontal: spacing.sm,
    fontWeight: '700',
  },
  timeHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default NotificationScreen; 