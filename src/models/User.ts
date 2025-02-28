export interface User {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
  profilePicture?: string;
  dateOfBirth?: string;
  joinDate: string;
  lastActive: string;
  preferences: UserPreferences;
  financialProfile?: FinancialProfile;
  achievements?: Achievement[];
  friends?: string[]; // User IDs
}

export interface UserPreferences {
  currency: string;
  language: string;
  theme: 'light' | 'dark' | 'system';
  notifications: {
    budgetAlerts: boolean;
    expenseReminders: boolean;
    savingsMilestones: boolean;
    financialTips: boolean;
    friendActivity: boolean;
  };
  privacySettings: {
    shareFinancialGoals: boolean;
    shareAchievements: boolean;
    allowFriendRequests: boolean;
  };
  securitySettings: {
    biometricAuth: boolean;
    twoFactorAuth: boolean;
  };
}

export interface FinancialProfile {
  monthlyIncome: number;
  savingsRate: number; // Percentage of income saved
  financialGoals: string[];
  riskTolerance: 'low' | 'medium' | 'high';
  financialInterests: string[];
  financialChallenges: string[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  dateEarned: string;
  isShared: boolean;
}

// Default user preferences
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  currency: 'ZAR',
  language: 'en',
  theme: 'light',
  notifications: {
    budgetAlerts: true,
    expenseReminders: true,
    savingsMilestones: true,
    financialTips: true,
    friendActivity: true,
  },
  privacySettings: {
    shareFinancialGoals: false,
    shareAchievements: true,
    allowFriendRequests: true,
  },
  securitySettings: {
    biometricAuth: false,
    twoFactorAuth: false,
  },
}; 