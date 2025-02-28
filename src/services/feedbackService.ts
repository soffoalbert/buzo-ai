import { 
  Feedback, 
  FeedbackType, 
  FeedbackContext, 
  Survey, 
  SurveyResponse,
  DEFAULT_AI_RECOMMENDATION_SURVEY,
  DEFAULT_APP_EXPERIENCE_SURVEY
} from '../models/Feedback';
import { saveData, loadData, removeData } from './offlineStorage';
import { generateUUID } from '../utils/helpers';
import { supabase } from '../api/supabaseClient';
import { getCurrentUser } from './userService';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Storage keys
const FEEDBACK_STORAGE_KEY = 'buzo_feedback';
const SURVEYS_STORAGE_KEY = 'buzo_surveys';
const PENDING_FEEDBACK_STORAGE_KEY = 'buzo_pending_feedback';

/**
 * Submit user feedback
 * @param feedback The feedback data to submit
 * @returns Promise resolving to the submitted feedback
 */
export const submitFeedback = async (feedback: Omit<Feedback, 'id' | 'userId' | 'timestamp'>): Promise<Feedback> => {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Create feedback object with required fields
    const newFeedback: Feedback = {
      id: generateUUID(),
      userId: user.id,
      timestamp: new Date().toISOString(),
      ...feedback,
      // Add device metadata
      metadata: {
        ...feedback.metadata,
        appVersion: Constants.expoConfig?.version || 'unknown',
        deviceInfo: `${Device.brand} ${Device.modelName} (${Device.osName} ${Device.osVersion})`
      }
    };
    
    // Try to submit to Supabase
    try {
      const { data, error } = await supabase
        .from('feedback')
        .insert(newFeedback)
        .select()
        .single();
      
      if (error) {
        console.warn('Error submitting feedback to Supabase:', error);
        // Store locally for later sync
        await storePendingFeedback(newFeedback);
      }
      
      return data || newFeedback;
    } catch (error) {
      console.warn('Error submitting feedback to Supabase:', error);
      // Store locally for later sync
      await storePendingFeedback(newFeedback);
      return newFeedback;
    }
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw new Error('Failed to submit feedback');
  }
};

/**
 * Store feedback locally when offline
 * @param feedback The feedback to store
 */
export const storePendingFeedback = async (feedback: Feedback): Promise<void> => {
  try {
    // Load existing pending feedback
    const pendingFeedback = await loadData<Feedback[]>(PENDING_FEEDBACK_STORAGE_KEY) || [];
    
    // Add new feedback
    pendingFeedback.push(feedback);
    
    // Save updated list
    await saveData(PENDING_FEEDBACK_STORAGE_KEY, pendingFeedback);
  } catch (error) {
    console.error('Error storing pending feedback:', error);
  }
};

/**
 * Sync pending feedback to the server
 * @returns Promise resolving to the number of items synced
 */
export const syncPendingFeedback = async (): Promise<number> => {
  try {
    // Load pending feedback
    const pendingFeedback = await loadData<Feedback[]>(PENDING_FEEDBACK_STORAGE_KEY) || [];
    
    if (pendingFeedback.length === 0) {
      return 0;
    }
    
    // Try to submit each item
    const syncResults = await Promise.allSettled(
      pendingFeedback.map(async (feedback) => {
        const { error } = await supabase
          .from('feedback')
          .insert(feedback);
        
        return { feedback, success: !error, error };
      })
    );
    
    // Filter out successful submissions
    const successfulIds = syncResults
      .filter((result): result is PromiseFulfilledResult<{ feedback: Feedback; success: boolean; error?: any }> => 
        result.status === 'fulfilled' && result.value.success
      )
      .map(result => result.value.feedback.id);
    
    // Update pending feedback list
    const remainingFeedback = pendingFeedback.filter(
      feedback => !successfulIds.includes(feedback.id)
    );
    
    // Save updated list
    await saveData(PENDING_FEEDBACK_STORAGE_KEY, remainingFeedback);
    
    return successfulIds.length;
  } catch (error) {
    console.error('Error syncing pending feedback:', error);
    return 0;
  }
};

