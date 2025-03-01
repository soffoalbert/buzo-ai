import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  ToastAndroid,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { getEducationArticles, getArticleById, EducationArticle } from '../services/educationService';

// Storage keys for offline content
const OFFLINE_CONTENT_KEY = 'offline_education_content';
const OFFLINE_ARTICLES_LIST_KEY = 'offline_education_articles_list';

// Interface for the component props
interface OfflineContentManagerProps {
  onContentUpdated?: () => void;
}

const OfflineContentManager: React.FC<OfflineContentManagerProps> = ({ onContentUpdated }) => {
  const [articles, setArticles] = useState<EducationArticle[]>([]);
  const [offlineArticles, setOfflineArticles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected === true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load the list of articles stored offline
      const offlineArticlesJson = await AsyncStorage.getItem(OFFLINE_ARTICLES_LIST_KEY);
      const savedOfflineArticles = offlineArticlesJson ? JSON.parse(offlineArticlesJson) : [];
      setOfflineArticles(savedOfflineArticles);

      // Load all available articles
      const allArticles = await getEducationArticles();
      setArticles(allArticles);
    } catch (err) {
      console.error('Error loading offline content data:', err);
      setError('Failed to load content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadArticle = async (article: EducationArticle) => {
    // Don't proceed if already downloading
    if (downloading[article.id]) return;
    
    try {
      setDownloading(prev => ({ ...prev, [article.id]: true }));
      
      // Check if we're online
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        showMessage('You are offline. Cannot download content.');
        return;
      }

      // Get the full article content
      const fullArticle = await getArticleById(article.id);
      
      if (!fullArticle || !fullArticle.content) {
        showMessage('Article content not available for download.');
        return;
      }

      // Store the article content
      const offlineContent = await getOfflineContent();
      offlineContent[article.id] = fullArticle;
      
      // Save the updated offline content
      await AsyncStorage.setItem(OFFLINE_CONTENT_KEY, JSON.stringify(offlineContent));
      
      // Update the list of offline articles
      const updatedOfflineArticles = [...offlineArticles, article.id];
      setOfflineArticles(updatedOfflineArticles);
      await AsyncStorage.setItem(OFFLINE_ARTICLES_LIST_KEY, JSON.stringify(updatedOfflineArticles));
      
      // Show success message
      showMessage('Article downloaded for offline reading');
      
      // Notify parent component if needed
      if (onContentUpdated) {
        onContentUpdated();
      }
    } catch (err) {
      console.error('Error downloading article:', err);
      showMessage('Failed to download article. Please try again.');
    } finally {
      setDownloading(prev => ({ ...prev, [article.id]: false }));
    }
  };

  const removeOfflineArticle = async (articleId: string) => {
    try {
      // Get current offline content
      const offlineContent = await getOfflineContent();
      
      // Remove the article
      delete offlineContent[articleId];
      
      // Save updated offline content
      await AsyncStorage.setItem(OFFLINE_CONTENT_KEY, JSON.stringify(offlineContent));
      
      // Update the list of offline articles
      const updatedOfflineArticles = offlineArticles.filter(id => id !== articleId);
      setOfflineArticles(updatedOfflineArticles);
      await AsyncStorage.setItem(OFFLINE_ARTICLES_LIST_KEY, JSON.stringify(updatedOfflineArticles));
      
      // Show success message
      showMessage('Article removed from offline storage');
      
      // Notify parent component if needed
      if (onContentUpdated) {
        onContentUpdated();
      }
    } catch (err) {
      console.error('Error removing offline article:', err);
      showMessage('Failed to remove article. Please try again.');
    }
  };

  const getOfflineContent = async (): Promise<Record<string, EducationArticle>> => {
    try {
      const offlineContentJson = await AsyncStorage.getItem(OFFLINE_CONTENT_KEY);
      return offlineContentJson ? JSON.parse(offlineContentJson) : {};
    } catch (err) {
      console.error('Error getting offline content:', err);
      return {};
    }
  };

  const showMessage = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Buzo Education', message);
    }
  };

  const getOfflineStorageSize = async (): Promise<string> => {
    try {
      const offlineContentJson = await AsyncStorage.getItem(OFFLINE_CONTENT_KEY);
      if (!offlineContentJson) return '0 KB';
      
      const bytes = new Blob([offlineContentJson]).size;
      if (bytes < 1024) {
        return `${bytes} B`;
      } else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
      } else {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      }
    } catch (err) {
      console.error('Error calculating offline storage size:', err);
      return 'Unknown';
    }
  };

  const clearAllOfflineContent = async () => {
    Alert.alert(
      'Clear Offline Content',
      'Are you sure you want to remove all downloaded content?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(OFFLINE_CONTENT_KEY);
              await AsyncStorage.removeItem(OFFLINE_ARTICLES_LIST_KEY);
              setOfflineArticles([]);
              showMessage('All offline content has been removed');
              
              if (onContentUpdated) {
                onContentUpdated();
              }
            } catch (err) {
              console.error('Error clearing offline content:', err);
              showMessage('Failed to clear offline content. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderArticleItem = ({ item }: { item: EducationArticle }) => {
    const isDownloaded = offlineArticles.includes(item.id);
    const isDownloading = downloading[item.id];

    return (
      <View style={styles.articleItem}>
        <View style={styles.articleInfo}>
          <Text style={styles.articleTitle}>{item.title}</Text>
          <Text style={styles.articleCategory}>{item.category} • {item.readTime}</Text>
        </View>
        
        {isDownloading ? (
          <ActivityIndicator size="small" color="#6739B7" />
        ) : isDownloaded ? (
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => removeOfflineArticle(item.id)}
          >
            <Ionicons name="trash-outline" size={20} color="#FF7675" />
            <Text style={[styles.buttonText, styles.removeButtonText]}>Remove</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.actionButton, !isOnline && styles.disabledButton]}
            onPress={() => downloadArticle(item)}
            disabled={!isOnline}
          >
            <Ionicons name="download-outline" size={20} color="#6739B7" />
            <Text style={styles.buttonText}>Download</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6739B7" />
        <Text style={styles.loadingText}>Loading content...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#FF7675" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isOnline && (
        <View style={styles.offlineNotice}>
          <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
          <Text style={styles.offlineText}>You are offline. Some features may be limited.</Text>
        </View>
      )}
      
      <View style={styles.header}>
        <Text style={styles.title}>Offline Content</Text>
        <Text style={styles.subtitle}>
          Downloaded: {offlineArticles.length} of {articles.length} articles
        </Text>
      </View>
      
      {offlineArticles.length > 0 && (
        <TouchableOpacity style={styles.clearButton} onPress={clearAllOfflineContent}>
          <Ionicons name="trash-outline" size={16} color="#FF7675" />
          <Text style={styles.clearButtonText}>Clear All Offline Content</Text>
        </TouchableOpacity>
      )}
      
      <FlatList
        data={articles}
        renderItem={renderArticleItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={40} color="#6739B7" />
            <Text style={styles.emptyText}>No content available</Text>
            <Text style={styles.emptySubtext}>Check your connection and try again</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666666',
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
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF7675',
    padding: 10,
    paddingHorizontal: 16,
  },
  offlineText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF6F6',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  clearButtonText: {
    color: '#FF7675',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  articleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  articleInfo: {
    flex: 1,
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  articleCategory: {
    fontSize: 12,
    color: '#666666',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F0FF',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 14,
    color: '#6739B7',
    marginLeft: 4,
  },
  removeButtonText: {
    color: '#FF7675',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
});

export default OfflineContentManager; 