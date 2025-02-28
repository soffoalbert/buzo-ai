import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';

// Mock data for expenses
const EXPENSE_DATA = [
  { 
    id: '1', 
    title: 'Grocery Shopping', 
    amount: 450.75, 
    date: '2023-06-15', 
    category: 'Food',
    icon: 'cart-outline',
    color: colors.secondary,
  },
  { 
    id: '2', 
    title: 'Uber Ride', 
    amount: 120.50, 
    date: '2023-06-14', 
    category: 'Transport',
    icon: 'car-outline',
    color: colors.accent,
  },
  { 
    id: '3', 
    title: 'Coffee Shop', 
    amount: 85.00, 
    date: '2023-06-14', 
    category: 'Food',
    icon: 'cafe-outline',
    color: colors.secondary,
  },
  { 
    id: '4', 
    title: 'Mobile Data', 
    amount: 200.00, 
    date: '2023-06-13', 
    category: 'Utilities',
    icon: 'flash-outline',
    color: colors.error,
  },
  { 
    id: '5', 
    title: 'Rent Payment', 
    amount: 1500.00, 
    date: '2023-06-01', 
    category: 'Housing',
    icon: 'home-outline',
    color: colors.primary,
  },
  { 
    id: '6', 
    title: 'Movie Tickets', 
    amount: 150.00, 
    date: '2023-06-10', 
    category: 'Entertainment',
    icon: 'film-outline',
    color: colors.info,
  },
  { 
    id: '7', 
    title: 'Gym Membership', 
    amount: 300.00, 
    date: '2023-06-05', 
    category: 'Health',
    icon: 'fitness-outline',
    color: '#6366F1',
  },
];

const ExpensesScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filter expenses based on search query and active filter
  const filteredExpenses = EXPENSE_DATA.filter(expense => {
    const matchesSearch = expense.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         expense.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilter === 'all') {
      return matchesSearch;
    } else {
      return matchesSearch && expense.category.toLowerCase() === activeFilter.toLowerCase();
    }
  });
  
  // Calculate total expenses
  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  // Group expenses by date
  const groupedExpenses: Record<string, typeof EXPENSE_DATA> = {};
  filteredExpenses.forEach(expense => {
    if (!groupedExpenses[expense.date]) {
      groupedExpenses[expense.date] = [];
    }
    groupedExpenses[expense.date].push(expense);
  });
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  // Render expense item
  const renderExpenseItem = ({ item }: { item: typeof EXPENSE_DATA[0] }) => (
    <TouchableOpacity style={styles.expenseItem}>
      <View style={[styles.expenseIconContainer, { backgroundColor: `${item.color}20` }]}>
        <Ionicons name={item.icon as any} size={24} color={item.color} />
      </View>
      <View style={styles.expenseDetails}>
        <Text style={styles.expenseTitle}>{item.title}</Text>
        <Text style={styles.expenseCategory}>{item.category}</Text>
      </View>
      <Text style={styles.expenseAmount}>R {item.amount.toFixed(2)}</Text>
    </TouchableOpacity>
  );
  
  // Render section header (date)
  const renderSectionHeader = (date: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{formatDate(date)}</Text>
    </View>
  );
  
  // Filter categories
  const categories = ['All', 'Food', 'Transport', 'Housing', 'Utilities', 'Entertainment', 'Health'];
  
  const onRefresh = () => {
    setIsRefreshing(true);
    // Simulate refreshing
    setTimeout(() => {
      setIsRefreshing(false);
    }, 2000);
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Expenses</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="options-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search expenses..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Category Filters */}
      <View style={styles.filterContainer}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.filterItem, 
                activeFilter === item.toLowerCase() && styles.activeFilterItem
              ]}
              onPress={() => setActiveFilter(item.toLowerCase())}
            >
              <Text 
                style={[
                  styles.filterText, 
                  activeFilter === item.toLowerCase() && styles.activeFilterText
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterList}
        />
      </View>
      
      {/* Total Expenses */}
      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total Expenses</Text>
        <Text style={styles.totalAmount}>R {totalExpenses.toFixed(2)}</Text>
      </View>
      
      {/* Expenses List */}
      {Object.keys(groupedExpenses).length > 0 ? (
        <FlatList
          data={Object.keys(groupedExpenses).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())}
          keyExtractor={(date) => date}
          renderItem={({ item: date }) => (
            <View>
              {renderSectionHeader(date)}
              {groupedExpenses[date].map((expense) => (
                <View key={expense.id}>
                  {renderExpenseItem({ item: expense })}
                </View>
              ))}
            </View>
          )}
          contentContainerStyle={styles.expensesList}
          ListHeaderComponent={renderSectionHeader}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyText}>No expenses found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={["#4F46E5"]}
              tintColor="#4F46E5"
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No expenses found</Text>
          <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
        </View>
      )}
      
      {/* Add Expense Button */}
      <TouchableOpacity style={styles.floatingButton}>
        <Ionicons name="add" size={24} color={colors.white} />
      </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: textStyles.h2.fontSize,
    fontWeight: textStyles.h2.fontWeight as any,
    lineHeight: textStyles.h2.lineHeight,
    color: textStyles.h2.color,
  },
  headerButton: {
    padding: spacing.xs,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: textStyles.body1.fontSize,
    fontWeight: textStyles.body1.fontWeight as any,
    color: colors.text,
  },
  filterContainer: {
    marginBottom: spacing.md,
  },
  filterList: {
    paddingHorizontal: spacing.lg,
  },
  filterItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
  },
  activeFilterItem: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    color: colors.textSecondary,
  },
  activeFilterText: {
    color: colors.white,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  totalLabel: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    color: colors.textSecondary,
  },
  totalAmount: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    color: colors.text,
  },
  expensesList: {
    paddingBottom: spacing.xxxl,
  },
  sectionHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionHeaderText: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    color: colors.textSecondary,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  expenseIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: textStyles.subtitle1.fontSize,
    fontWeight: textStyles.subtitle1.fontWeight as any,
    color: colors.text,
  },
  expenseCategory: {
    fontSize: textStyles.caption.fontSize,
    fontWeight: textStyles.caption.fontWeight as any,
    color: colors.textSecondary,
  },
  expenseAmount: {
    fontSize: textStyles.subtitle1.fontSize,
    fontWeight: textStyles.subtitle1.fontWeight as any,
    color: colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: textStyles.body2.fontSize,
    fontWeight: textStyles.body2.fontWeight as any,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  floatingButton: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  listContent: {
    paddingBottom: 100,
  },
});

export default ExpensesScreen; 