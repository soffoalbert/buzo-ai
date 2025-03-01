import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
  TextStyle,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';

import offlineStorage from '../services/offlineStorage';
import syncService from '../services/syncService';
import syncQueueService from '../services/syncQueueService';
import testOfflineMode from '../utils/testOfflineMode';
import OfflineStatusBar from '../components/OfflineStatusBar';
import Button from '../components/Button';
import { colors, spacing, textStyles } from '../utils/theme';

type FontWeight = TextStyle['fontWeight'];
type OfflineTestScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const OfflineTestScreen: React.FC = () => {
  const navigation = useNavigation<OfflineTestScreenNavigationProp>();
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const syncProgressAnimation = new Animated.Value(0);
  const fadeAnim = new Animated.Value(1);

  // Load data
  const loadData = async () => {
    try {
      setIsLoading(true);
      fadeOut();
      
      const online = await offlineStorage.isOnline();
      setIsOnline(online);
      
      const pendingItems = await offlineStorage.getPendingSync();
      setPendingCount(pendingItems.length);
      
      const lastSyncTime = await offlineStorage.getLastSync();
      setLastSync(lastSyncTime);
      
      const status = await syncQueueService.getSyncStatus();
      setSyncStatus(status);
      
      const [cachedBudgets, cachedExpenses, cachedSavingsGoals] = await Promise.all([
        offlineStorage.loadBudgets(),
        offlineStorage.loadExpenses(),
        offlineStorage.loadSavingsGoals()
      ]);
      
      setBudgets(cachedBudgets);
      setExpenses(cachedExpenses); 
      setSavingsGoals(cachedSavingsGoals);

      fadeIn();
    } catch (error) {
      console.error('Error loading data:', error);
      showErrorAlert('Failed to load data');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fadeIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true
    }).start();
  };

  const fadeOut = () => {
    Animated.timing(fadeAnim, {
      toValue: 0.3,
      duration: 300,
      useNativeDriver: true
    }).start();
  };

  const showErrorAlert = (message: string) => {
    Alert.alert(
      'Error',
      message,
      [{ text: 'OK', style: 'default' }],
      { cancelable: true }
    );
  };

  const showSuccessAlert = (message: string) => {
    Alert.alert(
      'Success',
      message,
      [{ text: 'Great!', style: 'default' }],
      { cancelable: true }
    );
  };

  const handleAddMockData = async (count: number = 1) => {
    try {
      setIsLoading(true);
      await testOfflineMode.addMultipleMockItems(count);
      await loadData();
      showSuccessAlert(`${count} mock data item${count > 1 ? 's' : ''} added successfully`);
    } catch (error) {
      console.error('Error adding mock data:', error);
      showErrorAlert('Failed to add mock data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearData = async () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to clear all offline data? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await testOfflineMode.clearAllOfflineData();
              await loadData();
              showSuccessAlert('All data cleared successfully');
            } catch (error) {
              console.error('Error clearing data:', error);
              showErrorAlert('Failed to clear data');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleSync = async () => {
    try {
      setIsLoading(true);
      
      // Animate sync progress
      syncProgressAnimation.setValue(0);
      Animated.timing(syncProgressAnimation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true
      }).start();

      await syncService.performFullSync();
      await loadData();
      showSuccessAlert('Data synced successfully');
    } catch (error) {
      console.error('Error syncing data:', error);
      showErrorAlert('Failed to sync data');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNetworkStatus = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    
    Alert.alert(
      'Network Status',
      `Network status simulated as ${newStatus ? 'online' : 'offline'}`,
      [
        {
          text: 'OK',
          onPress: () => {
            if (newStatus && pendingCount > 0) {
              Alert.alert(
                'Pending Changes',
                `You have ${pendingCount} pending changes. Would you like to sync now?`,
                [
                  { text: 'Later', style: 'cancel' },
                  { text: 'Sync Now', onPress: handleSync }
                ]
              );
            }
          }
        }
      ]
    );
  };

  const toggleAutoSync = (value: boolean) => {
    setAutoSyncEnabled(value);
    Alert.alert(
      'Auto-Sync',
      `Auto-sync has been ${value ? 'enabled' : 'disabled'}`,
      [{ text: 'OK' }]
    );
  };

  useEffect(() => {
    loadData();
    
    const unsubscribeSyncStatus = syncService.addSyncStatusListener((status) => {
      setSyncStatus(status);
      if (!status.isSyncing && status.lastSuccessfulSync) {
        loadData();
      }
    });
    
    return () => {
      unsubscribeSyncStatus();
    };
  }, []);

  const renderDataItem = (item: any, type: 'budget' | 'expense' | 'goal') => (
    <Animated.View 
      key={item.id}
      style={[styles.dataItem, { opacity: fadeAnim }]}
    >
      <LinearGradient
        colors={[colors.white, colors.backgroundLight]}
        style={styles.dataItemGradient}
      >
        <View style={styles.dataItemHeader}>
          <Text style={styles.dataItemTitle}>{
            type === 'expense' ? item.description : item.name
          }</Text>
          <MaterialCommunityIcons
            name={
              type === 'budget' ? 'wallet' :
              type === 'expense' ? 'cash' : 'piggy-bank'
            }
            size={20}
            color={colors.primary}
          />
        </View>
        <Text style={styles.dataItemSubtitle}>
          {type === 'budget' && `${item.amount} • ${item.category} • ${item.period}`}
          {type === 'expense' && `${item.amount} • ${item.category} • ${new Date(item.date).toLocaleDateString()}`}
          {type === 'goal' && `${item.currentAmount}/${item.targetAmount} • ${item.category}`}
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { 
            width: `${type === 'goal' ? (item.currentAmount / item.targetAmount * 100) : 100}%`,
            backgroundColor: type === 'goal' ? colors.success : colors.primary
          }]} />
        </View>
      </LinearGradient>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="auto" />
      
      <OfflineStatusBar onSyncComplete={loadData} />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Offline Mode Testing</Text>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <LottieView
            source={require('../assets/animations/loading.json')}
            autoPlay
            loop
            style={styles.loadingAnimation}
          />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statusCard}>
            <Text style={styles.sectionTitle}>Network Status</Text>
            <View style={styles.statusRow}>
              <Ionicons
                name={isOnline ? "cloud-done" : "cloud-offline"}
                size={24}
                color={isOnline ? colors.success : colors.error}
              />
              <Text style={[styles.statusText, { color: isOnline ? colors.success : colors.error }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Pending Changes:</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingCount}</Text>
              </View>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Failed Syncs:</Text>
              <View style={[styles.badge, styles.errorBadge]}>
                <Text style={styles.badgeText}>{syncStatus?.failedCount || 0}</Text>
              </View>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Last Sync:</Text>
              <Text style={styles.statusValue}>
                {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Auto-Sync:</Text>
              <Switch
                value={autoSyncEnabled}
                onValueChange={toggleAutoSync}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.border}
              />
            </View>
            
            <Button
              title="Toggle Network Status"
              onPress={toggleNetworkStatus}
              variant="outline"
              size="small"
              style={styles.actionButton}
              icon="wifi"
            />
          </View>
          
          <View style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Test Actions</Text>
            
            <View style={styles.actionButtonsGrid}>
              <Button
                title="Add Mock Item"
                onPress={() => handleAddMockData(1)}
                variant="outline"
                size="small"
                style={styles.gridButton}
                icon="add-circle"
              />
              
              <Button
                title="Add 5 Items"
                onPress={() => handleAddMockData(5)}
                variant="outline"
                size="small"
                style={styles.gridButton}
                icon="layers"
              />
              
              <Button
                title="Sync Now"
                onPress={handleSync}
                variant="primary"
                size="small"
                style={styles.gridButton}
                icon="sync"
                disabled={!isOnline}
              />
              
              <Button
                title="Clear All"
                onPress={handleClearData}
                variant="danger"
                size="small"
                style={styles.gridButton}
                icon="trash"
              />
            </View>
          </View>
          
          <View style={styles.dataCard}>
            <Text style={styles.sectionTitle}>Cached Data</Text>
            
            <View style={styles.dataSection}>
              <Text style={styles.dataTitle}>
                Budgets ({budgets.length})
              </Text>
              {budgets.length > 0 ? (
                budgets.slice(0, 3).map(budget => renderDataItem(budget, 'budget'))
              ) : (
                <Text style={styles.emptyText}>No budgets found</Text>
              )}
              {budgets.length > 3 && (
                <TouchableOpacity style={styles.viewMoreButton}>
                  <Text style={styles.viewMoreText}>View {budgets.length - 3} more</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.dataSection}>
              <Text style={styles.dataTitle}>
                Expenses ({expenses.length})
              </Text>
              {expenses.length > 0 ? (
                expenses.slice(0, 3).map(expense => renderDataItem(expense, 'expense'))
              ) : (
                <Text style={styles.emptyText}>No expenses found</Text>
              )}
              {expenses.length > 3 && (
                <TouchableOpacity style={styles.viewMoreButton}>
                  <Text style={styles.viewMoreText}>View {expenses.length - 3} more</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.dataSection}>
              <Text style={styles.dataTitle}>
                Savings Goals ({savingsGoals.length})
              </Text>
              {savingsGoals.length > 0 ? (
                savingsGoals.slice(0, 3).map(goal => renderDataItem(goal, 'goal'))
              ) : (
                <Text style={styles.emptyText}>No savings goals found</Text>
              )}
              {savingsGoals.length > 3 && (
                <TouchableOpacity style={styles.viewMoreButton}>
                  <Text style={styles.viewMoreText}>View {savingsGoals.length - 3} more</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      )}
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
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
    height: 64,
  },
  backButton: {
    padding: spacing.small,
    marginRight: spacing.medium,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
  },
  headerTitle: {
    ...textStyles.h2,
    color: colors.text,
    fontSize: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  loadingAnimation: {
    width: 240,
    height: 240,
  },
  loadingText: {
    ...textStyles.body1,
    marginTop: spacing.medium,
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.large,
    paddingBottom: spacing.extraLarge,
  },
  statusCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.large,
    marginBottom: spacing.large,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  actionsCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.large,
    marginBottom: spacing.large,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  dataCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.large,
    marginBottom: spacing.large,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  sectionTitle: {
    ...textStyles.h3,
    marginBottom: spacing.large,
    color: colors.text,
    fontSize: 22,
    fontWeight: '700' as FontWeight,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium,
    paddingHorizontal: spacing.medium,
    height: 44,
  },
  statusText: {
    ...textStyles.body1,
    marginLeft: spacing.medium,
    fontWeight: '600' as FontWeight,
    fontSize: 16,
  },
  statusLabel: {
    ...textStyles.body2,
    color: colors.textSecondary,
    width: 140,
    fontSize: 15,
  },
  statusValue: {
    ...textStyles.body2,
    color: colors.text,
    flex: 1,
    fontSize: 15,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: spacing.medium,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  errorBadge: {
    backgroundColor: colors.error,
  },
  badgeText: {
    ...textStyles.caption,
    color: colors.white,
    fontWeight: '600' as FontWeight,
    fontSize: 13,
  },
  actionButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.small,
    marginTop: spacing.small,
  },
  gridButton: {
    width: (width - spacing.large * 2 - spacing.medium * 2) / 2,
    marginHorizontal: spacing.small,
    marginBottom: spacing.medium,
    height: 48,
  },
  dataSection: {
    marginBottom: spacing.extraLarge,
  },
  dataTitle: {
    ...textStyles.subtitle1,
    color: colors.text,
    marginBottom: spacing.large,
    fontSize: 18,
    fontWeight: '600' as FontWeight,
  },
  dataItem: {
    marginBottom: spacing.medium,
    borderRadius: 16,
    overflow: 'hidden',
  },
  dataItemGradient: {
    padding: spacing.large,
  },
  dataItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  dataItemTitle: {
    ...textStyles.body1,
    color: colors.text,
    fontWeight: '600' as FontWeight,
    flex: 1,
    fontSize: 16,
  },
  dataItemSubtitle: {
    ...textStyles.body2,
    color: colors.textSecondary,
    marginBottom: spacing.medium,
    fontSize: 14,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyText: {
    ...textStyles.body2,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing.large,
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    fontSize: 15,
  },
  viewMoreButton: {
    alignItems: 'center',
    padding: spacing.medium,
    marginTop: spacing.medium,
  },
  viewMoreText: {
    ...textStyles.button,
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600' as FontWeight,
  },
});

export default OfflineTestScreen;
// End of Selection