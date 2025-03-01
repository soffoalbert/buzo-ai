import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import Button from '../components/Button';
import ReceiptScanner from '../components/ReceiptScanner';
import { createExpense, syncExpensesToSupabase } from '../services/expenseService';
import { processReceiptImage, ExtractedReceiptData, createExpenseFromReceipt } from '../services/receiptService';
import { isMockDataEnabled, setMockDataEnabled, generateAndSaveMockExpenses } from '../services/mockDataService';

// Define the categories
const EXPENSE_CATEGORIES = [
  { id: 'groceries', name: 'Groceries', icon: 'cart-outline', color: colors.secondary },
  { id: 'transport', name: 'Transport', icon: 'car-outline', color: colors.accent },
  { id: 'dining', name: 'Dining', icon: 'restaurant-outline', color: '#FF9800' },
  { id: 'utilities', name: 'Utilities', icon: 'flash-outline', color: colors.error },
  { id: 'housing', name: 'Housing', icon: 'home-outline', color: colors.primary },
  { id: 'entertainment', name: 'Entertainment', icon: 'film-outline', color: colors.info },
  { id: 'health', name: 'Health', icon: 'fitness-outline', color: '#6366F1' },
  { id: 'education', name: 'Education', icon: 'school-outline', color: '#8B5CF6' },
  { id: 'shopping', name: 'Shopping', icon: 'bag-outline', color: '#EC4899' },
  { id: 'other', name: 'Other', icon: 'ellipsis-horizontal-outline', color: '#9CA3AF' },
];

// Define the payment methods
const PAYMENT_METHODS = [
  { id: 'cash', name: 'Cash', icon: 'cash-outline' },
  { id: 'credit_card', name: 'Credit Card', icon: 'card-outline' },
  { id: 'debit_card', name: 'Debit Card', icon: 'card-outline' },
  { id: 'bank_transfer', name: 'Bank Transfer', icon: 'swap-horizontal-outline' },
  { id: 'mobile_payment', name: 'Mobile Payment', icon: 'phone-portrait-outline' },
];

// Define the RootStackParamList for navigation
type RootStackParamList = {
  ExpenseScreen: { receiptData?: ExtractedReceiptData; receiptImage?: string } | undefined;
  ExpensesScreen: undefined;
  ExpenseAnalytics: undefined;
};

