import React, { useEffect } from 'react';
import { trackFeatureEngagement } from '../services/feedbackService';
import { FeedbackContext } from '../models/Feedback';

interface FeatureTrackerProps {
  featureId: string;
  context: FeedbackContext;
  metadata?: Record<string, any>;
  children: React.ReactNode;
}

/**
 * A component that tracks when a feature is used
 * Wrap any feature component with this to automatically track usage
 */
const FeatureTracker: React.FC<FeatureTrackerProps> = ({
  featureId,
  context,
  metadata,
  children
}) => {
  useEffect(() => {
    const trackUsage = async () => {
      try {
        await trackFeatureEngagement(featureId, context, metadata);
      } catch (error) {
        // Silently fail - analytics should not interrupt user experience
        console.warn('Error tracking feature usage:', error);
      }
    };
    
    trackUsage();
  }, [featureId, context, metadata]);

  return <>{children}</>;
};

export default FeatureTracker; 