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
import { supabase, supabaseAdmin } from '../api/supabaseClient';
import { getCurrentUser } from './userService';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { v4 as uuidv4 } from 'uuid';

// Storage keys
const FEEDBACK_STORAGE_KEY = 'buzo_feedback';
const SURVEYS_STORAGE_KEY = 'buzo_surveys';
const PENDING_FEEDBACK_STORAGE_KEY = 'buzo_pending_feedback';

/**
 * Get the current authenticated user directly from Supabase
 * This ensures we're always using the most up-to-date session information
 */
export const getSupabaseUser = async () => {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.warn('Error getting Supabase session:', sessionError);
      return null;
    }
    
    if (!sessionData?.session) {
      console.log('No active Supabase session found');
      return null;
    }
    
    return sessionData.session.user;
  } catch (error) {
    console.warn('Unexpected error getting Supabase user:', error);
    return null;
  }
};

/**
 * Get device information for diagnostics
 */
const getDeviceInfo = () => {
  return {
    brand: Device.brand || 'Unknown',
    model: Device.modelName || 'Device',
    osName: Device.osName || 'OS',
    osVersion: Device.osVersion || 'Version',
    appVersion: Constants.expoConfig?.version || 'unknown'
  };
};

/**
 * Get user name from various user objects
 * @param user The user object from either Supabase or getCurrentUser
 * @returns The user's name or a default value
 */
const getUserName = (user: any): string => {
  if (!user) return 'anonymous user';
  
  // Try to get name from different possible locations
  return user.user_metadata?.name || 
         user.user_metadata?.full_name || 
         user.name || 
         user.full_name || 
         user.email || 
         'anonymous user';
};

/**
 * Diagnose authentication issues
 * @returns Promise resolving to diagnostic information
 */
export const diagnoseAuthIssues = async (): Promise<Record<string, any>> => {
  try {
    const diagnostics: Record<string, any> = {
      timestamp: new Date().toISOString(),
      deviceInfo: getDeviceInfo()
    };
    
    // Check if we have a session directly from Supabase
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      diagnostics.sessionError = sessionError.message;
      diagnostics.hasSession = false;
    } else {
      diagnostics.hasSession = !!sessionData?.session;
      diagnostics.sessionExpiry = sessionData?.session?.expires_at 
        ? new Date(sessionData.session.expires_at * 1000).toISOString() 
        : 'none';
      
      if (sessionData?.session?.user) {
        const supabaseUser = sessionData.session.user;
        diagnostics.sessionUser = supabaseUser.id;
        diagnostics.sessionUserEmail = supabaseUser.email;
        diagnostics.sessionUserPhone = supabaseUser.phone;
        diagnostics.sessionUserRole = supabaseUser.role;
        diagnostics.sessionUserConfirmed = supabaseUser.confirmed_at ? true : false;
        diagnostics.sessionUserCreated = supabaseUser.created_at;
        diagnostics.sessionUserLastSignIn = supabaseUser.last_sign_in_at;
      } else {
        diagnostics.sessionUser = 'none';
      }
    }
    
    // Get current user from our service for comparison
    try {
      const currentUser = await getCurrentUser();
      diagnostics.hasCurrentUser = !!currentUser;
      if (currentUser) {
        diagnostics.currentUserId = currentUser.id;
        diagnostics.currentUserEmail = currentUser.email;
        
        // Check if the IDs match
        if (diagnostics.sessionUser && diagnostics.sessionUser !== 'none') {
          diagnostics.userIdMatch = diagnostics.sessionUser === currentUser.id;
        }
        
        // Check if this user exists in auth.users
        if (typeof supabaseAdmin !== 'undefined' && supabaseAdmin) {
          try {
            const { data: authUser, error: authError } = await supabaseAdmin
              .from('auth.users')
              .select('id, email')
              .eq('id', currentUser.id)
              .single();
            
            diagnostics.userExistsInAuthTable = !authError && !!authUser;
            diagnostics.authTableError = authError ? authError.message : null;
            
            // Check if user has a profile
            const { data: profileData, error: profileError } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('id', currentUser.id)
              .single();
            
            diagnostics.userHasProfile = !profileError && !!profileData;
            diagnostics.profileError = profileError ? profileError.message : null;
          } catch (error: any) {
            diagnostics.adminCheckError = error.message || 'Unknown error';
          }
        } else {
          diagnostics.adminClientAvailable = false;
        }
      }
    } catch (error: any) {
      diagnostics.getCurrentUserError = error.message || 'Unknown error';
    }
    
    return diagnostics;
  } catch (error: any) {
    return {
      error: error.message || 'Unknown error during diagnosis',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Verify if a user exists in the auth.users table
 * @param userId The user ID to check
 * @returns Promise resolving to a boolean indicating if the user exists
 */
export const verifyUserInAuthTable = async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  
  try {
    if (typeof supabaseAdmin !== 'undefined' && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('auth.users')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.warn(`Error verifying user ${userId} in auth.users table:`, error);
        return false;
      }
      
      return !!data;
    }
    
    // If no admin client, we can't directly check auth.users
    // Try to check if the user can access their own profile as a proxy
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // Profile not found, but this doesn't necessarily mean the user doesn't exist
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.warn(`Unexpected error verifying user ${userId} in auth.users table:`, error);
    return false;
  }
};

