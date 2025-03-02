import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import ProgressBar from './ProgressBar';
import Chart from './Chart';
import { formatCurrency } from '../utils/helpers';
import { colors } from 'utils/theme';

// Types for financial insights
export interface FinancialInsight {
  id: string;
  title: string;
  description: string;
  type: 'tip' | 'warning' | 'achievement' | 'recommendation';
  priority: 'high' | 'medium' | 'low';
  category?: string;
  actionable?: boolean;
  action?: {
    label: string;
    screen?: string;
    params?: any;
  };
  createdAt: string;
  read?: boolean;
}

export interface SpendingCategory {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
}

export interface SpendingTrend {
  month: string;
  income: number;
  expenses: number;
}

interface FinancialInsightsProps {
  insights: FinancialInsight[];
  spendingCategories: SpendingCategory[];
  spendingTrends: SpendingTrend[];
  savingsRate: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  isLoading?: boolean;
  onInsightPress?: (insight: FinancialInsight) => void;
  onSeeAllInsights?: () => void;
  onSeeAllCategories?: () => void;
  onSeeAllTrends?: () => void;
  currency?: string;
  locale?: string;
  budgetUtilization?: {
    id: string;
    name: string;
    utilization: number;
    savingsContribution: number;
  }[];
  savingsProgress?: {
    id: string;
    title: string;
    progress: number;
    nextSavingDate?: string;
  }[];
}

