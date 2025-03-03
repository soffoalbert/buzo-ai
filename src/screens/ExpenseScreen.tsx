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
  Platform,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// Comment out the DateTimePicker import causing issues
// import DateTimePicker from '@react-native-community/datetimepicker';

import { colors, spacing, textStyles, borderRadius, shadows } from '../utils/theme';
import { formatDate } from '../utils/helpers';
import Button from '../components/Button';
import ReceiptScanner from '../components/ReceiptScanner';
import { createExpense, syncExpensesToSupabase } from '../services/expenseService';
import { processReceiptImage, ExtractedReceiptData, createExpenseFromReceipt } from '../services/receiptService';
import { isMockDataEnabled, setMockDataEnabled, generateAndSaveMockExpenses } from '../services/mockDataService';
import notificationService from '../services/notifications';
import PremiumFeatureGate from '../components/PremiumFeatureGate';
import subscriptionService, { PremiumFeature } from '../services/subscriptionService';
import { BudgetCategory } from '../models/Budget';
import { loadBudgetCategories } from '../services/budgetService';

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
  const [date, setDate] = useState(() => {
    // Ensure we initialize with a valid date
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showMockDataOptions, setShowMockDataOptions] = useState(false);
  const [scanLimitReached, setScanLimitReached] = useState(false);
  const [remainingScans, setRemainingScans] = useState<number | null>(null);
  
  // Add state for budget categories
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);

  // Load budget categories when component mounts
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categories = await loadBudgetCategories();
        setBudgetCategories(categories);
        console.log('Loaded budget categories:', categories.length);
      } catch (error) {
        console.error('Error loading budget categories:', error);
      }
    };
    
    loadCategories();
  }, []);
  
  // Add useEffect to handle receipt data if provided
  useEffect(() => {
    if (route.params?.receiptData && route.params?.receiptImage) {
      // Handle data from a receipt scan
      const { receiptData, receiptImage } = route.params;
      const expenseData = createExpenseFromReceipt(receiptData, receiptImage);
      
      setTitle(expenseData.title);
      setAmount(expenseData.amount.toString());
      
      // Map the receipt category to a budget category if possible
      if (expenseData.category) {
        const lowerCaseCategory = expenseData.category.toLowerCase();
        // Try to find a matching budget category by name (case insensitive)
        const matchingCategory = budgetCategories.find(cat => 
          cat.name.toLowerCase() === lowerCaseCategory
        );
        
        if (matchingCategory) {
          setCategory(matchingCategory.id);
        } else {
          // If no match found, try to find a similar category or use "Other"
          const otherCategory = budgetCategories.find(cat => cat.name === 'Other');
          setCategory(otherCategory?.id || '');
        }
      }
      
      // Ensure we create a proper Date object if a date is provided
      if (expenseData.date) {
        const parsedDate = new Date(expenseData.date);
        if (!isNaN(parsedDate.getTime())) {
          setDate(parsedDate);
          console.log('Setting date from receipt:', parsedDate);
        }
      }
      
      setDescription(expenseData.description || '');
      setReceiptImage(expenseData.receiptImage);
    } else if (route.params?.receiptData) {
      // Handle direct data without receipt image
      const data = route.params.receiptData;
      if (data.title) setTitle(data.title);
      if (data.amount) setAmount(String(data.amount));
      if (data.category) setCategory(data.category);
      
      if (data.date) {
        // Make sure we create a proper Date object
        const parsedDate = new Date(data.date);
        if (!isNaN(parsedDate.getTime())) {
          setDate(parsedDate);
          console.log('Setting date from params:', parsedDate);
        }
      }
      
      if (data.description) setDescription(data.description);
    }
  }, [route.params]);
  
  // Check scan limits when screen loads
  useEffect(() => {
    const checkScanLimits = async () => {
      try {
        const remaining = await subscriptionService.getRemainingReceiptScans();
        setRemainingScans(remaining);
        setScanLimitReached(remaining <= 0);
      } catch (error) {
        console.error('Error checking scan limits:', error);
      }
    };
    
    checkScanLimits();
  }, []);
  
  // Custom date picker logic
  const [year, setYear] = useState(date.getFullYear());
  const [month, setMonth] = useState(date.getMonth());
  const [day, setDay] = useState(date.getDate());
  
  // Get current date for comparing
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const currentDay = currentDate.getDate();
  
  // Handle year change with validation
  const handleYearChange = (selectedYear: number) => {
    setYear(selectedYear);
    
    // If year is current year and month is greater than current month, reset month
    if (selectedYear === currentYear && month > currentMonth) {
      setMonth(currentMonth);
    }
    
    // If year is current year and month is current month and day is greater than current day, reset day
    if (selectedYear === currentYear && month === currentMonth && day > currentDay) {
      setDay(currentDay);
    }
  };
  
  // Handle month change with validation
  const handleMonthChange = (selectedMonth: number) => {
    // If year is current year, don't allow selecting future months
    if (year === currentYear && selectedMonth > currentMonth) {
      return;
    }
    
    setMonth(selectedMonth);
    
    // If year is current year and month is current month and day is greater than current day, reset day
    if (year === currentYear && selectedMonth === currentMonth && day > currentDay) {
      setDay(currentDay);
    }
    
    // Check if the day is valid for the new month
    const daysInNewMonth = getDaysInMonth(year, selectedMonth);
    if (day > daysInNewMonth) {
      setDay(daysInNewMonth);
    }
  };
  
  // Handle day change with validation
  const handleDayChange = (selectedDay: number) => {
    // If year is current year and month is current month, don't allow selecting future days
    if (year === currentYear && month === currentMonth && selectedDay > currentDay) {
      return;
    }
    
    setDay(selectedDay);
  };
  
  const updateDate = () => {
    // Create new date with selected values
    const newDate = new Date(year, month, day);
    
    // Ensure the date is not in the future
    if (newDate > currentDate) {
      // If somehow a future date slipped through, use today
      setDate(new Date(currentYear, currentMonth, currentDay));
    } else {
      setDate(newDate);
    }
    
    setShowDatePicker(false);
  };
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  // Reset the day, month, year when the date picker is opened
  useEffect(() => {
    if(showDatePicker) {
      setYear(date.getFullYear());
      setMonth(date.getMonth());
      setDay(date.getDate());
    }
  }, [showDatePicker]);
  
  // Handle receipt capture
  const handleReceiptCapture = (imageUri: string, extractedData?: ExtractedReceiptData) => {
    setShowReceiptScanner(false);
    setReceiptImage(imageUri);
    
    if (extractedData) {
      const expenseData = createExpenseFromReceipt(extractedData, imageUri);
      
      setTitle(expenseData.title);
      setAmount(expenseData.amount.toString());
      
      // Map the receipt category to a budget category if possible
      if (expenseData.category) {
        const lowerCaseCategory = expenseData.category.toLowerCase();
        // Try to find a matching budget category by name (case insensitive)
        const matchingCategory = budgetCategories.find(cat => 
          cat.name.toLowerCase() === lowerCaseCategory
        );
        
        if (matchingCategory) {
          setCategory(matchingCategory.id);
        } else {
          // If no match found, try to find a similar category or use "Other"
          const otherCategory = budgetCategories.find(cat => cat.name === 'Other');
          setCategory(otherCategory?.id || '');
        }
      }
      
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
      // Find the selected budget category to include the proper name
      const selectedCategory = budgetCategories.find(cat => cat.id === category);
      
      // Fix the date issue by creating a proper ISO string with correct time
      const fixedDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        new Date().getHours(),
        new Date().getMinutes(),
        new Date().getSeconds()
      );
      
      console.log('DATE DEBUGGING:');
      console.log('Raw date from picker:', date.toISOString());
      console.log('Fixed date with current time:', fixedDate.toISOString());
      console.log('Current date for comparison:', new Date().toISOString());
      
      const expenseData = {
        title,
        amount: parseFloat(amount),
        date: fixedDate.toISOString(), // Use full ISO string with time
        category, // This is the budget category ID
        categoryName: selectedCategory?.name, // Add the category name for better integration
        description: description.trim() || undefined,
        paymentMethod: paymentMethod || undefined,
        receiptImage: receiptImage || undefined,
        // Set the budgetId explicitly to link this expense to a budget
        budgetId: category, // Using the category ID as the budget ID
        // Add user_id if available from the profile
        user_id: undefined // Will be populated by the expense service
      };
      
      console.log('Creating expense with data:', JSON.stringify(expenseData, null, 2));
      
      // Create the expense
      await createExpense(expenseData);
      
      // Explicitly trigger sync to Supabase
      try {
        await syncExpensesToSupabase();
      } catch (syncError) {
        console.warn('Failed to sync expenses to Supabase:', syncError);
        // Continue with the flow even if sync fails
      }
      
      // Check if any budget thresholds have been reached
      await notificationService.scheduleBudgetCheck();
      
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
  
  // Handle scan receipt
  const handleScanReceipt = async () => {
    try {
      // Check remaining scans for free users
      const isPremium = await subscriptionService.hasPremiumAccess();
      
      if (!isPremium) {
        const remaining = await subscriptionService.getRemainingReceiptScans();
        setRemainingScans(remaining);
        
        // Show upgrade modal if limit reached
        if (remaining <= 0) {
          subscriptionService.showPremiumUpgradeModal(PremiumFeature.RECEIPT_SCANNING, navigation);
          return;
        }
        
        // Increment scan count
        await subscriptionService.incrementReceiptScanCount();
        
        // Update remaining scans
        const newRemaining = await subscriptionService.getRemainingReceiptScans();
        setRemainingScans(newRemaining);
      }
      
      // Open receipt scanner
      setShowReceiptScanner(true);
    } catch (error) {
      console.error('Error scanning receipt:', error);
      Alert.alert('Error', 'Could not start receipt scanning. Please try again.');
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
              <Text style={styles.dateText}>
                {formatDate(date, 'medium')}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            
            {/* Custom Date Picker Modal */}
            <Modal
              visible={showDatePicker}
              transparent
              animationType="fade"
              onRequestClose={() => setShowDatePicker(false)}
            >
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setShowDatePicker(false)}
              >
                <View style={styles.modalContent}>
                  <View style={styles.datePickerHeader}>
                    <Text style={styles.datePickerTitle}>Select Date</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.pickerContainer}>
                    {/* Month Picker */}
                    <ScrollView style={styles.pickerColumn}>
                      {months.map((monthName, index) => {
                        // Skip future months in current year
                        if (year === currentYear && index > currentMonth) {
                          return null;
                        }
                        
                        return (
                          <TouchableOpacity
                            key={monthName}
                            style={[
                              styles.pickerItem,
                              month === index && styles.pickerItemSelected
                            ]}
                            onPress={() => handleMonthChange(index)}
                          >
                            <Text 
                              style={[
                                styles.pickerText,
                                month === index && styles.pickerTextSelected
                              ]}
                            >
                              {monthName}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    
                    {/* Day Picker */}
                    <ScrollView style={styles.pickerColumn}>
                      {Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1).map((d) => {
                        // Skip future days in current month and year
                        if (year === currentYear && month === currentMonth && d > currentDay) {
                          return null;
                        }
                        
                        return (
                          <TouchableOpacity
                            key={`day-${d}`}
                            style={[
                              styles.pickerItem,
                              day === d && styles.pickerItemSelected
                            ]}
                            onPress={() => handleDayChange(d)}
                          >
                            <Text 
                              style={[
                                styles.pickerText,
                                day === d && styles.pickerTextSelected
                              ]}
                            >
                              {d}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    
                    {/* Year Picker */}
                    <ScrollView style={styles.pickerColumn}>
                      {Array.from({ length: 10 }, (_, i) => currentYear - 9 + i).map((y) => {
                        // Skip future years
                        if (y > currentYear) {
                          return null;
                        }
                        
                        return (
                          <TouchableOpacity
                            key={`year-${y}`}
                            style={[
                              styles.pickerItem,
                              year === y && styles.pickerItemSelected
                            ]}
                            onPress={() => handleYearChange(y)}
                          >
                            <Text 
                              style={[
                                styles.pickerText,
                                year === y && styles.pickerTextSelected
                              ]}
                            >
                              {y}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={updateDate}
                  >
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
          
          {/* Category Selection */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Category</Text>
            {formErrors.category && (
              <Text style={styles.errorText}>{formErrors.category}</Text>
            )}
            
            <View style={styles.categoriesContainer}>
              {budgetCategories.map((cat) => (
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
              <PremiumFeatureGate
                feature={PremiumFeature.RECEIPT_SCANNING}
                limitMessage={`You can scan up to ${subscriptionService.FREE_PLAN_LIMITS.MAX_RECEIPT_SCANS_PER_MONTH} receipts per month with a free account.`}
              >
                <TouchableOpacity 
                  style={styles.scanReceiptButton}
                  onPress={handleScanReceipt}
                >
                  <Ionicons name="camera-outline" size={24} color={colors.primary} />
                  <Text style={styles.scanReceiptText}>
                    Scan Receipt
                    {remainingScans !== null && remainingScans < Infinity && (
                      <Text style={styles.remainingScanText}> ({remainingScans} left)</Text>
                    )}
                  </Text>
                </TouchableOpacity>
              </PremiumFeatureGate>
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
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  remainingScanText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: 'normal',
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
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '80%',
    maxHeight: '80%',
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
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  datePickerTitle: {
    fontSize: textStyles.h3.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
  },
  pickerColumn: {
    flex: 1,
    height: 200,
  },
  pickerItem: {
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemSelected: {
    backgroundColor: colors.primary + '20',
    borderRadius: borderRadius.sm,
  },
  pickerText: {
    fontSize: textStyles.body2.fontSize,
    color: colors.text,
  },
  pickerTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: textStyles.button.fontSize,
    fontWeight: '600',
  },
});

export default ExpenseScreen; 