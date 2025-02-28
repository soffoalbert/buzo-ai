import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AIRecommendationRating from './AIRecommendationRating';
import { useTheme } from '../hooks/useTheme';

export interface AIRecommendation {
  id: string;
  content: string;
  type: 'budget' | 'expense' | 'savings' | 'general';
  timestamp: string;
  isRated?: boolean;
}

interface AIRecommendationCardProps {
  recommendation: AIRecommendation;
  isLoading?: boolean;
  onRatingSubmitted?: (score: number) => void;
}

const AIRecommendationCard: React.FC<AIRecommendationCardProps> = ({
  recommendation,
  isLoading = false,
  onRatingSubmitted
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showRating, setShowRating] = useState(false);
  const { colors } = useTheme();

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleRatingSubmitted = (score: number) => {
    if (onRatingSubmitted) {
      onRatingSubmitted(score);
    }
  };

  const getTypeIcon = () => {
    switch (recommendation.type) {
      case 'budget':
        return 'wallet-outline';
      case 'expense':
        return 'cash-outline';
      case 'savings':
        return 'trending-up-outline';
      case 'general':
      default:
        return 'bulb-outline';
    }
  };

  const getTypeLabel = () => {
    switch (recommendation.type) {
      case 'budget':
        return 'Budget Advice';
      case 'expense':
        return 'Expense Advice';
      case 'savings':
        return 'Savings Advice';
      case 'general':
      default:
        return 'Financial Advice';
    }
  };

  // Show rating after 5 seconds of viewing the recommendation
  React.useEffect(() => {
    if (!recommendation.isRated && !isLoading) {
      const timer = setTimeout(() => {
        setShowRating(true);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [recommendation, isLoading]);

  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: colors.card,
          borderColor: colors.border
        }
      ]}
    >
      <View style={styles.header}>
        <View style={styles.typeContainer}>
          <View 
            style={[
              styles.iconContainer, 
              { backgroundColor: colors.primary + '20' }
            ]}
          >
            <Ionicons name={getTypeIcon()} size={18} color={colors.primary} />
          </View>
          <Text style={[styles.typeText, { color: colors.text }]}>
            {getTypeLabel()}
          </Text>
        </View>
        
        <TouchableOpacity onPress={toggleExpand}>
          <Ionicons 
            name={isExpanded ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color={colors.text} 
          />
        </TouchableOpacity>
      </View>
      
      {isExpanded && (
        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.text }]}>
                Generating advice...
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.adviceText, { color: colors.text }]}>
                {recommendation.content}
              </Text>
              
              {showRating && !recommendation.isRated && (
                <AIRecommendationRating 
                  recommendationId={recommendation.id}
                  onRatingSubmitted={handleRatingSubmitted}
                />
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    padding: 16,
    paddingTop: 0,
  },
  adviceText: {
    fontSize: 14,
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
});

export default AIRecommendationCard; 