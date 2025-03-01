import { supabase } from '../api/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { generateUUID } from '../utils/helpers';
import { mockArticles as MOCK_EDUCATION_ARTICLES, mockCategories as MOCK_EDUCATION_CATEGORIES } from '../utils/mockData';

// Define types for educational content
export interface EducationArticle {
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
  updatedAt?: string;
  createdAt?: string;
}

export interface EducationCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctOption: number;
  explanation?: string;
}

export interface Quiz {
  id: string;
  articleId: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
}

export interface QuizScore {
  score: number;
  totalQuestions: number;
  completedDate: string;
}

export interface UserProgress {
  userId: string;
  completedArticles: string[];
  quizScores: Record<string, QuizScore>;
  lastAccessedArticleId?: string | null;
  lastAccessedArticle?: string | null;
  favoriteArticles: string[];
  completedCategories: string[];
}

// Cache TTL in milliseconds (24 hours)
const CACHE_TTL = 86400000;

// Storage keys for caching
export const STORAGE_KEYS = {
  USER_PROGRESS: 'education_user_progress',
  CATEGORIES: 'education_categories',
  ARTICLES: 'education_articles_',
  ARTICLE_DETAIL: 'education_article_detail_',
  QUIZ: 'education_quiz_',
  LAST_FETCH: 'education_last_fetch_'
};

// Check if data is stale
const isDataStale = async (key: string): Promise<boolean> => {
  try {
    const lastFetch = await AsyncStorage.getItem(`${STORAGE_KEYS.LAST_FETCH}${key}`);
    if (!lastFetch) return true;
    
    const lastFetchTime = parseInt(lastFetch, 10);
    return Date.now() - lastFetchTime > CACHE_TTL;
  } catch (error) {
    console.error('Error checking if data is stale:', error);
    return true;
  }
};

// Update last fetch time
const updateLastFetchTime = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(`${STORAGE_KEYS.LAST_FETCH}${key}`, Date.now().toString());
  } catch (error) {
    console.error('Error updating last fetch time:', error);
  }
};

// Check if device is online
const isOnline = async (): Promise<boolean> => {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected === true;
};

// Get user ID
export const getUserId = async (): Promise<string | null> => {
  try {
    const session = await supabase.auth.getSession();
    return session?.data?.session?.user?.id || null;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
};

// Helper function to check if error is due to missing database table
const isMissingTableError = (error: any): boolean => {
  return error?.code === '42P01' || // PostgreSQL code for "relation does not exist"
    (error?.message && error.message.includes('does not exist'));
};

/**
 * Fetches all education categories
 */
export const getEducationCategories = async (): Promise<EducationCategory[]> => {
  try {
    // Try to get categories from cache first
    const cachedData = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
    const isStale = await isDataStale(STORAGE_KEYS.CATEGORIES);
    const online = await isOnline();

    // If we have cached data and it's not stale or we're offline, use it
    if (cachedData && (!isStale || !online)) {
      return JSON.parse(cachedData);
    }

    // If we're online, fetch from the backend
    if (online) {
      try {
        const { data, error } = await supabase
          .from('education_categories')
          .select('*')
          .order('order', { ascending: true });

        if (error) {
          // If the error is due to missing table, silently fall back to mock data
          if (isMissingTableError(error)) {
            throw new Error('Missing table');
          }
          throw error;
        }

        if (data) {
          // Cache the data
          await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(data));
          await updateLastFetchTime(STORAGE_KEYS.CATEGORIES);
          return data;
        }
      } catch (dbError: any) {
        // Silent fallback for missing table errors
        if (dbError.message === 'Missing table') {
          // Fall through to use mock data
        } else {
          throw dbError;
        }
      }
    }

    // If we're offline and have no cache or stale cache, use mock data
    if (cachedData) {
      return JSON.parse(cachedData);
    } else {
      // Cache mock data for offline use
      await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(MOCK_EDUCATION_CATEGORIES));
      return MOCK_EDUCATION_CATEGORIES;
    }
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('Error fetching education categories:', error);
    }
    
    // Try to get from cache as fallback
    const cachedData = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    return MOCK_EDUCATION_CATEGORIES;
  }
};

/**
 * Fetches education articles, optionally filtered by category
 */
