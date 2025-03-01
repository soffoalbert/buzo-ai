import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation';
import Card from '../components/Card';
import InsightsScreen from './InsightsScreen';
import { 
  getEducationCategories, 
  getEducationArticles, 
  getUserProgress, 
  getPersonalizedRecommendations,
  getEducationStats,
  EducationArticle,
  EducationCategory
} from '../services/educationService';
import { colors, spacing, textStyles } from '../utils/theme';
import CourseCard from '../components/CourseCard';
import LearningPathTracker, { LearningPathStep } from '../components/LearningPathTracker';

const LearnScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [articles, setArticles] = useState<EducationArticle[]>([]);
  const [categories, setCategories] = useState<EducationCategory[]>([]);
  const [featuredArticle, setFeaturedArticle] = useState<EducationArticle | null>(null);
  const [activeTab, setActiveTab] = useState<'education' | 'insights'>('education');
  const [userId, setUserId] = useState<string>('guest-user');
  const [userProgress, setUserProgress] = useState<any>(null);
  const [recommendedArticles, setRecommendedArticles] = useState<EducationArticle[]>([]);
  const [educationStats, setEducationStats] = useState<any>(null);
  const [learningPath, setLearningPath] = useState<LearningPathStep[]>([]);

  // Load education content
  useEffect(() => {
    if (activeTab === 'education') {
      loadEducationContent();
    }
  }, [activeTab, selectedCategory]);

  const loadEducationContent = async () => {
    try {
      setIsLoading(true);
      
      // Fetch real data from the educationService
      const categoriesData = await getEducationCategories();
      let articlesData;
      
      if (selectedCategory) {
        articlesData = await getEducationArticles(selectedCategory);
      } else {
        articlesData = await getEducationArticles();
      }
      
      // Get user progress
      const progress = await getUserProgress(userId);
      setUserProgress(progress);
      
      // Get personalized recommendations
      const recommendations = await getPersonalizedRecommendations(userId);
      setRecommendedArticles(recommendations);
      
      // Get education stats
      const stats = await getEducationStats(userId);
      setEducationStats(stats);
      
      // Set featured article
      const featured = articlesData.find(article => article.isFeatured) || articlesData[0];
      
      setCategories(categoriesData);
      setArticles(articlesData);
      setFeaturedArticle(featured);
      
      // Create a learning path based on recommendations and progress
      createLearningPath(recommendations, progress);
      
      setIsLoading(false);
      setIsRefreshing(false);
    } catch (error) {
      console.error('Error loading education content:', error);
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  const createLearningPath = (recommendations: EducationArticle[], progress: any) => {
    if (!recommendations || !progress) return;
    
    // Create a learning path with 5 steps based on recommendations
    const steps: LearningPathStep[] = recommendations.slice(0, 5).map((article, index) => {
      const isCompleted = progress.completedArticles.includes(article.id);
      const isActive = !isCompleted && (index === 0 || 
        (recommendations[index-1] && progress.completedArticles.includes(recommendations[index-1].id)));
      
      return {
        id: article.id,
        title: article.title,
        description: article.description,
        isCompleted,
        isActive: isActive || (index === 0 && !isCompleted),
        icon: article.category === 'Budgeting' ? 'calculator-outline' : 
              article.category === 'Saving' ? 'wallet-outline' :
              article.category === 'Debt' ? 'trending-down-outline' :
              article.category === 'Investing' ? 'trending-up-outline' : 'card-outline',
        type: article.hasQuiz ? 'quiz' : 'article'
      };
    });
    
    setLearningPath(steps);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadEducationContent();
  };

  const handleCategoryPress = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
  };

  const handleArticlePress = (article: EducationArticle) => {
    navigation.navigate('ArticleDetail', { article });
  };
  
  const handleLearningPathStepPress = (stepId: string) => {
    const article = articles.find(a => a.id === stepId);
    if (article) {
      handleArticlePress(article);
    }
  };

  const renderEducationContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading education content...</Text>
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Featured Article */}
        {featuredArticle && (
          <View style={styles.featuredArticleContainer}>
            <Text style={styles.sectionTitle}>Featured Article</Text>
            <TouchableOpacity
              style={styles.featuredArticleCard}
              onPress={() => handleArticlePress(featuredArticle)}
            >
              <Image
                source={{ uri: featuredArticle.imageUrl }}
                style={styles.featuredArticleImage}
                resizeMode="cover"
              />
              <View style={styles.featuredArticleOverlay}>
                <View style={styles.featuredArticleBadge}>
                  <Text style={styles.featuredArticleBadgeText}>Featured</Text>
                </View>
                <Text style={styles.featuredArticleTitle}>{featuredArticle.title}</Text>
                <Text style={styles.featuredArticleDescription} numberOfLines={2}>
                  {featuredArticle.description}
                </Text>
                <View style={styles.featuredArticleMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={12} color="#FFFFFF" />
                    <Text style={styles.metaText}>{featuredArticle.readTime}</Text>
                  </View>
                  {featuredArticle.hasQuiz && (
                    <View style={styles.metaItem}>
                      <Ionicons name="school-outline" size={12} color="#FFFFFF" />
                      <Text style={styles.metaText}>Has Quiz</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Learning Path */}
        {learningPath.length > 0 && (
          <View style={styles.learningPathContainer}>
            <Text style={styles.sectionTitle}>Your Learning Path</Text>
            <LearningPathTracker
              pathTitle="Personal Finance Fundamentals"
              pathDescription="Master the essentials of managing your money with these key lessons"
              steps={learningPath}
              progress={educationStats ? educationStats.articlesRead / educationStats.totalArticles : 0}
              onStepPress={handleLearningPathStepPress}
            />
          </View>
        )}

        {/* Education Categories */}
        <View style={styles.categoriesContainer}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScrollContent}
          >
            <TouchableOpacity
              style={[
                styles.categoryButton,
                selectedCategory === null && styles.categoryButtonActive,
                {backgroundColor: selectedCategory === null ? '#6366F1' : '#F3F4F6'}
              ]}
              onPress={() => handleCategoryPress(null)}
            >
              <Ionicons
                name="grid-outline"
                size={22}
                color={selectedCategory === null ? "#FFFFFF" : "#5B21B6"}
              />
              <Text
                style={[
                  styles.categoryButtonText,
                  selectedCategory === null && styles.categoryButtonTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>

            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  selectedCategory === category.id && styles.categoryButtonActive,
                  { 
                    backgroundColor: selectedCategory === category.id 
                      ? category.color 
                      : `${category.color}15` 
                  }
                ]}
                onPress={() => handleCategoryPress(category.id)}
              >
                <Ionicons
                  name={category.icon as any}
                  size={22}
                  color={selectedCategory === category.id ? "#FFFFFF" : category.color}
                />
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === category.id && styles.categoryButtonTextActive,
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Articles Grid */}
        <View style={styles.articlesContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedCategory 
                ? `${categories.find(c => c.id === selectedCategory)?.name} Articles` 
                : 'All Articles'}
            </Text>
            
            {educationStats && (
              <Text style={styles.statsText}>
                {educationStats.articlesRead} of {educationStats.totalArticles} completed
              </Text>
            )}
          </View>
          
          <View style={styles.articlesGrid}>
            {articles.map((article) => {
              const isCompleted = userProgress?.completedArticles?.includes(article.id);
              
              return (
                <TouchableOpacity
                  key={article.id}
                  style={styles.articleCard}
                  onPress={() => handleArticlePress(article)}
                >
                  <Image
                    source={{ uri: article.imageUrl }}
                    style={styles.articleImage}
                    resizeMode="cover"
                  />
                  <View style={styles.articleContent}>
                    <Text style={styles.articleTitle} numberOfLines={2}>{article.title}</Text>
                    <View style={styles.articleMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={12} color="#6B7280" />
                        <Text style={styles.articleMetaText}>{article.readTime}</Text>
                      </View>
                      {article.hasQuiz && (
                        <View style={styles.metaItem}>
                          <Ionicons name="school-outline" size={12} color="#6B7280" />
                          <Text style={styles.articleMetaText}>Quiz</Text>
                        </View>
                      )}
                      {article.isNew && (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>NEW</Text>
                        </View>
                      )}
                      {isCompleted && (
                        <View style={styles.completedBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                          <Text style={styles.completedText}>Done</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Courses */}
        <View style={styles.coursesContainer}>
          <Text style={styles.sectionTitle}>Courses</Text>
          <View style={styles.comingSoonContainer}>
            <Ionicons name="time-outline" size={32} color={colors.primary} />
            <Text style={styles.comingSoonTitle}>Coming Soon</Text>
            <Text style={styles.comingSoonText}>
              Our in-depth courses are being developed to provide you with comprehensive financial education.
            </Text>
          </View>
          
          {categories.map(category => {
            // Calculate total and completed articles for this category
            const categoryArticles = articles.filter(a => a.category === category.name);
            const totalArticles = categoryArticles.length;
            
            return (
              <View key={category.id} style={styles.courseCard}>
                <View style={[styles.courseIconContainer, {backgroundColor: category.color}]}>
                  <Ionicons name={category.icon as any} size={24} color="#FFFFFF" />
                </View>
                <View style={styles.courseContent}>
                  <View>
                    <Text style={styles.courseTitle}>{category.name}</Text>
                    <Text style={styles.courseDescription}>{category.description}</Text>
                  </View>
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonBadgeText}>Coming Soon</Text>
                  </View>
                </View>
                <View style={styles.courseOverlay} />
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderInsightsContent = () => {
    return <InsightsScreen />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Learn</Text>
        
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'education' && styles.activeTab]}
            onPress={() => setActiveTab('education')}
          >
            <Text
              style={[styles.tabText, activeTab === 'education' && styles.activeTabText]}
            >
              Education
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'insights' && styles.activeTab]}
            onPress={() => setActiveTab('insights')}
          >
            <Text
              style={[styles.tabText, activeTab === 'insights' && styles.activeTabText]}
            >
              Insights
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Content */}
      {activeTab === 'education' ? renderEducationContent() : renderInsightsContent()}
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 10,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
  },
  tab: {
    marginRight: 24,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#6366F1',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  activeTabText: {
    color: '#6366F1',
    fontWeight: '600',
  },
  featuredArticleContainer: {
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  featuredArticleCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1F2937',
    height: 200,
  },
  featuredArticleImage: {
    width: '100%',
    height: '100%',
  },
  featuredArticleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 16,
    justifyContent: 'flex-end',
  },
  featuredArticleBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#6366F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuredArticleBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  featuredArticleTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  featuredArticleDescription: {
    color: '#E5E7EB',
    fontSize: 14,
    marginBottom: 8,
  },
  featuredArticleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  metaText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 4,
  },
  learningPathContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  statsText: {
    fontSize: 12,
    color: '#6B7280',
  },
  coursesContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  courseCard: {
    flexDirection: 'row',
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
  courseIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 12,
  },
  courseContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  courseDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  courseProgress: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    marginBottom: 4,
    justifyContent: 'center',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  progressPercentage: {
    position: 'absolute',
    right: 0,
    top: 6,
    fontSize: 12,
    color: '#6B7280',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  completedText: {
    fontSize: 10,
    color: '#10B981',
    marginLeft: 2,
  },
  categoriesContainer: {
    paddingTop: 8,
    paddingBottom: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoriesScrollContent: {
    paddingHorizontal: 12,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 80,
    justifyContent: 'center',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    marginLeft: 6,
  },
  categoryButtonActive: {
    // Styles are applied dynamically
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  articlesContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 24,
  },
  articlesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  articleCard: {
    width: (width - 40) / 2,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  articleImage: {
    width: '100%',
    height: 100,
  },
  articleContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  articleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
    height: 40,
  },
  articleMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  articleMetaText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  newBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  comingSoonContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  comingSoonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 8,
    marginBottom: 4,
  },
  comingSoonText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  comingSoonBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  comingSoonBadgeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  courseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
  },
});

export default LearnScreen; 