import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import FeedbackForm from '../components/FeedbackForm';
import QuickSurvey from '../components/QuickSurvey';
import { getAvailableSurveys, syncPendingFeedback } from '../services/feedbackService';
import { Survey } from '../models/Feedback';
import { useTheme } from '../hooks/useTheme';

const FeedbackScreen: React.FC = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigation = useNavigation();
  const { colors } = useTheme();

  useEffect(() => {
    loadSurveys();
    syncFeedback();
  }, []);

  const loadSurveys = async () => {
    setIsLoading(true);
    try {
      const availableSurveys = await getAvailableSurveys();
      setSurveys(availableSurveys);
      console.log('Loaded surveys:', JSON.stringify(availableSurveys, null, 2));
    } catch (error) {
      console.error('Error loading surveys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncFeedback = async () => {
    setIsSyncing(true);
    try {
      const syncedCount = await syncPendingFeedback();
      if (syncedCount > 0) {
        console.log(`Synced ${syncedCount} feedback items`);
      }
    } catch (error) {
      console.error('Error syncing feedback:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSurveySelect = (survey: Survey) => {
    setSelectedSurvey(survey);
    setShowSurvey(true);
  };

  const handleSurveyComplete = () => {
    loadSurveys(); // Reload surveys to update status
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>Feedback Center</Text>
      <View style={styles.headerRight} />
    </View>
  );

  const renderSurveys = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (surveys.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            No surveys available at the moment.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.surveysContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Quick Surveys
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.text + 'CC' }]}>
          Help us improve Buzo by taking a quick survey
        </Text>
        
        {surveys.map((survey) => (
          <TouchableOpacity
            key={survey.id}
            style={[styles.surveyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleSurveySelect(survey)}
          >
            <View style={styles.surveyCardContent}>
              <View style={styles.surveyCardHeader}>
                <Text style={[styles.surveyTitle, { color: colors.text }]}>
                  {survey.title}
                </Text>
                <Text style={[styles.surveyQuestions, { color: colors.text + 'CC' }]}>
                  {survey.questions.length} questions
                </Text>
              </View>
              <Text style={[styles.surveyDescription, { color: colors.text + 'CC' }]}>
                {survey.description}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text + 'CC'} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.content}>
          <View style={styles.introContainer}>
            <Text style={[styles.introTitle, { color: colors.text }]}>
              We Value Your Feedback
            </Text>
            <Text style={[styles.introText, { color: colors.text + 'CC' }]}>
              Your feedback helps us improve Buzo and provide a better financial assistant for you and other users.
            </Text>
          </View>
          
          {renderSurveys()}
          
          <View style={styles.formContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Share Your Thoughts
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.text + 'CC' }]}>
              Have a suggestion, found a bug, or want to request a feature?
            </Text>
            
            <FeedbackForm />
          </View>
        </View>
      </ScrollView>
      
      {selectedSurvey && (
        <QuickSurvey
          survey={selectedSurvey}
          isVisible={showSurvey}
          onClose={() => setShowSurvey(false)}
          onComplete={handleSurveyComplete}
        />
      )}
      
      {isSyncing && (
        <View style={styles.syncIndicator}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.syncText, { color: colors.text }]}>
            Syncing feedback...
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  introContainer: {
    marginBottom: 24,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
  },
  surveysContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  surveyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  surveyCardContent: {
    flex: 1,
  },
  surveyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  surveyTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  surveyQuestions: {
    fontSize: 12,
  },
  surveyDescription: {
    fontSize: 14,
  },
  formContainer: {
    marginBottom: 24,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  syncIndicator: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  syncText: {
    fontSize: 12,
    marginLeft: 8,
    color: '#fff',
  },
});

export default FeedbackScreen; 