export const getEducationArticles = async (categoryId?: string): Promise<EducationArticle[]> => {
  try {
    const cacheKey = `${STORAGE_KEYS.ARTICLES}${categoryId || 'all'}`;
    
    // Try to get articles from cache first
    const cachedData = await AsyncStorage.getItem(cacheKey);
    const isStale = await isDataStale(cacheKey);
    const online = await isOnline();

    // If we have cached data and it's not stale or we're offline, use it
    if (cachedData && (!isStale || !online)) {
      return JSON.parse(cachedData);
    }

    // If we're online, fetch from the backend
    if (online) {
      try {
        let query = supabase
          .from('education_articles')
          .select('*');
          
        if (categoryId) {
          query = query.eq('category_id', categoryId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
          // If the error is due to missing table, silently fall back to mock data
          if (isMissingTableError(error)) {
            throw new Error('Missing table');
          }
          throw error;
        }

        if (data) {
          // Transform backend data to match our interface
          const articlesData = data.map((item: any) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            imageUrl: item.image_url,
            readTime: item.read_time,
            isNew: new Date(item.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // New if less than 7 days old
            isFeatured: item.is_featured,
            hasQuiz: item.has_quiz
          }));
          
          // Cache the data
          await AsyncStorage.setItem(cacheKey, JSON.stringify(articlesData));
          await updateLastFetchTime(cacheKey);
          return articlesData;
        }
      } catch (dbError: any) {
        // Silent fallback for missing table errors
        if (dbError.message === 'Missing table') {
          // Fall through to use mock data
        } else {
          throw dbError;
        }
      }
    }

    // If we're offline and have no cache or stale cache, use mock data
    if (cachedData) {
      return JSON.parse(cachedData);
    } else {
      let articlesData = MOCK_EDUCATION_ARTICLES;
      
      if (categoryId) {
        const category = (await getEducationCategories()).find((c) => c.id === categoryId);
        if (category) {
          articlesData = MOCK_EDUCATION_ARTICLES.filter((a) => a.category === category.name);
        }
      }
      
      // Cache mock data for offline use
      await AsyncStorage.setItem(cacheKey, JSON.stringify(articlesData));
      return articlesData;
    }
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('Error fetching education articles:', error);
    }
    
    // Try to get from cache as fallback
    const cacheKey = `${STORAGE_KEYS.ARTICLES}${categoryId || 'all'}`;
    const cachedData = await AsyncStorage.getItem(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    // Use mock data if nothing else works
    if (categoryId) {
      const category = (await getEducationCategories()).find((c) => c.id === categoryId);
      return category 
        ? MOCK_EDUCATION_ARTICLES.filter((a) => a.category === category.name)
        : MOCK_EDUCATION_ARTICLES;
    }
    
    return MOCK_EDUCATION_ARTICLES;
  }
};

/**
 * Fetches a specific article by ID
 */
