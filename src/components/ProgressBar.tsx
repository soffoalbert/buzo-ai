import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  TextStyle,
  ColorValue
} from 'react-native';

export type ProgressBarVariant = 'default' | 'budget' | 'expense' | 'savings' | 'education';
export type ProgressBarSize = 'small' | 'medium' | 'large';

interface ProgressBarProps {
  progress: number; // 0 to 100
  variant?: ProgressBarVariant;
  size?: ProgressBarSize;
  showPercentage?: boolean;
  showValue?: boolean;
  currentValue?: number;
  targetValue?: number;
  label?: string;
  customColor?: ColorValue;
  containerStyle?: ViewStyle;
  progressStyle?: ViewStyle;
  labelStyle?: TextStyle;
  valueStyle?: TextStyle;
  percentageStyle?: TextStyle;
  formatValue?: (value: number) => string;
  animated?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  variant = 'default',
  size = 'medium',
  showPercentage = true,
  showValue = false,
  currentValue,
  targetValue,
  label,
  customColor,
  containerStyle,
  progressStyle,
  labelStyle,
  valueStyle,
  percentageStyle,
  formatValue = (value) => `R${value.toLocaleString()}`,
  animated = true,
}) => {
  // Ensure progress is between 0 and 100
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);
  
  // Get color based on variant
  const getColor = (): ColorValue => {
    if (customColor) return customColor;
    
    switch (variant) {
      case 'budget':
        return '#4F46E5'; // Indigo
      case 'expense':
        return '#EF4444'; // Red
      case 'savings':
        return '#10B981'; // Green
      case 'education':
        return '#F59E0B'; // Amber
      default:
        return '#4F46E5'; // Default to indigo
    }
  };
  
  // Get height based on size
  const getHeight = (): number => {
    switch (size) {
      case 'small':
        return 6;
      case 'medium':
        return 10;
      case 'large':
        return 16;
      default:
        return 10;
    }
  };
  
  // Format values if needed
  const formattedCurrentValue = currentValue !== undefined ? formatValue(currentValue) : undefined;
  const formattedTargetValue = targetValue !== undefined ? formatValue(targetValue) : undefined;
  
  return (
    <View style={[styles.container, containerStyle]}>
      {/* Label and Values */}
      {(label || (showValue && currentValue !== undefined && targetValue !== undefined)) && (
        <View style={styles.header}>
          {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
          {showValue && currentValue !== undefined && targetValue !== undefined && (
            <Text style={[styles.value, valueStyle]}>
              {formattedCurrentValue} / {formattedTargetValue}
            </Text>
          )}
        </View>
      )}
      
      {/* Progress Bar */}
      <View style={[styles.progressContainer, { height: getHeight() }]}>
        <View 
          style={[
            styles.progressBar, 
            { 
              width: `${normalizedProgress}%`,
              backgroundColor: getColor(),
              height: getHeight(),
            },
            animated && styles.animated,
            progressStyle
          ]} 
        />
      </View>
      
      {/* Percentage */}
      {showPercentage && (
        <Text style={[styles.percentage, percentageStyle]}>
          {Math.round(normalizedProgress)}%
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  value: {
    fontSize: 14,
    color: '#6B7280',
  },
  progressContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBar: {
    borderRadius: 999,
  },
  animated: {
    transition: 'width 0.3s ease-in-out',
  },
  percentage: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
});

export default ProgressBar; 