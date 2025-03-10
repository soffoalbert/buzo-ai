import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Notification types
export enum NotificationType {
  BUDGET_ALERT = 'BUDGET_ALERT',
  SAVINGS_MILESTONE = 'SAVINGS_MILESTONE',
  EXPENSE_REMINDER = 'EXPENSE_REMINDER',
  FINANCIAL_TIP = 'FINANCIAL_TIP',
}

// Notification data interface
interface NotificationData {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

// Notification history item interface
export interface NotificationHistoryItem {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  timestamp: number;
  read: boolean;
  data?: any;
}

// Notification preferences interface
export interface NotificationPreferences {
  enabled: boolean;
  budgetAlerts: boolean;
  savingsMilestones: boolean;
  expenseReminders: boolean;
  financialTips: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // Format: "HH:MM"
  quietHoursEnd: string; // Format: "HH:MM"
}

// Default notification preferences
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  budgetAlerts: true,
  savingsMilestones: true,
  expenseReminders: true,
  financialTips: true,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
};

// Storage key for notification history
const NOTIFICATION_HISTORY_KEY = 'buzo_notification_history';

// Storage key for notification preferences
const NOTIFICATION_PREFERENCES_KEY = 'buzo_notification_preferences';

class NotificationService {
  async init() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  }

  async requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async scheduleNotification(title: string, body: string, trigger?: Notifications.NotificationTriggerInput) {
    return Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
      },
      trigger,
    });
  }

  // Budget notifications
  async sendBudgetAlert({ budgetId, type, remainingPercentage }: { 
    budgetId: string; 
    type: 'threshold' | 'limit_reached'; 
    remainingPercentage: number;
  }) {
    const title = type === 'threshold' 
      ? 'Budget Alert' 
      : 'Budget Limit Reached';
    
    const body = type === 'threshold'
      ? `You have ${remainingPercentage.toFixed(1)}% remaining in your budget.`
      : 'You have reached your budget limit.';

    await this.scheduleNotification(title, body);
  }

  // Savings notifications
  async sendSavingsProgressAlert({ goalId, progress }: {
    goalId: string;
    progress: number;
  }) {
    const milestone = Math.floor(progress / 25) * 25; // Get nearest 25% milestone
    const title = 'Savings Goal Progress';
    const body = `Congratulations! You've reached ${milestone}% of your savings goal!`;

    await this.scheduleNotification(title, body);
  }

  async sendMilestoneAlert({ goalId, milestoneId, title: milestoneTitle }: {
    goalId: string;
    milestoneId: string;
    title: string;
  }) {
    const title = 'Milestone Achieved!';
    const body = `You've completed the milestone: ${milestoneTitle}`;

    await this.scheduleNotification(title, body);
  }

  // AI Insights notifications
  async sendFinancialInsight({ type, message }: {
    type: 'ai_insight' | 'recommendation' | 'alert';
    message: string;
  }) {
    const title = type === 'ai_insight' 
      ? 'Financial Insight'
      : type === 'recommendation'
      ? 'Recommendation'
      : 'Alert';

    await this.scheduleNotification(title, message);
  }

  // Automated savings notifications
  async scheduleSavingsReminder({ goalId, nextDate, amount }: {
    goalId: string;
    nextDate: Date;
    amount: number;
  }) {
    const title = 'Savings Reminder';
    const body = `Time to save R${amount.toFixed(2)} towards your goal!`;

    await this.scheduleNotification(title, body, {
      date: nextDate,
    });
  }

  // Budget-savings integration notifications
  async sendAutoSaveNotification({ budgetId, goalId, amount }: {
    budgetId: string;
    goalId: string;
    amount: number;
  }) {
    const title = 'Automatic Savings';
    const body = `R${amount.toFixed(2)} has been automatically saved from your budget.`;

    await this.scheduleNotification(title, body);
  }
}

export const notificationService = new NotificationService();