export const getArticleById = async (articleId: string): Promise<EducationArticle | null> => {
  try {
    const cacheKey = `${STORAGE_KEYS.ARTICLE_DETAIL}${articleId}`;
    
    // Try to get article from cache first
    const cachedData = await AsyncStorage.getItem(cacheKey);
    const isStale = await isDataStale(cacheKey);
    const online = await isOnline();

    // If we have cached data and it's not stale or we're offline, use it
    if (cachedData && (!isStale || !online)) {
      return JSON.parse(cachedData);
    }

    // If we're online, fetch from the backend
    if (online) {
      try {
        const { data, error } = await supabase
          .from('education_articles')
          .select('*')
          .eq('id', articleId)
          .single();

        if (error) {
          // If the error is due to missing table, silently fall back to mock data
          if (isMissingTableError(error)) {
            throw new Error('Missing table');
          }
          throw error;
        }

        if (data) {
          // Transform backend data to match our interface
          const articleData: EducationArticle = {
            id: data.id,
            title: data.title,
            description: data.description,
            category: data.category,
            imageUrl: data.image_url,
            readTime: data.read_time,
            content: data.content,
            videoUrl: data.video_url,
            isNew: new Date(data.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            isFeatured: data.is_featured,
            hasQuiz: data.has_quiz
          };
          
          // Cache the data
          await AsyncStorage.setItem(cacheKey, JSON.stringify(articleData));
          await updateLastFetchTime(cacheKey);
          return articleData;
        }
      } catch (dbError: any) {
        // Silent fallback for missing table errors
        if (dbError.message === 'Missing table') {
          // Fall through to use mock data
        } else {
          throw dbError;
        }
      }
    }

    // If we're offline and have no cache or stale cache, look for article in mock data
    if (cachedData) {
      return JSON.parse(cachedData);
    } else {
      const mockArticle = MOCK_EDUCATION_ARTICLES.find((a) => a.id === articleId);
      if (mockArticle) {
        // Cache mock data for offline use
        await AsyncStorage.setItem(cacheKey, JSON.stringify(mockArticle));
        return mockArticle;
      }
    }

    return null;
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error(`Error fetching article with ID ${articleId}:`, error);
    }
    
    // Try to get from cache as fallback
    const cacheKey = `${STORAGE_KEYS.ARTICLE_DETAIL}${articleId}`;
    const cachedData = await AsyncStorage.getItem(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    // Use mock data if nothing else works
    return MOCK_EDUCATION_ARTICLES.find((a) => a.id === articleId) || null;
  }
};

/**
 * Fetches a quiz for a specific article
 */
export const getQuizForArticle = async (articleId: string): Promise<Quiz | null> => {
  try {
    const cacheKey = `${STORAGE_KEYS.QUIZ}${articleId}`;
    
    // Try to get quiz from cache first
    const cachedData = await AsyncStorage.getItem(cacheKey);
    const isStale = await isDataStale(cacheKey);
    const online = await isOnline();

    // If we have cached data and it's not stale or we're offline, use it
    if (cachedData && (!isStale || !online)) {
      return JSON.parse(cachedData);
    }

    // If we're online, fetch from the backend
    if (online) {
      try {
        const { data, error } = await supabase
          .from('education_quizzes')
          .select('*, education_quiz_questions(*)')
          .eq('article_id', articleId)
          .single();

        if (error && error.code !== 'PGRST116') {
          // If the error is due to missing table, silently fall back to mock data
          if (isMissingTableError(error)) {
            throw new Error('Missing table');
          }
          throw error;
        }

        if (data) {
          // Transform backend data to match our interface
          const quizData: Quiz = {
            id: data.id,
            articleId: data.article_id,
            title: data.title,
            description: data.description,
            questions: data.education_quiz_questions.map((q: any) => ({
              id: q.id,
              text: q.question_text,
              options: JSON.parse(q.options),
              correctOption: q.correct_option,
              explanation: q.explanation
            }))
          };
          
          // Cache the data
          await AsyncStorage.setItem(cacheKey, JSON.stringify(quizData));
          await updateLastFetchTime(cacheKey);
          return quizData;
        }
      } catch (dbError: any) {
        // Silent fallback for missing table errors
        if (dbError.message === 'Missing table') {
          // Fall through to use mock data
        } else {
          throw dbError;
        }
      }
    }

    // If we're offline and have no cache or stale cache, generate a mock quiz
    if (cachedData) {
      return JSON.parse(cachedData);
    } else {
      const article = await getArticleById(articleId);
      if (article && article.hasQuiz) {
        const mockQuiz = generateMockQuiz(article);
        // Cache mock data for offline use
        await AsyncStorage.setItem(cacheKey, JSON.stringify(mockQuiz));
        return mockQuiz;
      }
    }

    return null;
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error(`Error fetching quiz for article ${articleId}:`, error);
    }
    
    // Try to get from cache as fallback
    const cacheKey = `${STORAGE_KEYS.QUIZ}${articleId}`;
    const cachedData = await AsyncStorage.getItem(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    // Generate mock quiz if nothing else works
    const article = await getArticleById(articleId);
    if (article && article.hasQuiz) {
      return generateMockQuiz(article);
    }
    
    return null;
  }
};

/**
 * Gets the user's education progress
 */
export const getUserProgress = async (userId: string): Promise<UserProgress> => {
  try {
    if (!userId) throw new Error('User ID is required');
    
    const cacheKey = `${STORAGE_KEYS.USER_PROGRESS}${userId}`;
    
    // If we're online, fetch from the backend
    const online = await isOnline();
    if (online) {
      try {
        const { data, error } = await supabase
          .from('user_education_progress')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          // If the error is due to missing table, silently fall back to mock data
          if (isMissingTableError(error)) {
            throw new Error('Missing table');
          }
          throw error;
        }

        if (data) {
          // Transform backend data to match our interface
          const progressData: UserProgress = {
            userId: data.user_id,
            completedArticles: data.completed_articles || [],
            quizScores: data.quiz_scores || {},
            lastAccessedArticleId: data.last_accessed_article,
            lastAccessedArticle: data.last_accessed_article,
            favoriteArticles: data.favorite_articles || [],
            completedCategories: data.completed_categories || []
          };
          
          // Cache the data
          await AsyncStorage.setItem(cacheKey, JSON.stringify(progressData));
          return progressData;
        }
      } catch (dbError: any) {
        // Silent fallback for missing table errors
        if (dbError.message === 'Missing table') {
          // Fall through to use mock data
        } else {
          throw dbError;
        }
      }
    }

    // If we're offline or no data in backend, try to get from cache
    const cachedData = await AsyncStorage.getItem(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    // If no cached data, return empty progress
    const emptyProgress: UserProgress = {
      userId,
      completedArticles: [],
      quizScores: {},
      lastAccessedArticleId: null,
      lastAccessedArticle: null,
      favoriteArticles: [],
      completedCategories: []
    };
    
    // Cache empty progress
    await AsyncStorage.setItem(cacheKey, JSON.stringify(emptyProgress));
    return emptyProgress;
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error(`Error fetching user progress for ${userId}:`, error);
    }
    
    // Try to get from cache as fallback
    const cacheKey = `${STORAGE_KEYS.USER_PROGRESS}${userId}`;
    const cachedData = await AsyncStorage.getItem(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    
    // Return empty progress if nothing else works
    return {
      userId,
      completedArticles: [],
      quizScores: {},
      lastAccessedArticleId: null,
      lastAccessedArticle: null,
      favoriteArticles: [],
      completedCategories: []
    };
  }
};

/**
 * Marks an article as completed for a user
 */
export const markArticleAsCompleted = async (userId: string, articleId: string): Promise<void> => {
  try {
    if (!userId) throw new Error('User ID is required');
    
    // Get current progress
    const progress = await getUserProgress(userId);
    
    // Check if article is already completed
    if (progress.completedArticles.includes(articleId)) {
      return;
    }
    
    // Add article to completed list
    progress.completedArticles.push(articleId);
    progress.lastAccessedArticleId = articleId;
    progress.lastAccessedArticle = articleId;
    
    // Update local cache immediately for responsive UI
    const cacheKey = `${STORAGE_KEYS.USER_PROGRESS}${userId}`;
    await AsyncStorage.setItem(cacheKey, JSON.stringify(progress));
    
    // If online, update backend
    const online = await isOnline();
    if (online) {
      try {
        const { error } = await supabase
          .from('user_education_progress')
          .upsert({
            user_id: userId,
            completed_articles: progress.completedArticles,
            quiz_scores: progress.quizScores,
            last_accessed_article: progress.lastAccessedArticle,
            favorite_articles: progress.favoriteArticles,
            completed_categories: progress.completedCategories
          });

        if (error) {
          // If the error is due to missing table, silently proceed
          if (isMissingTableError(error)) {
            // Continue with local only changes
          } else {
            throw error;
          }
        }
      } catch (dbError: any) {
        if (!isMissingTableError(dbError)) {
          throw dbError;
        }
        // Otherwise continue with local changes only
      }
    }
    
    // Check if this completion leads to category completion
    await checkAndMarkCategoryCompletion(userId, articleId);
    
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error(`Error marking article ${articleId} as completed for user ${userId}:`, error);
    }
    // We don't throw here to ensure the app doesn't crash if this operation fails
  }
};

