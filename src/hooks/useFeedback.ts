import { useState, useEffect } from 'react';
import { getAvailableSurveys, trackFeatureEngagement } from '../services/feedbackService';
import { Survey, FeedbackContext } from '../models/Feedback';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const LAST_SURVEY_PROMPT_KEY = 'buzo_last_survey_prompt';
const COMPLETED_SURVEYS_KEY = 'buzo_completed_surveys';
const SURVEY_COOLDOWN_DAYS = 7; // Days between survey prompts

export const useFeedback = () => {
  const [availableSurveys, setAvailableSurveys] = useState<Survey[]>([]);
  const [currentSurvey, setCurrentSurvey] = useState<Survey | null>(null);
  const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load available surveys
  useEffect(() => {
    loadSurveys();
  }, []);

  // Check if we should show a survey prompt
  useEffect(() => {
    if (availableSurveys.length > 0) {
      checkSurveyPrompt();
    }
  }, [availableSurveys]);

  const loadSurveys = async () => {
    setIsLoading(true);
    try {
      const surveys = await getAvailableSurveys();
      setAvailableSurveys(surveys);
    } catch (error) {
      console.error('Error loading surveys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkSurveyPrompt = async () => {
    try {
      // Get last prompt date
      const lastPromptStr = await AsyncStorage.getItem(LAST_SURVEY_PROMPT_KEY);
      const lastPrompt = lastPromptStr ? new Date(lastPromptStr) : null;
      
      // Get completed surveys
      const completedSurveysStr = await AsyncStorage.getItem(COMPLETED_SURVEYS_KEY);
      const completedSurveys: string[] = completedSurveysStr ? JSON.parse(completedSurveysStr) : [];
      
      // Check if enough time has passed since last prompt
      const now = new Date();
      const cooldownPassed = !lastPrompt || 
        (now.getTime() - lastPrompt.getTime()) > (SURVEY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      
      if (cooldownPassed) {
        // Find a survey that hasn't been completed
        const availableSurvey = availableSurveys.find(survey => 
          !completedSurveys.includes(survey.id)
        );
        
        if (availableSurvey) {
          setCurrentSurvey(availableSurvey);
          setShowSurveyPrompt(true);
          
          // Update last prompt date
          await AsyncStorage.setItem(LAST_SURVEY_PROMPT_KEY, now.toISOString());
        }
      }
    } catch (error) {
      console.error('Error checking survey prompt:', error);
    }
  };

  const dismissSurvey = async () => {
    setShowSurveyPrompt(false);
    setCurrentSurvey(null);
  };

  const completeSurvey = async (surveyId: string) => {
    try {
      // Get completed surveys
      const completedSurveysStr = await AsyncStorage.getItem(COMPLETED_SURVEYS_KEY);
      const completedSurveys: string[] = completedSurveysStr ? JSON.parse(completedSurveysStr) : [];
      
      // Add this survey to completed list
      if (!completedSurveys.includes(surveyId)) {
        completedSurveys.push(surveyId);
        await AsyncStorage.setItem(COMPLETED_SURVEYS_KEY, JSON.stringify(completedSurveys));
      }
      
      setShowSurveyPrompt(false);
      setCurrentSurvey(null);
    } catch (error) {
      console.error('Error marking survey as completed:', error);
    }
  };

  const trackFeatureUsage = async (
    featureId: string,
    context: FeedbackContext,
    metadata?: Record<string, any>
  ) => {
    try {
      await trackFeatureEngagement(featureId, context, metadata);
    } catch (error) {
      console.warn('Error tracking feature usage:', error);
    }
  };

  return {
    availableSurveys,
    currentSurvey,
    showSurveyPrompt,
    isLoading,
    loadSurveys,
    dismissSurvey,
    completeSurvey,
    trackFeatureUsage
  };
};

export default useFeedback; 