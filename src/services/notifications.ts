import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

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
  BUDGET_ALERT = 'budget_alert',
  SAVINGS_MILESTONE = 'savings_milestone',
  EXPENSE_REMINDER = 'expense_reminder',
  FINANCIAL_TIP = 'financial_tip',
}

// Notification data interface
interface NotificationData {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

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
 * @returns The notification identifier
 */
export const scheduleNotification = async (
  notification: NotificationData,
  delay: number = 0
): Promise<string> => {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        data: { ...notification.data, type: notification.type },
      },
      trigger: delay > 0 ? { seconds: delay } : null,
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
}; 