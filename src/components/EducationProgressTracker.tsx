import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEducationStats, UserProgress } from '../services/educationService';

interface CategoryProgressProps {
  category: string;
  completed: number;
  total: number;
  percentComplete: number;
}

const CategoryProgress: React.FC<CategoryProgressProps> = ({
  category,
  completed,
  total,
  percentComplete,
}) => {
  const progressAnim = React.useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: percentComplete / 100,
      duration: 1000,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [percentComplete]);
  
  const width = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  
  return (
    <View style={styles.categoryProgressContainer}>
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryName}>{category}</Text>
        <Text style={styles.categoryStats}>
          {completed}/{total} completed
        </Text>
      </View>
      
      <View style={styles.progressBarContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            { width },
            {
              backgroundColor:
                percentComplete < 30
                  ? '#FF7675' // Red for low progress
                  : percentComplete < 70
                  ? '#FDCB6E' // Yellow for medium progress
                  : '#55EFC4', // Green for high progress
            },
          ]}
        />
      </View>
    </View>
  );
};

interface EducationProgressTrackerProps {
  userId: string;
  onStatsFetched?: (stats: any) => void;
}

const EducationProgressTracker: React.FC<EducationProgressTrackerProps> = ({
  userId,
  onStatsFetched,
}) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(20)).current;
  
  useEffect(() => {
    fetchStats();
  }, [userId]);
  
  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!userId) {
        setError('User ID is required to fetch education stats');
        setLoading(false);
        return;
      }
      
      const educationStats = await getEducationStats(userId);
      setStats(educationStats);
      
      if (onStatsFetched) {
        onStatsFetched(educationStats);
      }
      
      // Start animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      
    } catch (err) {
      console.error('Error fetching education stats:', err);
      setError('Failed to load education progress. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Determine achievement badges based on progress
  const getAchievements = () => {
    if (!stats) return [];
    
    const achievements = [];
    
    // Articles read achievements
    if (stats.articlesRead >= 1) {
      achievements.push({
        id: 'first_article',
        title: 'First Steps',
        description: 'Completed your first article',
        icon: 'book-outline',
      });
    }
    
    if (stats.articlesRead >= 5) {
      achievements.push({
        id: 'knowledge_seeker',
        title: 'Knowledge Seeker',
        description: 'Read 5 articles',
        icon: 'library-outline',
      });
    }
    
    if (stats.articlesRead >= 10) {
      achievements.push({
        id: 'financial_scholar',
        title: 'Financial Scholar',
        description: 'Read 10 articles',
        icon: 'school-outline',
      });
    }
    
    // Quiz achievements
    if (stats.quizzesCompleted >= 1) {
      achievements.push({
        id: 'quiz_taker',
        title: 'Quiz Taker',
        description: 'Completed your first quiz',
        icon: 'checkbox-outline',
      });
    }
    
    if (stats.quizzesCompleted >= 3 && stats.averageQuizScore >= 80) {
      achievements.push({
        id: 'quiz_master',
        title: 'Quiz Master',
        description: 'Completed 3 quizzes with 80%+ average',
        icon: 'trophy-outline',
      });
    }
    
    // Category achievements
    const completedCategories = stats.categoryStats.filter(
      (cat: any) => cat.percentComplete === 100
    );
    
    if (completedCategories.length >= 1) {
      achievements.push({
        id: 'category_completer',
        title: 'Category Champion',
        description: `Completed all articles in ${completedCategories[0].category}`,
        icon: 'checkmark-circle-outline',
      });
    }
    
    if (completedCategories.length >= 3) {
      achievements.push({
        id: 'financial_expert',
        title: 'Financial Expert',
        description: 'Completed all articles in 3 categories',
        icon: 'ribbon-outline',
      });
    }
    
    return achievements;
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6739B7" />
        <Text style={styles.loadingText}>Loading your progress...</Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#FF7675" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchStats}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  if (!stats) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={40} color="#6739B7" />
        <Text style={styles.emptyText}>No progress data available yet.</Text>
        <Text style={styles.emptySubtext}>Start reading articles to track your learning journey!</Text>
      </View>
    );
  }
  
  const achievements = getAchievements();
  
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View
        style={[
          styles.statsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.overallStatsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.articlesRead}</Text>
            <Text style={styles.statLabel}>Articles Read</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.quizzesCompleted}</Text>
            <Text style={styles.statLabel}>Quizzes Completed</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.percentComplete.toFixed(0)}%</Text>
            <Text style={styles.statLabel}>Overall Progress</Text>
          </View>
        </View>
        
        {stats.averageQuizScore > 0 && (
          <View style={styles.quizScoreContainer}>
            <Text style={styles.quizScoreLabel}>Average Quiz Score</Text>
            <View style={styles.quizScoreBar}>
              <View
                style={[
                  styles.quizScoreFill,
                  {
                    width: `${stats.averageQuizScore}%`,
                    backgroundColor:
                      stats.averageQuizScore < 50
                        ? '#FF7675'
                        : stats.averageQuizScore < 80
                        ? '#FDCB6E'
                        : '#55EFC4',
                  },
                ]}
              />
            </View>
            <Text style={styles.quizScoreValue}>{stats.averageQuizScore.toFixed(0)}%</Text>
          </View>
        )}
        
        <View style={styles.sectionHeader}>
          <Ionicons name="analytics-outline" size={20} color="#6739B7" />
          <Text style={styles.sectionTitle}>Category Progress</Text>
        </View>
        
        {stats.categoryStats.map((category: CategoryProgressProps, index: number) => (
          <CategoryProgress
            key={`${category.category}-${index}`}
            category={category.category}
            completed={category.completed}
            total={category.total}
            percentComplete={category.percentComplete}
          />
        ))}
        
        {achievements.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons name="trophy-outline" size={20} color="#6739B7" />
              <Text style={styles.sectionTitle}>Achievements</Text>
            </View>
            
            <View style={styles.achievementsContainer}>
              {achievements.map((achievement) => (
                <View key={achievement.id} style={styles.achievementItem}>
                  <View style={styles.achievementIconContainer}>
                    <Ionicons name={achievement.icon as any} size={24} color="#6739B7" />
                  </View>
                  <View style={styles.achievementContent}>
                    <Text style={styles.achievementTitle}>{achievement.title}</Text>
                    <Text style={styles.achievementDescription}>{achievement.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#6739B7',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  emptySubtext: {
    marginTop: 5,
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  statsContainer: {
    padding: 16,
  },
  overallStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: '#F5F0FF',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#CCCCCC',
    alignSelf: 'center',
  },
  quizScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
  },
  quizScoreLabel: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
  },
  quizScoreBar: {
    flex: 2,
    height: 8,
    backgroundColor: '#DDDDDD',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  quizScoreFill: {
    height: '100%',
    borderRadius: 4,
  },
  quizScoreValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    width: 40,
    textAlign: 'right',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#333333',
  },
  categoryProgressContainer: {
    marginBottom: 15,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  categoryStats: {
    fontSize: 12,
    color: '#666666',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#DDDDDD',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  achievementsContainer: {
    backgroundColor: '#F5F0FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  achievementIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  achievementDescription: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
});

export default EducationProgressTracker; 