/**
 * Register for push notifications
 * @returns The Expo push token
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    console.log('Push notifications are not available on emulator');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo push token:', token);

    // Configure for Android
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
};

/**
 * Schedule a local notification
 * @param notification The notification data
 * @param delay Delay in seconds before showing the notification
 * @returns The notification identifier or null if notification should not be shown
 */
export const scheduleNotification = async (
  notification: NotificationData,
  delay: number = 0
): Promise<string | null> => {
  try {
    // Check if notification should be shown based on preferences
    const shouldShow = await shouldShowNotification(notification.type);
    if (!shouldShow) {
      console.log(`Notification of type ${notification.type} not shown due to user preferences`);
      return null;
    }
    
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        data: { ...notification.data, type: notification.type },
      },
      trigger: delay > 0 ? { seconds: delay } : null,
    });
    
    // Add to notification history
    await addNotificationToHistory({
      ...notification,
      id,
      timestamp: Date.now(),
      read: false,
    });
    
    return id;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    throw error;
  }
};

/**
 * Send a budget alert notification
 * @param category Budget category
 * @param percentage Percentage of budget used
 * @param limit Budget limit
 * @returns The notification identifier
 */
export const sendBudgetAlert = async (
  category: string,
  percentage: number,
  limit: number
): Promise<string> => {
  return await scheduleNotification({
    type: NotificationType.BUDGET_ALERT,
    title: 'Budget Alert',
    body: `You've used ${percentage}% of your ${category} budget (R${limit}).`,
    data: { category, percentage, limit },
  });
};

/**
 * Send a savings milestone notification
 * @param goal Savings goal title
 * @param percentage Percentage of goal achieved
 * @param target Target amount
 * @returns The notification identifier
 */
export const sendSavingsMilestone = async (
  goal: string,
  percentage: number,
  target: number
): Promise<string> => {
  return await scheduleNotification({
    type: NotificationType.SAVINGS_MILESTONE,
    title: 'Savings Milestone',
    body: `Congratulations! You've reached ${percentage}% of your ${goal} savings goal (R${target}).`,
    data: { goal, percentage, target },
  });
};

/**
 * Send an expense reminder notification
 * @param message Reminder message
 * @param delay Delay in seconds before showing the notification
 * @returns The notification identifier
 */
export const sendExpenseReminder = async (
  message: string,
  delay: number = 0
): Promise<string> => {
  return await scheduleNotification(
    {
      type: NotificationType.EXPENSE_REMINDER,
      title: 'Expense Reminder',
      body: message,
    },
    delay
  );
};

/**
 * Send a financial tip notification
 * @param tip Financial tip message
 * @param delay Delay in seconds before showing the notification
 * @returns The notification identifier
 */
export const sendFinancialTip = async (
  tip: string,
  delay: number = 0
): Promise<string> => {
  return await scheduleNotification(
    {
      type: NotificationType.FINANCIAL_TIP,
      title: 'Financial Tip',
      body: tip,
    },
    delay
  );
};

/**
 * Cancel a scheduled notification
 * @param notificationId The notification identifier
 */
export const cancelNotification = async (notificationId: string): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Error canceling notification:', error);
    throw error;
  }
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling all notifications:', error);
    throw error;
  }
};

/**
 * Get all scheduled notifications
 * @returns Array of scheduled notifications
 */
export const getAllScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    throw error;
  }
};

/**
 * Add a notification to history
 * @param notification The notification to add to history
 */
export const addNotificationToHistory = async (notification: NotificationHistoryItem): Promise<void> => {
  try {
    // Get existing history
    const history = await getNotificationHistory();
    
    // Add new notification to the beginning of the array
    history.unshift(notification);
    
    // Limit history to 50 items
    const limitedHistory = history.slice(0, 50);
    
    // Save updated history
    await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(limitedHistory));
  } catch (error) {
    console.error('Error adding notification to history:', error);
    throw error;
  }
};

/**
 * Get notification history
 * @returns Array of notification history items
 */
