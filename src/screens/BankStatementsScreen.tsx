import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '../navigation';
import { colors, spacing, textStyles, borderRadius } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import BankStatementUploader from '../components/BankStatementUploader';
import { 
  BankStatement, 
  getUserBankStatements, 
  uploadBankStatement, 
  deleteBankStatement 
} from '../services/bankStatementService';

// Define props type
type BankStatementsScreenProps = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'BankStatements'>;
  route: RouteProp<MainStackParamList, 'BankStatements'>;
};

const BankStatementsScreen: React.FC<BankStatementsScreenProps> = ({ navigation }) => {
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Fetch bank statements on component mount
  useEffect(() => {
    fetchBankStatements();
  }, []);

  // Fetch bank statements from the server
  const fetchBankStatements = async () => {
    try {
      const data = await getUserBankStatements();
      setStatements(data);
    } catch (error) {
      console.error('Error fetching bank statements:', error);
      Alert.alert(
        'Error',
        'Failed to load bank statements. Please try again later.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchBankStatements();
  };

  // Handle bank statement upload
  const handleBankStatementUpload = async (fileUri: string, fileName: string) => {
    setUploading(true);
    
    try {
      // Upload the bank statement to Supabase
      await uploadBankStatement(fileUri, fileName);
      Alert.alert(
        'Upload Successful',
        'Your bank statement has been uploaded successfully. We\'ll analyze it to provide personalized financial advice.'
      );
      // Refresh the list
      fetchBankStatements();
    } catch (error) {
      console.error('Error uploading bank statement:', error);
      Alert.alert(
        'Upload Failed',
        'There was an error uploading your bank statement. Please try again later.'
      );
    } finally {
      setUploading(false);
    }
  };

  // Handle bank statement upload error
  const handleBankStatementUploadError = (error: string) => {
    Alert.alert('Upload Error', error);
  };

  // Handle bank statement deletion
  const handleDeleteStatement = (statement: BankStatement) => {
    Alert.alert(
      'Delete Statement',
      'Are you sure you want to delete this bank statement? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBankStatement(statement.id);
              // Remove from local state
              setStatements(statements.filter(s => s.id !== statement.id));
              Alert.alert('Success', 'Bank statement deleted successfully.');
            } catch (error) {
              console.error('Error deleting bank statement:', error);
              Alert.alert('Error', 'Failed to delete bank statement. Please try again later.');
            }
          },
        },
      ]
    );
  };

  // Render a bank statement item
  const renderStatementItem = ({ item }: { item: BankStatement }) => {
    const date = new Date(item.upload_date).toLocaleDateString();
    
    return (
      <View style={styles.statementItem}>
        <View style={styles.statementInfo}>
          <Ionicons
            name={item.file_name.endsWith('.pdf') ? 'document-text' : 'image'}
            size={24}
            color={colors.primary}
          />
          <View style={styles.statementDetails}>
            <Text style={styles.statementName} numberOfLines={1} ellipsizeMode="middle">
              {item.file_name}
            </Text>
            <Text style={styles.statementDate}>{date}</Text>
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      item.status === 'processed'
                        ? colors.success
                        : item.status === 'error'
                        ? colors.error
                        : colors.warning,
                  },
                ]}
              />
              <Text style={styles.statusText}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={() => handleDeleteStatement(item)}>
          <Ionicons name="trash-outline" size={24} color={colors.error} />
        </TouchableOpacity>
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.emptyText}>Loading bank statements...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
        <Text style={styles.emptyTitle}>No Bank Statements</Text>
        <Text style={styles.emptyText}>
          Upload your bank statements to get personalized financial insights and advice.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bank Statements</Text>
        <View style={styles.placeholder} />
      </View>

      <BankStatementUploader
        onUploadComplete={handleBankStatementUpload}
        onUploadError={handleBankStatementUploadError}
      />

      {uploading && (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.uploadingText}>Uploading bank statement...</Text>
        </View>
      )}

      <FlatList
        data={statements}
        renderItem={renderStatementItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  listContainer: {
    flexGrow: 1,
    padding: spacing.md,
  },
  statementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statementInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statementDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  statementName: {
    fontSize: 16,
    fontWeight: '600',
  },
  statementDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    backgroundColor: `${colors.primary}10`,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  uploadingText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
});

export default BankStatementsScreen; 