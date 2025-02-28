import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/helpers';

// Transaction type definition
export interface Transaction {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  type: 'income' | 'expense';
  paymentMethod?: string;
  description?: string;
  tags?: string[];
  receiptUrl?: string;
  isRecurring?: boolean;
  location?: string;
}

// Props for the TransactionList component
interface TransactionListProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onTransactionPress?: (transaction: Transaction) => void;
  onAddPress?: () => void;
  showHeader?: boolean;
  showFilters?: boolean;
  emptyStateMessage?: string;
  currency?: string;
  locale?: string;
}

// Filter options type
interface FilterOptions {
  searchQuery: string;
  type: 'all' | 'income' | 'expense';
  sortBy: 'date' | 'amount';
  sortOrder: 'asc' | 'desc';
}

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  isLoading = false,
  onTransactionPress,
  onAddPress,
  showHeader = true,
  showFilters = true,
  emptyStateMessage = 'No transactions found',
  currency = 'ZAR',
  locale = 'en-ZA',
}) => {
  // State for filter options
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    searchQuery: '',
    type: 'all',
    sortBy: 'date',
    sortOrder: 'desc',
  });
  
  // State for filtered transactions
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>(transactions);
  
  // Apply filters when transactions or filter options change
  useEffect(() => {
    let result = [...transactions];
    
    // Filter by type
    if (filterOptions.type !== 'all') {
      result = result.filter(t => t.type === filterOptions.type);
    }
    
    // Filter by search query
    if (filterOptions.searchQuery) {
      const query = filterOptions.searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(query) || 
        t.category.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query)) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }
    
    // Sort transactions
    result.sort((a, b) => {
      if (filterOptions.sortBy === 'date') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      } else {
        return a.amount - b.amount;
      }
    });
    
    // Apply sort order
    if (filterOptions.sortOrder === 'desc') {
      result.reverse();
    }
    
    setFilteredTransactions(result);
  }, [transactions, filterOptions]);
  
  // Update search query
  const handleSearchChange = (text: string) => {
    setFilterOptions(prev => ({ ...prev, searchQuery: text }));
  };
  
  // Update transaction type filter
  const handleTypeFilter = (type: 'all' | 'income' | 'expense') => {
    setFilterOptions(prev => ({ ...prev, type }));
  };
  
  // Update sort options
  const handleSort = (sortBy: 'date' | 'amount') => {
    setFilterOptions(prev => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  // Group transactions by date
  const groupTransactionsByDate = () => {
    const groups: { [key: string]: Transaction[] } = {};
    
    filteredTransactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      
      groups[dateKey].push(transaction);
    });
    
    return Object.entries(groups).map(([date, transactions]) => ({
      date,
      transactions,
    }));
  };
  
  // Format date for section headers
  const formatSectionDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(locale, { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      });
    }
  };
  
  // Render a transaction item
  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isExpense = item.type === 'expense';
    
    return (
      <TouchableOpacity 
        style={styles.transactionItem}
        onPress={() => onTransactionPress && onTransactionPress(item)}
        activeOpacity={0.7}
      >
        {/* Category Icon */}
        <View style={[
          styles.categoryIcon, 
          { backgroundColor: isExpense ? '#FFEBEE' : '#E8F5E9' }
        ]}>
          <Ionicons 
            name={getCategoryIcon(item.category)} 
            size={20} 
            color={isExpense ? '#E53935' : '#43A047'} 
          />
        </View>
        
        {/* Transaction Details */}
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.transactionCategory} numberOfLines={1}>
            {item.category}
            {item.paymentMethod && ` • ${item.paymentMethod}`}
          </Text>
        </View>
        
        {/* Amount */}
        <View style={styles.amountContainer}>
          <Text style={[
            styles.transactionAmount,
            { color: isExpense ? '#E53935' : '#43A047' }
          ]}>
            {isExpense ? '-' : '+'}{formatCurrency(item.amount, locale, currency)}
          </Text>
          
          {/* Receipt indicator */}
          {item.receiptUrl && (
            <Ionicons name="receipt-outline" size={14} color="#757575" style={styles.receiptIcon} />
          )}
          
          {/* Recurring indicator */}
          {item.isRecurring && (
            <Ionicons name="repeat" size={14} color="#757575" style={styles.recurringIcon} />
          )}
        </View>
      </TouchableOpacity>
    );
  };
  
  // Render a section header
  const renderSectionHeader = ({ section }: { section: { date: string, transactions: Transaction[] } }) => {
    const totalIncome = section.transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const totalExpense = section.transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionDate}>{formatSectionDate(section.date)}</Text>
        <View style={styles.sectionSummary}>
          {totalIncome > 0 && (
            <Text style={styles.sectionIncome}>
              +{formatCurrency(totalIncome, locale, currency)}
            </Text>
          )}
          {totalExpense > 0 && (
            <Text style={styles.sectionExpense}>
              -{formatCurrency(totalExpense, locale, currency)}
            </Text>
          )}
        </View>
      </View>
    );
  };
  
  // Render empty state
  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.emptyStateText}>Loading transactions...</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyStateContainer}>
        <Image 
          source={{ uri: 'https://via.placeholder.com/150?text=No+Transactions' }} 
          style={styles.emptyStateImage} 
        />
        <Text style={styles.emptyStateTitle}>No transactions found</Text>
        <Text style={styles.emptyStateText}>{emptyStateMessage}</Text>
        {onAddPress && (
          <TouchableOpacity 
            style={styles.emptyStateButton}
            onPress={onAddPress}
          >
            <Text style={styles.emptyStateButtonText}>Add Transaction</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  // Get icon name based on category
  const getCategoryIcon = (category: string): string => {
    const categoryMap: {[key: string]: string} = {
      'Food': 'restaurant',
      'Groceries': 'cart',
      'Transport': 'car',
      'Entertainment': 'film',
      'Shopping': 'bag',
      'Housing': 'home',
      'Utilities': 'flash',
      'Health': 'medical',
      'Education': 'school',
      'Personal': 'person',
      'Travel': 'airplane',
      'Salary': 'cash',
      'Investment': 'trending-up',
      'Gift': 'gift',
      'Other': 'ellipsis-horizontal'
    };
    
    return categoryMap[category] || 'ellipsis-horizontal';
  };
  
  // Group transactions by date
  const groupedTransactions = groupTransactionsByDate();
  
  return (
    <View style={styles.container}>
      {/* Header */}
      {showHeader && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Transactions</Text>
          {onAddPress && (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={onAddPress}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search transactions..."
              value={filterOptions.searchQuery}
              onChangeText={handleSearchChange}
              placeholderTextColor="#9CA3AF"
            />
            {filterOptions.searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => handleSearchChange('')}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Type filters */}
          <View style={styles.typeFilters}>
            <TouchableOpacity
              style={[
                styles.typeFilter,
                filterOptions.type === 'all' && styles.activeTypeFilter
              ]}
              onPress={() => handleTypeFilter('all')}
            >
              <Text style={[
                styles.typeFilterText,
                filterOptions.type === 'all' && styles.activeTypeFilterText
              ]}>All</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.typeFilter,
                filterOptions.type === 'income' && styles.activeTypeFilter,
                styles.incomeFilter
              ]}
              onPress={() => handleTypeFilter('income')}
            >
              <Text style={[
                styles.typeFilterText,
                filterOptions.type === 'income' && styles.activeTypeFilterText
              ]}>Income</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.typeFilter,
                filterOptions.type === 'expense' && styles.activeTypeFilter,
                styles.expenseFilter
              ]}
              onPress={() => handleTypeFilter('expense')}
            >
              <Text style={[
                styles.typeFilterText,
                filterOptions.type === 'expense' && styles.activeTypeFilterText
              ]}>Expenses</Text>
            </TouchableOpacity>
          </View>
          
          {/* Sort options */}
          <View style={styles.sortOptions}>
            <TouchableOpacity
              style={styles.sortOption}
              onPress={() => handleSort('date')}
            >
              <Text style={[
                styles.sortOptionText,
                filterOptions.sortBy === 'date' && styles.activeSortOptionText
              ]}>Date</Text>
              {filterOptions.sortBy === 'date' && (
                <Ionicons 
                  name={filterOptions.sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
                  size={16} 
                  color="#4F46E5" 
                />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.sortOption}
              onPress={() => handleSort('amount')}
            >
              <Text style={[
                styles.sortOptionText,
                filterOptions.sortBy === 'amount' && styles.activeSortOptionText
              ]}>Amount</Text>
              {filterOptions.sortBy === 'amount' && (
                <Ionicons 
                  name={filterOptions.sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
                  size={16} 
                  color="#4F46E5" 
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Transaction List */}
      {filteredTransactions.length > 0 ? (
        <FlatList
          data={groupedTransactions}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => (
            <View>
              {renderSectionHeader({ section: item })}
              {item.transactions.map(transaction => (
                <View key={transaction.id}>
                  {renderTransactionItem({ item: transaction })}
                </View>
              ))}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        renderEmptyState()
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#1F2937',
  },
  clearButton: {
    padding: 4,
  },
  typeFilters: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  typeFilter: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  activeTypeFilter: {
    backgroundColor: '#4F46E5',
  },
  incomeFilter: {
    backgroundColor: '#E8F5E9',
  },
  expenseFilter: {
    backgroundColor: '#FFEBEE',
  },
  typeFilterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  activeTypeFilterText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sortOptions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  sortOptionText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 4,
  },
  activeSortOptionText: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  sectionDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  sectionSummary: {
    flexDirection: 'row',
  },
  sectionIncome: {
    fontSize: 14,
    fontWeight: '600',
    color: '#43A047',
    marginRight: 8,
  },
  sectionExpense: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E53935',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  transactionCategory: {
    fontSize: 14,
    color: '#6B7280',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  receiptIcon: {
    marginBottom: 2,
  },
  recurringIcon: {
    marginTop: 2,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateImage: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TransactionList; 