import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, textStyles, borderRadius } from '../utils/theme';

interface BankStatementUploaderProps {
  onUploadComplete: (fileUri: string, fileName: string) => void;
  onUploadError: (error: string) => void;
}

const BankStatementUploader: React.FC<BankStatementUploaderProps> = ({
  onUploadComplete,
  onUploadError,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    uri: string;
    name: string;
  } | null>(null);

  const pickDocument = async () => {
    setIsUploading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setIsUploading(false);
        return;
      }

      // Handle the selected document
      const file = result.assets[0];
      setUploadedFile({
        uri: file.uri,
        name: file.name,
      });
      onUploadComplete(file.uri, file.name);
      setIsUploading(false);
    } catch (error) {
      console.error('Error picking document:', error);
      onUploadError('Failed to select document. Please try again.');
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Bank Statement</Text>
      <Text style={styles.description}>
        Upload your bank statement to help us provide personalized financial advice.
        We accept PDF files and images.
      </Text>

      {!uploadedFile ? (
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={pickDocument}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={24} color={colors.background} />
              <Text style={styles.uploadButtonText}>Select Bank Statement</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.fileContainer}>
          <View style={styles.fileInfo}>
            <Ionicons
              name={uploadedFile.name.endsWith('.pdf') ? 'document-text' : 'image'}
              size={24}
              color={colors.primary}
            />
            <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
              {uploadedFile.name}
            </Text>
          </View>
          <TouchableOpacity onPress={handleRemoveFile}>
            <Ionicons name="close-circle" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.securityNote}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
        <Text style={styles.securityText}>
          Your data is encrypted and securely stored. We never share your financial information.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  uploadButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.md,
  },
  uploadButtonText: {
    color: colors.background,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${colors.primary}10`,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.md,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: spacing.sm,
    flex: 1,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.success}10`,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  securityText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    marginLeft: spacing.sm,
  },
});

export default BankStatementUploader; 