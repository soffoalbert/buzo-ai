import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ScrollView,
  Modal,
  ActivityIndicator,
  FlatList,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Survey, SurveyQuestion, SurveyResponse } from '../models/Feedback';
import { submitSurveyResponses } from '../services/feedbackService';
import { useTheme } from '../hooks/useTheme';

const { width } = Dimensions.get('window');

interface QuickSurveyProps {
  survey: Survey;
  isVisible: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const QuickSurvey: React.FC<QuickSurveyProps> = ({
  survey,
  isVisible,
  onClose,
  onComplete
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    // Reset state when survey changes
    if (isVisible) {
      setCurrentQuestionIndex(0);
      setResponses([]);
      
      // Debug log to check survey structure
      console.log('Survey in QuickSurvey:', JSON.stringify(survey, null, 2));
    }
  }, [survey, isVisible]);

  const handleResponse = (question: SurveyQuestion, answer: string | number) => {
    console.log(`Setting response for question ${question.id}: ${answer}`);
    // Update responses
    setResponses(prev => {
      // Check if we already have a response for this question
      const existingIndex = prev.findIndex(r => r.questionId === question.id);
      
      if (existingIndex >= 0) {
        // Update existing response
        const updated = [...prev];
        updated[existingIndex] = { questionId: question.id, answer };
        return updated;
      } else {
        // Add new response
        return [...prev, { questionId: question.id, answer }];
      }
    });
  };

  const getCurrentResponse = (questionId: string): string | number | undefined => {
    const response = responses.find(r => r.questionId === questionId);
    return response?.answer;
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < (survey.questions?.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await submitSurveyResponses(survey.id, responses);
      if (onComplete) {
        onComplete();
      }
      onClose();
    } catch (error) {
      console.error('Error submitting survey:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRatingQuestion = (question: SurveyQuestion) => {
    const currentResponse = getCurrentResponse(question.id);
    
    return (
      <View style={styles.ratingContainer}>
        <View style={styles.ratingButtonsContainer}>
          {[1, 2, 3, 4, 5].map((rating) => (
            <TouchableOpacity
              key={rating}
              style={[
                styles.ratingButton,
                { borderColor: colors.border },
                currentResponse === rating && { 
                  backgroundColor: colors.primary,
                  borderColor: colors.primary 
                }
              ]}
              onPress={() => handleResponse(question, rating)}
            >
              <Text 
                style={[
                  styles.ratingText, 
                  { color: colors.text },
                  currentResponse === rating && { color: '#fff' }
                ]}
              >
                {rating}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.ratingLabels}>
          <Text style={[styles.ratingLabelText, { color: colors.text }]}>Poor</Text>
          <Text style={[styles.ratingLabelText, { color: colors.text }]}>Excellent</Text>
        </View>
      </View>
    );
  };

  const renderMultipleChoiceQuestion = (question: SurveyQuestion) => {
    const currentResponse = getCurrentResponse(question.id);
    
    return (
      <View style={styles.choicesContainer}>
        {question.options?.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.choiceButton,
              { borderColor: colors.border },
              currentResponse === option && { 
                backgroundColor: colors.primary,
                borderColor: colors.primary 
              }
            ]}
            onPress={() => handleResponse(question, option)}
          >
            <Text 
              style={[
                styles.choiceText, 
                { color: colors.text },
                currentResponse === option && { color: '#fff' }
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderTextQuestion = (question: SurveyQuestion) => {
    const currentResponse = getCurrentResponse(question.id) as string;
    
    return (
      <TextInput
        style={[
          styles.textInput,
          { 
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.card
          }
        ]}
        placeholder="Type your answer here..."
        placeholderTextColor={colors.text + '80'}
        multiline
        value={currentResponse || ''}
        onChangeText={(text) => handleResponse(question, text)}
      />
    );
  };

  const renderQuestion = (question: SurveyQuestion) => {
    if (!question) {
      console.warn('Question is undefined');
      return null;
    }
    
    console.log(`Rendering question: ${question.id}, type: ${question.type}`);
    
    switch (question.type) {
      case 'rating':
        return renderRatingQuestion(question);
      case 'multiple_choice':
        return renderMultipleChoiceQuestion(question);
      case 'text':
        return renderTextQuestion(question);
      default:
        return null;
    }
  };

  // Check if survey has questions
  if (!survey.questions || !Array.isArray(survey.questions) || survey.questions.length === 0) {
    console.warn('Survey has no questions or questions is not an array:', survey);
  }

  const questions = Array.isArray(survey.questions) ? survey.questions : [];
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === (questions.length - 1);
  const hasResponse = currentQuestion && getCurrentResponse(currentQuestion?.id) !== undefined;

  console.log(`Current question index: ${currentQuestionIndex}, Current question: ${currentQuestion?.id}`);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{survey.title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          {/* Description */}
          <Text style={[styles.description, { color: colors.text }]}>
            {survey.description}
          </Text>
          
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View 
              style={[
                styles.progressBar, 
                { backgroundColor: colors.border }
              ]}
            >
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: colors.primary,
                    width: `${((currentQuestionIndex + 1) / (questions.length || 1)) * 100}%` 
                  }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: colors.text }]}>
              {currentQuestionIndex + 1} of {questions.length}
            </Text>
          </View>
          
          {/* Question Content */}
          <View style={styles.contentContainer}>
            {currentQuestion ? (
              <View style={styles.questionContainer}>
                <Text style={[styles.questionText, { color: colors.text }]}>
                  {currentQuestion.text}
                </Text>
                {renderQuestion(currentQuestion)}
              </View>
            ) : (
              <View style={styles.questionContainer}>
                <Text style={[styles.questionText, { color: colors.text }]}>
                  No questions available
                </Text>
              </View>
            )}
          </View>
          
          {/* Navigation Buttons */}
          <View style={styles.buttonsContainer}>
            {currentQuestionIndex > 0 ? (
              <TouchableOpacity 
                style={[styles.navButton, { borderColor: colors.border }]} 
                onPress={goToPreviousQuestion}
              >
                <Text style={{ color: colors.text }}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.emptyButtonSpace} />
            )}
            
            <TouchableOpacity 
              style={[
                styles.navButton, 
                styles.nextButton, 
                { backgroundColor: colors.primary },
                (!hasResponse && !isLastQuestion) && { opacity: 0.5 }
              ]} 
              onPress={goToNextQuestion}
              disabled={!hasResponse && !isLastQuestion && questions.length > 0}
            >
              {isSubmitting && isLastQuestion ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: '#fff' }}>
                  {isLastQuestion ? 'Submit' : 'Next'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '92%',
    maxHeight: '85%',
    borderRadius: 16,
    padding: 20,
    paddingBottom: 500,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'right',
  },
  contentContainer: {
    flex: 1,
    minHeight: 400,
    justifyContent: 'center',
  },
  contentContainerStyle: {
    paddingVertical: 10,
  },
  questionContainer: {
    width: '100%',
    alignItems: 'center',
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  ratingContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  ratingButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
  },
  ratingText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  ratingLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  ratingLabelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  choicesContainer: {
    width: '100%',
  },
  choiceButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  choiceText: {
    fontSize: 14,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    width: '100%',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '45%',
  },
  nextButton: {
    borderWidth: 0,
  },
  emptyButtonSpace: {
    minWidth: '45%',
  },
});

export default QuickSurvey; 