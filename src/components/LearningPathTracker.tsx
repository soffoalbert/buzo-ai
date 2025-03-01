import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, textStyles, borderRadius } from '../utils/theme';
import Card from './Card';

export interface LearningPathStep {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isActive: boolean;
  icon: string;
  type: 'article' | 'quiz' | 'video';
}

interface LearningPathTrackerProps {
  pathTitle: string;
  pathDescription: string;
  steps: LearningPathStep[];
  progress: number; // 0 to 1
  onStepPress: (stepId: string) => void;
}

const LearningPathTracker: React.FC<LearningPathTrackerProps> = ({
  pathTitle,
  pathDescription,
  steps,
  progress,
  onStepPress
}) => {
  const completedSteps = steps.filter(step => step.isCompleted).length;
  const totalSteps = steps.length;
  
  const getStepIcon = (step: LearningPathStep) => {
    const baseIcon = step.type === 'article' 
      ? 'document-text' 
      : step.type === 'quiz' 
        ? 'help-circle' 
        : 'play-circle';
        
    return step.isCompleted 
      ? 'checkmark-circle' 
      : baseIcon;
  };
  
  const getStepIconColor = (step: LearningPathStep) => {
    if (step.isCompleted) return colors.success;
    if (step.isActive) return colors.primary;
    return colors.textSecondary;
  };
  
  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{pathTitle}</Text>
        <Text style={styles.description}>{pathDescription}</Text>
        
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        
        <Text style={styles.progressText}>
          {completedSteps} of {totalSteps} steps completed ({Math.round(progress * 100)}%)
        </Text>
      </View>
      
      <View style={styles.stepsContainer}>
        {steps.map((step, index) => (
          <TouchableOpacity
            key={step.id}
            style={[
              styles.stepItem,
              step.isActive && styles.stepItemActive
            ]}
            onPress={() => onStepPress(step.id)}
            disabled={!step.isActive && !step.isCompleted}
          >
            {/* Connector line */}
            {index > 0 && (
              <View 
                style={[
                  styles.connector,
                  steps[index-1].isCompleted && styles.connectorCompleted
                ]} 
              />
            )}
            
            {/* Step icon */}
            <View 
              style={[
                styles.stepIconContainer,
                step.isCompleted && styles.stepIconContainerCompleted,
                step.isActive && styles.stepIconContainerActive
              ]}
            >
              <Ionicons 
                name={getStepIcon(step) as any} 
                size={20} 
                color={getStepIconColor(step)} 
              />
            </View>
            
            {/* Step content */}
            <View style={styles.stepContent}>
              <Text 
                style={[
                  styles.stepTitle,
                  step.isCompleted && styles.stepTitleCompleted,
                  step.isActive && styles.stepTitleActive
                ]}
              >
                {step.title}
              </Text>
              
              <Text style={styles.stepDescription} numberOfLines={2}>
                {step.description}
              </Text>
              
              <View style={styles.stepTypeContainer}>
                <Ionicons 
                  name={
                    step.type === 'article' 
                      ? 'document-text-outline' 
                      : step.type === 'quiz' 
                        ? 'help-circle-outline' 
                        : 'play-circle-outline'
                  } 
                  size={14} 
                  color={colors.textSecondary} 
                />
                
                <Text style={styles.stepType}>
                  {step.type.charAt(0).toUpperCase() + step.type.slice(1)}
                </Text>
              </View>
            </View>
            
            {/* Action icon */}
            <View style={styles.actionIcon}>
              {step.isCompleted ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              ) : step.isActive ? (
                <Ionicons name="arrow-forward-circle" size={20} color={colors.primary} />
              ) : (
                <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
    overflow: 'hidden',
  },
  header: {
    padding: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...textStyles.heading3,
    marginBottom: spacing.xSmall,
  },
  description: {
    ...textStyles.body,
    color: colors.textSecondary,
    marginBottom: spacing.medium,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.disabled,
    borderRadius: 4,
    marginBottom: spacing.xSmall,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  stepsContainer: {
    paddingVertical: spacing.small,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.medium,
    position: 'relative',
  },
  stepItemActive: {
    backgroundColor: `${colors.primary}10`,
  },
  connector: {
    position: 'absolute',
    left: spacing.medium + 12, // Center of the icon container
    top: -spacing.medium, // Connect to the previous icon
    width: 2,
    height: spacing.medium * 2,
    backgroundColor: colors.disabled,
    zIndex: 1,
  },
  connectorCompleted: {
    backgroundColor: colors.success,
  },
  stepIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.disabled,
    marginRight: spacing.medium,
    zIndex: 2,
  },
  stepIconContainerCompleted: {
    borderColor: colors.success,
    backgroundColor: `${colors.success}20`,
  },
  stepIconContainerActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}20`,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    ...textStyles.subheading,
    marginBottom: 2,
    color: colors.textSecondary,
  },
  stepTitleCompleted: {
    color: colors.success,
  },
  stepTitleActive: {
    color: colors.primary,
  },
  stepDescription: {
    ...textStyles.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xSmall,
  },
  stepTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepType: {
    ...textStyles.caption,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  actionIcon: {
    marginLeft: spacing.medium,
  },
});

export default LearningPathTracker; 