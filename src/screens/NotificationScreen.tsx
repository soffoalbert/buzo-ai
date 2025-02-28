import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { format, isToday, isYesterday } from 'date-fns';

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

  // Load notifications and preferences
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load notification history
      const history = await notificationService.getNotificationHistory();
      setNotifications(history);
      
      // Load notification preferences
      const prefs = await notificationService.getNotificationPreferences();
      setPreferences(prefs);
      
      // Set quiet hours time inputs
      if (prefs.quietHoursStart) {
        const [hour, minute] = prefs.quietHoursStart.split(':');
        setStartHour(hour);
        setStartMinute(minute);
      }
      
      if (prefs.quietHoursEnd) {
        const [hour, minute] = prefs.quietHoursEnd.split(':');
        setEndHour(hour);
        setEndMinute(minute);
      }
    } catch (error) {
      console.error('Error loading notification data:', error);
      Alert.alert('Error', 'Failed to load notifications. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Handle back button press
  const handleBackPress = () => {
    navigation.goBack();
  };

  // Handle notification item press
  const handleNotificationPress = async (notification: NotificationHistoryItem) => {
    // Mark notification as read
    if (!notification.read) {
      await notificationService.markNotificationAsRead(notification.id);
      
      // Update notifications list
      setNotifications(prevNotifications => 
        prevNotifications.map(item => 
          item.id === notification.id ? { ...item, read: true } : item
        )
      );
    }
    
    // Navigate based on notification type
    switch (notification.type) {
      case NotificationType.BUDGET_ALERT:
        navigation.navigate('Budget');
        break;
      case NotificationType.SAVINGS_MILESTONE:
        navigation.navigate('Savings');
        break;
      case NotificationType.EXPENSE_REMINDER:
        navigation.navigate('Expenses');
        break;
      case NotificationType.FINANCIAL_TIP:
        navigation.navigate('Learn');
        break;
      default:
        // Do nothing
        break;
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllNotificationsAsRead();
      
      // Update notifications list
      setNotifications(prevNotifications => 
        prevNotifications.map(item => ({ ...item, read: true }))
      );
      
      Alert.alert('Success', 'All notifications marked as read.');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      Alert.alert('Error', 'Failed to mark all notifications as read. Please try again.');
    }
  };

  // Handle clear all notifications
  const handleClearAll = async () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationService.clearNotificationHistory();
              setNotifications([]);
              Alert.alert('Success', 'All notifications cleared.');
            } catch (error) {
              console.error('Error clearing notifications:', error);
              Alert.alert('Error', 'Failed to clear notifications. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Handle toggle notification preference
  const handleTogglePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    try {
      const updatedPreferences = { ...preferences, [key]: value };
      
      // If disabling all notifications, confirm with user
      if (key === 'enabled' && !value) {
        Alert.alert(
          'Disable Notifications',
          'Are you sure you want to disable all notifications? You may miss important updates about your finances.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Disable', 
              style: 'destructive',
              onPress: async () => {
                await notificationService.updateNotificationPreferences(updatedPreferences);
                setPreferences(updatedPreferences);
              }
            }
          ]
        );
        return;
      }
      
      await notificationService.updateNotificationPreferences(updatedPreferences);
      setPreferences(updatedPreferences);
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      Alert.alert('Error', 'Failed to update notification preferences. Please try again.');
    }
  };

  // Handle save quiet hours
  const handleSaveQuietHours = async () => {
    try {
      // Validate inputs
      const startHourNum = parseInt(startHour, 10);
      const startMinuteNum = parseInt(startMinute, 10);
      const endHourNum = parseInt(endHour, 10);
      const endMinuteNum = parseInt(endMinute, 10);
      
      if (
        isNaN(startHourNum) || isNaN(startMinuteNum) || isNaN(endHourNum) || isNaN(endMinuteNum) ||
        startHourNum < 0 || startHourNum > 23 || startMinuteNum < 0 || startMinuteNum > 59 ||
        endHourNum < 0 || endHourNum > 23 || endMinuteNum < 0 || endMinuteNum > 59
      ) {
        Alert.alert('Invalid Time', 'Please enter valid hours (0-23) and minutes (0-59).');
        return;
      }
      
      // Format times
      const quietHoursStart = `${startHourNum.toString().padStart(2, '0')}:${startMinuteNum.toString().padStart(2, '0')}`;
      const quietHoursEnd = `${endHourNum.toString().padStart(2, '0')}:${endMinuteNum.toString().padStart(2, '0')}`;
      
      // Update preferences
      const updatedPreferences = { 
        ...preferences, 
        quietHoursStart, 
        quietHoursEnd,
        quietHoursEnabled: true
      };
      
      await notificationService.updateNotificationPreferences(updatedPreferences);
      setPreferences(updatedPreferences);
      setShowQuietHoursModal(false);
    } catch (error) {
      console.error('Error saving quiet hours:', error);
      Alert.alert('Error', 'Failed to save quiet hours. Please try again.');
    }
  };

  // Handle sending test notifications
  const handleSendTestNotifications = async () => {
    try {
      await testNotifications.sendAllTestNotifications();
      Alert.alert('Success', 'Test notifications sent successfully. Check your notification history in a few seconds.');
      
      // Refresh the notification list after a short delay
      setTimeout(() => {
        loadData();
      }, 1000);
    } catch (error) {
      console.error('Error sending test notifications:', error);
      Alert.alert('Error', 'Failed to send test notifications. Please try again.');
    }
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

  // Get icon for notification type
  const getNotificationIcon = (type: NotificationType): string => {
    switch (type) {
      case NotificationType.BUDGET_ALERT:
        return 'wallet-outline';
      case NotificationType.SAVINGS_MILESTONE:
        return 'trending-up-outline';
      case NotificationType.EXPENSE_REMINDER:
        return 'cash-outline';
      case NotificationType.FINANCIAL_TIP:
        return 'bulb-outline';
      default:
        return 'notifications-outline';
    }
  };

  // Render notification item
  const renderNotificationItem = ({ item }: { item: NotificationHistoryItem }) => (
    <TouchableOpacity
      style={[styles.notificationItem, item.read ? styles.notificationItemRead : null]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationIcon}>
        <Ionicons name={getNotificationIcon(item.type) as any} size={24} color={colors.primary} />
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationBody}>{item.body}</Text>
        <Text style={styles.notificationTime}>{formatTimestamp(item.timestamp)}</Text>
      </View>
      {!item.read && <View style={styles.unreadIndicator} />}
    </TouchableOpacity>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-off-outline" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyStateTitle}>No Notifications</Text>
      <Text style={styles.emptyStateText}>
        You don't have any notifications yet. We'll notify you about budget alerts, savings milestones, and financial tips.
      </Text>
    </View>
  );

  // Render quiet hours modal
  const renderQuietHoursModal = () => (
    <Modal
      visible={showQuietHoursModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowQuietHoursModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Set Quiet Hours</Text>
          <Text style={styles.modalDescription}>
            During quiet hours, notifications will be silenced. They will still appear in your notification history.
          </Text>
          
          <View style={styles.timeInputContainer}>
            <Text style={styles.timeInputLabel}>Start Time:</Text>
            <View style={styles.timeInputs}>
              <TextInput
                style={styles.timeInput}
                value={startHour}
                onChangeText={setStartHour}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="HH"
              />
              <Text style={styles.timeInputSeparator}>:</Text>
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
            <Text style={styles.timeInputLabel}>End Time:</Text>
            <View style={styles.timeInputs}>
              <TextInput
                style={styles.timeInput}
                value={endHour}
                onChangeText={setEndHour}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="HH"
              />
              <Text style={styles.timeInputSeparator}>:</Text>
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
          
          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              onPress={() => setShowQuietHoursModal(false)}
              variant="secondary"
              size="small"
              style={styles.modalButton}
            />
            <Button
              title="Save"
              onPress={handleSaveQuietHours}
              variant="primary"
              size="small"
              style={styles.modalButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
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
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRight}>
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Notification Preferences */}
      <View style={styles.preferencesContainer}>
        <Text style={styles.sectionTitle}>Notification Settings</Text>
        
        <View style={styles.preferenceItem}>
          <View style={styles.preferenceContent}>
            <Text style={styles.preferenceTitle}>Enable Notifications</Text>
            <Text style={styles.preferenceDescription}>
              Receive alerts about your finances
            </Text>
          </View>
          <Switch
            value={preferences.enabled}
            onValueChange={(value) => handleTogglePreference('enabled', value)}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={preferences.enabled ? colors.primary : '#f4f3f4'}
            ios_backgroundColor={colors.border}
          />
        </View>
        
        {preferences.enabled && (
          <>
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceTitle}>Budget Alerts</Text>
                <Text style={styles.preferenceDescription}>
                  Get notified when approaching budget limits
                </Text>
              </View>
              <Switch
                value={preferences.budgetAlerts}
                onValueChange={(value) => handleTogglePreference('budgetAlerts', value)}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={preferences.budgetAlerts ? colors.primary : '#f4f3f4'}
                ios_backgroundColor={colors.border}
              />
            </View>
            
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceTitle}>Savings Milestones</Text>
                <Text style={styles.preferenceDescription}>
                  Celebrate when you reach savings goals
                </Text>
              </View>
              <Switch
                value={preferences.savingsMilestones}
                onValueChange={(value) => handleTogglePreference('savingsMilestones', value)}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={preferences.savingsMilestones ? colors.primary : '#f4f3f4'}
                ios_backgroundColor={colors.border}
              />
            </View>
            
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceTitle}>Expense Reminders</Text>
                <Text style={styles.preferenceDescription}>
                  Reminders to log your expenses
                </Text>
              </View>
              <Switch
                value={preferences.expenseReminders}
                onValueChange={(value) => handleTogglePreference('expenseReminders', value)}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={preferences.expenseReminders ? colors.primary : '#f4f3f4'}
                ios_backgroundColor={colors.border}
              />
            </View>
            
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceTitle}>Financial Tips</Text>
                <Text style={styles.preferenceDescription}>
                  Receive helpful financial advice
                </Text>
              </View>
              <Switch
                value={preferences.financialTips}
                onValueChange={(value) => handleTogglePreference('financialTips', value)}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={preferences.financialTips ? colors.primary : '#f4f3f4'}
                ios_backgroundColor={colors.border}
              />
            </View>
            
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceTitle}>Quiet Hours</Text>
                <Text style={styles.preferenceDescription}>
                  {preferences.quietHoursEnabled
                    ? `From ${preferences.quietHoursStart} to ${preferences.quietHoursEnd}`
                    : 'Set hours when notifications are silenced'}
                </Text>
              </View>
              <View style={styles.quietHoursControls}>
                <Switch
                  value={preferences.quietHoursEnabled}
                  onValueChange={(value) => {
                    if (value) {
                      setShowQuietHoursModal(true);
                    } else {
                      handleTogglePreference('quietHoursEnabled', false);
                    }
                  }}
                  trackColor={{ false: colors.border, true: colors.primaryLight }}
                  thumbColor={preferences.quietHoursEnabled ? colors.primary : '#f4f3f4'}
                  ios_backgroundColor={colors.border}
                />
                {preferences.quietHoursEnabled && (
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => setShowQuietHoursModal(true)}
                  >
                    <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        )}
      </View>
      
      {/* Notification History */}
      <View style={styles.historyContainer}>
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Notification History</Text>
          <View style={styles.historyActions}>
            {notifications.length > 0 && (
              <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
                <Text style={styles.markAllText}>Mark all as read</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleSendTestNotifications} style={styles.testButton}>
              <Text style={styles.testButtonText}>Test</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.notificationsList}
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
      </View>
      
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
    fontSize: 16,
    fontWeight: "normal",
    lineHeight: 24,
    color: colors.text,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    lineHeight: 32,
    color: colors.text,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  clearButton: {
    padding: spacing.xs,
  },
  preferencesContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    lineHeight: 24,
    color: colors.text,
    marginBottom: spacing.md,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  preferenceContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: "500" as const,
    lineHeight: 22,
    color: colors.text,
  },
  preferenceDescription: {
    fontSize: 14,
    fontWeight: "normal",
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  quietHoursControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  historyContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: colors.primary,
  },
  testButton: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  testButtonText: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: colors.primary,
  },
  notificationsList: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  notificationItemRead: {
    opacity: 0.7,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 22,
    color: colors.text,
  },
  notificationBody: {
    fontSize: 14,
    fontWeight: "normal",
    lineHeight: 20,
    color: colors.text,
    marginTop: spacing.xs / 2,
  },
  notificationTime: {
    fontSize: 12,
    fontWeight: "normal",
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  unreadIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
    marginTop: spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    lineHeight: 24,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: "normal",
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600" as const,
    lineHeight: 28,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalDescription: {
    fontSize: 14,
    fontWeight: "normal",
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  timeInputLabel: {
    fontSize: 16,
    fontWeight: "500" as const,
    lineHeight: 22,
    color: colors.text,
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    width: 50,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
    textAlign: 'center',
  },
  timeInputSeparator: {
    fontSize: 20,
    fontWeight: "bold",
    marginHorizontal: spacing.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.lg,
  },
  modalButton: {
    marginLeft: spacing.sm,
  },
});

export default NotificationScreen; 