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
import { generateUUID } from '../utils/helpers';
import InsightsScreen from './InsightsScreen';

// Define interfaces for education content
interface EducationArticle {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  readTime: string;
  isNew?: boolean;
  isFeatured?: boolean;
  content?: string;
  videoUrl?: string;
  hasQuiz?: boolean;
}

interface EducationCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

const LearnScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [articles, setArticles] = useState<EducationArticle[]>([]);
  const [categories, setCategories] = useState<EducationCategory[]>([]);
  const [featuredArticle, setFeaturedArticle] = useState<EducationArticle | null>(null);
  const [activeTab, setActiveTab] = useState<'education' | 'insights'>('education');

  // Load education content
  useEffect(() => {
    if (activeTab === 'education') {
      loadEducationContent();
    }
  }, [activeTab]);

  const loadEducationContent = async () => {
    try {
      setIsLoading(true);
      
      // In a real app, this would fetch from an API
      // For now, we'll use mock data
      const mockCategories: EducationCategory[] = [
        {
          id: generateUUID(),
          name: 'Budgeting',
          icon: 'calculator-outline',
          color: '#4F46E5',
          description: 'Learn how to create and stick to a budget'
        },
        {
          id: generateUUID(),
          name: 'Saving',
          icon: 'wallet-outline',
          color: '#10B981',
          description: 'Strategies to build your savings'
        },
        {
          id: generateUUID(),
          name: 'Debt',
          icon: 'trending-down-outline',
          color: '#EF4444',
          description: 'Managing and reducing debt effectively'
        },
        {
          id: generateUUID(),
          name: 'Investing',
          icon: 'trending-up-outline',
          color: '#F59E0B',
          description: 'Introduction to investments'
        },
        {
          id: generateUUID(),
          name: 'Banking',
          icon: 'card-outline',
          color: '#6366F1',
          description: 'Understanding banking services'
        }
      ];
      
      const mockArticles: EducationArticle[] = [
        {
          id: generateUUID(),
          title: 'Creating Your First Budget',
          description: 'Learn the basics of budgeting and how to create a plan that works for you.',
          category: 'Budgeting',
          imageUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f',
          readTime: '5 min',
          isFeatured: true,
          hasQuiz: true
        },
        {
          id: generateUUID(),
          title: 'The 50/30/20 Rule',
          description: 'A simple budgeting method to help you manage your money effectively.',
          category: 'Budgeting',
          imageUrl: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e',
          readTime: '3 min'
        },
        {
          id: generateUUID(),
          title: 'Emergency Fund Basics',
          description: 'Why you need an emergency fund and how to build one.',
          category: 'Saving',
          imageUrl: 'https://images.unsplash.com/photo-1579621970795-87facc2f976d',
          readTime: '4 min',
          isNew: true
        },
        {
          id: generateUUID(),
          title: 'Saving for Big Goals',
          description: 'Strategies for saving for major life expenses like education or a home.',
          category: 'Saving',
          imageUrl: 'https://images.unsplash.com/photo-1565514020179-026b92b2ed33',
          readTime: '6 min'
        },
        {
          id: generateUUID(),
          title: 'Understanding Credit Scores',
          description: 'What credit scores mean and how they affect your financial life.',
          category: 'Debt',
          imageUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3',
          readTime: '7 min',
          hasQuiz: true
        },
        {
          id: generateUUID(),
          title: 'Debt Repayment Strategies',
          description: 'Effective methods to pay down debt faster.',
          category: 'Debt',
          imageUrl: 'https://images.unsplash.com/photo-1559526324-593bc073d938',
          readTime: '5 min'
        },
        {
          id: generateUUID(),
          title: 'Investing for Beginners',
          description: 'The basics of investing and how to get started with small amounts.',
          category: 'Investing',
          imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3',
          readTime: '8 min',
          isNew: true
        },
        {
          id: generateUUID(),
          title: 'Understanding Banking Fees',
          description: 'How to identify and minimize banking fees to save money.',
          category: 'Banking',
          imageUrl: 'https://images.unsplash.com/photo-1601597111158-2fceff292cdc',
          readTime: '4 min'
        },
        {
          id: generateUUID(),
          title: 'Mobile Banking Safety',
          description: 'Tips to keep your mobile banking secure and protect your money.',
          category: 'Banking',
          imageUrl: 'https://images.unsplash.com/photo-1573164713988-8665fc963095',
          readTime: '5 min',
          hasQuiz: true
        }
      ];
      
      // Set featured article
      const featured = mockArticles.find(article => article.isFeatured) || mockArticles[0];
      
      setCategories(mockCategories);
      setArticles(mockArticles);
      setFeaturedArticle(featured);
      
      // Simulate API delay
      setTimeout(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error loading education content:', error);
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    if (activeTab === 'education') {
      loadEducationContent();
    }
  };

  const handleCategoryPress = (categoryId: string) => {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null); // Deselect if already selected
    } else {
      setSelectedCategory(categoryId);
    }
  };

  const handleArticlePress = (article: EducationArticle) => {
    // Navigate to article detail screen
    navigation.navigate('ArticleDetail', { article });
  };

  const filteredArticles = selectedCategory 
    ? articles.filter(article => {
        const category = categories.find(c => c.id === selectedCategory);
        return category && article.category === category.name;
      })
    : articles;

  if (isLoading && !isRefreshing && activeTab === 'education') {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading educational content...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Learn & Grow</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search-outline" size={22} color="#1F2937" />
        </TouchableOpacity>
      </View>
      
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'education' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('education')}
        >
          <Ionicons 
            name="book-outline" 
            size={20} 
            color={activeTab === 'education' ? "#4F46E5" : "#6B7280"} 
          />
          <Text 
            style={[
              styles.tabText, 
              activeTab === 'education' && styles.activeTabText
            ]}
          >
            Education
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'insights' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('insights')}
        >
          <Ionicons 
            name="analytics-outline" 
            size={20} 
            color={activeTab === 'insights' ? "#4F46E5" : "#6B7280"} 
          />
          <Text 
            style={[
              styles.tabText, 
              activeTab === 'insights' && styles.activeTabText
            ]}
          >
            Insights
          </Text>
        </TouchableOpacity>
      </View>
      
      {activeTab === 'education' ? (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={["#4F46E5"]}
              tintColor="#4F46E5"
            />
          }
          contentContainerStyle={styles.scrollViewContent}
        >
          {/* Categories */}
          <View style={styles.categoriesContainer}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesScrollContent}
            >
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryButton,
                    selectedCategory === category.id && { backgroundColor: category.color + '20' }
                  ]}
                  onPress={() => handleCategoryPress(category.id)}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                    <Ionicons name={category.icon as any} size={22} color={category.color} />
                  </View>
                  <Text style={styles.categoryName}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          {/* Featured Article */}
          {featuredArticle && !selectedCategory && (
            <View style={styles.featuredContainer}>
              <Text style={styles.sectionTitle}>Featured</Text>
              <TouchableOpacity 
                style={styles.featuredCard}
                onPress={() => handleArticlePress(featuredArticle)}
              >
                <Image
                  source={{ uri: `${featuredArticle.imageUrl}?w=600` }}
                  style={styles.featuredImage}
                  resizeMode="cover"
                />
                <View style={styles.featuredOverlay}>
                  <View style={styles.featuredBadge}>
                    <Text style={styles.featuredBadgeText}>Featured</Text>
                  </View>
                  <Text style={styles.featuredTitle}>{featuredArticle.title}</Text>
                  <Text style={styles.featuredDescription}>{featuredArticle.description}</Text>
                  <View style={styles.featuredMeta}>
                    <Text style={styles.featuredCategory}>{featuredArticle.category}</Text>
                    <Text style={styles.featuredReadTime}>{featuredArticle.readTime} read</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Articles List */}
          <View style={styles.articlesContainer}>
            <View style={styles.articlesHeader}>
              <Text style={styles.sectionTitle}>
                {selectedCategory 
                  ? `${categories.find(c => c.id === selectedCategory)?.name} Articles` 
                  : 'Recent Articles'}
              </Text>
              {selectedCategory && (
                <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                  <Text style={styles.clearFilterText}>Clear filter</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {filteredArticles.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyStateText}>No articles found</Text>
                <Text style={styles.emptyStateSubtext}>Try selecting a different category</Text>
              </View>
            ) : (
              filteredArticles.map((article) => (
                <TouchableOpacity
                  key={article.id}
                  style={styles.articleCard}
                  onPress={() => handleArticlePress(article)}
                >
                  <Image
                    source={{ uri: `${article.imageUrl}?w=400` }}
                    style={styles.articleImage}
                    resizeMode="cover"
                  />
                  <View style={styles.articleContent}>
                    <View style={styles.articleMeta}>
                      <Text style={styles.articleCategory}>{article.category}</Text>
                      <Text style={styles.articleReadTime}>{article.readTime} read</Text>
                    </View>
                    <Text style={styles.articleTitle}>{article.title}</Text>
                    <Text style={styles.articleDescription} numberOfLines={2}>
                      {article.description}
                    </Text>
                    <View style={styles.articleFooter}>
                      {article.isNew && (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>NEW</Text>
                        </View>
                      )}
                      {article.hasQuiz && (
                        <View style={styles.quizBadge}>
                          <Ionicons name="help-circle-outline" size={14} color="#4F46E5" />
                          <Text style={styles.quizBadgeText}>Quiz</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      ) : (
        <InsightsScreen />
      )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  searchButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#4F46E5',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#4F46E5',
  },
  categoriesContainer: {
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
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
    alignItems: 'center',
    marginHorizontal: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4B5563',
  },
  featuredContainer: {
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  featuredCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1F2937',
    height: 200,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 16,
    justifyContent: 'flex-end',
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  featuredBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  featuredTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  featuredDescription: {
    color: '#E5E7EB',
    fontSize: 14,
    marginBottom: 8,
  },
  featuredMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featuredCategory: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  featuredReadTime: {
    color: '#D1D5DB',
    fontSize: 12,
  },
  articlesContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 24,
  },
  articlesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  clearFilterText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '500',
  },
  articleCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  articleImage: {
    width: 100,
    height: 100,
  },
  articleContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  articleMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  articleCategory: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '500',
  },
  articleReadTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  articleDescription: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
  },
  articleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  quizBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  quizBadgeText: {
    color: '#4F46E5',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
});

export default LearnScreen; 