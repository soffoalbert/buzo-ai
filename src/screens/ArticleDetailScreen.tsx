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
  Dimensions,
  Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { colors, spacing, textStyles, borderRadius } from '../utils/theme';

// Define the article interface (should match the one in EducationScreen)
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

// Define the route params type
type ArticleDetailRouteProp = RouteProp<RootStackParamList, 'ArticleDetail'>;
type ArticleDetailNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ArticleDetailScreen: React.FC = () => {
  const navigation = useNavigation<ArticleDetailNavigationProp>();
  const route = useRoute<ArticleDetailRouteProp>();
  const { article } = route.params;
  
  const [isLoading, setIsLoading] = useState(true);
  const [fullArticle, setFullArticle] = useState<EducationArticle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    loadArticleContent();
  }, []);

  const loadArticleContent = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // In a real app, this would fetch the full article content from an API
      // For this demo, we'll simulate an API call with a timeout
      setTimeout(() => {
        const articleWithContent = {
          ...article,
          content: generateMockContentForCategory(article.category)
        };
        setFullArticle(articleWithContent);
        setIsLoading(false);
      }, 1500);
    } catch (error) {
      console.error('Error loading article content:', error);
      setError('Failed to load article content. Please try again.');
      setIsLoading(false);
    }
  };

  const generateMockContentForCategory = (category: string): string => {
    switch (category.toLowerCase()) {
      case 'budgeting':
        return `# The Art of Effective Budgeting

Budgeting is the foundation of financial wellness. It's not about restricting your spending, but rather about understanding where your money goes and making intentional decisions.

## Why Budget?

Budgeting gives you control over your finances and helps you achieve your financial goals. When you budget effectively, you:

* Track your income and expenses
* Identify spending patterns
* Reduce unnecessary expenses
* Save for future goals
* Reduce financial stress

## The 50/30/20 Rule

> The 50/30/20 rule is a simple budgeting framework that allocates your after-tax income to three main categories.

* 50% for needs (housing, food, utilities)
* 30% for wants (entertainment, dining out)
* 20% for savings and debt repayment

TIP: Start small by tracking just one category of spending that you want to reduce, like dining out or subscription services.

## Common Budgeting Mistakes to Avoid

* Setting unrealistic expectations
* Forgetting irregular expenses
* Not adjusting your budget as circumstances change
* Focusing only on cutting expenses instead of increasing income

Remember that budgeting is a skill that improves with practice. Be patient with yourself and celebrate small wins along the way.`;

      case 'saving':
        return `# Building a Solid Savings Strategy

Saving money is about creating financial security and working toward your goals. It's one of the most powerful financial habits you can develop.

## Types of Savings

Different savings goals require different approaches:

* Emergency fund (3-6 months of expenses)
* Short-term savings (vacations, purchases)
* Medium-term savings (education, car, home down payment)
* Long-term savings (retirement, financial independence)

## The Power of Compound Interest

> Compound interest is the eighth wonder of the world. He who understands it, earns it; he who doesn't, pays it.

When you save and invest early, your money grows exponentially over time due to compound interest.

TIP: Even small amounts add up over time. Saving just R100 per week equals R5,200 per year plus interest!

## Overcoming Savings Challenges

* Start with a small emergency fund of R1,000
* Use visual reminders of your savings goals
* Find an accountability partner
* Track your progress and celebrate milestones

Remember that saving is not about deprivation—it's about prioritizing your future self.`;

      case 'debt':
        return `# Taking Control of Your Debt

Debt can be a useful tool when managed wisely, but it can also become a significant burden. Understanding how to manage debt effectively is crucial for financial health.

## Good Debt vs. Bad Debt

> Not all debt is created equal. Some debt can help you build wealth, while other types can drain your finances.

* Good debt: Potentially increases your net worth or income (education, home mortgage, business loans)
* Bad debt: Decreases in value and doesn't generate income (credit cards, consumer loans)

## Debt Repayment Strategies

There are two popular methods for tackling multiple debts:

* Debt Avalanche: Pay off highest interest rate debts first (saves the most money)
* Debt Snowball: Pay off smallest balances first (provides psychological wins)

TIP: Always pay more than the minimum payment on your debts when possible. Even a small additional amount can significantly reduce the total interest paid.

## Avoiding Debt Traps

* Understand the true cost of credit
* Read the fine print before signing
* Avoid payday loans and high-interest debt
* Build an emergency fund to prevent new debt

Remember that becoming debt-free is a journey. Celebrate each debt you eliminate and use that momentum to keep going.`;

      case 'investing':
        return `# Building Wealth Through Investing

Investing is how you grow your money over time and build wealth. While it involves risk, thoughtful investing is essential for long-term financial success.

## Investment Fundamentals

> The best time to plant a tree was 20 years ago. The second best time is now. The same is true for investing.

1. Start early to harness compound growth
2. Diversify to manage risk
3. Invest regularly regardless of market conditions
4. Focus on the long term rather than short-term fluctuations

## Types of Investments

Different investments serve different purposes in your portfolio:

* Stocks: Ownership in companies (higher risk, higher potential return)
* Bonds: Loans to governments or corporations (lower risk, lower return)
* Real estate: Property investments (tangible assets, potential income)
* ETFs and mutual funds: Baskets of investments (instant diversification)

TIP: If you're new to investing, consider starting with a low-cost index fund that tracks the broader market. This provides instant diversification and typically outperforms actively managed funds over time.

## Common Investment Mistakes to Avoid

1. Trying to time the market
2. Letting emotions drive investment decisions
3. Neglecting fees and expenses
4. Failing to diversify adequately

Remember that successful investing is about patience and consistency, not getting rich quickly.`;

      case 'banking':
        return `# Maximizing Your Banking Relationship

Your banking choices can significantly impact your financial health. Understanding how to optimize your banking relationship helps you save money and access better financial tools.

## Types of Bank Accounts

Different accounts serve different purposes in your financial life:

* Transactional accounts: For daily expenses and bill payments
* Savings accounts: For emergency funds and short-term goals
* Fixed deposits: For higher interest on funds you won't need immediately
* Money market accounts: Blend of checking and savings features

## Choosing the Right Bank

> Your bank should work for you, not the other way around. Don't pay for services you can get for free elsewhere.

When evaluating banking options, consider:

1. Fees and minimum balance requirements
2. Interest rates on deposits
3. ATM access and fees
4. Digital banking capabilities
5. Customer service quality

TIP: Many banks offer fee waivers for students, seniors, or when you maintain a minimum balance or use direct deposit. Ask your bank about available fee waivers.

## Banking Security Best Practices

1. Use strong, unique passwords for online banking
2. Enable two-factor authentication
3. Be cautious of phishing attempts
4. Monitor accounts regularly for unauthorized transactions

Remember that your banking relationship should evolve as your financial needs change. Review your banking setup annually to ensure it still meets your needs.`;

      default:
        return `# Financial Education Fundamentals

Financial education is the foundation for making informed money decisions. Understanding key financial concepts helps you build wealth and achieve your goals.

## The Importance of Financial Literacy

> Financial literacy isn't about being rich—it's about having options and control over your financial future.

Financial education empowers you to:

* Make informed financial decisions
* Avoid costly mistakes
* Build and protect wealth
* Achieve your financial goals
* Pass financial knowledge to future generations

## Core Financial Concepts Everyone Should Know

* Budgeting and cash flow management
* Saving and emergency planning
* Debt management and credit scores
* Investment basics and risk tolerance
* Insurance and risk management
* Tax planning and optimization

TIP: The best financial education combines knowledge with action. For each concept you learn, identify one specific step you can take to apply it to your own finances.

## Avoiding Financial Misinformation

* Be skeptical of get-rich-quick schemes
* Verify information from multiple sources
* Understand that financial advice is not one-size-fits-all
* Consider the source's credentials and potential conflicts of interest

Remember that financial education is a lifelong journey. Start where you are, use what you have, and do what you can.`;
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleSharePress = async () => {
    if (fullArticle) {
      try {
        await Share.share({
          message: `Check out this article: ${fullArticle.title} - ${fullArticle.description}`,
          title: fullArticle.title,
        });
      } catch (error) {
        console.error('Error sharing article:', error);
      }
    }
  };

  const handleStartQuiz = () => {
    // In a real app, this would navigate to a quiz screen
    alert('Quiz feature coming soon!');
  };

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const scrollViewHeight = event.nativeEvent.layoutMeasurement.height;
    const contentHeight = event.nativeEvent.contentSize.height;
    
    // Calculate scroll progress percentage
    const progress = scrollY / (contentHeight - scrollViewHeight);
    setScrollProgress(Math.min(Math.max(progress, 0), 1));
  };

  // Calculate estimated reading time
  const getReadingTime = (content: string): string => {
    const wordsPerMinute = 200;
    const words = content?.split(/\s+/).length || 0;
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min read`;
  };

  if (!article) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Article not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading article...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleSharePress}>
            <Ionicons name="share-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          {fullArticle?.hasQuiz && (
            <TouchableOpacity style={styles.actionButton} onPress={handleStartQuiz}>
              <Ionicons name="school-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Reading Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${scrollProgress * 100}%` }]} />
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading article...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadArticleContent}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Article Header */}
          <View style={styles.articleHeader}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{fullArticle?.category}</Text>
            </View>
            <Text style={styles.title}>{fullArticle?.title}</Text>
            <View style={styles.articleMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.metaText}>
                  {fullArticle?.content ? getReadingTime(fullArticle.content) : fullArticle?.readTime}
                </Text>
              </View>
              {fullArticle?.isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Article Image */}
          <Image
            source={{ uri: fullArticle?.imageUrl }}
            style={styles.articleImage}
            resizeMode="cover"
          />
          
          {/* Article Content */}
          <View style={styles.contentContainer}>
            {fullArticle?.content?.split('\n\n').map((paragraph, index) => {
              // Check if paragraph is a heading (starts with # or ##)
              if (paragraph.startsWith('# ')) {
                return (
                  <Text key={index} style={styles.heading1}>
                    {paragraph.substring(2)}
                  </Text>
                );
              } else if (paragraph.startsWith('## ')) {
                return (
                  <Text key={index} style={styles.heading2}>
                    {paragraph.substring(3)}
                  </Text>
                );
              } else if (paragraph.startsWith('* ')) {
                // Handle bullet points
                return (
                  <View key={index} style={styles.bulletPointContainer}>
                    <View style={styles.bulletPointMarkerContainer}>
                      <Text style={styles.bulletPointMarker}>•</Text>
                    </View>
                    <Text style={styles.bulletPointText}>
                      {paragraph.substring(2)}
                    </Text>
                  </View>
                );
              } else if (/^\d+\.\s/.test(paragraph)) {
                // Handle numbered lists (e.g., "1. Item")
                const number = paragraph.split('.')[0];
                const content = paragraph.substring(number.length + 2); // +2 for the dot and space
                return (
                  <View key={index} style={styles.numberedListContainer}>
                    <View style={styles.numberedListNumberContainer}>
                      <Text style={styles.numberedListNumber}>{number}.</Text>
                    </View>
                    <Text style={styles.numberedListText}>
                      {content}
                    </Text>
                  </View>
                );
              } else if (paragraph.startsWith('> ')) {
                // Handle blockquotes
                return (
                  <View key={index} style={styles.blockquoteContainer}>
                    <View style={styles.blockquoteLine} />
                    <Text style={styles.blockquoteText}>
                      {paragraph.substring(2)}
                    </Text>
                  </View>
                );
              } else if (paragraph.startsWith('TIP: ')) {
                // Handle tips
                return (
                  <View key={index} style={styles.tipContainer}>
                    <Ionicons name="bulb-outline" size={24} color={colors.accent} />
                    <Text style={styles.tipText}>
                      {paragraph.substring(5)}
                    </Text>
                  </View>
                );
              } else {
                // Regular paragraph
                return (
                  <Text key={index} style={styles.paragraph}>
                    {paragraph}
                  </Text>
                );
              }
            })}
          </View>
          
          {/* Related Articles */}
          <View style={styles.relatedArticlesContainer}>
            <Text style={styles.relatedArticlesTitle}>Related Articles</Text>
            <View style={styles.relatedContent}>
              {/* Mock related articles - in a real app, these would be fetched from an API */}
              <TouchableOpacity style={styles.relatedArticleCard}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1579621970795-87facc2f976d?ixlib=rb-1.2.1&auto=format&fit=crop&w=200&q=80' }}
                  style={styles.relatedArticleImage}
                />
                <Text style={styles.relatedArticleTitle}>5 Ways to Improve Your Credit Score</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.relatedArticleCard}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-1.2.1&auto=format&fit=crop&w=200&q=80' }}
                  style={styles.relatedArticleImage}
                />
                <Text style={styles.relatedArticleTitle}>Understanding Investment Risk</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
      
      {/* Quiz Button */}
      {fullArticle?.hasQuiz && !isLoading && !error && (
        <View style={styles.quizContainer}>
          <TouchableOpacity style={styles.quizButton} onPress={handleStartQuiz}>
            <Ionicons name="school-outline" size={20} color={colors.white} />
            <Text style={styles.quizButtonText}>Take Quiz</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: colors.border,
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    padding: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  articleHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  categoryBadge: {
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  categoryText: {
    color: colors.primary,
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: textStyles.caption.fontSize,
    marginLeft: spacing.xs,
  },
  newBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.round,
  },
  newBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  articleImage: {
    width: width,
    height: width * 0.6,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  content: {
    fontSize: textStyles.body1.fontSize,
    lineHeight: textStyles.body1.lineHeight * 1.5,
    color: colors.text,
    marginBottom: spacing.md,
  },
  heading1: {
    fontSize: textStyles.h2.fontSize,
    fontWeight: textStyles.h2.fontWeight as any,
    lineHeight: textStyles.h2.lineHeight * 1.2,
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    letterSpacing: 0.5,
  },
  heading2: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    lineHeight: textStyles.h3.lineHeight * 1.2,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    letterSpacing: 0.3,
  },
  paragraph: {
    fontSize: textStyles.body1.fontSize,
    lineHeight: textStyles.body1.lineHeight * 1.5,
    color: colors.text,
    marginBottom: spacing.lg,
    letterSpacing: 0.3,
  },
  bulletPointContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingLeft: spacing.md,
    alignItems: 'flex-start',
    paddingRight: spacing.md,
  },
  bulletPointMarkerContainer: {
    width: 24,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  bulletPointMarker: {
    fontSize: 18,
    color: colors.primary,
    lineHeight: 24,
  },
  bulletPointText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    letterSpacing: 0.3,
    paddingBottom: spacing.sm,
  },
  numberedListContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingLeft: spacing.md,
    alignItems: 'flex-start',
    paddingRight: spacing.md,
  },
  numberedListNumberContainer: {
    width: 24,
    alignItems: 'flex-end',
    marginRight: spacing.sm,
  },
  numberedListNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    lineHeight: 24,
  },
  numberedListText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    letterSpacing: 0.3,
    paddingBottom: spacing.sm,
  },
  blockquoteContainer: {
    flexDirection: 'row',
    marginVertical: spacing.lg,
    paddingLeft: spacing.sm,
  },
  blockquoteLine: {
    width: 4,
    backgroundColor: colors.primary,
    marginRight: spacing.md,
    borderRadius: 2,
  },
  blockquoteText: {
    flex: 1,
    fontSize: textStyles.body1.fontSize,
    fontStyle: 'italic',
    lineHeight: textStyles.body1.lineHeight * 1.4,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  tipContainer: {
    flexDirection: 'row',
    backgroundColor: `${colors.accent}15`,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.md,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: textStyles.body1.fontSize,
    lineHeight: textStyles.body1.lineHeight * 1.4,
    color: colors.text,
    letterSpacing: 0.3,
  },
  quizContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  quizButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  quizButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  relatedArticlesContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  relatedArticlesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  relatedContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  relatedArticleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  relatedArticleImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  relatedArticleTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
});

export default ArticleDetailScreen; 