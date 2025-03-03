import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import { RootStackParamList } from '../navigation';
import { createBudget } from '../services/budgetService';
import { loadBudgetCategories } from '../services/budgetService';
import { BudgetCategory, DEFAULT_BUDGET_CATEGORIES } from '../models/Budget';
import NetworkManager from '../utils/NetworkManager';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AddBudgetScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BudgetCategory | null>(null);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Use the NetworkManager hook instead of our own state and useEffect
  const isOffline = !NetworkManager.useNetworkStatus();

  // Load budget categories when component mounts
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true);
      try {
        const loadedCategories = await loadBudgetCategories();
        
        if (loadedCategories.length === 0 && isOffline) {
          // If offline and no categories, use default categories
          setCategories(DEFAULT_BUDGET_CATEGORIES);
          if (DEFAULT_BUDGET_CATEGORIES.length > 0) {
            setSelectedCategory(DEFAULT_BUDGET_CATEGORIES[0]);
          }
        } else {
          setCategories(loadedCategories);
          // Set default selected category if available
          if (loadedCategories.length > 0) {
            setSelectedCategory(loadedCategories[0]);
          }
        }
      } catch (error) {
        console.error('Error loading budget categories:', error);
        
        if (isOffline) {
          // If offline, use default categories
          setCategories(DEFAULT_BUDGET_CATEGORIES);
          if (DEFAULT_BUDGET_CATEGORIES.length > 0) {
            setSelectedCategory(DEFAULT_BUDGET_CATEGORIES[0]);
          }
        } else {
          Alert.alert('Error', 'Failed to load budget categories. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, [isOffline]);

  const handleSaveBudget = async () => {
    // Validate inputs
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a budget name');
      return;
    }

    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    setIsSaving(true);
    try {
      // Create new budget
      const budget = await createBudget({
        name: name.trim(),
        amount: Number(amount),
        spent: 0,
        category: selectedCategory.id,
        color: selectedCategory.color,
        icon: selectedCategory.icon,
      });

      if (isOffline) {
        Alert.alert(
          'Budget Created (Offline)',
          'Your budget has been saved locally and will be synchronized when you reconnect to the internet.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        // Navigate back to budget screen
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error creating budget:', error);
      Alert.alert('Error', 'Failed to create budget. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderCategoryItem = (category: BudgetCategory) => {
    const isSelected = selectedCategory?.id === category.id;
    
    return (
      <TouchableOpacity
        key={category.id}
        style={[
          styles.categoryItem,
          isSelected && styles.selectedCategoryItem,
        ]}
        onPress={() => setSelectedCategory(category)}
      >
        <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
          <Ionicons name={category.icon as any} size={24} color={category.color} />
        </View>
        <Text style={styles.categoryName}>{category.name}</Text>
        {isSelected && (
          <View style={styles.checkmarkContainer}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Budget</Text>
        <View style={styles.headerRight} />
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading categories...</Text>
            </View>
          ) : (
            <>
              {/* Budget Name Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Budget Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Monthly Groceries"
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              
              {/* Budget Amount Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Budget Amount (R)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.00"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              
              {/* Category Selection */}
              <View style={styles.categoriesContainer}>
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.categoriesGrid}>
                  {categories.map(renderCategoryItem)}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Save Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSaveBudget}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save Budget</Text>
          )}
        </TouchableOpacity>
      </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    color: colors.text,
  },
  headerRight: {
    width: 24,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: textStyles.body1.fontSize,
    color: colors.textSecondary,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: textStyles.body1.fontSize,
    color: colors.text,
    ...shadows.sm,
  },
  categoriesContainer: {
    marginBottom: spacing.lg,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  categoryItem: {
    width: '30%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginRight: '5%',
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  selectedCategoryItem: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: `${colors.primary}10`,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryName: {
    fontSize: textStyles.caption.fontSize,
    color: colors.text,
    textAlign: 'center',
  },
  checkmarkContainer: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.white,
    borderRadius: borderRadius.round,
  },
  buttonContainer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: textStyles.button.fontSize,
    fontWeight: textStyles.button.fontWeight as any,
  },
});

export default AddBudgetScreen; 