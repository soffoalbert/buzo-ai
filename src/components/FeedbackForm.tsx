import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FeedbackType, FeedbackContext } from '../models/Feedback';
import { submitFeedback, submitSuggestion, reportBug } from '../services/feedbackService';
import { useTheme } from '../hooks/useTheme';

interface FeedbackFormProps {
  onSubmitSuccess?: () => void;
  initialType?: FeedbackType;
  initialContext?: FeedbackContext;
  screenName?: string;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({
  onSubmitSuccess,
  initialType = FeedbackType.SUGGESTION,
  initialContext = FeedbackContext.GENERAL,
  screenName
}) => {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(initialType);
  const [feedbackContext, setFeedbackContext] = useState<FeedbackContext>(initialContext);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { colors } = useTheme();

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please enter your feedback before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      switch (feedbackType) {
        case FeedbackType.SUGGESTION:
          await submitSuggestion(message, feedbackContext);
          break;
        case FeedbackType.BUG_REPORT:
          await reportBug(message, screenName);
          break;
        default:
          await submitFeedback({
            type: feedbackType,
            context: feedbackContext,
            message
          });
      }
      
      Alert.alert(
        'Thank You!',
        'Your feedback has been submitted successfully. We appreciate your input!',
        [{ text: 'OK', onPress: handleSuccess }]
      );
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert(
        'Error',
        'There was a problem submitting your feedback. Please try again later.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccess = () => {
    setMessage('');
    if (onSubmitSuccess) {
      onSubmitSuccess();
    }
  };

  const renderTypeSelector = () => {
    const types = [
      { value: FeedbackType.SUGGESTION, label: 'Suggestion', icon: 'bulb-outline' },
      { value: FeedbackType.BUG_REPORT, label: 'Bug Report', icon: 'bug-outline' },
      { value: FeedbackType.FEATURE_REQUEST, label: 'Feature Request', icon: 'add-circle-outline' }
    ];

    return (
      <View style={styles.selectorContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          What type of feedback do you have?
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typesScrollContent}
        >
          {types.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.typeButton,
                { borderColor: colors.border },
                feedbackType === type.value && { 
                  backgroundColor: colors.primary,
                  borderColor: colors.primary 
                }
              ]}
              onPress={() => setFeedbackType(type.value)}
            >
              <Ionicons 
                name={type.icon as any} 
                size={20} 
                color={feedbackType === type.value ? '#fff' : colors.text} 
              />
              <Text 
                style={[
                  styles.typeText, 
                  { color: colors.text },
                  feedbackType === type.value && { color: '#fff' }
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderContextSelector = () => {
    // Only show context selector for suggestions and feature requests
    if (feedbackType === FeedbackType.BUG_REPORT) {
      return null;
    }

    const contexts = [
      { value: FeedbackContext.GENERAL, label: 'General' },
      { value: FeedbackContext.BUDGET_FEATURE, label: 'Budget' },
      { value: FeedbackContext.EXPENSE_TRACKING, label: 'Expenses' },
      { value: FeedbackContext.SAVINGS_GOALS, label: 'Savings' },
      { value: FeedbackContext.AI_RECOMMENDATION, label: 'AI Advice' },
      { value: FeedbackContext.ONBOARDING, label: 'Onboarding' }
    ];

    return (
      <View style={styles.selectorContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Which area are you providing feedback on?
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typesScrollContent}
        >
          {contexts.map((context) => (
            <TouchableOpacity
              key={context.value}
              style={[
                styles.contextButton,
                { borderColor: colors.border },
                feedbackContext === context.value && { 
                  backgroundColor: colors.primary,
                  borderColor: colors.primary 
                }
              ]}
              onPress={() => setFeedbackContext(context.value)}
            >
              <Text 
                style={[
                  styles.contextText, 
                  { color: colors.text },
                  feedbackContext === context.value && { color: '#fff' }
                ]}
              >
                {context.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderTypeSelector()}
      {renderContextSelector()}
      
      <View style={styles.messageContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {feedbackType === FeedbackType.BUG_REPORT 
            ? 'Please describe the issue you encountered:' 
            : 'Tell us more about your feedback:'}
        </Text>
        <TextInput
          style={[
            styles.messageInput,
            { 
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.card
            }
          ]}
          placeholder={
            feedbackType === FeedbackType.BUG_REPORT
              ? "What happened? What did you expect to happen? Steps to reproduce..."
              : "Share your thoughts, ideas, or suggestions..."
          }
          placeholderTextColor={colors.text + '80'}
          multiline
          textAlignVertical="top"
          value={message}
          onChangeText={setMessage}
        />
      </View>
      
      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: colors.primary },
          (!message.trim() || isSubmitting) && { opacity: 0.7 }
        ]}
        onPress={handleSubmit}
        disabled={!message.trim() || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Feedback</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  selectorContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  typesScrollContent: {
    paddingRight: 16,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  typeText: {
    marginLeft: 8,
    fontSize: 14,
  },
  contextButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  contextText: {
    fontSize: 14,
  },
  messageContainer: {
    marginBottom: 24,
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 150,
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FeedbackForm; 