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
import DateTimePicker from '@react-native-community/datetimepicker';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import { RootStackParamList } from '../navigation';
import { createSavingsGoal } from '../services/savingsService';
import { loadSavingsCategories } from '../services/savingsService';
import { SAVINGS_CATEGORIES } from '../models/SavingsGoal';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AddSavingsGoalScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [targetDate, setTargetDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // Default to 30 days from now
  const [selectedCategory, setSelectedCategory] = useState<typeof SAVINGS_CATEGORIES[0] | null>(null);
  const [categories, setCategories] = useState<typeof SAVINGS_CATEGORIES>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showTargetDatePicker, setShowTargetDatePicker] = useState(false);

  // Load savings categories when component mounts
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true);
      try {
        const loadedCategories = await loadSavingsCategories();
        setCategories(loadedCategories);
        // Set default selected category if available
        if (loadedCategories.length > 0) {
          setSelectedCategory(loadedCategories[0]);
        }
      } catch (error) {
        console.error('Error loading savings categories:', error);
        Alert.alert('Error', 'Failed to load savings categories. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const handleSaveSavingsGoal = async () => {
    // Validate inputs
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a goal title');
      return;
    }

    if (!targetAmount.trim() || isNaN(Number(targetAmount)) || Number(targetAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid target amount');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    // Validate dates
    if (targetDate <= startDate) {
      Alert.alert('Error', 'Target date must be after start date');
      return;
    }

    setIsSaving(true);
    try {
      // Create new savings goal
      await createSavingsGoal({
        title: title.trim(),
        description: description.trim(),
        targetAmount: Number(targetAmount),
        currentAmount: Number(initialAmount) || 0,
        startDate: startDate.toISOString(),
        targetDate: targetDate.toISOString(),
        category: selectedCategory.id,
        icon: selectedCategory.icon,
        color: selectedCategory.color,
        isCompleted: false,
        isShared: false,
      });

      // Navigate back to savings screen
      navigation.goBack();
    } catch (error) {
      console.error('Error creating savings goal:', error);
      Alert.alert('Error', 'Failed to create savings goal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const handleTargetDateChange = (event: any, selectedDate?: Date) => {
    setShowTargetDatePicker(false);
    if (selectedDate) {
      setTargetDate(selectedDate);
    }
  };

  const renderCategoryItem = (category: typeof SAVINGS_CATEGORIES[0]) => {
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
        <Text style={styles.headerTitle}>Add Savings Goal</Text>
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
              {/* Goal Title Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Goal Title</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Emergency Fund"
                  value={title}
                  onChangeText={setTitle}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              
              {/* Goal Description Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textAreaInput]}
                  placeholder="What are you saving for?"
                  value={description}
                  onChangeText={setDescription}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                />
              </View>
              
              {/* Target Amount Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Target Amount (R)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.00"
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              
              {/* Initial Amount Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Initial Amount (R) (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.00"
                  value={initialAmount}
                  onChangeText={setInitialAmount}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              
              {/* Date Inputs */}
              <View style={styles.datesContainer}>
                <View style={styles.dateInputContainer}>
                  <Text style={styles.inputLabel}>Start Date</Text>
                  <TouchableOpacity 
                    style={styles.dateInput}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Text style={styles.dateText}>{formatDate(startDate)}</Text>
                    <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showStartDatePicker && (
                    <DateTimePicker
                      value={startDate}
                      mode="date"
                      display="default"
                      onChange={handleStartDateChange}
                    />
                  )}
                </View>
                
                <View style={styles.dateInputContainer}>
                  <Text style={styles.inputLabel}>Target Date</Text>
                  <TouchableOpacity 
                    style={styles.dateInput}
                    onPress={() => setShowTargetDatePicker(true)}
                  >
                    <Text style={styles.dateText}>{formatDate(targetDate)}</Text>
                    <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  {showTargetDatePicker && (
                    <DateTimePicker
                      value={targetDate}
                      mode="date"
                      display="default"
                      onChange={handleTargetDateChange}
                      minimumDate={new Date(startDate.getTime() + 24 * 60 * 60 * 1000)} // At least 1 day after start date
                    />
                  )}
                </View>
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
          onPress={handleSaveSavingsGoal}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save Goal</Text>
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
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: textStyles.body1.fontSize,
    color: colors.text,
  },
  textAreaInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  datesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  dateInputContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  dateInput: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: textStyles.body2.fontSize,
    color: colors.text,
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
    marginRight: '5%',
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
  },
  selectedCategoryItem: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryName: {
    fontSize: textStyles.caption.fontSize,
    color: colors.text,
    textAlign: 'center',
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 5,
    right: 5,
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

export default AddSavingsGoalScreen; 