type ExpenseScreenRouteProp = RouteProp<RootStackParamList, 'ExpenseScreen'>;
type ExpenseScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ExpenseScreen: React.FC = () => {
  const navigation = useNavigation<ExpenseScreenNavigationProp>();
  const route = useRoute<ExpenseScreenRouteProp>();
  
  // State for form fields
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showMockDataOptions, setShowMockDataOptions] = useState(false);
  
  // Initialize form with receipt data if provided
  useEffect(() => {
    if (route.params?.receiptData && route.params?.receiptImage) {
      const { receiptData, receiptImage } = route.params;
      const expenseData = createExpenseFromReceipt(receiptData, receiptImage);
      
      setTitle(expenseData.title);
      setAmount(expenseData.amount.toString());
      setCategory(expenseData.category.toLowerCase());
      if (expenseData.date) {
        setDate(new Date(expenseData.date));
      }
      setDescription(expenseData.description || '');
      setReceiptImage(expenseData.receiptImage);
    }
  }, [route.params]);
  
  // Handle date change
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };
  
  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  // Handle receipt capture
  const handleReceiptCapture = (imageUri: string, extractedData?: ExtractedReceiptData) => {
    setShowReceiptScanner(false);
    setReceiptImage(imageUri);
    
    if (extractedData) {
      const expenseData = createExpenseFromReceipt(extractedData, imageUri);
      
      setTitle(expenseData.title);
      setAmount(expenseData.amount.toString());
      setCategory(expenseData.category.toLowerCase());
      if (expenseData.date) {
        setDate(new Date(expenseData.date));
      }
      setDescription(expenseData.description || '');
    }
  };
  
  // Validate form
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!title.trim()) {
      errors.title = 'Title is required';
    }
    
    if (!amount.trim()) {
      errors.amount = 'Amount is required';
    } else if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      errors.amount = 'Amount must be a positive number';
    }
    
    if (!category) {
      errors.category = 'Category is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const expenseData = {
        title,
        amount: parseFloat(amount),
        date: date.toISOString().split('T')[0],
        category,
        description: description.trim() || undefined,
        paymentMethod: paymentMethod || undefined,
        receiptImage: receiptImage || undefined,
      };
      
      // Create the expense
      await createExpense(expenseData);
      
      // Explicitly trigger sync to Supabase
      try {
        await syncExpensesToSupabase();
      } catch (syncError) {
        console.warn('Failed to sync expenses to Supabase:', syncError);
        // Continue with the flow even if sync fails
      }
      
      Alert.alert(
        'Success',
        'Expense saved successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('ExpensesScreen'),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('Error', 'Failed to save expense. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Navigate to expense analytics
  const handleNavigateToAnalytics = () => {
    navigation.navigate('ExpenseAnalytics');
  };
  
  // Enable mock data for demonstration
  const handleEnableMockData = async () => {
    try {
      setIsLoading(true);
      await generateAndSaveMockExpenses();
      await setMockDataEnabled(true);
      Alert.alert(
        'Demo Data Enabled',
        'Demo data has been generated. You can now view analytics with realistic expense patterns.',
        [
          {
            text: 'View Analytics',
            onPress: handleNavigateToAnalytics,
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Error enabling mock data:', error);
      Alert.alert('Error', 'Failed to enable demo data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Expense</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowMockDataOptions(true)}
          >
            <Ionicons name="flask-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleNavigateToAnalytics}
          >
            <Ionicons name="bar-chart-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Mock Data Options Modal */}
      {showMockDataOptions && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Demo Data Options</Text>
              <TouchableOpacity onPress={() => setShowMockDataOptions(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>
              Generate realistic expense data for demonstration purposes. This will allow you to explore the analytics features with meaningful patterns.
            </Text>
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={() => {
                setShowMockDataOptions(false);
                handleEnableMockData();
              }}
            >
              <Ionicons name="flask-outline" size={20} color={colors.white} />
              <Text style={styles.modalButtonText}>Generate Demo Data</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.secondaryButton]}
              onPress={() => {
                setShowMockDataOptions(false);
                handleNavigateToAnalytics();
              }}
            >
              <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
              <Text style={[styles.modalButtonText, styles.secondaryButtonText]}>View Analytics</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Title Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={[styles.input, formErrors.title ? styles.inputError : null]}
              placeholder="What did you spend on?"
              value={title}
              onChangeText={setTitle}
            />
            {formErrors.title && (
              <Text style={styles.errorText}>{formErrors.title}</Text>
            )}
          </View>
          
          {/* Amount Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Amount (R)</Text>
            <TextInput
              style={[styles.input, formErrors.amount ? styles.inputError : null]}
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            {formErrors.amount && (
              <Text style={styles.errorText}>{formErrors.amount}</Text>
            )}
          </View>
          
          {/* Date Picker */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Date</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateText}>{formatDate(date)}</Text>
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>
          
          {/* Category Selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Category</Text>
            {formErrors.category && (
              <Text style={styles.errorText}>{formErrors.category}</Text>
            )}
            
            <View style={styles.categoriesContainer}>
              {EXPENSE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryItem,
                    category === cat.id && { backgroundColor: `${cat.color}20` },
                  ]}
                  onPress={() => setCategory(cat.id)}
                >
                  <View 
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: cat.color },
                    ]}
                  >
                    <Ionicons name={cat.icon as any} size={18} color="#FFFFFF" />
                  </View>
                  <Text 
                    style={[
                      styles.categoryText,
                      category === cat.id && { color: cat.color, fontWeight: '600' },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Payment Method */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Payment Method (Optional)</Text>
            
            <View style={styles.paymentMethodsContainer}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.paymentMethodItem,
                    paymentMethod === method.id && styles.selectedPaymentMethod,
                  ]}
                  onPress={() => setPaymentMethod(method.id)}
                >
                  <Ionicons 
                    name={method.icon as any} 
                    size={20} 
                    color={paymentMethod === method.id ? colors.primary : colors.textSecondary} 
                  />
                  <Text 
                    style={[
                      styles.paymentMethodText,
                      paymentMethod === method.id && styles.selectedPaymentMethodText,
                    ]}
                  >
                    {method.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          {/* Description Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add notes about this expense..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
          
          {/* Receipt Image */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Receipt (Optional)</Text>
            
            {receiptImage ? (
              <View style={styles.receiptImageContainer}>
                <Image source={{ uri: receiptImage }} style={styles.receiptImage} />
                <TouchableOpacity 
                  style={styles.removeReceiptButton}
                  onPress={() => setReceiptImage(null)}
                >
                  <Ionicons name="close-circle" size={24} color={colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.scanReceiptButton}
                onPress={() => setShowReceiptScanner(true)}
              >
                <Ionicons name="camera-outline" size={24} color={colors.primary} />
                <Text style={styles.scanReceiptText}>Scan Receipt</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Submit Button */}
          <Button
            title="Save Expense"
            onPress={handleSubmit}
            variant="primary"
            style={styles.submitButton}
            isLoading={isLoading}
            disabled={isLoading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Receipt Scanner Modal */}
      <ReceiptScanner
        visible={showReceiptScanner}
        onClose={() => setShowReceiptScanner(false)}
        onCapture={handleReceiptCapture}
        processingEnabled={true}
      />
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: textStyles.h2.fontSize,
    fontWeight: textStyles.h2.fontWeight as any,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: textStyles.subtitle2.fontSize,
    fontWeight: textStyles.subtitle2.fontWeight as any,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: textStyles.body1.fontSize,
    color: colors.text,
    ...shadows.sm,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: textStyles.caption.fontSize,
    marginTop: spacing.xs,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.sm,
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  dateText: {
    fontSize: textStyles.body1.fontSize,
    color: colors.text,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  categoryText: {
    fontSize: textStyles.body2.fontSize,
    color: colors.text,
  },
  paymentMethodsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  selectedPaymentMethod: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary,
    borderWidth: 1,
  },
  paymentMethodText: {
    fontSize: textStyles.body2.fontSize,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  selectedPaymentMethodText: {
    color: colors.primary,
    fontWeight: '600',
  },
  scanReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  scanReceiptText: {
    fontSize: textStyles.body1.fontSize,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  receiptImageContainer: {
    position: 'relative',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.md,
  },
  receiptImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  removeReceiptButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
  },
  submitButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: textStyles.h3.fontWeight as any,
    color: colors.text,
  },
  modalDescription: {
    fontSize: textStyles.body2.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  modalButtonText: {
    fontSize: textStyles.button.fontSize,
    fontWeight: textStyles.button.fontWeight as any,
    color: colors.white,
    marginLeft: spacing.sm,
  },
  secondaryButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    color: colors.primary,
  },
});

export default ExpenseScreen; 