export const getNotificationHistory = async (): Promise<NotificationHistoryItem[]> => {
  try {
    const historyJson = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
    if (!historyJson) return [];
    
    const history: NotificationHistoryItem[] = JSON.parse(historyJson);
    return history.sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp (newest first)
  } catch (error) {
    console.error('Error getting notification history:', error);
    return [];
  }
};

/**
 * Mark a notification as read
 * @param notificationId The notification identifier
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const history = await getNotificationHistory();
    const updatedHistory = history.map(item => 
      item.id === notificationId ? { ...item, read: true } : item
    );
    await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (): Promise<void> => {
  try {
    const history = await getNotificationHistory();
    const updatedHistory = history.map(item => ({ ...item, read: true }));
    await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Clear notification history
 */
export const clearNotificationHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(NOTIFICATION_HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing notification history:', error);
    throw error;
  }
};

/**
 * Get unread notification count
 * @returns Number of unread notifications
 */
export const getUnreadNotificationCount = async (): Promise<number> => {
  try {
    const history = await getNotificationHistory();
    return history.filter(item => !item.read).length;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }
};

/**
 * Set up notification received listener
 * @param callback Function to call when a notification is received
 * @returns Subscription that should be removed on cleanup
 */
export const addNotificationReceivedListener = (
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription => {
  return Notifications.addNotificationReceivedListener((notification) => {
    // Add to notification history
    const { request } = notification;
    const { content } = request;
    const { title, body, data } = content;
    
    addNotificationToHistory({
      id: request.identifier,
      type: data?.type as NotificationType || NotificationType.FINANCIAL_TIP,
      title: title || 'Notification',
      body: body || '',
      data,
      timestamp: Date.now(),
      read: false,
    }).catch(error => console.error('Error adding received notification to history:', error));
    
    // Call the callback
    callback(notification);
  });
};

/**
 * Set up notification response listener
 * @param callback Function to call when a user responds to a notification
 * @returns Subscription that should be removed on cleanup
 */
export const addNotificationResponseReceivedListener = (
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription => {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    // Mark notification as read
    const { notification } = response;
    const { request } = notification;
    
    markNotificationAsRead(request.identifier)
      .catch(error => console.error('Error marking notification as read:', error));
    
    // Call the callback
    callback(response);
  });
};

/**
 * Remove notification subscription
 * @param subscription Subscription to remove
 */
export const removeNotificationSubscription = (
  subscription: Notifications.Subscription
): void => {
  Notifications.removeNotificationSubscription(subscription);
};

/**
 * Get notification preferences
 * @returns User's notification preferences
 */
export const getNotificationPreferences = async (): Promise<NotificationPreferences> => {
  try {
    const preferencesJson = await AsyncStorage.getItem(NOTIFICATION_PREFERENCES_KEY);
    if (!preferencesJson) return DEFAULT_NOTIFICATION_PREFERENCES;
    
    const preferences: NotificationPreferences = JSON.parse(preferencesJson);
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...preferences };
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
};

/**
 * Update notification preferences
 * @param preferences Updated notification preferences
 */
export const updateNotificationPreferences = async (
  preferences: Partial<NotificationPreferences>
): Promise<void> => {
  try {
    const currentPreferences = await getNotificationPreferences();
    const updatedPreferences = { ...currentPreferences, ...preferences };
    await AsyncStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(updatedPreferences));
    
    // If notifications are disabled, cancel all scheduled notifications
    if (!updatedPreferences.enabled) {
      await cancelAllNotifications();
    }
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    throw error;
  }
};

/**
 * Check if a notification should be shown based on preferences and quiet hours
 * @param type Notification type
 * @returns Whether the notification should be shown
 */
