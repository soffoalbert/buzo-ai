import notificationService, { NotificationType } from '../services/notifications';

/**
 * Utility functions to test sending different types of notifications
 */

// Send a test budget alert notification
export const sendTestBudgetAlert = async (): Promise<string | null> => {
  return await notificationService.scheduleNotification(
    'Budget Alert',
    'You have spent 80% of your Food budget for this month.',
    NotificationType.BUDGET_ALERT,
    null, // Send immediately
    { category: 'Food', spent: 800, budget: 1000 }
  );
};

// Send a test savings milestone notification
export const sendTestSavingsMilestone = async (): Promise<string | null> => {
  return await notificationService.scheduleNotification(
    'Savings Milestone Reached! 🎉',
    'Congratulations! You have reached 50% of your Emergency Fund goal.',
    NotificationType.SAVINGS_MILESTONE,
    null, // Send immediately
    { goal: 'Emergency Fund', current: 5000, target: 10000 }
  );
};

// Send a test expense reminder notification
export const sendTestExpenseReminder = async (): Promise<string | null> => {
  return await notificationService.scheduleNotification(
    'Expense Reminder',
    'Don\'t forget to log your expenses for today.',
    NotificationType.EXPENSE_REMINDER,
    null // Send immediately
  );
};

// Send a test financial tip notification
export const sendTestFinancialTip = async (): Promise<string | null> => {
  return await notificationService.scheduleNotification(
    'Financial Tip',
    'Try the 50/30/20 rule: Spend 50% on needs, 30% on wants, and save 20% of your income.',
    NotificationType.FINANCIAL_TIP,
    null, // Send immediately
    { tipId: 'tip001', category: 'Budgeting' }
  );
};

// Send a scheduled notification (5 seconds from now)
export const sendScheduledNotification = async (): Promise<string | null> => {
  return await notificationService.scheduleNotification(
    'Scheduled Notification',
    'This notification was scheduled to appear 5 seconds after being triggered.',
    NotificationType.FINANCIAL_TIP,
    { seconds: 5 } // Send after 5 seconds
  );
};

// Send all test notifications
export const sendAllTestNotifications = async (): Promise<void> => {
  await sendTestBudgetAlert();
  await sendTestSavingsMilestone();
  await sendTestExpenseReminder();
  await sendTestFinancialTip();
  await sendScheduledNotification();
};

export default {
  sendTestBudgetAlert,
  sendTestSavingsMilestone,
  sendTestExpenseReminder,
  sendTestFinancialTip,
  sendScheduledNotification,
  sendAllTestNotifications,
}; 