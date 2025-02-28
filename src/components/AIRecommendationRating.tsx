import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { rateAIRecommendation } from '../services/feedbackService';
import { useTheme } from '../hooks/useTheme';

interface AIRecommendationRatingProps {
  recommendationId: string;
  onRatingSubmitted?: (score: number) => void;
}

const AIRecommendationRating: React.FC<AIRecommendationRatingProps> = ({
  recommendationId,
  onRatingSubmitted
}) => {
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { colors } = useTheme();

  const handleRating = (score: number) => {
    setRating(score);
    
    // For low ratings (1-3), show feedback modal
    if (score <= 3) {
      setShowFeedbackModal(true);
    } else {
      // For high ratings (4-5), submit immediately
      submitRating(score);
    }
  };

  const submitRating = async (score: number = rating || 0, message: string = feedbackText) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await rateAIRecommendation(recommendationId, score, message);
      setIsSubmitted(true);
      if (onRatingSubmitted) {
        onRatingSubmitted(score);
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
    } finally {
      setIsSubmitting(false);
      setShowFeedbackModal(false);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => !isSubmitted && handleRating(star)}
            disabled={isSubmitted}
          >
            <Ionicons
              name={rating && star <= rating ? 'star' : 'star-outline'}
              size={24}
              color={rating && star <= rating ? colors.primary : colors.text}
              style={styles.star}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (isSubmitted) {
    return (
      <View style={styles.container}>
        <Text style={[styles.thankYouText, { color: colors.text }]}>
          Thanks for your feedback!
        </Text>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Ionicons
              key={star}
              name={rating && star <= rating ? 'star' : 'star-outline'}
              size={20}
              color={rating && star <= rating ? colors.primary : colors.text}
              style={styles.star}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.ratingText, { color: colors.text }]}>
        Was this advice helpful?
      </Text>
      {renderStars()}

      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              How can we improve?
            </Text>
            <TextInput
              style={[styles.feedbackInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Tell us how we can make our advice more helpful..."
              placeholderTextColor={colors.text + '80'}
              multiline
              value={feedbackText}
              onChangeText={setFeedbackText}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: colors.border }]}
                onPress={() => setShowFeedbackModal(false)}
                disabled={isSubmitting}
              >
                <Text style={{ color: colors.text }}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton, { backgroundColor: colors.primary }]}
                onPress={() => submitRating()}
                disabled={isSubmitting}
              >
                <Text style={{ color: '#fff' }}>
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    marginBottom: 8,
  },
  thankYouText: {
    fontSize: 14,
    marginBottom: 4,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  star: {
    marginHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  feedbackInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '45%',
  },
  submitButton: {
    borderWidth: 0,
  },
});

export default AIRecommendationRating; 