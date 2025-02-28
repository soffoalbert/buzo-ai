import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Animated,
  Platform,
  useWindowDimensions,
  Easing,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import offlineStorage from '../services/offlineStorage';
import syncService from '../services/syncService';
import syncQueueService, { SyncStatus } from '../services/syncQueueService';
import { colors, shadows, borderRadius } from '../utils/theme';

interface OfflineStatusBarProps {
  onSyncComplete?: () => void;
}

const OfflineStatusBar: React.FC<OfflineStatusBarProps> = ({ onSyncComplete }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  
  // Animation values
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const syncIconAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Check online status and sync status
  const checkStatus = async () => {
    try {
      // Check online status
      const online = await offlineStorage.isOnline();
      // NetInfo can sometimes return null for isConnected, so we need to handle that
      const isNetworkOnline = typeof online === 'boolean' ? online : true;
      setIsOnline(isNetworkOnline);
      
      // Get sync status
      const status = await syncQueueService.getSyncStatus();
      if (status) {
        setSyncStatus(status);
        
        // Update progress animation
        Animated.timing(progressAnim, {
          toValue: status.syncProgress / 100,
          duration: 300,
          useNativeDriver: false,
          easing: Easing.out(Easing.ease),
        }).start();
      }
      
      // Determine if the bar should be visible
      const shouldBeVisible = !isNetworkOnline || (status && (status.pendingCount > 0 || status.isSyncing || status.failedCount > 0));
      
      if (shouldBeVisible !== isVisible) {
        setIsVisible(shouldBeVisible);
        animateVisibility(shouldBeVisible);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      // Default to online if we can't check
      setIsOnline(true);
    }
  };

  // Animate the bar's visibility
  const animateVisibility = (visible: boolean) => {
    Animated.timing(opacityAnim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start();
  };

  // Animate the sync icon when syncing
  const animateSyncIcon = () => {
    Animated.loop(
      Animated.timing(syncIconAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    ).start();
  };

  // Stop sync icon animation
  const stopSyncAnimation = () => {
    syncIconAnim.setValue(0);
    syncIconAnim.stopAnimation();
  };

  // Handle manual sync
  const handleSync = async () => {
    if (syncStatus?.isSyncing) return;
    
    try {
      // Start sync
      await syncService.performFullSync({ forceSync: true });
      
      // Check status after sync
      await checkStatus();
      
      // Notify parent component
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error) {
      console.error('Error during manual sync:', error);
      await checkStatus();
    }
  };

  // Handle retry for failed items
  const handleRetryFailed = async () => {
    if (syncStatus?.isSyncing) return;
    
    try {
      // Reset failed items
      await syncQueueService.resetFailedSyncItems();
      
      // Start sync
      await syncService.performFullSync({ forceSync: true });
      
      // Check status after sync
      await checkStatus();
    } catch (error) {
      console.error('Error during retry sync:', error);
      await checkStatus();
    }
  };

  // Set up listeners
  useEffect(() => {
    // Initial check
    checkStatus();
    
    // Set up sync status listener
    const unsubscribeSyncStatus = syncService.addSyncStatusListener((status) => {
      setSyncStatus(status);
      
      // Update progress animation
      Animated.timing(progressAnim, {
        toValue: status.syncProgress / 100,
        duration: 300,
        useNativeDriver: false,
        easing: Easing.out(Easing.ease),
      }).start();
      
      // Start or stop sync animation
      if (status.isSyncing) {
        animateSyncIcon();
      } else {
        stopSyncAnimation();
      }
    });
    
    // Set up network listener
    const unsubscribeNetwork = offlineStorage.setupNetworkListener(async () => {
      await checkStatus();
    });
    
    // Check status every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    
    return () => {
      unsubscribeSyncStatus();
      unsubscribeNetwork();
      clearInterval(interval);
    };
  }, []);

  // Format last sync time
  const formatLastSync = () => {
    const lastSyncTime = syncStatus?.lastSuccessfulSync;
    if (!lastSyncTime) return 'Never synced';
    
    const now = new Date();
    const lastSync = new Date(lastSyncTime);
    const diffMs = now.getTime() - lastSync.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Rotate animation for sync icon
  const rotateInterpolation = syncIconAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Progress bar width interpolation
  const progressWidthInterpolation = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // If not visible and no pending items, don't render anything
  if (!isVisible && isOnline && (!syncStatus || (syncStatus.pendingCount === 0 && syncStatus.failedCount === 0))) {
    return null;
  }

  // Determine container style based on status
  const getContainerStyle = () => {
    if (!isOnline) {
      return styles.offlineContainer;
    }
    if (syncStatus?.failedCount && syncStatus.failedCount > 0) {
      return styles.errorContainer;
    }
    if (syncStatus?.isSyncing) {
      return styles.syncingContainer;
    }
    if (syncStatus?.pendingCount && syncStatus.pendingCount > 0) {
      return styles.pendingContainer;
    }
    return styles.onlineContainer;
  };

  return (
    <Animated.View 
      style={[
        styles.container, 
        getContainerStyle(),
        { opacity: opacityAnim }
      ]}
    >
      {/* Status indicator */}
      <View style={styles.statusSection}>
        <Ionicons 
          name={
            !isOnline ? "cloud-offline" : 
            syncStatus?.failedCount && syncStatus.failedCount > 0 ? "alert-circle" :
            syncStatus?.isSyncing ? "sync" : "cloud-done"
          } 
          size={16} 
          color={
            !isOnline ? colors.error : 
            syncStatus?.failedCount && syncStatus.failedCount > 0 ? colors.error :
            syncStatus?.isSyncing ? colors.primary : colors.success
          } 
        />
        <Text style={styles.statusText}>
          {!isOnline ? 'Offline' : 
           syncStatus?.failedCount && syncStatus.failedCount > 0 ? 'Sync Failed' :
           syncStatus?.isSyncing ? 'Syncing...' : 'Online'}
        </Text>
      </View>
      
      {/* Pending changes indicator */}
      {syncStatus && (syncStatus.pendingCount > 0 || syncStatus.failedCount > 0) && (
        <View style={styles.pendingSection}>
          {syncStatus.pendingCount > 0 && (
            <>
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>
                  {syncStatus.pendingCount}
                </Text>
              </View>
              <Text style={styles.pendingText}>
                {syncStatus.pendingCount === 1 ? 'change pending' : 'changes pending'}
              </Text>
            </>
          )}
          
          {syncStatus.failedCount > 0 && (
            <>
              <View style={[styles.badgeContainer, styles.errorBadge]}>
                <Text style={styles.badgeText}>
                  {syncStatus.failedCount}
                </Text>
              </View>
              <Text style={styles.errorText}>
                {syncStatus.failedCount === 1 ? 'sync failed' : 'syncs failed'}
              </Text>
              <TouchableOpacity 
                style={styles.retryButton} 
                onPress={handleRetryFailed}
                disabled={!isOnline || syncStatus.isSyncing}
                activeOpacity={0.7}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
      
      {/* Sync section */}
      <View style={styles.syncSection}>
        <Text style={styles.syncText}>
          {formatLastSync()}
        </Text>
        
        <TouchableOpacity 
          style={[
            styles.syncButton,
            !isOnline && styles.disabledButton
          ]} 
          onPress={handleSync}
          disabled={!isOnline || (syncStatus?.isSyncing || false)}
          activeOpacity={0.7}
        >
          {syncStatus?.isSyncing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Animated.View style={{ transform: [{ rotate: rotateInterpolation }] }}>
                <Ionicons name="sync" size={14} color={colors.white} />
              </Animated.View>
              <Text style={styles.syncButtonText}>Sync</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Progress bar for sync */}
      {syncStatus?.isSyncing && (
        <Animated.View 
          style={[
            styles.progressBar,
            { width: progressWidthInterpolation }
          ]}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 5,
    marginBottom: 2,
    borderRadius: borderRadius.md,
    ...shadows.md,
    position: 'relative',
    overflow: 'hidden',
  },
  offlineContainer: {
    backgroundColor: `${colors.error}15`,
    borderColor: colors.error,
  },
  onlineContainer: {
    backgroundColor: `${colors.success}15`,
    borderColor: colors.success,
  },
  pendingContainer: {
    backgroundColor: `${colors.warning}15`,
    borderColor: colors.warning,
  },
  syncingContainer: {
    backgroundColor: `${colors.primary}15`,
    borderColor: colors.primary,
  },
  errorContainer: {
    backgroundColor: `${colors.error}15`,
    borderColor: colors.error,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  pendingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    flex: 1,
  },
  badgeContainer: {
    backgroundColor: colors.warning,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 1,
  },
  errorBadge: {
    backgroundColor: colors.error,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  pendingText: {
    marginLeft: 6,
    fontSize: 13,
    color: colors.text,
  },
  errorText: {
    marginLeft: 6,
    fontSize: 13,
    color: colors.error,
  },
  syncSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncText: {
    fontSize: 12,
    color: colors.text,
    marginRight: 8,
  },
  syncButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: colors.border,
  },
  syncButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  retryButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: colors.primary,
  },
});

export default OfflineStatusBar; 