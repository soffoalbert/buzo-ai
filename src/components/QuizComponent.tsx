import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Quiz, QuizQuestion } from '../services/educationService';
import { saveQuizScore } from '../services/educationService';
import { colors, spacing, textStyles, borderRadius } from '../utils/theme';
import ProgressBar from './ProgressBar';
import Card from './Card';
import Button from './Button';

interface QuizComponentProps {
  quiz: Quiz;
  userId: string;
  onComplete: (score: number, totalQuestions: number) => void;
  onCancel: () => void;
}

const QuizComponent: React.FC<QuizComponentProps> = ({
  quiz,
  userId,
  onComplete,
  onCancel
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalQuestions = quiz.questions.length;
  const currentQuestion = quiz.questions[currentQuestionIndex];
  
  const handleOptionSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
  };
  
  const handleConfirmAnswer = () => {
    if (selectedOption === null) {
      Alert.alert('Please select an answer', 'You need to choose an option before continuing.');
      return;
    }
    
    setIsAnswered(true);
    
    // Check if answer is correct
    if (selectedOption === currentQuestion.correctOptionIndex) {
      setScore(prevScore => prevScore + 1);
    }
  };
  
  const handleNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      // Move to next question
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      // Show final results
      setShowResults(true);
      submitQuizResults();
    }
  };
  
  const submitQuizResults = async () => {
    setIsSubmitting(true);
    
    try {
      // Calculate percentage score
      const percentageScore = Math.round((score / totalQuestions) * 100);
      
      // Save quiz score to user progress
      await saveQuizScore(userId, quiz.id, percentageScore);
      
      // Report back to parent component
      onComplete(score, totalQuestions);
    } catch (error) {
      console.error('Error saving quiz results:', error);
      Alert.alert(
        'Error Saving Results',
        'There was a problem saving your quiz results. Your progress may not be recorded.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const renderQuestion = () => {
    return (
      <View style={styles.questionContainer}>
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </Text>
          <ProgressBar 
            progress={(currentQuestionIndex + 1) / totalQuestions} 
            height={8} 
            backgroundColor={colors.primary}
            style={styles.progressBar}
          />
        </View>
        
        <Text style={styles.questionText}>{currentQuestion.question}</Text>
        
        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                selectedOption === index && styles.optionSelected,
                isAnswered && index === currentQuestion.correctOptionIndex && styles.optionCorrect,
                isAnswered && selectedOption === index && 
                  index !== currentQuestion.correctOptionIndex && styles.optionIncorrect
              ]}
              onPress={() => handleOptionSelect(index)}
              disabled={isAnswered}
            >
              <Text style={[
                styles.optionText,
                selectedOption === index && styles.optionTextSelected,
                isAnswered && index === currentQuestion.correctOptionIndex && styles.optionTextCorrect,
                isAnswered && selectedOption === index && 
                  index !== currentQuestion.correctOptionIndex && styles.optionTextIncorrect
              ]}>
                {option}
              </Text>
              
              {isAnswered && index === currentQuestion.correctOptionIndex && (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} style={styles.icon} />
              )}
              
              {isAnswered && selectedOption === index && 
                index !== currentQuestion.correctOptionIndex && (
                <Ionicons name="close-circle" size={20} color={colors.error} style={styles.icon} />
              )}
            </TouchableOpacity>
          ))}
        </View>
        
        {isAnswered && (
          <Card style={styles.explanationCard}>
            <Text style={styles.explanationTitle}>
              {selectedOption === currentQuestion.correctOptionIndex
                ? '✓ Correct!'
                : '✗ Incorrect'}
            </Text>
            <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
          </Card>
        )}
        
        <View style={styles.buttonContainer}>
          {!isAnswered ? (
            <Button 
              title="Submit Answer" 
              onPress={handleConfirmAnswer} 
              disabled={selectedOption === null}
              style={selectedOption === null ? styles.buttonDisabled : styles.buttonPrimary}
            />
          ) : (
            <Button 
              title={currentQuestionIndex < totalQuestions - 1 ? "Next Question" : "See Results"} 
              onPress={handleNextQuestion} 
              style={styles.buttonPrimary}
            />
          )}
          
          {!isAnswered && (
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Exit Quiz</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };
  
  const renderResults = () => {
    const percentScore = Math.round((score / totalQuestions) * 100);
    
    let resultMessage = '';
    let resultIcon = '';
    
    if (percentScore >= 80) {
      resultMessage = 'Excellent! You have a strong understanding of this topic.';
      resultIcon = '🏆';
    } else if (percentScore >= 60) {
      resultMessage = 'Good job! You grasp most of the concepts, but there\'s room for improvement.';
      resultIcon = '👍';
    } else {
      resultMessage = 'You might want to review this topic again to strengthen your understanding.';
      resultIcon = '📚';
    }
    
    return (
      <View style={styles.resultsContainer}>
        {isSubmitting ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <>
            <Text style={styles.resultIcon}>{resultIcon}</Text>
            <Text style={styles.resultsTitle}>Quiz Complete!</Text>
            
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreLabel}>Your Score</Text>
              <Text style={styles.scoreValue}>{score}/{totalQuestions}</Text>
              <Text style={styles.percentageScore}>{percentScore}%</Text>
            </View>
            
            <Card style={styles.resultMessageCard}>
              <Text style={styles.resultMessageText}>{resultMessage}</Text>
            </Card>
            
            <Button 
              title="Done" 
              onPress={() => onComplete(score, totalQuestions)} 
              style={styles.buttonPrimary}
            />
          </>
        )}
      </View>
    );
  };
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.quizTitle}>{quiz.title}</Text>
      <Text style={styles.quizDescription}>{quiz.description}</Text>
      
      {showResults ? renderResults() : renderQuestion()}
    </ScrollView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    padding: spacing.medium,
    paddingBottom: spacing.xxLarge,
  },
  quizTitle: {
    ...textStyles.heading2,
    marginBottom: spacing.xSmall,
    textAlign: 'center',
  },
  quizDescription: {
    ...textStyles.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.large,
  },
  questionContainer: {
    width: '100%',
  },
  progressContainer: {
    marginBottom: spacing.medium,
  },
  progressText: {
    ...textStyles.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xSmall,
  },
  progressBar: {
    marginBottom: spacing.medium,
  },
  questionText: {
    ...textStyles.heading3,
    marginBottom: spacing.medium,
  },
  optionsContainer: {
    marginBottom: spacing.medium,
  },
  optionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.medium,
    marginBottom: spacing.small,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionCorrect: {
    borderColor: colors.success,
    backgroundColor: `${colors.success}20`,
  },
  optionIncorrect: {
    borderColor: colors.error,
    backgroundColor: `${colors.error}20`,
  },
  optionText: {
    ...textStyles.body,
    flex: 1,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  optionTextCorrect: {
    color: colors.success,
    fontWeight: '500',
  },
  optionTextIncorrect: {
    color: colors.error,
    fontWeight: '500',
  },
  icon: {
    marginLeft: spacing.small,
  },
  explanationCard: {
    marginBottom: spacing.medium,
    padding: spacing.medium,
  },
  explanationTitle: {
    ...textStyles.subheading,
    marginBottom: spacing.xSmall,
  },
  explanationText: {
    ...textStyles.body,
  },
  buttonContainer: {
    marginTop: spacing.medium,
  },
  buttonPrimary: {
    marginBottom: spacing.small,
  },
  buttonDisabled: {
    marginBottom: spacing.small,
    backgroundColor: colors.disabled,
  },
  cancelButton: {
    alignItems: 'center',
    padding: spacing.small,
  },
  cancelText: {
    ...textStyles.buttonText,
    color: colors.textSecondary,
  },
  resultsContainer: {
    alignItems: 'center',
    paddingVertical: spacing.large,
  },
  resultIcon: {
    fontSize: 64,
    marginBottom: spacing.medium,
  },
  resultsTitle: {
    ...textStyles.heading2,
    marginBottom: spacing.large,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: spacing.large,
  },
  scoreLabel: {
    ...textStyles.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xSmall,
  },
  scoreValue: {
    ...textStyles.heading1,
    color: colors.primary,
    marginBottom: spacing.xSmall,
  },
  percentageScore: {
    ...textStyles.heading3,
    color: colors.textSecondary,
  },
  resultMessageCard: {
    marginBottom: spacing.large,
    padding: spacing.medium,
    width: '100%',
  },
  resultMessageText: {
    ...textStyles.body,
    textAlign: 'center',
  },
});

export default QuizComponent; 