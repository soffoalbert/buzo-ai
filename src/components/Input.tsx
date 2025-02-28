import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  TextStyle, 
  TextInputProps,
  TouchableOpacity,
  KeyboardTypeOptions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type InputVariant = 'default' | 'outline' | 'filled' | 'underline';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: InputVariant;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  inputStyle?: TextStyle;
  errorStyle?: TextStyle;
  hintStyle?: TextStyle;
  onClear?: () => void;
  showClearButton?: boolean;
  isPassword?: boolean;
  isNumeric?: boolean;
  isCurrency?: boolean;
  required?: boolean;
  touched?: boolean;
  onValidate?: (isValid: boolean) => void;
  validationRegex?: RegExp;
  validationMessage?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  variant = 'default',
  containerStyle,
  labelStyle,
  inputStyle,
  errorStyle,
  hintStyle,
  onClear,
  showClearButton = false,
  isPassword = false,
  isNumeric = false,
  isCurrency = false,
  required = false,
  touched = false,
  onValidate,
  validationRegex,
  validationMessage,
  value,
  onChangeText,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(isPassword);
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  
  // Determine keyboard type based on input type
  const getKeyboardType = (): KeyboardTypeOptions => {
    if (isNumeric) return 'numeric';
    if (isCurrency) return 'decimal-pad';
    return rest.keyboardType || 'default';
  };
  
  // Handle input focus
  const handleFocus = () => {
    setIsFocused(true);
    if (rest.onFocus) {
      rest.onFocus({} as any);
    }
  };
  
  // Handle input blur
  const handleBlur = () => {
    setIsFocused(false);
    
    // Validate on blur if needed
    if (required && (!value || value.toString().trim() === '')) {
      setLocalError(`${label || 'Field'} is required`);
      if (onValidate) onValidate(false);
    } else if (validationRegex && value && !validationRegex.test(value.toString())) {
      setLocalError(validationMessage || 'Invalid input');
      if (onValidate) onValidate(false);
    } else {
      setLocalError(undefined);
      if (onValidate) onValidate(true);
    }
    
    if (rest.onBlur) {
      rest.onBlur({} as any);
    }
  };
  
  // Handle text change
  const handleChangeText = (text: string) => {
    // Clear error when user starts typing
    if (localError) {
      setLocalError(undefined);
    }
    
    // Format currency if needed
    if (isCurrency) {
      // Remove non-numeric characters except decimal point
      const numericValue = text.replace(/[^0-9.]/g, '');
      
      // Ensure only one decimal point
      const parts = numericValue.split('.');
      const formattedValue = parts.length > 1 
        ? `${parts[0]}.${parts.slice(1).join('')}` 
        : numericValue;
      
      if (onChangeText) {
        onChangeText(formattedValue);
      }
    } else if (onChangeText) {
      onChangeText(text);
    }
  };
  
  // Toggle password visibility
  const toggleSecureEntry = () => {
    setSecureTextEntry(!secureTextEntry);
  };
  
  // Clear input value
  const handleClear = () => {
    if (onChangeText) {
      onChangeText('');
    }
    if (onClear) {
      onClear();
    }
  };
  
  // Determine container styles based on variant and state
  const getContainerStyles = (): ViewStyle => {
    let variantStyle: ViewStyle = {};
    
    switch (variant) {
      case 'outline':
        variantStyle = {
          borderWidth: 1,
          borderColor: isFocused ? '#4F46E5' : '#E5E7EB',
          borderRadius: 8,
        };
        break;
      case 'filled':
        variantStyle = {
          backgroundColor: '#F3F4F6',
          borderRadius: 8,
        };
        break;
      case 'underline':
        variantStyle = {
          borderBottomWidth: 1,
          borderBottomColor: isFocused ? '#4F46E5' : '#E5E7EB',
          borderRadius: 0,
        };
        break;
      default:
        variantStyle = {
          borderWidth: 1,
          borderColor: '#E5E7EB',
          borderRadius: 8,
        };
        break;
    }
    
    // Error style
    const errorContainerStyle: ViewStyle = (error || localError) ? {
      borderColor: '#EF4444',
    } : {};
    
    return {
      ...styles.inputContainer,
      ...variantStyle,
      ...(isFocused && styles.focusedContainer),
      ...errorContainerStyle,
      ...containerStyle,
    };
  };
  
  // Determine if we should show an error
  const displayError = error || (touched && localError);
  
  return (
    <View style={styles.container}>
      {/* Label */}
      {label && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, labelStyle]}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        </View>
      )}
      
      {/* Input Container */}
      <View style={getContainerStyles()}>
        {/* Left Icon */}
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}
        
        {/* TextInput */}
        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            (rightIcon || showClearButton || isPassword) && styles.inputWithRightIcon,
            inputStyle,
          ]}
          placeholderTextColor="#9CA3AF"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChangeText={handleChangeText}
          value={value}
          secureTextEntry={secureTextEntry}
          keyboardType={getKeyboardType()}
          {...rest}
        />
        
        {/* Clear Button */}
        {showClearButton && value && value.length > 0 && (
          <TouchableOpacity style={styles.rightIconContainer} onPress={handleClear}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
        
        {/* Password Toggle */}
        {isPassword && (
          <TouchableOpacity style={styles.rightIconContainer} onPress={toggleSecureEntry}>
            <Ionicons 
              name={secureTextEntry ? 'eye-off' : 'eye'} 
              size={18} 
              color="#9CA3AF" 
            />
          </TouchableOpacity>
        )}
        
        {/* Right Icon */}
        {rightIcon && !showClearButton && !isPassword && (
          <View style={styles.rightIconContainer}>{rightIcon}</View>
        )}
      </View>
      
      {/* Error Message */}
      {displayError && (
        <Text style={[styles.error, errorStyle]}>
          {error || localError}
        </Text>
      )}
      
      {/* Hint Text */}
      {hint && !displayError && (
        <Text style={[styles.hint, hintStyle]}>
          {hint}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelContainer: {
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  required: {
    color: '#EF4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  focusedContainer: {
    borderColor: '#4F46E5',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    paddingVertical: 8,
  },
  inputWithLeftIcon: {
    paddingLeft: 8,
  },
  inputWithRightIcon: {
    paddingRight: 8,
  },
  leftIconContainer: {
    marginRight: 8,
  },
  rightIconContainer: {
    marginLeft: 8,
  },
  error: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
});

export default Input; 