/**
 * Saves a quiz score for a user
 */
export const saveQuizScore = async (
  userId: string, 
  articleId: string, 
  score: number, 
  totalQuestions: number
): Promise<void> => {
  try {
    if (!userId) throw new Error('User ID is required');
    
    // Get current progress
    const progress = await getUserProgress(userId);
    
    // Add quiz score
    progress.quizScores[articleId] = {
      score,
      totalQuestions,
      completedDate: new Date().toISOString()
    };
    
    // Update local cache immediately for responsive UI
    const cacheKey = `${STORAGE_KEYS.USER_PROGRESS}${userId}`;
    await AsyncStorage.setItem(cacheKey, JSON.stringify(progress));
    
    // If online, update backend
    const online = await isOnline();
    if (online) {
      const { error } = await supabase
        .from('user_education_progress')
        .upsert({
          user_id: userId,
          completed_articles: progress.completedArticles,
          quiz_scores: progress.quizScores,
          last_accessed_article: progress.lastAccessedArticle,
          favorite_articles: progress.favoriteArticles,
          completed_categories: progress.completedCategories
        });

      if (error) throw error;
    }
    
  } catch (error) {
    console.error(`Error saving quiz score for article ${articleId} for user ${userId}:`, error);
  }
};

/**
 * Toggles an article as favorite for a user
 */
