import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ViewStyle, 
  TextStyle, 
  TouchableOpacity,
  TouchableOpacityProps
} from 'react-native';

export type CardVariant = 'default' | 'budget' | 'expense' | 'savings' | 'education';

interface CardProps extends TouchableOpacityProps {
  title?: string;
  subtitle?: string;
  content?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: CardVariant;
  amount?: number;
  currency?: string;
  progress?: number;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  contentStyle?: ViewStyle;
  footerStyle?: ViewStyle;
  onPress?: () => void;
  rightComponent?: React.ReactNode;
  leftComponent?: React.ReactNode;
  elevated?: boolean;
  bordered?: boolean;
}

const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  content,
  footer,
  variant = 'default',
  amount,
  currency = 'R',
  progress,
  style,
  titleStyle,
  subtitleStyle,
  contentStyle,
  footerStyle,
  onPress,
  rightComponent,
  leftComponent,
  elevated = true,
  bordered = false,
  ...rest
}) => {
  // Determine card styles based on variant
  const getCardStyles = (): ViewStyle => {
    let variantStyle: ViewStyle = {};
    
    switch (variant) {
      case 'budget':
        variantStyle = {
          borderLeftWidth: 4,
          borderLeftColor: '#4F46E5',
        };
        break;
      case 'expense':
        variantStyle = {
          borderLeftWidth: 4,
          borderLeftColor: '#EF4444',
        };
        break;
      case 'savings':
        variantStyle = {
          borderLeftWidth: 4,
          borderLeftColor: '#10B981',
        };
        break;
      case 'education':
        variantStyle = {
          borderLeftWidth: 4,
          borderLeftColor: '#F59E0B',
        };
        break;
      default:
        variantStyle = {};
        break;
    }
    
    // Elevation style
    const elevationStyle: ViewStyle = elevated ? styles.elevated : {};
    
    // Border style
    const borderStyle: ViewStyle = bordered ? styles.bordered : {};
    
    return {
      ...styles.card,
      ...variantStyle,
      ...elevationStyle,
      ...borderStyle,
      ...style,
    };
  };
  
  // Format amount with currency
  const formattedAmount = amount !== undefined ? `${currency}${amount.toLocaleString()}` : undefined;
  
  // Render progress bar if progress is provided
  const renderProgressBar = () => {
    if (progress === undefined) return null;
    
    let progressColor = '#4F46E5';
    if (variant === 'expense') progressColor = '#EF4444';
    if (variant === 'savings') progressColor = '#10B981';
    if (variant === 'education') progressColor = '#F59E0B';
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBackground}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${Math.min(Math.max(progress, 0), 100)}%`,
                backgroundColor: progressColor
              }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>{progress}%</Text>
      </View>
    );
  };
  
  const CardContainer = onPress ? TouchableOpacity : View;
  
  return (
    <CardContainer 
      style={getCardStyles()} 
      onPress={onPress}
      activeOpacity={0.8}
      {...rest}
    >
      {/* Card Header */}
      {(title || subtitle || amount !== undefined || leftComponent || rightComponent) && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {leftComponent}
            <View style={styles.titleContainer}>
              {title && <Text style={[styles.title, titleStyle]}>{title}</Text>}
              {subtitle && <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>}
            </View>
          </View>
          <View style={styles.headerRight}>
            {amount !== undefined && <Text style={styles.amount}>{formattedAmount}</Text>}
            {rightComponent}
          </View>
        </View>
      )}
      
      {/* Progress Bar */}
      {renderProgressBar()}
      
      {/* Card Content */}
      {content && (
        <View style={[styles.content, contentStyle]}>
          {content}
        </View>
      )}
      
      {/* Card Footer */}
      {footer && (
        <View style={[styles.footer, footerStyle]}>
          {footer}
        </View>
      )}
    </CardContainer>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  elevated: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bordered: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  content: {
    marginVertical: 8,
  },
  footer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  progressBackground: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    flex: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
});

export default Card; 