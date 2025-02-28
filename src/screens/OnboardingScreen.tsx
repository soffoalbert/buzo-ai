import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Alert,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation';
import { colors, spacing, textStyles, borderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import BankStatementUploader from '../components/BankStatementUploader';
import { uploadBankStatement } from '../services/bankStatementService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Get screen dimensions
const { width, height } = Dimensions.get('window');

// Define onboarding slide data
const slides = [
  {
    id: '1',
    title: 'Welcome to Buzo',
    description: 'Your AI-powered financial assistant designed for African youth.',
    icon: 'wallet-outline',
  },
  {
    id: '2',
    title: 'Smart Budgeting',
    description: 'Set up personalized budgets and get alerts when you\'re approaching your limits.',
    icon: 'calculator-outline',
  },
  {
    id: '3',
    title: 'Track Expenses',
    description: 'Scan receipts with your camera or manually log expenses to keep track of your spending.',
    icon: 'camera-outline',
  },
  {
    id: '4',
    title: 'Upload Bank Statements',
    description: 'Upload your bank statements to get personalized financial insights and advice.',
    icon: 'document-text-outline',
    component: 'BankStatementUploader',
  },
  {
    id: '5',
    title: 'Achieve Savings Goals',
    description: 'Set savings targets and get personalized advice to help you reach them faster.',
    icon: 'trending-up-outline',
  },
  {
    id: '6',
    title: 'Financial Education',
    description: 'Access educational content tailored to your needs and improve your financial literacy.',
    icon: 'school-outline',
  },
];

// Define props type
type OnboardingScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Onboarding'>;
};

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [uploadedStatement, setUploadedStatement] = useState<{ uri: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Handle slide change
  const handleSlideChange = (index: number) => {
    setCurrentIndex(index);
  };

  // Mark onboarding as completed
  const markOnboardingCompleted = async () => {
    try {
      await SecureStore.setItemAsync('onboardingCompleted', 'true');
      console.log('Onboarding marked as completed');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  // Navigate to next slide or login screen
  const handleNext = async () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
    } else {
      // Mark onboarding as completed
      await markOnboardingCompleted();
      
      // If user has uploaded a statement, navigate to register
      if (uploadedStatement) {
        navigation.navigate('Register');
      } else {
        navigation.navigate('Login');
      }
    }
  };

  // Skip to login screen
  const handleSkip = async () => {
    // Mark onboarding as completed even when skipped
    await markOnboardingCompleted();
    navigation.navigate('Login');
  };

  // Handle bank statement upload
  const handleBankStatementUpload = async (fileUri: string, fileName: string) => {
    setUploadedStatement({ uri: fileUri, name: fileName });
    setIsUploading(true);
    
    try {
      // Store the bank statement info temporarily in AsyncStorage
      // It will be uploaded after the user registers/logs in
      await AsyncStorage.setItem('pendingBankStatement', JSON.stringify({
        uri: fileUri,
        name: fileName,
        timestamp: new Date().toISOString()
      }));
      
      Alert.alert(
        'Statement Saved',
        'Your bank statement has been saved. It will be uploaded after you create an account or log in.'
      );
    } catch (error) {
      console.error('Error saving bank statement:', error);
      Alert.alert(
        'Save Failed',
        'There was an error saving your bank statement. Please try again later.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Handle bank statement upload error
  const handleBankStatementUploadError = (error: string) => {
    Alert.alert('Upload Error', error);
  };

  // Render individual slide
  const renderSlide = ({ item }: { item: typeof slides[0] }) => {
    // For the bank statement slide, use a ScrollView to make content scrollable
    if (item.component === 'BankStatementUploader') {
      return (
        <ScrollView 
          style={styles.slideScrollContainer}
          contentContainerStyle={styles.slideScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.slideContentContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name={item.icon as any} size={100} color={colors.primary} />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
            
            <View style={styles.uploaderContainer}>
              <BankStatementUploader
                onUploadComplete={handleBankStatementUpload}
                onUploadError={handleBankStatementUploadError}
              />
            </View>
            
            {/* Add extra space at the bottom to ensure content is not hidden */}
            <View style={styles.bottomSpacer} />
          </View>
        </ScrollView>
      );
    }
    
    // For other slides, use the regular layout
    return (
      <View style={styles.slideContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name={item.icon as any} size={100} color={colors.primary} />
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    );
  };

  // Render pagination dots
  const renderPagination = () => {
    return (
      <View style={styles.paginationContainer}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              { backgroundColor: index === currentIndex ? colors.primary : colors.border },
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      {/* Skip button */}
      <TouchableOpacity 
        style={[styles.skipButton, { marginTop: 50 }]} 
        onPress={handleSkip}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
      
      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / width);
          handleSlideChange(index);
        }}
      />
      
      {/* Pagination */}
      {renderPagination()}
      
      {/* Navigation buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleNext}
        >
          <Text style={styles.buttonText}>
            {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
        
        {currentIndex === slides.length - 1 && (
          <TouchableOpacity
            style={[styles.button, styles.registerButton]}
            onPress={async () => {
              await markOnboardingCompleted();
              navigation.navigate('Register');
            }}
          >
            <Text style={styles.buttonText}>Create Account</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    zIndex: 1,
    padding: spacing.sm,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  slideContainer: {
    width,
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xxxl,
  },
  slideScrollContainer: {
    width,
  },
  slideScrollContent: {
    flexGrow: 1,
    paddingBottom: 120, // Extra padding to ensure content is not hidden behind buttons
  },
  slideContentContainer: {
    width: '100%',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xxxl,
  },
  iconContainer: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: `${colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
    color: colors.text,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
  },
  uploaderContainer: {
    width: '100%',
    marginTop: spacing.md,
  },
  bottomSpacer: {
    height: 100, // Extra space at the bottom
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  paginationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  buttonContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  registerButton: {
    backgroundColor: colors.secondary,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OnboardingScreen;