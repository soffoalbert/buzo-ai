import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Animated,
  Dimensions,
  ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { 
  getFinancialAdvice, 
  getUserLocationData, 
  analyzeSpendingPatterns 
} from '../services/aiAdvisor';
import { loadExpenses } from '../services/expenseService';
import { loadBudgets } from '../services/budgetService';
import { loadSavingsGoals } from '../services/savingsService';
import { loadUserProfile } from '../services/userService';
import { colors, shadows, borderRadius, spacing, textStyles } from '../utils/theme';
import Markdown from 'react-native-markdown-display';
import { accessPremiumFeature, PremiumFeatureType } from '../utils/premiumFeatures';
import { hasPremiumAccess } from '../services/subscriptionService';
import { differenceInYears, parseISO } from 'date-fns';

// Define message interface
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  formattedText?: boolean; // Flag to indicate if the message contains markdown
}

// Define suggested questions
const SUGGESTED_QUESTIONS = [
  'How can I improve my budget?',
  'Where am I spending too much?',
  'How can I save more money?',
  'What\'s my financial health like?',
  'Tips for reducing expenses?',
  'How to start an emergency fund?'
];

const AIAdvisorScreen: React.FC = () => {
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "# Welcome to Buzo AI Advisor! 👋\n\nI'm your personal financial assistant. I can help you with:\n\n- Creating and managing budgets\n- Tracking and reducing expenses\n- Setting and achieving savings goals\n- General financial advice\n\nHow can I assist you today?",
      sender: 'ai',
      timestamp: new Date(),
      formattedText: true
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState(SUGGESTED_QUESTIONS);
  const [isPremium, setIsPremium] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const typingAnimation = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;

  // Check premium status on mount
  useEffect(() => {
    const checkPremiumStatus = async () => {
      const premium = await hasPremiumAccess();
      setIsPremium(premium);
    };
    
    checkPremiumStatus();
  }, []);

  // Animate typing dots
  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(typingAnimation, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      typingAnimation.setValue(0);
    }
  }, [isLoading]);

  // Animate suggestions in
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Format AI responses to include markdown and rich formatting
  const formatAIResponse = (text: string): string => {
    // Add markdown formatting to lists
    let formattedText = text;
    
    // Format bullet points
    formattedText = formattedText.replace(/•\s(.*?)(?=\n|$)/g, '* $1');
    
    // Format numbered lists
    formattedText = formattedText.replace(/(\d+)\.\s(.*?)(?=\n|$)/g, '$1. $2');
    
    // Format currency amounts
    formattedText = formattedText.replace(/R(\d+(\.\d+)?)/g, '**R$1**');
    
    // Format section titles
    formattedText = formattedText.replace(/([A-Za-z\s]+):/g, '**$1:**');
    
    // Format important advice
    formattedText = formattedText.replace(/(Tip|Note|Important|Warning):(.*?)(?=\n|$)/g, '> **$1:** $2');
    
    return formattedText;
  };

  // Calculate user age from date of birth
  const calculateAge = (dateOfBirth?: string): number | undefined => {
    if (!dateOfBirth) return undefined;
    try {
      const dob = parseISO(dateOfBirth);
      return differenceInYears(new Date(), dob);
    } catch (error) {
      console.error('Error calculating age:', error);
      return undefined;
    }
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    
    // Create a new user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date()
    };
    
    // Add user message to the list
    setMessages(prevMessages => [...prevMessages, userMessage]);
    
    // Clear input and scroll to bottom
    setInputText('');
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    // Check if this is a premium feature (personalized financial coaching)
    accessPremiumFeature(
      PremiumFeatureType.PERSONALIZED_COACHING,
      navigation,
      async () => {
        // User has premium access, proceed with getting AI response
        setIsLoading(true);
        
        try {
          // Get user data for context
          const expenses = await loadExpenses();
          const budgets = await loadBudgets();
          const savingsGoals = await loadSavingsGoals();
          const userProfile = await loadUserProfile();
          const locationData = await getUserLocationData();
          
          // Analyze spending patterns
          const spendingPatterns = analyzeSpendingPatterns(
            expenses,
            userProfile?.financialProfile?.monthlyIncome
          );
          
          // Prepare user profile data
          const userProfileData = userProfile ? {
            age: calculateAge(userProfile.dateOfBirth),
            occupation: userProfile.financialProfile?.occupation,
            financialGoals: userProfile.financialProfile?.financialGoals,
            riskTolerance: userProfile.financialProfile?.riskTolerance,
            financialInterests: userProfile.financialProfile?.financialInterests,
            financialChallenges: userProfile.financialProfile?.financialChallenges
          } : undefined;
          
          // Determine advice type based on question content
          let adviceType: 'budget' | 'expense' | 'savings' | 'general' = 'general';
          const question = userMessage.text.toLowerCase();
          
          if (question.includes('budget') || question.includes('spending limit') || question.includes('allocate')) {
            adviceType = 'budget';
          } else if (question.includes('expense') || question.includes('spending') || question.includes('cost')) {
            adviceType = 'expense';
          } else if (question.includes('saving') || question.includes('goal') || question.includes('target')) {
            adviceType = 'savings';
          }
          
          // Get AI response with enhanced context
          const response = await getFinancialAdvice({
            type: adviceType,
            financialData: {
              income: userProfile?.financialProfile?.monthlyIncome,
              expenses,
              budgets,
              savingsGoals,
              userProfile: userProfileData,
              locationData,
              spendingPatterns
            },
            question: userMessage.text
          });
          
          // Create AI message
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: formatAIResponse(response),
            sender: 'ai',
            timestamp: new Date(),
            formattedText: true
          };
          
          // Add AI message to the list
          setMessages(prevMessages => [...prevMessages, aiMessage]);
          
          // Scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } catch (error) {
          console.error('Error getting AI response:', error);
          
          // Add error message
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: "I'm sorry, I couldn't process your request. Please try again later.",
            sender: 'ai',
            timestamp: new Date()
          };
          
          setMessages(prevMessages => [...prevMessages, errorMessage]);
        } finally {
          setIsLoading(false);
        }
      }
    );
  };

  // Handle suggested question tap
  const handleSuggestedQuestionTap = (question: string) => {
    setInputText(question);
    handleSendMessage();
  };

  const handleNavigateToSettings = () => {
    navigation.navigate('Settings');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  // Format timestamp
  const formatMessageTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render message item
  const renderMessageItem = ({ item }: { item: Message }) => {
    const isAI = item.sender === 'ai';
    
    return (
      <View style={[
        styles.messageContainer,
        isAI ? styles.aiMessageContainer : styles.userMessageContainer
      ]}>
        {isAI && (
          <View style={styles.avatarContainer}>
            <Ionicons name="chatbubble-ellipses" size={24} color={colors.white} />
          </View>
        )}
        <View style={styles.messageContentContainer}>
          <View style={[
            styles.messageBubble,
            isAI ? styles.aiMessageBubble : styles.userMessageBubble
          ]}>
            {item.formattedText ? (
              <Markdown 
                style={markdownStyles(isAI)}
              >
                {item.text}
              </Markdown>
            ) : (
              <Text style={[
                styles.messageText,
                isAI ? styles.aiMessageText : styles.userMessageText
              ]}>
                {item.text}
              </Text>
            )}
          </View>
          <Text style={styles.timestampText}>
            {formatMessageTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  // Render typing indicator
  const renderTypingIndicator = () => {
    if (!isLoading) return null;
    
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.avatarContainer}>
          <Ionicons name="chatbubble-ellipses" size={24} color={colors.white} />
        </View>
        <View style={styles.loadingBubble}>
          <View style={styles.typingContainer}>
            <Animated.View 
              style={[
                styles.typingDot, 
                { opacity: typingAnimation }
              ]} 
            />
            <Animated.View 
              style={[
                styles.typingDot, 
                { opacity: Animated.multiply(typingAnimation, 0.8) }
              ]} 
            />
            <Animated.View 
              style={[
                styles.typingDot, 
                { opacity: Animated.multiply(typingAnimation, 0.6) }
              ]} 
            />
          </View>
        </View>
      </View>
    );
  };

  // Render suggested questions
  const renderSuggestedQuestions = () => {
    if (messages.length > 2) return null;
    
    return (
      <Animated.View style={[styles.suggestedQuestionsContainer, { opacity: fadeAnim }]}>
        <Text style={styles.suggestedQuestionsTitle}>
          You can ask me about:
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestedQuestionsScrollContent}
        >
          {suggestedQuestions.map((question, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestedQuestionBubble}
              onPress={() => handleSuggestedQuestionTap(question)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestedQuestionText}>{question}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    );
  };

  // Render premium badge in header if user has premium
  const renderPremiumBadge = () => {
    if (!isPremium) return null;
    
    return (
      <View style={styles.premiumBadge}>
        <Text style={styles.premiumBadgeText}>Premium</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Ask Buzo</Text>
          <Text style={styles.headerSubtitle}>Your AI Financial Advisor</Text>
        </View>
        {renderPremiumBadge()}
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={handleNavigateToSettings}
        >
          <Ionicons name="settings-outline" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>
      
      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessageItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesListContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={renderTypingIndicator}
      />
      
      {/* Suggested Questions */}
      {renderSuggestedQuestions()}
      
      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.inputContainer}
      >
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Ask me anything about your finances..."
            placeholderTextColor={colors.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => handleSendMessage()}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled
            ]}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim()}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={inputText.trim() ? colors.white : colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Markdown styles based on sender
const markdownStyles = (isAI: boolean) => ({
  body: {
    color: isAI ? colors.text : colors.white,
    fontSize: textStyles.body2.fontSize,
    lineHeight: 20,
  },
  heading1: {
    color: isAI ? colors.text : colors.white,
    fontSize: 20,
    fontWeight: 'bold' as const,
    marginBottom: 8,
    marginTop: 4,
  },
  heading2: {
    color: isAI ? colors.text : colors.white,
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginBottom: 6,
    marginTop: 3,
  },
  heading3: {
    color: isAI ? colors.text : colors.white,
    fontSize: 16,
    fontWeight: 'bold' as const,
    marginBottom: 4,
    marginTop: 2,
  },
  paragraph: {
    color: isAI ? colors.text : colors.white,
    marginBottom: 8,
    marginTop: 0,
  },
  bullet_list: {
    marginTop: 4,
    marginBottom: 8,
  },
  ordered_list: {
    marginTop: 4,
    marginBottom: 8,
  },
  bullet_list_item: {
    color: isAI ? colors.text : colors.white,
    marginBottom: 4,
  },
  ordered_list_item: {
    color: isAI ? colors.text : colors.white,
    marginBottom: 4,
  },
  bullet_list_icon: {
    color: isAI ? colors.primary : colors.white,
  },
  strong: {
    color: isAI ? colors.primary : colors.white,
    fontWeight: 'bold' as const,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  blockquote: {
    backgroundColor: isAI ? 'rgba(79, 70, 229, 0.1)' : 'rgba(255, 255, 255, 0.2)',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginVertical: 8,
  },
  code_inline: {
    backgroundColor: isAI ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.2)',
    color: isAI ? colors.primary : colors.white,
    paddingHorizontal: 4,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline' as const,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitleContainer: {
    marginLeft: spacing.sm,
  },
  headerTitle: {
    fontSize: textStyles.h4.fontSize,
    fontWeight: textStyles.h4.fontWeight as any,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: textStyles.caption.fontSize,
    color: colors.textSecondary,
  },
  messagesListContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    maxWidth: '90%',
  },
  messageContentContainer: {
    flexDirection: 'column',
    maxWidth: '100%',
  },
  aiMessageContainer: {
    alignSelf: 'flex-start',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  messageBubble: {
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '100%',
  },
  aiMessageBubble: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  userMessageBubble: {
    backgroundColor: colors.primary,
  },
  messageText: {
    fontSize: textStyles.body2.fontSize,
    lineHeight: 20,
  },
  aiMessageText: {
    color: colors.text,
  },
  userMessageText: {
    color: colors.white,
  },
  timestampText: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
    marginLeft: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 20,
    width: 40,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginHorizontal: 2,
  },
  loadingText: {
    marginLeft: spacing.xs,
    fontSize: textStyles.body2.fontSize,
    color: colors.textSecondary,
  },
  suggestedQuestionsContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  suggestedQuestionsTitle: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  suggestedQuestionsScrollContent: {
    paddingBottom: spacing.xs,
  },
  suggestedQuestionBubble: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  suggestedQuestionText: {
    fontSize: textStyles.caption.fontSize,
    color: colors.primary,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    fontSize: textStyles.body2.fontSize,
    color: colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
    ...shadows.sm,
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  premiumBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  premiumBadgeText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 12,
  },
  settingsButton: {
    padding: spacing.sm,
  },
});

export default AIAdvisorScreen; 