export const shouldShowNotification = async (type: NotificationType): Promise<boolean> => {
  try {
    const preferences = await getNotificationPreferences();
    
    // Check if notifications are enabled
    if (!preferences.enabled) {
      return false;
    }
    
    // Check if this type of notification is enabled
    switch (type) {
      case NotificationType.BUDGET_ALERT:
        if (!preferences.budgetAlerts) return false;
        break;
      case NotificationType.SAVINGS_MILESTONE:
        if (!preferences.savingsMilestones) return false;
        break;
      case NotificationType.EXPENSE_REMINDER:
        if (!preferences.expenseReminders) return false;
        break;
      case NotificationType.FINANCIAL_TIP:
        if (!preferences.financialTips) return false;
        break;
    }
    
    // Check quiet hours
    if (preferences.quietHoursEnabled) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      
      const start = preferences.quietHoursStart;
      const end = preferences.quietHoursEnd;
      
      // Check if current time is within quiet hours
      if (start <= end) {
        // Simple case: start time is before end time (e.g., 22:00 to 07:00)
        if (currentTime >= start && currentTime <= end) {
          return false;
        }
      } else {
        // Complex case: start time is after end time (e.g., 22:00 to 07:00)
        if (currentTime >= start || currentTime <= end) {
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking if notification should be shown:', error);
    return true; // Default to showing notification if there's an error
  }
};

/**
 * Check if current time is within quiet hours
 * @returns True if current time is within quiet hours, false otherwise
 */
export const isWithinQuietHours = async (): Promise<boolean> => {
  try {
    const preferences = await getNotificationPreferences();
    
    // If quiet hours are not enabled, return false
    if (!preferences.quietHoursEnabled) {
      return false;
    }
    
    const currentDate = new Date();
    const currentHours = currentDate.getHours();
    const currentMinutes = currentDate.getMinutes();
    
    const [startHours, startMinutes] = preferences.quietHoursStart.split(':').map(Number);
    const [endHours, endMinutes] = preferences.quietHoursEnd.split(':').map(Number);
    
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;
    const startTimeInMinutes = startHours * 60 + startMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;
    
    // Handle overnight quiet hours
    if (startTimeInMinutes > endTimeInMinutes) {
      // Quiet hours cross midnight (e.g., 22:00 to 07:00)
      return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
    } else {
      // Quiet hours within the same day (e.g., 01:00 to 07:00)
      return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
    }
  } catch (error) {
    console.error('Error checking quiet hours:', error);
    return false;
  }
};

/**
 * Schedule budget alert check based on user's spending patterns
 * This function should be called when a new expense is added
 */
export const scheduleBudgetCheck = async (): Promise<void> => {
  try {
    // Import dynamically to avoid circular dependencies
    const { getBudgetCategories, getCategorySpending } = await import('../services/budgetService');
    
    // Get all budget categories
    const categories = await getBudgetCategories();
    
    // Check each category for potential alerts
    for (const category of categories) {
      // Get current spending for the category
      const spending = await getCategorySpending(category.id);
      
      // Calculate percentage of budget used
      const percentage = Math.round((spending / category.limit) * 100);
      
      // Send alerts at 50%, 75%, 90%, and 100% thresholds
      if (percentage >= 50 && percentage < 75 && !category.alerts?.includes('50')) {
        await sendBudgetAlert(category.name, 50, category.limit);
        
        // Mark that we've sent the 50% alert
        // This would need to be implemented in the budget service
        await markBudgetAlert(category.id, '50');
      }
      else if (percentage >= 75 && percentage < 90 && !category.alerts?.includes('75')) {
        await sendBudgetAlert(category.name, 75, category.limit);
        await markBudgetAlert(category.id, '75');
      }
      else if (percentage >= 90 && percentage < 100 && !category.alerts?.includes('90')) {
        await sendBudgetAlert(category.name, 90, category.limit);
        await markBudgetAlert(category.id, '90');
      }
      else if (percentage >= 100 && !category.alerts?.includes('100')) {
        await sendBudgetAlert(category.name, 100, category.limit);
        await markBudgetAlert(category.id, '100');
      }
    }
  } catch (error) {
    console.error('Error scheduling budget check:', error);
  }
};

/**
 * Mark that a budget alert has been sent for a category
 * @param categoryId The budget category ID
 * @param alertThreshold The alert threshold (50, 75, 90, or 100)
 */
export const markBudgetAlert = async (categoryId: string, alertThreshold: string): Promise<void> => {
  try {
    // Import dynamically to avoid circular dependencies
    const { updateBudgetCategory, getBudgetCategory } = await import('../services/budgetService');
    
    // Get the current category
    const category = await getBudgetCategory(categoryId);
    
    if (!category) {
      return;
    }
    
    // Add the alert to the list of sent alerts
    const alerts = category.alerts || [];
    if (!alerts.includes(alertThreshold)) {
      alerts.push(alertThreshold);
    }
    
    // Update the category
    await updateBudgetCategory(categoryId, {
      ...category,
      alerts
    });
  } catch (error) {
    console.error('Error marking budget alert:', error);
  }
};

/**
 * Schedule daily financial tips
 * This should be called once during app initialization
 */
export const scheduleDailyTips = async (): Promise<void> => {
  try {
    const preferences = await getNotificationPreferences();
    
    // Skip if financial tips are disabled
    if (!preferences.financialTips) {
      return;
    }
    
    // Financial tips to be sent
    const tips = [
      "Set aside at least 10% of your income for saving and investing each month.",
      "Use the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings/debt.",
      "Create an emergency fund to cover 3-6 months of expenses.",
      "Pay yourself first - set up automatic transfers to your savings on payday.",
      "Review your subscriptions and cancel any you don't regularly use.",
      "Compare prices before making large purchases to get the best deal.",
      "Consider using cash for discretionary spending to stay within budget.",
      "Track your expenses daily to stay aware of your spending habits.",
      "Set specific, measurable, achievable, relevant, and time-bound (SMART) financial goals.",
      "Use the 24-hour rule: wait 24 hours before making non-essential purchases.",
    ];
    
    // Calculate time until next delivery (10:00 AM tomorrow)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    
    const delayInSeconds = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
    
    // Pick a random tip
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    
    // Schedule the notification
    await sendFinancialTip(randomTip, delayInSeconds);
    
    // We could also store that we've scheduled this so we don't schedule duplicates
  } catch (error) {
    console.error('Error scheduling daily tips:', error);
  }
};

/**
 * Initialize notification listeners
 * This should be called once during app initialization
 */
export const initializeNotifications = async (): Promise<void> => {
  try {
    // Check if notifications are enabled in the app settings
    const preferences = await getNotificationPreferences();
    
    if (!preferences.enabled) {
      return;
    }
    
    // Register for push notifications to get token
    const token = await registerForPushNotifications();
    
    // Setup notification listeners
    const receivedSubscription = addNotificationReceivedListener((notification) => {
      // When a notification is received, add it to history
      const { title, body, data } = notification.request.content;
      
      addNotificationToHistory({
        id: notification.request.identifier,
        title: title || 'Buzo Notification',
        body: body || '',
        type: (data?.type as NotificationType) || NotificationType.FINANCIAL_TIP,
        timestamp: Date.now(),
        read: false,
        data: data || {},
      });
    });
    
    const responseSubscription = addNotificationResponseReceivedListener((response) => {
      // When user taps on a notification, mark it as read
      const notificationId = response.notification.request.identifier;
      markNotificationAsRead(notificationId);
    });
    
    // Store subscriptions to clean up later if needed
    
    // Schedule daily tips
    await scheduleDailyTips();
    
    return token;
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
};

// Export a notification service with all the methods
export default {
  registerForPushNotifications,
  scheduleNotification,
  sendBudgetAlert,
  sendSavingsMilestone,
  sendExpenseReminder,
  sendFinancialTip,
  cancelNotification,
  cancelAllNotifications,
  getAllScheduledNotifications,
  getNotificationHistory,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearNotificationHistory,
  getUnreadNotificationCount,
  getNotificationPreferences,
  updateNotificationPreferences,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  removeNotificationSubscription,
  initializeNotifications,
  scheduleBudgetCheck,
  scheduleDailyTips,
  isWithinQuietHours
}; 