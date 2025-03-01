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
        <Ionicons name="document-text" size={32} color={colors.primary} />
        <Text style={styles.title}>Bank Statement Upload</Text>
      </View>

      <Text style={styles.description}>
        Upload your bank statement to help us provide personalized financial advice.
        Our AI-powered system will securely analyze your transactions and provide
        comprehensive financial insights.
      </Text>

      <View style={styles.comingSoonContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="time-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.comingSoonText}>Coming Soon!</Text>
        <Text style={styles.comingSoonDescription}>
          We're working hard to bring you advanced bank statement analysis with AI-powered insights, 
          spending categorization, and personalized financial recommendations. Stay tuned for our next update!
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.uploadButton, styles.disabledButton]}
        onPress={handleFilePick}
        disabled={true}
        activeOpacity={0.8}
      >
        {isUploading ? (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator color={colors.background} />
            <Text style={styles.uploadingText}>Processing...</Text>
            <View style={styles.progressBarContainer}>
              <Animated.View 
                style={[
                  styles.progressBar,
                  { width: progressBarWidth }
                ]} 
              />
            </View>
          </View>
        ) : (
          <View style={styles.buttonContent}>
            <Ionicons name="cloud-upload-outline" size={24} color={colors.background} />
            <Text style={styles.uploadButtonText}>Select PDF Bank Statement</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.securityNote}>
        🔒 Your data is encrypted and securely processed
      </Text>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    marginVertical: spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...textStyles.h2,
    marginLeft: spacing.sm,
  },
  description: {
    ...textStyles.body1,
    color: colors.secondary,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
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
  comingSoonContainer: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  iconContainer: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.round,
    marginBottom: spacing.sm,
  },
  comingSoonText: {
    ...textStyles.h3,
    color: colors.primary,
    marginVertical: spacing.sm,
  },
  comingSoonDescription: {
    ...textStyles.body1,
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 20,
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
    backgroundColor: colors.background,
    borderRadius: 2,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  securityNote: {
    ...textStyles.caption,
    color: colors.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

export default BankStatementUploader;