const FinancialInsights: React.FC<FinancialInsightsProps> = ({
  insights = [],
  spendingCategories = [],
  spendingTrends = [],
  savingsRate = 0,
  monthlyIncome,
  monthlyExpenses,
  isLoading = false,
  onInsightPress,
  onSeeAllInsights,
  onSeeAllCategories,
  onSeeAllTrends,
  currency = 'ZAR',
  locale = 'en-ZA',
  budgetUtilization,
  savingsProgress,
}) => {
  const [activeInsights, setActiveInsights] = useState<FinancialInsight[]>([]);
  
  // Filter insights to show only high and medium priority ones (max 3)
  useEffect(() => {
    const filtered = insights
      .filter(insight => insight.priority !== 'low')
      .sort((a, b) => {
        // Sort by priority first
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        // Then by date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 3);
    
    setActiveInsights(filtered);
  }, [insights]);
  
  // Prepare data for pie chart
  const prepareCategoryData = () => {
    return spendingCategories.map(category => ({
      name: category.name,
      value: category.percentage,
      color: category.color,
      legendFontColor: '#6B7280',
      legendFontSize: 12,
    }));
  };
  
  // Prepare data for line chart
  const prepareTrendData = () => {
    return {
      labels: spendingTrends.map(trend => trend.month),
      datasets: [
        {
          data: spendingTrends.map(trend => trend.income),
          color: () => '#43A047', // Green for income
          strokeWidth: 2,
        },
        {
          data: spendingTrends.map(trend => trend.expenses),
          color: () => '#E53935', // Red for expenses
          strokeWidth: 2,
        },
      ],
      legend: ['Income', 'Expenses'],
    };
  };
  
  // Get icon for insight type
  const getInsightIcon = (type: FinancialInsight['type']) => {
    switch (type) {
      case 'tip':
        return 'bulb-outline';
      case 'warning':
        return 'warning-outline';
      case 'achievement':
        return 'trophy-outline';
      case 'recommendation':
        return 'star-outline';
      default:
        return 'information-circle-outline';
    }
  };
  
  // Get color for insight type
  const getInsightColor = (type: FinancialInsight['type']) => {
    switch (type) {
      case 'tip':
        return '#4F46E5'; // Indigo
      case 'warning':
        return '#F59E0B'; // Amber
      case 'achievement':
        return '#10B981'; // Green
      case 'recommendation':
        return '#8B5CF6'; // Purple
      default:
        return '#6B7280'; // Gray
    }
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Analyzing your financial data...</Text>
      </View>
    );
  }
  
  // Render empty state
  if (insights.length === 0 && spendingCategories.length === 0 && spendingTrends.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Image 
          source={{ uri: 'https://via.placeholder.com/150?text=No+Insights' }} 
          style={styles.emptyImage} 
        />
        <Text style={styles.emptyTitle}>No insights available yet</Text>
        <Text style={styles.emptyText}>
          Add more transactions and budget data to receive personalized financial insights.
        </Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Savings Rate */}
      {savingsRate > 0 && (
        <Card
          title="Savings Rate"
          subtitle={`You're saving ${savingsRate}% of your income`}
          style={styles.card}
          variant="savings"
        >
          <View style={styles.savingsContainer}>
            <ProgressBar
              progress={savingsRate}
              variant="savings"
              showPercentage={true}
              size="medium"
            />
            <Text style={styles.savingsText}>
              {savingsRate < 10 ? 'Try to save at least 10% of your income' : 
               savingsRate < 20 ? 'Good job! Aim for 20% for better financial security' :
               'Excellent! You have a healthy savings rate'}
            </Text>
          </View>
        </Card>
      )}
      
      {/* Financial Insights */}
      {activeInsights.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Financial Insights</Text>
            {insights.length > 3 && onSeeAllInsights && (
              <TouchableOpacity onPress={onSeeAllInsights}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {activeInsights.map(insight => (
            <TouchableOpacity
              key={insight.id}
              style={styles.insightCard}
              onPress={() => onInsightPress && onInsightPress(insight)}
              activeOpacity={0.7}
            >
              <View style={[styles.insightIconContainer, { backgroundColor: `${getInsightColor(insight.type)}20` }]}>
                <Ionicons name={getInsightIcon(insight.type)} size={24} color={getInsightColor(insight.type)} />
              </View>
              <View style={styles.insightContent}>
                <Text style={styles.insightTitle}>{insight.title}</Text>
                <Text style={styles.insightDescription} numberOfLines={2}>
                  {insight.description}
                </Text>
                {insight.actionable && insight.action && (
                  <View style={styles.insightAction}>
                    <Text style={[styles.insightActionText, { color: getInsightColor(insight.type) }]}>
                      {insight.action.label}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={getInsightColor(insight.type)} />
                  </View>
                )}
              </View>
              {!insight.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      {/* Monthly Overview */}
      {monthlyIncome !== undefined && monthlyExpenses !== undefined && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Monthly Overview</Text>
          </View>
          
          <Card
            style={styles.card}
            variant="default"
            elevated={true}
          >
            {/* Income vs Expenses Visual */}
            <View style={styles.overviewVisual}>
              <View style={styles.overviewBarContainer}>
                <View style={styles.overviewBarLabel}>
                  <Text style={styles.overviewBarLabelText}>Income</Text>
                </View>
                <View style={styles.overviewBar}>
                  <View 
                    style={[
                      styles.overviewBarFill, 
                      { width: '100%', backgroundColor: '#43A047' }
                    ]} 
                  />
                </View>
                <Text style={styles.overviewBarAmount}>
                  {formatCurrency(monthlyIncome, locale, currency)}
                </Text>
              </View>
              
              <View style={styles.overviewBarContainer}>
                <View style={styles.overviewBarLabel}>
                  <Text style={styles.overviewBarLabelText}>Expenses</Text>
                </View>
                <View style={styles.overviewBar}>
                  <View 
                    style={[
                      styles.overviewBarFill, 
                      { 
                        width: `${Math.min((monthlyExpenses / monthlyIncome) * 100, 100)}%`, 
                        backgroundColor: '#E53935' 
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.overviewBarAmount}>
                  {formatCurrency(monthlyExpenses, locale, currency)}
                </Text>
              </View>
            </View>
            
            <View style={styles.overviewDivider} />
            
            {/* Financial Metrics */}
            <View style={styles.overviewContainer}>
              <View style={styles.overviewItem}>
                <Text style={styles.overviewLabel}>Balance</Text>
                <Text style={[
                  styles.overviewBalance,
                  { color: monthlyIncome - monthlyExpenses >= 0 ? '#43A047' : '#E53935' }
                ]}>
                  {formatCurrency(monthlyIncome - monthlyExpenses, locale, currency)}
                </Text>
              </View>
              
              <View style={styles.overviewDivider} />
              
              <View style={styles.overviewItem}>
                <Text style={styles.overviewLabel}>Savings Rate</Text>
                <Text style={[
                  styles.overviewSavingsRate,
                  { 
                    color: savingsRate >= 20 ? '#43A047' : 
                           savingsRate >= 10 ? '#F59E0B' : '#E53935' 
                  }
                ]}>
                  {savingsRate.toFixed(0)}%
                </Text>
              </View>
              
              <View style={styles.overviewDivider} />
              
              <View style={styles.overviewItem}>
                <Text style={styles.overviewLabel}>Budget Used</Text>
                <Text style={[
                  styles.overviewBudgetUsed,
                  { 
                    color: (monthlyExpenses / monthlyIncome) <= 0.8 ? '#43A047' : 
                           (monthlyExpenses / monthlyIncome) <= 1 ? '#F59E0B' : '#E53935' 
                  }
                ]}>
                  {Math.min(Math.round((monthlyExpenses / monthlyIncome) * 100), 100)}%
                </Text>
              </View>
            </View>
            
            {/* Savings Tip */}
            {monthlyIncome > monthlyExpenses ? (
              <View style={styles.overviewTip}>
                <Ionicons name="checkmark-circle" size={16} color="#43A047" />
                <Text style={styles.overviewTipText}>
                  Great job! You're spending less than you earn.
                </Text>
              </View>
            ) : (
              <View style={styles.overviewTip}>
                <Ionicons name="alert-circle" size={16} color="#E53935" />
                <Text style={styles.overviewTipText}>
                  Warning: You're spending more than you earn this month.
                </Text>
              </View>
            )}
          </Card>
        </View>
      )}
      
      {/* Spending Categories */}
      {spendingCategories.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Spending Breakdown</Text>
            {onSeeAllCategories && (
              <TouchableOpacity onPress={onSeeAllCategories}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <Card style={styles.card}>
            <View style={styles.chartContainer}>
              <Chart
                type="pie"
                data={prepareCategoryData()}
                width={Dimensions.get('window').width - 64}
                height={180}
                showLegend={true}
                backgroundColor="transparent"
                containerStyle={styles.chart}
              />
            </View>
            
            <View style={styles.categoriesList}>
              {spendingCategories.slice(0, 3).map(category => (
                <View key={category.name} style={styles.categoryItem}>
                  <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
                    <Ionicons name={category.icon as any} size={18} color={category.color} />
                  </View>
                  <View style={styles.categoryDetails}>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <View style={styles.categoryValues}>
                      <Text style={styles.categoryAmount}>
                        {formatCurrency(category.amount, locale, currency)}
                      </Text>
                      <Text style={styles.categoryPercentage}>
                        {category.percentage}%
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>
      )}
      
      {/* Spending Trends */}
      {spendingTrends.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Income vs. Expenses</Text>
            {onSeeAllTrends && (
              <TouchableOpacity onPress={onSeeAllTrends}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <Card style={styles.card}>
            <View style={styles.chartContainer}>
              <Chart
                type="line"
                data={prepareTrendData()}
                width={Dimensions.get('window').width - 64}
                height={220}
                yAxisSuffix=""
                formatYLabel={(value) => formatCurrency(Number(value), locale, currency)}
                showLegend={true}
                showGrid={true}
                backgroundColor="transparent"
                containerStyle={styles.chart}
              />
            </View>
            
            <View style={styles.trendSummary}>
              <Text style={styles.trendText}>
                {spendingTrends[spendingTrends.length - 1].income > spendingTrends[spendingTrends.length - 1].expenses
                  ? 'You spent less than you earned this month. Great job!'
                  : 'You spent more than you earned this month. Try to reduce expenses.'}
              </Text>
            </View>
          </Card>
        </View>
      )}
      
      {/* Add new section for Budget & Savings Integration */}
      {(budgetUtilization?.length > 0 || savingsProgress?.length > 0) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Budget & Savings Overview</Text>
          </View>
          
          <Card style={styles.card} variant="default" elevated={true}>
            {/* Budget Utilization */}
            {budgetUtilization?.length > 0 && (
              <>
                <Text style={styles.subsectionTitle}>Budget Utilization</Text>
                {budgetUtilization.map((budget) => (
                  <View key={budget.id} style={styles.budgetItem}>
                    <View style={styles.budgetHeader}>
                      <Text style={styles.budgetName}>{budget.name}</Text>
                      <Text style={styles.budgetPercentage}>{budget.utilization.toFixed(1)}%</Text>
                    </View>
                    <View style={styles.budgetBarContainer}>
                      <View 
                        style={[
                          styles.budgetBar,
                          {
                            width: `${Math.min(budget.utilization, 100)}%`,
                            backgroundColor: budget.utilization > 90 ? colors.error : colors.primary
                          }
                        ]}
                      />
                    </View>
                    {budget.savingsContribution > 0 && (
                      <Text style={styles.savingsNote}>
                        Contributing R {budget.savingsContribution.toFixed(2)} to savings
                      </Text>
                    )}
                  </View>
                ))}
              </>
            )}

            {/* Savings Progress */}
            {savingsProgress?.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.subsectionTitle}>Savings Progress</Text>
                {savingsProgress.map((goal) => (
                  <View key={goal.id} style={styles.savingsItem}>
                    <View style={styles.savingsHeader}>
                      <Text style={styles.savingsName}>{goal.title}</Text>
                      <Text style={styles.savingsPercentage}>{goal.progress.toFixed(1)}%</Text>
                    </View>
                    <View style={styles.savingsBarContainer}>
                      <View 
                        style={[
                          styles.savingsBar,
                          {
                            width: `${Math.min(goal.progress, 100)}%`,
                            backgroundColor: colors.success
                          }
                        ]}
                      />
                    </View>
                    {goal.nextSavingDate && (
                      <Text style={styles.nextSavingDate}>
                        Next saving: {new Date(goal.nextSavingDate).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                ))}
              </>
            )}
          </Card>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyImage: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  seeAllText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '500',
  },
  savingsContainer: {
    marginTop: 8,
  },
  savingsText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  insightIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  insightDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  insightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  insightActionText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4F46E5',
    position: 'absolute',
    top: 16,
    right: 16,
  },
  overviewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  overviewItem: {
    flex: 1,
    alignItems: 'center',
  },
  overviewDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  overviewLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  overviewIncome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#43A047',
  },
  overviewExpense: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E53935',
  },
  overviewBalance: {
    fontSize: 16,
    fontWeight: '600',
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  chart: {
    marginVertical: 0,
    padding: 0,
    elevation: 0,
    shadowOpacity: 0,
    backgroundColor: 'transparent',
  },
  categoriesList: {
    marginTop: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryDetails: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 14,
    color: '#1F2937',
  },
  categoryValues: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  categoryPercentage: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  trendSummary: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  trendText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  overviewVisual: {
    marginBottom: 16,
  },
  overviewBarContainer: {
    marginBottom: 12,
  },
  overviewBarLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  overviewBarLabelText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  overviewBar: {
    height: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  overviewBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  overviewBarAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'right',
  },
  overviewSavingsRate: {
    fontSize: 16,
    fontWeight: '600',
  },
  overviewBudgetUsed: {
    fontSize: 16,
    fontWeight: '600',
  },
  overviewTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  overviewTipText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
    flex: 1,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  budgetItem: {
    marginBottom: 16,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  budgetName: {
    fontSize: 14,
    color: colors.text,
  },
  budgetPercentage: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  budgetBarContainer: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  budgetBar: {
    height: '100%',
    borderRadius: 2,
  },
  savingsNote: {
    fontSize: 12,
    color: colors.success,
    marginTop: 4,
  },
  savingsItem: {
    marginBottom: 16,
  },
  savingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  savingsName: {
    fontSize: 14,
    color: colors.text,
  },
  savingsPercentage: {
    fontSize: 14,
    color: colors.success,
  },
  savingsBarContainer: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  savingsBar: {
    height: '100%',
    borderRadius: 2,
  },
  nextSavingDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
});

export default FinancialInsights; 