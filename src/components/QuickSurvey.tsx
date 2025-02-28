import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ScrollView,
  Modal,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Survey, SurveyQuestion, SurveyResponse } from '../models/Feedback';
import { submitSurveyResponses } from '../services/feedbackService';
import { useTheme } from '../hooks/useTheme';

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
    }
  }, [survey, isVisible]);

  const handleResponse = (question: SurveyQuestion, answer: string | number) => {
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
    if (currentQuestionIndex < survey.questions.length - 1) {
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

  const renderQuestion = (question: SurveyQuestion) => {
    const currentResponse = getCurrentResponse(question.id);
    
    switch (question.type) {
      case 'rating':
        return (
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((rating) => (
              <TouchableOpacity
                key={rating}
                style={[
                  styles.ratingButton,
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
                    currentResponse === rating && { color: '#fff' }
                  ]}
                >
                  {rating}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.ratingLabels}>
              <Text style={[styles.ratingLabelText, { color: colors.text }]}>Poor</Text>
              <Text style={[styles.ratingLabelText, { color: colors.text }]}>Excellent</Text>
            </View>
          </View>
        );
        
      case 'multiple_choice':
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
        
      case 'text':
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
            value={currentResponse as string || ''}
            onChangeText={(text) => handleResponse(question, text)}
          />
        );
        
      default:
        return null;
    }
  };

  const currentQuestion = survey.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === survey.questions.length - 1;
  const hasResponse = currentQuestion && getCurrentResponse(currentQuestion.id) !== undefined;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{survey.title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.description, { color: colors.text }]}>
            {survey.description}
          </Text>
          
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
                    width: `${((currentQuestionIndex + 1) / survey.questions.length) * 100}%` 
                  }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: colors.text }]}>
              {currentQuestionIndex + 1} of {survey.questions.length}
            </Text>
          </View>
          
          <ScrollView style={styles.contentContainer}>
            {currentQuestion && (
              <View style={styles.questionContainer}>
                <Text style={[styles.questionText, { color: colors.text }]}>
                  {currentQuestion.text}
                </Text>
                {renderQuestion(currentQuestion)}
              </View>
            )}
          </ScrollView>
          
          <View style={styles.buttonsContainer}>
            {currentQuestionIndex > 0 && (
              <TouchableOpacity 
                style={[styles.navButton, { borderColor: colors.border }]} 
                onPress={goToPreviousQuestion}
              >
                <Text style={{ color: colors.text }}>Back</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[
                styles.navButton, 
                styles.nextButton, 
                { backgroundColor: colors.primary },
                (!hasResponse && !isLastQuestion) && { opacity: 0.5 }
              ]} 
              onPress={goToNextQuestion}
              disabled={!hasResponse && !isLastQuestion}
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
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
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
    marginBottom: 20,
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
  },
  questionContainer: {
    marginBottom: 20,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  ratingContainer: {
    alignItems: 'center',
  },
  ratingButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '500',
  },
  ratingLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  ratingLabelText: {
    fontSize: 12,
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
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
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
});

export default QuickSurvey; 