/**
 * Create a user in the auth.users table if it doesn't exist
 * This is a workaround for development environments where users might exist in auth but not in the database
 * @param userId The user ID to create
 * @param email The user's email
 * @returns Promise resolving to a boolean indicating if the user was created
 */
export const createUserInAuthTable = async (userId: string, email: string): Promise<boolean> => {
  if (!userId || !email) return false;
  
  try {
    if (typeof supabaseAdmin !== 'undefined' && supabaseAdmin) {
      // First check if the user already exists
      const { data: existingUser, error: checkError } = await supabaseAdmin
        .from('auth.users')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (!checkError && existingUser) {
        console.log(`User ${userId} already exists in auth.users table`);
        return true;
      }
      
      // User doesn't exist, try to create one
      console.log(`Attempting to create user ${userId} in auth.users table...`);
      
      // This is a simplified version - in a real environment, you would use proper auth admin APIs
      // This is just for development/testing purposes
      const { error: insertError } = await supabaseAdmin.rpc('create_test_user', {
        user_id: userId,
        user_email: email
      });
      
      if (insertError) {
        console.warn(`Failed to create user ${userId} in auth.users table:`, insertError);
        return false;
      }
      
      console.log(`Successfully created user ${userId} in auth.users table`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn(`Unexpected error creating user ${userId} in auth.users table:`, error);
    return false;
  }
};

/**
 * Submit user feedback
 * @param feedback The feedback data to submit
 * @returns Promise resolving to the submitted feedback
 */
export const submitFeedback = async (feedback: Omit<Feedback, 'id' | 'user_id' | 'timestamp'>): Promise<Feedback> => {
  try {
    // Run diagnostics first
    const authDiagnostics = await diagnoseAuthIssues();
    console.log('Auth diagnostics:', JSON.stringify(authDiagnostics, null, 2));
    
    // Get user directly from Supabase session first
    const supabaseUser = await getSupabaseUser();
    
    // Fall back to getCurrentUser if needed
    const user = supabaseUser || await getCurrentUser();
    
    // Log detailed user information for debugging
    if (user) {
      console.log(`Current user details - ID: ${user.id}, Email: ${user.email || 'none'}, Auth Source: ${supabaseUser ? 'Supabase Session' : 'getCurrentUser'}`);
    } else {
      console.log('No authenticated user found');
    }
    
    // Create feedback object with required fields
    const newFeedback: Feedback = {
      id: generateUUID(),
      user_id: user?.id || 'anonymous', // Use 'anonymous' if no user ID is available
      timestamp: new Date().toISOString(),
      ...feedback,
      // Add device metadata
      metadata: {
        ...feedback.metadata,
        appVersion: Constants.expoConfig?.version || 'unknown',
        deviceInfo: getDeviceInfo(),
        isAnonymous: !user, // Flag to indicate if this is anonymous feedback
        userEmail: user?.email || 'anonymous', // Store email in metadata for reference
        userName: getUserName(user), // Get user name using helper function
        authDiagnostics, // Include auth diagnostics in metadata
        authSource: supabaseUser ? 'supabase_session' : (user ? 'get_current_user' : 'none')
      }
    };
    
    // Always store locally first as a backup
    await storePendingFeedback(newFeedback);
    
    // If no authenticated user, don't try to submit to Supabase directly
    if (!user) {
      console.log('No authenticated user, storing feedback locally only');
      return newFeedback;
    }
    
    // Try to submit to Supabase
    try {
      // APPROACH 1: Try with the authenticated user's ID (should work if RLS is set up correctly)
      const { data: data1, error: error1 } = await supabase
        .from('feedback')
        .insert({
          ...newFeedback,
          user_id: user.id // Use the actual user ID
        })
        .select()
        .single();
      
      if (!error1) {
        console.log('Feedback submitted successfully with user ID');
        return data1 || newFeedback;
      }
      
      console.warn('Error submitting feedback with user ID:', error1);
      
      // APPROACH 2: Try with service role if available (bypasses RLS)
      if (typeof supabaseAdmin !== 'undefined' && supabaseAdmin) {
        const { data: data2, error: error2 } = await supabaseAdmin
          .from('feedback')
          .insert({
            ...newFeedback,
            user_id: user.id
          })
          .select()
          .single();
        
        if (!error2) {
          console.log('Feedback submitted successfully using admin client');
          return data2 || newFeedback;
        }
        
        console.warn('Error submitting feedback with admin client:', error2);
      }
      
      // APPROACH 3: Try with RPC function if available
      try {
        const { data: data3, error: error3 } = await supabase.rpc('submit_feedback', {
          feedback_data: {
            ...newFeedback,
            user_id: user.id
          }
        });
        
        if (!error3) {
          console.log('Feedback submitted successfully using RPC function');
          return data3 || newFeedback;
        }
        
        console.warn('Error submitting feedback with RPC function:', error3);
      } catch (rpcError) {
        console.warn('RPC function not available or error:', rpcError);
      }
      
      // If all approaches fail, store locally with detailed error info
      const anonymousFeedback: Feedback = {
        ...newFeedback,
        metadata: {
          ...newFeedback.metadata,
          errorDetails: JSON.stringify({
            userIdApproach: error1?.message,
            adminApproach: typeof supabaseAdmin !== 'undefined' ? 'attempted' : 'not available',
            rpcApproach: 'attempted'
          }),
          submissionFailed: true
        }
      };
      
      // Update the stored feedback with error details
      await storePendingFeedback(anonymousFeedback);
      
      // Show success message to user even though we're only storing locally
      console.log('Feedback stored locally due to database constraints');
      return anonymousFeedback;
    } catch (error) {
      console.warn('Error submitting feedback to Supabase:', error);
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
    
    // Get user directly from Supabase session first
    const supabaseUser = await getSupabaseUser();
    
    // Fall back to getCurrentUser if needed
    const currentUser = supabaseUser || await getCurrentUser();
    
    if (!currentUser) {
      console.log('No authenticated user, cannot sync feedback');
      return 0;
    }
    
    console.log(`Syncing feedback with user ID: ${currentUser.id}, Auth Source: ${supabaseUser ? 'Supabase Session' : 'getCurrentUser'}`);
    
    // Check if the user exists in the auth.users table
    let userExistsInAuthTable = false;
    
    if (typeof supabaseAdmin !== 'undefined' && supabaseAdmin) {
      try {
        const { data: authUser, error: authError } = await supabaseAdmin
          .from('auth.users')
          .select('id')
          .eq('id', currentUser.id)
          .single();
        
        if (authError || !authUser) {
          console.warn('User does not exist in auth.users table. Cannot sync feedback that requires user authentication.');
          userExistsInAuthTable = false;
        } else {
          console.log('User exists in auth.users table, proceeding with profile check');
          userExistsInAuthTable = true;
          
          // Ensure the user has a profile in the database
          try {
            // Check if the user exists in the profiles table
            const { data: userData, error: userError } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('id', currentUser.id)
              .single();
            
            // If user profile doesn't exist, create one
            if (userError && userError.code === 'PGRST116') {
              console.log('User profile not found, creating one before syncing feedback...');
              
              // Create a minimal profile for the user
              const profileData = {
                id: currentUser.id,
                email: currentUser.email || '',
                full_name: getUserName(currentUser),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              
              const { error: createError } = await supabaseAdmin
                .from('profiles')
                .insert(profileData);
                
              if (createError) {
                console.warn('Failed to create user profile:', createError);
                
                // If we can't create a profile due to foreign key constraint, we can't sync
                if (createError.code === '23503') {
                  console.warn('Foreign key constraint violation. Cannot create profile.');
                  userExistsInAuthTable = false;
                }
              } else {
                console.log('User profile created successfully');
              }
            } else if (userError) {
              console.warn('Error checking for user profile:', userError);
            } else {
              console.log('User profile found, proceeding with feedback sync');
            }
          } catch (error) {
            console.warn('Error checking/creating user profile:', error);
          }
        }
      } catch (error) {
        console.warn('Error checking if user exists in auth.users table:', error);
        userExistsInAuthTable = false;
      }
    }
    
    // If user doesn't exist in auth.users table, we can only process anonymous feedback
    if (!userExistsInAuthTable) {
      console.log('User authentication issues detected. Only syncing anonymous feedback.');
      
      // Convert all feedback to anonymous feedback
      pendingFeedback.forEach(feedback => {
        feedback.user_id = 'anonymous';
        feedback.metadata = {
          ...feedback.metadata,
          isAnonymous: true,
          originalUserId: feedback.user_id === 'anonymous' ? currentUser.id : feedback.user_id
        };
      });
      
      // Store the updated feedback items
      await saveData(PENDING_FEEDBACK_STORAGE_KEY, pendingFeedback);
      
      console.log('All feedback converted to anonymous format and stored locally');
      return 0; // No items synced to Supabase
    }
    
    // Filter out feedback with invalid user_ids (anonymous or non-existent users)
    const validFeedback = pendingFeedback.filter(feedback => {
      // Only sync feedback from the current user or convert anonymous feedback to current user
      if (feedback.user_id === 'anonymous' || feedback.metadata?.isAnonymous) {
        // Update anonymous feedback to use current user's ID
        feedback.user_id = currentUser.id;
        feedback.metadata = {
          ...feedback.metadata,
          isAnonymous: false,
          originallyAnonymous: true
        };
        return true;
      }
      
      // Only include feedback from the current user
      return feedback.user_id === currentUser.id;
    });
    
    if (validFeedback.length === 0) {
      console.log('No valid feedback to sync');
      return 0;
    }
    
    console.log(`Attempting to sync ${validFeedback.length} feedback items`);
    
    // Try to submit each item
    const syncResults = await Promise.allSettled(
      validFeedback.map(async (feedback) => {
        // Ensure feedback has the correct field names
        const formattedFeedback = {
          ...feedback,
          // Make sure we're using user_id, not userId
          user_id: feedback.user_id,
          // Make sure we're using survey_responses, not surveyResponses
          survey_responses: feedback.survey_responses
        };
        
        // Try with admin client first if available
        if (typeof supabaseAdmin !== 'undefined' && supabaseAdmin) {
          try {
            // Try to insert feedback
            const { error: adminError } = await supabaseAdmin
              .from('feedback')
              .insert(formattedFeedback);
              
            if (!adminError) {
              console.log('Feedback synced successfully using admin client');
              return { feedback, success: true };
            }
            
            console.warn('Error syncing feedback with admin client:', adminError);
            
            // If it's a foreign key constraint error, we can't sync this item
            if (adminError.code === '23503') {
              console.warn('Foreign key constraint violation. User does not exist in auth.users table.');
              return { feedback, success: false, error: adminError, reason: 'foreign_key_violation' };
            }
            
            // For other errors, try the regular client
          } catch (adminError) {
            console.warn('Error using admin client for feedback sync:', adminError);
          }
        }
        
        // Fall back to regular client
        try {
          const { error } = await supabase
            .from('feedback')
            .insert(formattedFeedback);
          
          if (!error) {
            return { feedback, success: true };
          }
          
          console.warn('Error syncing feedback with regular client:', error);
          return { feedback, success: false, error, reason: error.code };
        } catch (error) {
          console.warn('Unexpected error syncing feedback:', error);
          return { feedback, success: false, error, reason: 'unexpected_error' };
        }
      })
    );
    
    // Filter out successful submissions
    const successfulIds = syncResults
      .filter((result): result is PromiseFulfilledResult<{ feedback: Feedback; success: boolean; error?: any }> => 
        result.status === 'fulfilled' && result.value.success
      )
      .map(result => result.value.feedback.id);
    
    // Log results
    console.log(`Successfully synced ${successfulIds.length} of ${validFeedback.length} feedback items`);
    
    // Update pending feedback list - keep items that failed to sync
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
    // Try to fetch from Supabase first using admin client if available
    if (typeof supabaseAdmin !== 'undefined' && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('surveys')
          .select('*')
          .eq('is_active', true);
        
        if (!error && data && data.length > 0) {
          console.log('Fetched surveys from Supabase admin:', JSON.stringify(data, null, 2));
          // Save surveys locally
          await saveData(SURVEYS_STORAGE_KEY, data);
          return data;
        }
      } catch (adminError) {
        console.warn('Error fetching surveys from Supabase admin client:', adminError);
      }
    }
    
    // Try with regular client if admin client failed or is not available
    try {
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .eq('is_active', true);
      
      if (!error && data && data.length > 0) {
        console.log('Fetched surveys from Supabase:', JSON.stringify(data, null, 2));
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
      console.log('Using locally stored surveys:', JSON.stringify(localSurveys, null, 2));
      return localSurveys;
    }
    
    // Fall back to default surveys
    console.log('Using default surveys');
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
    survey_responses: responses,
    metadata: {
      featureId: surveyId
    }
  });
};

/**
 * Track user engagement with a feature
 * @param featureName The name of the feature
 * @param action The action performed on the feature
 * @param metadata Additional metadata
 */
export const trackFeatureEngagement = async (
  featureName: string,
  action: string,
  metadata: Record<string, any> = {}
): Promise<void> => {
  try {
    // Get user directly from Supabase session first
    const supabaseUser = await getSupabaseUser();
    
    // Fall back to getCurrentUser if needed
    const currentUser = supabaseUser || await getCurrentUser();
    
    if (!currentUser) {
      console.log('No authenticated user, cannot track feature engagement');
      return;
    }
    
    console.log(`Tracking feature engagement with user ID: ${currentUser.id}, Auth Source: ${supabaseUser ? 'Supabase Session' : 'getCurrentUser'}`);
    
    // Check if the user exists in the auth.users table
    let userExistsInAuthTable = false;
    
    if (typeof supabaseAdmin !== 'undefined' && supabaseAdmin) {
      try {
        const { data: authUser, error: authError } = await supabaseAdmin
          .from('auth.users')
          .select('id')
          .eq('id', currentUser.id)
          .single();
        
        if (authError || !authUser) {
          console.warn('User does not exist in auth.users table. Cannot track feature engagement that requires user authentication.');
          userExistsInAuthTable = false;
        } else {
          console.log('User exists in auth.users table, proceeding with profile check');
          userExistsInAuthTable = true;
          
          // Ensure the user has a profile in the database
          try {
            // Check if the user exists in the profiles table
            const { data: userData, error: userError } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('id', currentUser.id)
              .single();
            
            // If user profile doesn't exist, create one
            if (userError && userError.code === 'PGRST116') {
              console.log('User profile not found, creating one before tracking engagement...');
              
              // Create a minimal profile for the user
              const profileData = {
                id: currentUser.id,
                email: currentUser.email || '',
                full_name: getUserName(currentUser),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              
              const { error: createError } = await supabaseAdmin
                .from('profiles')
                .insert(profileData);
                
              if (createError) {
                console.warn('Failed to create user profile:', createError);
                
                // If we can't create a profile due to foreign key constraint, we can't track
                if (createError.code === '23503') {
                  console.warn('Foreign key constraint violation. Cannot create profile.');
                  userExistsInAuthTable = false;
                }
              } else {
                console.log('User profile created successfully');
              }
            } else if (userError) {
              console.warn('Error checking for user profile:', userError);
            } else {
              console.log('User profile found, proceeding with engagement tracking');
            }
          } catch (error) {
            console.warn('Error checking/creating user profile:', error);
          }
        }
      } catch (error) {
        console.warn('Error checking if user exists in auth.users table:', error);
        userExistsInAuthTable = false;
      }
    }
    
    // If user doesn't exist in auth.users table, store engagement locally
    if (!userExistsInAuthTable) {
      console.log('User authentication issues detected. Storing engagement data locally.');
      
      // Store engagement data locally
      const engagementData = {
        id: uuidv4(),
        user_id: 'anonymous',
        feature_name: featureName,
        action,
        timestamp: new Date().toISOString(),
        metadata: {
          ...metadata,
          isAnonymous: true,
          originalUserId: currentUser.id,
          deviceInfo: getDeviceInfo()
        }
      };
      
      // Load existing engagement data
      const pendingEngagements = await loadData<any[]>('PENDING_ENGAGEMENTS') || [];
      pendingEngagements.push(engagementData);
      
      // Save updated engagement data
      await saveData('PENDING_ENGAGEMENTS', pendingEngagements);
      
      console.log('Engagement data stored locally');
      return;
    }

    const engagementData = {
      user_id: currentUser.id,
      feature_name: featureName,
      action,
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        deviceInfo: getDeviceInfo()
      }
    };

    // Try with admin client first if available
    if (typeof supabaseAdmin !== 'undefined' && supabaseAdmin) {
      try {
        const { error: adminError } = await supabaseAdmin
          .from('feature_engagement')
          .insert(engagementData);
          
        if (!adminError) {
          console.log('Feature engagement tracked successfully using admin client');
          return;
        }
        
        console.warn('Error tracking feature engagement with admin client:', adminError);
        
        // If it's a foreign key constraint error, we can't track this item
        if (adminError.code === '23503') {
          console.warn('Foreign key constraint violation. User does not exist in auth.users table.');
          
          // Store engagement data locally
          const localEngagementData = {
            ...engagementData,
            id: uuidv4(),
            user_id: 'anonymous',
            metadata: {
              ...engagementData.metadata,
              isAnonymous: true,
              originalUserId: currentUser.id
            }
          };
          
          // Load existing engagement data
          const pendingEngagements = await loadData<any[]>('PENDING_ENGAGEMENTS') || [];
          pendingEngagements.push(localEngagementData);
          
          // Save updated engagement data
          await saveData('PENDING_ENGAGEMENTS', pendingEngagements);
          
          console.log('Engagement data stored locally due to foreign key constraint');
          return;
        }
        
        // For other errors, try the regular client
      } catch (adminError) {
        console.warn('Error using admin client for feature engagement:', adminError);
      }
    }

    // Fall back to regular client
    try {
      const { error } = await supabase
        .from('feature_engagement')
        .insert(engagementData);
      
      if (!error) {
        console.log('Feature engagement tracked successfully using regular client');
        return;
      }
      
      console.warn('Error tracking feature engagement with regular client:', error);
      
      // If it's a foreign key constraint error, store locally
      if (error.code === '23503') {
        // Store engagement data locally
        const localEngagementData = {
          ...engagementData,
          id: uuidv4(),
          user_id: 'anonymous',
          metadata: {
            ...engagementData.metadata,
            isAnonymous: true,
            originalUserId: currentUser.id
          }
        };
        
        // Load existing engagement data
        const pendingEngagements = await loadData<any[]>('PENDING_ENGAGEMENTS') || [];
        pendingEngagements.push(localEngagementData);
        
        // Save updated engagement data
        await saveData('PENDING_ENGAGEMENTS', pendingEngagements);
        
        console.log('Engagement data stored locally due to foreign key constraint');
      }
    } catch (error) {
      console.warn('Unexpected error tracking feature engagement:', error);
    }
  } catch (error) {
    console.error('Error in trackFeatureEngagement:', error);
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