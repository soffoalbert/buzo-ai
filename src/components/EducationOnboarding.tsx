import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// Onboarding steps data
const ONBOARDING_STEPS = [
  {
    id: '1',
    title: 'Welcome to Buzo Education',
    description: 'Discover financial knowledge that helps you build a solid financial foundation.',
    icon: 'school-outline',
    image: require('../assets/images/education-onboarding-1.png'),
  },
  {
    id: '2',
    title: 'Personalized Learning Path',
    description: 'Follow your customized learning journey based on your interests and goals.',
    icon: 'map-outline',
    image: require('../assets/images/education-onboarding-2.png'),
  },
  {
    id: '3',
    title: 'Interactive Quizzes',
    description: 'Test your knowledge with quizzes and track your progress over time.',
    icon: 'checkmark-circle-outline',
    image: require('../assets/images/education-onboarding-3.png'),
  },
  {
    id: '4',
    title: 'Save Content for Later',
    description: 'Bookmark articles to read offline and continue your learning anytime.',
    icon: 'bookmark-outline',
    image: require('../assets/images/education-onboarding-4.png'),
  },
];

// Define the props for the component
interface EducationOnboardingProps {
  onComplete: () => void;
  onSkip?: () => void;
}

// Storage key for checking if onboarding has been completed
const ONBOARDING_COMPLETED_KEY = 'education_onboarding_completed';

export const checkOnboardingStatus = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return false;
  }
};

export const markOnboardingComplete = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
  } catch (error) {
    console.error('Error marking onboarding as complete:', error);
  }
};

const EducationOnboarding: React.FC<EducationOnboardingProps> = ({ onComplete, onSkip }) => {
  // State for current step
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Animation values
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Screen entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);
  
  // Handle next step
  const handleNext = () => {
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: width * (currentIndex + 1),
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };
  
  // Handle previous step
  const handlePrevious = () => {
    if (currentIndex > 0) {
      scrollViewRef.current?.scrollTo({
        x: width * (currentIndex - 1),
        animated: true,
      });
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  // Handle completing the onboarding
  const handleComplete = async () => {
    await markOnboardingComplete();
    onComplete();
  };
  
  // Handle skipping the onboarding
  const handleSkip = async () => {
    await markOnboardingComplete();
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  };
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Skip button */}
        {currentIndex < ONBOARDING_STEPS.length - 1 && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        )}
        
        {/* Onboarding content */}
        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: Platform.OS === 'android' }
          )}
          onMomentumScrollEnd={(event) => {
            const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
            setCurrentIndex(newIndex);
          }}
          style={styles.scrollView}
        >
          {ONBOARDING_STEPS.map((step, index) => (
            <View key={step.id} style={styles.slide}>
              <View style={styles.iconContainer}>
                <Ionicons name={step.icon as any} size={40} color="#6739B7" />
              </View>
              
              <View style={styles.imageContainer}>
                {step.image ? (
                  <Image source={step.image} style={styles.image} resizeMode="contain" />
                ) : (
                  <View style={styles.imagePlaceholder} />
                )}
              </View>
              
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.description}>{step.description}</Text>
            </View>
          ))}
        </Animated.ScrollView>
        
        {/* Pagination dots */}
        <View style={styles.pagination}>
          {ONBOARDING_STEPS.map((_, index) => {
            const inputRange = [
              (index - 1) * width,
              index * width,
              (index + 1) * width,
            ];
            
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 20, 8],
              extrapolate: 'clamp',
            });
            
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            
            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity,
                    backgroundColor: currentIndex === index ? '#6739B7' : '#D9D9D9',
                  },
                ]}
              />
            );
          })}
        </View>
        
        {/* Navigation buttons */}
        <View style={styles.buttonContainer}>
          {currentIndex > 0 && (
            <TouchableOpacity onPress={handlePrevious} style={styles.button}>
              <Ionicons name="chevron-back" size={24} color="#6739B7" />
              <Text style={styles.buttonText}>Back</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            onPress={handleNext}
            style={[styles.button, styles.primaryButton]}
          >
            <Text style={styles.primaryButtonText}>
              {currentIndex === ONBOARDING_STEPS.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            {currentIndex < ONBOARDING_STEPS.length - 1 && (
              <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  skipButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#6739B7',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  imageContainer: {
    width: width * 0.8,
    height: 200,
    marginBottom: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F0FF',
    borderRadius: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 30,
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
  },
  primaryButton: {
    backgroundColor: '#6739B7',
    paddingHorizontal: 30,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6739B7',
    marginLeft: 5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginRight: 5,
  },
});

export default EducationOnboarding; 