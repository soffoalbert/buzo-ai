import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ViewStyle, 
  TextStyle,
  TouchableOpacityProps 
} from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'text';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
  ...rest
}) => {
  // Determine button styles based on variant and size
  const getButtonStyles = (): ViewStyle => {
    let variantStyle: ViewStyle = {};
    
    // Variant styles
    switch (variant) {
      case 'primary':
        variantStyle = {
          backgroundColor: '#4F46E5', // Indigo color from the splash screen
        };
        break;
      case 'secondary':
        variantStyle = {
          backgroundColor: '#6366F1',
        };
        break;
      case 'danger':
        variantStyle = {
          backgroundColor: '#EF4444',
        };
        break;
      case 'outline':
        variantStyle = {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: '#4F46E5',
        };
        break;
      case 'text':
        variantStyle = {
          backgroundColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
        };
        break;
    }
    
    // Size styles
    let sizeStyle: ViewStyle = {};
    switch (size) {
      case 'small':
        sizeStyle = {
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 8,
        };
        break;
      case 'medium':
        sizeStyle = {
          paddingVertical: 12,
          paddingHorizontal: 24,
          borderRadius: 10,
        };
        break;
      case 'large':
        sizeStyle = {
          paddingVertical: 16,
          paddingHorizontal: 32,
          borderRadius: 12,
        };
        break;
    }
    
    // Width style
    const widthStyle: ViewStyle = fullWidth ? { width: '100%' } : {};
    
    // Disabled style
    const disabledStyle: ViewStyle = (disabled || isLoading) ? { opacity: 0.6 } : {};
    
    return {
      ...styles.button,
      ...variantStyle,
      ...sizeStyle,
      ...widthStyle,
      ...disabledStyle,
      ...style,
    };
  };
  
  // Determine text styles based on variant
  const getTextStyles = (): TextStyle => {
    let variantTextStyle: TextStyle = {};
    
    switch (variant) {
      case 'outline':
        variantTextStyle = {
          color: '#4F46E5',
        };
        break;
      case 'text':
        variantTextStyle = {
          color: '#4F46E5',
        };
        break;
      default:
        variantTextStyle = {
          color: '#FFFFFF',
        };
        break;
    }
    
    // Size styles for text
    let sizeTextStyle: TextStyle = {};
    switch (size) {
      case 'small':
        sizeTextStyle = {
          fontSize: 14,
        };
        break;
      case 'medium':
        sizeTextStyle = {
          fontSize: 16,
        };
        break;
      case 'large':
        sizeTextStyle = {
          fontSize: 18,
        };
        break;
    }
    
    return {
      ...styles.text,
      ...variantTextStyle,
      ...sizeTextStyle,
      ...textStyle,
    };
  };
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      style={getButtonStyles()}
      activeOpacity={0.7}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'outline' || variant === 'text' ? '#4F46E5' : '#FFFFFF'} 
        />
      ) : (
        <React.Fragment>
          {leftIcon && <React.Fragment>{leftIcon}</React.Fragment>}
          <Text style={getTextStyles()}>{title}</Text>
          {rightIcon && <React.Fragment>{rightIcon}</React.Fragment>}
        </React.Fragment>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default Button; 