export const toggleArticleFavorite = async (userId: string, articleId: string): Promise<boolean> => {
  try {
    if (!userId) throw new Error('User ID is required');
    
    // Get current progress
    const progress = await getUserProgress(userId);
    
    // Toggle favorite status
    const isFavorite = progress.favoriteArticles.includes(articleId);
    
    if (isFavorite) {
      // Remove from favorites
      progress.favoriteArticles = progress.favoriteArticles.filter(id => id !== articleId);
    } else {
      // Add to favorites
      progress.favoriteArticles.push(articleId);
    }
    
    // Update local cache immediately for responsive UI
    const cacheKey = `${STORAGE_KEYS.USER_PROGRESS}${userId}`;
    await AsyncStorage.setItem(cacheKey, JSON.stringify(progress));
    
    // If online, update backend
    const online = await isOnline();
    if (online) {
      const { error } = await supabase
        .from('user_education_progress')
        .upsert({
          user_id: userId,
          completed_articles: progress.completedArticles,
          quiz_scores: progress.quizScores,
          last_accessed_article: progress.lastAccessedArticle,
          favorite_articles: progress.favoriteArticles,
          completed_categories: progress.completedCategories
        });

      if (error) throw error;
    }
    
    return !isFavorite; // Return new favorite status
    
  } catch (error) {
    console.error(`Error toggling favorite for article ${articleId} for user ${userId}:`, error);
    return false;
  }
};

/**
 * Gets personalized article recommendations for a user
 */
export const getPersonalizedRecommendations = async (userId: string): Promise<EducationArticle[]> => {
  try {
    // Get user progress
    const progress = await getUserProgress(userId);
    
    // Get all articles
    const allArticles = await getEducationArticles();
    
    // If user has no completed articles, recommend starting with budgeting basics
    if (progress.completedArticles.length === 0) {
      const beginnerArticles = allArticles.filter((a) => 
        a.category === 'Budgeting' || a.title.toLowerCase().includes('basic') || a.title.toLowerCase().includes('beginner')
      );
      
      return beginnerArticles.length > 0 ? beginnerArticles : allArticles.slice(0, 5);
    }
    
    // Filter out completed articles
    const uncompletedArticles = allArticles.filter((a) => !progress.completedArticles.includes(a.id));
    
    // If all articles are completed, recommend revisiting some
    if (uncompletedArticles.length === 0) {
      return allArticles.slice(0, 5);
    }
    
    // Get categories of completed articles
    const completedCategories = new Set();
    const completedArticles = allArticles.filter((a) => progress.completedArticles.includes(a.id));
    completedArticles.forEach(a => completedCategories.add(a.category));
    
    // Recommend next articles in completed categories
    const categoryRecommendations: EducationArticle[] = [];
    completedCategories.forEach(category => {
      const articlesInCategory = uncompletedArticles.filter(a => a.category === category);
      if (articlesInCategory.length > 0) {
        categoryRecommendations.push(articlesInCategory[0]);
      }
    });
    
    // If we don't have enough category recommendations, add some from uncompleted categories
    if (categoryRecommendations.length < 5) {
      const uncompletedCategories = allArticles
        .map(a => a.category)
        .filter(c => !completedCategories.has(c))
        .filter((v, i, a) => a.indexOf(v) === i); // Get unique categories
        
      uncompletedCategories.forEach(category => {
        if (categoryRecommendations.length < 5) {
          const articlesInCategory = uncompletedArticles.filter(a => a.category === category);
          if (articlesInCategory.length > 0) {
            categoryRecommendations.push(articlesInCategory[0]);
          }
        }
      });
    }
    
    // If we still don't have enough recommendations, add random uncompleted articles
    while (categoryRecommendations.length < 5 && uncompletedArticles.length > categoryRecommendations.length) {
      const randomIndex = Math.floor(Math.random() * uncompletedArticles.length);
      const randomArticle = uncompletedArticles[randomIndex];
      
      // Check if we already recommended this article
      if (!categoryRecommendations.some(a => a.id === randomArticle.id)) {
        categoryRecommendations.push(randomArticle);
      }
    }
    
    return categoryRecommendations;
    
  } catch (error) {
    console.error(`Error getting personalized recommendations for user ${userId}:`, error);
    
    // Return some articles as a fallback
    return getEducationArticles();
  }
};

