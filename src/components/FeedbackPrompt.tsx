import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import QuickSurvey from './QuickSurvey';
import { Survey } from '../models/Feedback';
import { useTheme } from '../hooks/useTheme';

interface FeedbackPromptProps {
  isVisible: boolean;
  survey: Survey;
  onDismiss: () => void;
  onComplete: () => void;
}

const FeedbackPrompt: React.FC<FeedbackPromptProps> = ({
  isVisible,
  survey,
  onDismiss,
  onComplete
}) => {
  const [showSurvey, setShowSurvey] = useState(false);
  const [animation] = useState(new Animated.Value(0));
  const navigation = useNavigation();
  const { colors } = useTheme();

  useEffect(() => {
    if (isVisible) {
      Animated.timing(animation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(animation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start();
    }
  }, [isVisible]);

  const handleTakeSurvey = () => {
    setShowSurvey(true);
  };

  const handleSurveyComplete = () => {
    setShowSurvey(false);
    onComplete();
  };

  const handleNavigateToFeedback = () => {
    onDismiss();
    // Navigate to feedback screen
    // @ts-ignore - We know this screen exists
    navigation.navigate('FeedbackScreen');
  };

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0]
  });

  const opacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  if (!isVisible && !showSurvey) {
    return null;
  }

  return (
    <>
      <Animated.View 
        style={[
          styles.container,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            transform: [{ translateY }],
            opacity
          }
        ]}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.primary} />
          </View>
          
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: colors.text }]}>
              Your feedback matters!
            </Text>
            <Text style={[styles.description, { color: colors.text + 'CC' }]}>
              Help us improve Buzo by taking a quick {survey.questions.length}-question survey.
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={onDismiss}
          >
            <Ionicons name="close" size={20} color={colors.text + '80'} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={[styles.button, { borderColor: colors.border }]} 
            onPress={handleNavigateToFeedback}
          >
            <Text style={{ color: colors.text }}>Later</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton, { backgroundColor: colors.primary }]} 
            onPress={handleTakeSurvey}
          >
            <Text style={{ color: '#fff' }}>Take Survey</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      
      {showSurvey && (
        <QuickSurvey
          survey={survey}
          isVisible={showSurvey}
          onClose={() => setShowSurvey(false)}
          onComplete={handleSurveyComplete}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
  },
  closeButton: {
    padding: 4,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 8,
  },
  primaryButton: {
    borderWidth: 0,
  },
});

export default FeedbackPrompt; 