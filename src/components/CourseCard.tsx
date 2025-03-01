import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EducationCategory } from '../services/educationService';
import { colors, spacing } from '../utils/theme';

interface CourseCardProps {
  category: EducationCategory;
  totalArticles: number;
  completedArticles: number;
  onPress: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ 
  category, 
  totalArticles, 
  completedArticles,
  onPress 
}) => {
  const progress = totalArticles > 0 ? completedArticles / totalArticles : 0;
  const isCompleted = completedArticles === totalArticles && totalArticles > 0;
  
  // Function to generate gradient background color
  const getBackgroundColor = () => {
    return { backgroundColor: category.color };
  };
  
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: category.color }]}>
          <Ionicons name={category.icon as any} size={24} color="#FFFFFF" />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>{category.name}</Text>
          <Text style={styles.description}>{category.description}</Text>
          
          <Text style={styles.progressText}>
            {completedArticles} of {totalArticles} lessons completed
          </Text>
          
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar, 
                { width: `${progress * 100}%`, backgroundColor: category.color }
              ]} 
            />
          </View>
          
          <Text style={styles.percentageText}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    padding: 12,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  percentageText: {
    fontSize: 12,
    color: '#6B7280',
    alignSelf: 'flex-end',
  },
});

export default CourseCard; 