/**
 * Gets education statistics for a user
 */
export const getEducationStats = async (userId: string): Promise<any> => {
  try {
    // Get user progress
    const progress = await getUserProgress(userId);
    
    // Get all articles and categories
    const allArticles = await getEducationArticles();
    const allCategories = await getEducationCategories();
    
    // Calculate statistics
    const articlesRead = progress.completedArticles.length;
    const totalArticles = allArticles.length;
    const percentComplete = totalArticles > 0 ? (articlesRead / totalArticles) * 100 : 0;
    
    // Calculate category completion
    const categoryStats = allCategories.map(category => {
      const articlesInCategory = allArticles.filter(a => a.category === category.name);
      const completedInCategory = articlesInCategory.filter(a => progress.completedArticles.includes(a.id));
      
      return {
        category: category.name,
        completed: completedInCategory.length,
        total: articlesInCategory.length,
        percentComplete: articlesInCategory.length > 0 
          ? (completedInCategory.length / articlesInCategory.length) * 100 
          : 0
      };
    });
    
    // Calculate quiz performance
    const quizzes = Object.values(progress.quizScores);
    const quizzesCompleted = quizzes.length;
    const totalQuizScore = quizzes.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions), 0);
    const averageQuizScore = quizzesCompleted > 0 ? (totalQuizScore / quizzesCompleted) * 100 : 0;
    
    return {
      articlesRead,
      totalArticles,
      percentComplete,
      quizzesCompleted,
      averageQuizScore,
      categoryStats
    };
    
  } catch (error) {
    console.error(`Error getting education stats for user ${userId}:`, error);
    
    // Return default stats
    return {
      articlesRead: 0,
      totalArticles: 0,
      percentComplete: 0,
      quizzesCompleted: 0,
      averageQuizScore: 0,
      categoryStats: []
    };
  }
};

/**
 * Checks if all articles in a category are completed when an article is marked as read
 */
const checkAndMarkCategoryCompletion = async (userId: string, articleId: string): Promise<void> => {
  try {
    // Get article to determine category
    const article = await getArticleById(articleId);
    if (!article) return;
    
    // Get all articles in the category
    const allArticles = await getEducationArticles();
    const articleCategory = article.category;
    const articlesInCategory = allArticles.filter(a => a.category === articleCategory);
    
    // Get user progress
    const progress = await getUserProgress(userId);
    
    // Check if all articles in the category are completed
    const allCompleted = articlesInCategory.every(a => progress.completedArticles.includes(a.id));
    
    if (allCompleted) {
      // Get category ID
      const categories = await getEducationCategories();
      const category = categories.find(c => c.name === articleCategory);
      
      if (category && !progress.completedCategories.includes(category.id)) {
        // Mark category as completed
        progress.completedCategories.push(category.id);
        
        // Update local cache
        const cacheKey = `${STORAGE_KEYS.USER_PROGRESS}${userId}`;
        await AsyncStorage.setItem(cacheKey, JSON.stringify(progress));
        
        // If online, update backend
        const online = await isOnline();
        if (online) {
          await supabase
            .from('user_education_progress')
            .upsert({
              user_id: userId,
              completed_articles: progress.completedArticles,
              quiz_scores: progress.quizScores,
              last_accessed_article: progress.lastAccessedArticle,
              favorite_articles: progress.favoriteArticles,
              completed_categories: progress.completedCategories
            });
        }
      }
    }
    
  } catch (error) {
    console.error(`Error checking category completion for user ${userId}:`, error);
  }
};

