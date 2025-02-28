import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';

import testAllFlows from '../utils/testAllFlows';
import testOfflineMode from '../utils/testOfflineMode';
import OfflineStatusBar from '../components/OfflineStatusBar';
import Button from '../components/Button';
import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';

type TestingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Testing'>;

const TestingScreen: React.FC = () => {
  const navigation = useNavigation<TestingScreenNavigationProp>();
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<{[key: string]: 'pending' | 'success' | 'failed'}>({});

  const runTest = async (testName: string, testFunction: () => Promise<void>) => {
    try {
      setTestResults(prev => ({ ...prev, [testName]: 'pending' }));
      setIsLoading(true);
      await testFunction();
      setTestResults(prev => ({ ...prev, [testName]: 'success' }));
    } catch (error) {
      console.error(`Error running ${testName}:`, error);
      setTestResults(prev => ({ ...prev, [testName]: 'failed' }));
      Alert.alert('Test Failed', `The ${testName} test failed. See console for details.`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: 'pending' | 'success' | 'failed' | undefined) => {
    if (status === 'success') {
      return <Ionicons name="checkmark-circle" size={24} color={colors.success} />;
    } else if (status === 'failed') {
      return <Ionicons name="close-circle" size={24} color={colors.error} />;
    } else if (status === 'pending') {
      return <ActivityIndicator size="small" color={colors.primary} />;
    } else {
      return <Ionicons name="ellipse-outline" size={24} color={colors.textSecondary} />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="auto" />
      
      <OfflineStatusBar onSyncComplete={() => {}} />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>End-to-End Testing</Text>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Flow Testing</Text>
          <Text style={styles.sectionDescription}>
            Test all major user flows in the application to ensure they work as expected.
          </Text>
          
          <View style={styles.testCard}>
            <View style={styles.testHeader}>
              <Text style={styles.testTitle}>Run All Tests</Text>
              {getStatusIcon(testResults['allTests'])}
            </View>
            <Text style={styles.testDescription}>
              Run all tests in sequence. This will test Supabase integration, OpenAI integration, 
              notifications, and offline functionality.
            </Text>
            <Button
              title="Run All Tests"
              onPress={() => runTest('allTests', testAllFlows.runAllTests)}
              variant="primary"
              size="small"
              style={styles.actionButton}
              disabled={isLoading}
            />
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Integration Testing</Text>
          <Text style={styles.sectionDescription}>
            Test integrations with external services.
          </Text>
          
          <View style={styles.testCard}>
            <View style={styles.testHeader}>
              <Text style={styles.testTitle}>Supabase Integration</Text>
              {getStatusIcon(testResults['supabase'])}
            </View>
            <Text style={styles.testDescription}>
              Test connection to Supabase and verify that the Vault is available.
            </Text>
            <Button
              title="Test Supabase"
              onPress={() => runTest('supabase', testAllFlows.testSupabaseIntegration)}
              variant="outline"
              size="small"
              style={styles.actionButton}
              disabled={isLoading}
            />
          </View>
          
          <View style={styles.testCard}>
            <View style={styles.testHeader}>
              <Text style={styles.testTitle}>OpenAI Integration</Text>
              {getStatusIcon(testResults['openai'])}
            </View>
            <Text style={styles.testDescription}>
              Test connection to OpenAI API and verify that the API key is set correctly.
            </Text>
            <Button
              title="Test OpenAI"
              onPress={() => runTest('openai', testAllFlows.testOpenAIIntegration)}
              variant="outline"
              size="small"
              style={styles.actionButton}
              disabled={isLoading}
            />
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feature Testing</Text>
          <Text style={styles.sectionDescription}>
            Test specific features of the application.
          </Text>
          
          <View style={styles.testCard}>
            <View style={styles.testHeader}>
              <Text style={styles.testTitle}>Offline Functionality</Text>
              {getStatusIcon(testResults['offline'])}
            </View>
            <Text style={styles.testDescription}>
              Test the app's ability to work offline and sync data when back online.
            </Text>
            <Button
              title="Test Offline Mode"
              onPress={() => runTest('offline', testAllFlows.testOfflineFunctionality)}
              variant="outline"
              size="small"
              style={styles.actionButton}
              disabled={isLoading}
            />
          </View>
          
          <View style={styles.testCard}>
            <View style={styles.testHeader}>
              <Text style={styles.testTitle}>Notifications</Text>
              {getStatusIcon(testResults['notifications'])}
            </View>
            <Text style={styles.testDescription}>
              Test the notification system by sending test notifications.
            </Text>
            <Button
              title="Test Notifications"
              onPress={() => runTest('notifications', testAllFlows.testNotificationSystem)}
              variant="outline"
              size="small"
              style={styles.actionButton}
              disabled={isLoading}
            />
          </View>
          
          <View style={styles.testCard}>
            <View style={styles.testHeader}>
              <Text style={styles.testTitle}>Generate Test Data</Text>
              {getStatusIcon(testResults['testData'])}
            </View>
            <Text style={styles.testDescription}>
              Generate a large dataset to test app performance with many items.
            </Text>
            <Button
              title="Generate 20 Items"
              onPress={() => runTest('testData', () => testOfflineMode.generateLargeOfflineDataset(20))}
              variant="outline"
              size="small"
              style={styles.actionButton}
              disabled={isLoading}
            />
          </View>
          
          <View style={styles.testCard}>
            <View style={styles.testHeader}>
              <Text style={styles.testTitle}>Clear Test Data</Text>
              {getStatusIcon(testResults['clearData'])}
            </View>
            <Text style={styles.testDescription}>
              Clear all test data from the app.
            </Text>
            <Button
              title="Clear All Data"
              onPress={() => runTest('clearData', testOfflineMode.clearAllOfflineData)}
              variant="danger"
              size="small"
              style={styles.actionButton}
              disabled={isLoading}
            />
          </View>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            After completing all tests, use the checklist in the documentation to verify that all features are working correctly.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  testCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  testDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  actionButton: {
    alignSelf: 'flex-start',
  },
  footer: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: `${colors.primary}10`,
    borderRadius: borderRadius.md,
  },
  footerText: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
  },
});

export default TestingScreen; 