/**
 * Submit a rating for an AI recommendation
 * @param recommendationId The ID of the recommendation
 * @param score The rating score (1-5)
 * @param message Optional feedback message
 * @returns Promise resolving to the submitted feedback
 */
export const rateAIRecommendation = async (
  recommendationId: string,
  score: number,
  message?: string
): Promise<Feedback> => {
  return submitFeedback({
    type: FeedbackType.RATING,
    context: FeedbackContext.AI_RECOMMENDATION,
    ratings: [{ score, category: 'overall' }],
    message,
    metadata: {
      recommendationId
    }
  });
};

/**
 * Submit a feature suggestion
 * @param message The suggestion message
 * @param context The feature context
 * @returns Promise resolving to the submitted feedback
 */
export const submitSuggestion = async (
  message: string,
  context: FeedbackContext = FeedbackContext.GENERAL
): Promise<Feedback> => {
  return submitFeedback({
    type: FeedbackType.SUGGESTION,
    context,
    message
  });
};

/**
 * Submit a bug report
 * @param message Description of the bug
 * @param screenName The screen where the bug occurred
 * @returns Promise resolving to the submitted feedback
 */
export const reportBug = async (
  message: string,
  screenName?: string
): Promise<Feedback> => {
  return submitFeedback({
    type: FeedbackType.BUG_REPORT,
    context: FeedbackContext.GENERAL,
    message,
    metadata: {
      screenName
    }
  });
};

/**
 * Get available surveys for the user
 * @returns Promise resolving to available surveys
 */
export const getAvailableSurveys = async (): Promise<Survey[]> => {
  try {
    // Try to fetch from Supabase first
    try {
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .eq('isActive', true);
      
      if (!error && data && data.length > 0) {
        // Save surveys locally
        await saveData(SURVEYS_STORAGE_KEY, data);
        return data;
      }
    } catch (error) {
      console.warn('Error fetching surveys from Supabase:', error);
    }
    
    // Fall back to local storage
    const localSurveys = await loadData<Survey[]>(SURVEYS_STORAGE_KEY);
    
    if (localSurveys && localSurveys.length > 0) {
      return localSurveys;
    }
    
    // Fall back to default surveys
    return [DEFAULT_AI_RECOMMENDATION_SURVEY, DEFAULT_APP_EXPERIENCE_SURVEY];
  } catch (error) {
    console.error('Error getting available surveys:', error);
    return [DEFAULT_AI_RECOMMENDATION_SURVEY, DEFAULT_APP_EXPERIENCE_SURVEY];
  }
};

/**
 * Submit survey responses
 * @param surveyId The ID of the survey
 * @param responses The user's responses
 * @returns Promise resolving to the submitted feedback
 */
export const submitSurveyResponses = async (
  surveyId: string,
  responses: SurveyResponse[]
): Promise<Feedback> => {
  // Get the survey to determine context
  const surveys = await getAvailableSurveys();
  const survey = surveys.find(s => s.id === surveyId);
  
  if (!survey) {
    throw new Error('Survey not found');
  }
  
  return submitFeedback({
    type: FeedbackType.SURVEY,
    context: survey.context,
    surveyResponses: responses,
    metadata: {
      featureId: surveyId
    }
  });
};

/**
 * Track user engagement with a feature
 * @param featureId The ID of the feature
 * @param context The feature context
 * @param metadata Additional metadata
 */
export const trackFeatureEngagement = async (
  featureId: string,
  context: FeedbackContext,
  metadata?: Record<string, any>
): Promise<void> => {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return;
    }
    
    // Send analytics event to Supabase
    await supabase
      .from('feature_engagement')
      .insert({
        userId: user.id,
        featureId,
        context,
        timestamp: new Date().toISOString(),
        metadata
      });
  } catch (error) {
    console.warn('Error tracking feature engagement:', error);
    // Silently fail - analytics should not interrupt user experience
  }
};

export default {
  submitFeedback,
  rateAIRecommendation,
  submitSuggestion,
  reportBug,
  getAvailableSurveys,
  submitSurveyResponses,
  syncPendingFeedback,
  trackFeatureEngagement
}; 