// Helper function to generate a mock quiz for testing
const generateMockQuiz = (article: EducationArticle): Quiz => {
  let questions: QuizQuestion[] = [];
  
  switch (article.category.toLowerCase()) {
    case 'budgeting':
      questions = [
        {
          id: generateUUID(),
          text: 'What is the 50/30/20 rule in budgeting?',
          options: [
            'Save 50%, spend 30% on needs and 20% on wants',
            'Spend 50% on needs, 30% on wants, and save 20%',
            'Spend 50% on housing, 30% on food, and 20% on transport',
            'Save 50% for retirement, 30% for emergencies, and 20% for goals'
          ],
          correctOption: 1,
          explanation: 'The 50/30/20 rule suggests allocating 50% of your income to needs, 30% to wants, and 20% to savings and debt repayment.'
        },
        {
          id: generateUUID(),
          text: 'What is zero-based budgeting?',
          options: [
            'When you spend your entire paycheck each month',
            'When you assign every dollar a job until you reach zero',
            'When you start your budget from scratch each month',
            'When you have zero debt payments in your budget'
          ],
          correctOption: 1,
          explanation: 'Zero-based budgeting means assigning every dollar of income to a specific expense, savings, or debt payment category until you have zero dollars left to assign.'
        },
        {
          id: generateUUID(),
          text: 'Why is tracking expenses important?',
          options: [
            'It helps you identify areas where you can cut back',
            'It ensures you stick to your budget',
            'It helps you understand your spending patterns',
            'All of the above'
          ],
          correctOption: 3,
          explanation: 'Tracking expenses is crucial because it helps you identify areas to cut back, ensures budget adherence, and helps understand spending patterns.'
        }
      ];
      break;
      
    case 'saving':
      questions = [
        {
          id: generateUUID(),
          text: 'What is an emergency fund?',
          options: [
            'Money set aside for unexpected expenses or financial emergencies',
            'A government fund that helps people in financial emergencies',
            'Money saved for a specific goal like a vacation',
            'A fund managed by your employer for emergencies'
          ],
          correctOption: 0,
          explanation: 'An emergency fund is money set aside to cover unexpected expenses or financial emergencies, such as medical bills, car repairs, or job loss.'
        },
        {
          id: generateUUID(),
          text: 'How much should you have in your emergency fund?',
          options: [
            'One month of expenses',
            'Three to six months of expenses',
            'One year of expenses',
            'As much as possible'
          ],
          correctOption: 1,
          explanation: 'Financial experts typically recommend having three to six months of essential expenses saved in your emergency fund.'
        },
        {
          id: generateUUID(),
          text: 'What is the main benefit of automating your savings?',
          options: [
            'It earns you more interest',
            'It prevents you from forgetting to save',
            'It helps you save before you can spend the money',
            'It makes your bank account look better'
          ],
          correctOption: 2,
          explanation: 'Automating savings helps you pay yourself first by transferring money to savings before you have a chance to spend it.'
        }
      ];
      break;
      
    // Add more categories as needed
    
    default:
      questions = [
        {
          id: generateUUID(),
          text: 'What is financial literacy?',
          options: [
            'The ability to read financial documents',
            'Having a lot of money',
            'The ability to understand and use various financial skills',
            'Being able to predict stock market trends'
          ],
          correctOption: 2,
          explanation: 'Financial literacy is the ability to understand and effectively use various financial skills, including personal financial management, budgeting, and investing.'
        },
        {
          id: generateUUID(),
          text: 'Why is financial education important?',
          options: [
            'It helps you get rich quickly',
            'It helps you make informed decisions about money',
            'It guarantees financial success',
            'It\'s required by law'
          ],
          correctOption: 1,
          explanation: 'Financial education is important because it helps you make informed decisions about managing your money, which can lead to better financial outcomes.'
        },
        {
          id: generateUUID(),
          text: 'Which of the following is NOT a good financial habit?',
          options: [
            'Creating and following a budget',
            'Saving regularly',
            'Maxing out credit cards to build credit',
            'Tracking expenses'
          ],
          correctOption: 2,
          explanation: 'Maxing out credit cards is not a good financial habit as it can lead to high interest debt and negatively impact your credit score.'
        }
      ];
  }
  
  return {
    id: generateUUID(),
    articleId: article.id,
    title: `Test Your Knowledge: ${article.category}`,
    description: `Take this quiz to test what you've learned about ${article.category.toLowerCase()}.`,
    questions
  };
}; 