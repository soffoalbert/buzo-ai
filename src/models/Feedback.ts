export enum FeedbackType {
  SURVEY = 'survey',
  RATING = 'rating',
  SUGGESTION = 'suggestion',
  BUG_REPORT = 'bug_report',
  FEATURE_REQUEST = 'feature_request'
}

export enum FeedbackContext {
  AI_RECOMMENDATION = 'ai_recommendation',
  BUDGET_FEATURE = 'budget_feature',
  EXPENSE_TRACKING = 'expense_tracking',
  SAVINGS_GOALS = 'savings_goals',
  ONBOARDING = 'onboarding',
  GENERAL = 'general'
}

export interface FeedbackRating {
  score: number; // 1-5 star rating
  category: string;
}

export interface SurveyQuestion {
  id: string;
  text: string;
  type: 'multiple_choice' | 'text' | 'rating';
  options?: string[]; // For multiple choice questions
}

export interface SurveyResponse {
  questionId: string;
  answer: string | number;
}

export interface Feedback {
  id: string;
  user_id: string;
  type: FeedbackType;
  context: FeedbackContext;
  timestamp: string;
  ratings?: FeedbackRating[];
  message?: string;
  survey_responses?: SurveyResponse[];
  metadata?: {
    appVersion?: string;
    deviceInfo?: any; // Changed from string to any to support object structure
    screenName?: string;
    featureId?: string;
    recommendationId?: string;
    isAnonymous?: boolean;
    originalUserId?: string;
    userEmail?: string;
    userName?: string;
    authStatus?: string;
    authDiagnostics?: Record<string, any>;
    userCreationAttempted?: boolean;
    reason?: string;
    originallyAnonymous?: boolean;
    errorMessage?: string;
    authSource?: string;
  };
  status?: 'pending' | 'reviewed' | 'addressed';
}

// Pre-defined surveys
export interface Survey {
  id: string;
  title: string;
  description?: string;
  context: FeedbackContext;
  questions: SurveyQuestion[];
  is_active: boolean;
  created_at: string;
  expires_at?: string;
}

// Default surveys
export const DEFAULT_AI_RECOMMENDATION_SURVEY: Survey = {
  id: 'ai-recommendation-survey',
  title: 'AI Recommendation Feedback',
  description: 'Help us improve Buzo\'s financial advice',
  context: FeedbackContext.AI_RECOMMENDATION,
  questions: [
    {
      id: 'relevance',
      text: 'How relevant was this advice to your financial situation?',
      type: 'rating'
    },
    {
      id: 'clarity',
      text: 'How clear and easy to understand was the advice?',
      type: 'rating'
    },
    {
      id: 'actionability',
      text: 'How actionable was this advice?',
      type: 'rating'
    },
    {
      id: 'improvement',
      text: 'How could we improve this recommendation?',
      type: 'text'
    }
  ],
  is_active: true,
  created_at: new Date().toISOString()
};

export const DEFAULT_APP_EXPERIENCE_SURVEY: Survey = {
  id: 'app-experience-survey',
  title: 'App Experience Feedback',
  description: 'Tell us about your experience with Buzo',
  context: FeedbackContext.GENERAL,
  questions: [
    {
      id: 'ease-of-use',
      text: 'How easy is Buzo to use?',
      type: 'rating'
    },
    {
      id: 'most-useful',
      text: 'Which feature do you find most useful?',
      type: 'multiple_choice',
      options: ['Budget Tracking', 'Expense Management', 'Savings Goals', 'AI Financial Advice', 'Reports & Insights']
    },
    {
      id: 'missing-features',
      text: 'What features would you like to see added to Buzo?',
      type: 'text'
    },
    {
      id: 'recommendation',
      text: 'How likely are you to recommend Buzo to a friend?',
      type: 'rating'
    }
  ],
  is_active: true,
  created_at: new Date().toISOString()
}; 