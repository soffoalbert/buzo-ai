import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { isOnline } from '../services/offlineStorage';
import syncService from '../services/syncService';
import { SyncStatus } from '../services/syncQueueService';
import { useInterval } from '../hooks/useInterval';

interface OfflineStatusBarProps {
  showSyncButton?: boolean;
  isLoading?: boolean;
}

/**
 * A status bar that shows the user's online/offline status and sync information
 */
const OfflineStatusBar: React.FC<OfflineStatusBarProps> = ({ 
  showSyncButton = true,
  isLoading = false
}) => {
  const theme = useTheme();
  const [online, setOnline] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Check online status and pending count every 10 seconds
  useInterval(() => {
    checkStatus();
  }, 10000);

  // Check status on mount and when sync status changes
  useEffect(() => {
    checkStatus();
    
    // Listen for sync status changes
    const unsubscribe = syncService.addSyncStatusListener((status) => {
      setSyncStatus(status);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Check online status and pending count
  const checkStatus = async () => {
    try {
      const isOnlineNow = await isOnline();
      setOnline(isOnlineNow);

      const count = await syncService.getPendingSyncCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  // Trigger manual sync
  const handleSync = () => {
    syncService.performFullSync({ showAlert: true });
  };

  // Always show when offline or loading offline data
  if (!online || isLoading || pendingCount > 0 || (syncStatus?.isSyncing)) {
    // Determine status text and color
    let statusText = '';
    let statusColor = '';

    if (isLoading) {
      // When explicitly loading data (usually from local storage)
      statusText = 'Loading data from offline storage...';
      statusColor = theme.colors.primary;
    } else if (!online) {
      // When offline
      statusText = 'You are offline. Using locally stored data.';
      statusColor = theme.colors.notification; // Usually orange/yellow
    } else if (syncStatus?.isSyncing) {
      // When syncing
      statusText = `Syncing... ${syncStatus.syncProgress}%`;
      statusColor = theme.colors.primary;
    } else if (pendingCount > 0) {
      // When there are pending changes
      statusText = `${pendingCount} change${pendingCount !== 1 ? 's' : ''} pending sync`;
      statusColor = theme.colors.text;
    }

  return (
      <View style={[styles.container, { backgroundColor: statusColor }]}>
        <View style={styles.content}>
          <Icon
          name={
              isLoading ? 'database' : 
              !online ? 'cloud-off-outline' : 
              syncStatus?.isSyncing ? 'cloud-sync' : 'cloud-alert'
            }
            size={20}
            color="#fff"
            style={styles.icon}
          />
          <Text style={styles.text}>{statusText}</Text>
          {(syncStatus?.isSyncing || isLoading) && (
            <ActivityIndicator size="small" color="#fff" style={styles.spinner} />
          )}
        </View>
        {showSyncButton && online && pendingCount > 0 && !syncStatus?.isSyncing && !isLoading && (
          <TouchableOpacity style={styles.syncButton} onPress={handleSync}>
            <Text style={styles.syncButtonText}>Sync Now</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Don't render anything when online and no pending changes
  return null;
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  spinner: {
    marginLeft: 8,
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    marginLeft: 8,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default OfflineStatusBar; 