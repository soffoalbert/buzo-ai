import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { colors, spacing, textStyles, borderRadius } from '../utils/theme';

interface BankStatementUploaderProps {
  onUploadComplete: (fileUri: string, fileName: string) => void;
  onUploadError: (error: string) => void;
}

const BankStatementUploader: React.FC<BankStatementUploaderProps> = ({
  onUploadComplete,
  onUploadError
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress] = useState(new Animated.Value(0));

  const animateProgress = useCallback(() => {
    Animated.sequence([
      Animated.timing(uploadProgress, {
        toValue: 0.7,
        duration: 1500,
        useNativeDriver: true
      }),
      Animated.timing(uploadProgress, {
        toValue: 0.9,
        duration: 1000,
        useNativeDriver: true
      })
    ]).start();
  }, [uploadProgress]);

  const handleFilePick = useCallback(async () => {
    try {
      setIsUploading(true);
      animateProgress();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        return;
      }

      const { uri, name } = result.assets[0];

      // Validate file size (max 10MB)
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists && fileInfo.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      uploadProgress.setValue(1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUploadComplete(uri, name);

    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = error instanceof Error ? error.message : 'Failed to upload file';
      onUploadError(message);
      Alert.alert('Upload Error', message);
    } finally {
      setIsUploading(false);
      uploadProgress.setValue(0);
    }
  }, [onUploadComplete, onUploadError, uploadProgress, animateProgress]);

  const progressBarWidth = uploadProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconWrapper}>
          <Ionicons name="document-text" size={32} color={colors.primary} />
        </View>
        <Text style={styles.title}>Bank Statement Upload</Text>
      </View>

      <Text style={styles.description}>
        Upload your bank statement to unlock personalized AI-powered financial insights. 
        We'll analyze your transactions securely to help you make smarter money decisions.
      </Text>

      <View style={styles.comingSoonContainer}>
        <View style={styles.featurePreview}>
          <View style={styles.featureIcon}>
            <Ionicons name="analytics-outline" size={24} color={colors.primary} />
          </View>
          <Text style={styles.featureText}>Smart Transaction Analysis</Text>
        </View>

        <View style={styles.featurePreview}>
          <View style={styles.featureIcon}>
            <Ionicons name="pie-chart-outline" size={24} color={colors.primary} />
          </View>
          <Text style={styles.featureText}>Spending Categories</Text>
        </View>

        <View style={styles.featurePreview}>
          <View style={styles.featureIcon}>
            <Ionicons name="bulb-outline" size={24} color={colors.primary} />
          </View>
          <Text style={styles.featureText}>Smart Recommendations</Text>
        </View>

        <View style={styles.comingSoonBadge}>
          <Ionicons name="time-outline" size={20} color={colors.background} />
          <Text style={styles.comingSoonText}>Coming Soon</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.uploadButton, styles.disabledButton]}
        onPress={handleFilePick}
        disabled={true}
        activeOpacity={0.7}
      >
        {isUploading ? (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator color={colors.background} size="small" />
            <Text style={styles.uploadingText}>Processing your statement...</Text>
            <View style={styles.progressBarContainer}>
              <Animated.View 
                style={[styles.progressBar, { width: progressBarWidth }]} 
              />
            </View>
          </View>
        ) : (
          <View style={styles.buttonContent}>
            <Ionicons name="cloud-upload-outline" size={24} color={colors.background} />
            <Text style={styles.uploadButtonText}>Select Bank Statement (PDF)</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.securityContainer}>
        <Ionicons name="shield-checkmark" size={16} color={colors.secondary} />
        <Text style={styles.securityNote}>
          Bank-grade encryption & secure processing
        </Text>
      </View>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    marginVertical: spacing.md,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconWrapper: {
    backgroundColor: colors.primaryLight,
    padding: spacing.sm,
    borderRadius: borderRadius.round,
  },
  title: {
    ...textStyles.h2,
    marginLeft: spacing.sm,
    color: colors.text,
  },
  description: {
    ...textStyles.body1,
    color: colors.secondary,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  comingSoonContainer: {
    padding: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  featurePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  featureIcon: {
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.round,
    marginRight: spacing.sm,
  },
  featureText: {
    ...textStyles.body1,
    color: colors.primary,
    fontWeight: '500',
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    marginTop: spacing.sm,
  },
  comingSoonText: {
    ...textStyles.button,
    color: colors.background,
    marginLeft: spacing.xs,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    minHeight: 56,
  },
  disabledButton: {
    backgroundColor: colors.secondary,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonText: {
    ...textStyles.button,
    color: colors.background,
    marginLeft: spacing.sm,
  },
  uploadingContainer: {
    alignItems: 'center',
  },
  uploadingText: {
    ...textStyles.body2,
    color: colors.background,
    marginTop: spacing.xs,
  },
  progressBarContainer: {
    width: width - 80,
    height: 4,
    backgroundColor: `${colors.background}40`,
    borderRadius: borderRadius.round,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  securityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  securityNote: {
    ...textStyles.caption,
    color: colors.secondary,
    marginLeft: spacing.xs,
  },
});

export default BankStatementUploader;