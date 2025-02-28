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
import { colors, shadows, borderRadius } from '../utils/theme';

interface OfflineStatusBarProps {
  onSyncComplete?: () => void;
}

const OfflineStatusBar: React.FC<OfflineStatusBarProps> = ({ onSyncComplete }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  
  // Animation values
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const syncIconAnim = useRef(new Animated.Value(0)).current;

  // Check online status and pending sync items
  const checkStatus = async () => {
    try {
      const online = await offlineStorage.isOnline();
      setIsOnline(online);
      
      const pendingItems = await offlineStorage.getPendingSync();
      setPendingCount(pendingItems.length);
      
      const lastSync = await offlineStorage.getLastSync();
      setLastSyncTime(lastSync);
      
      // Determine if the bar should be visible
      const shouldBeVisible = !online || pendingItems.length > 0;
      
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
    if (isSyncing) return;
    
    setIsSyncing(true);
    animateSyncIcon();
    
    try {
      await syncService.performFullSync();
      await checkStatus();
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error) {
      console.error('Error during manual sync:', error);
    } finally {
      setIsSyncing(false);
      stopSyncAnimation();
    }
  };

  // Set up network listener
  useEffect(() => {
    // Initial check
    checkStatus();
    
    // Set up listener for network changes
    let unsubscribe = () => {};
    try {
      unsubscribe = offlineStorage.setupNetworkListener(async () => {
        await checkStatus();
      });
    } catch (error) {
      console.error('Error setting up network listener:', error);
    }
    
    // Check status every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Format last sync time
  const formatLastSync = () => {
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

  // If not visible, don't render anything
  if (!isVisible && isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container, 
        isOnline ? styles.onlineContainer : styles.offlineContainer,
        { opacity: opacityAnim }
      ]}
    >
      <View style={styles.statusSection}>
        <Ionicons 
          name={isOnline ? "cloud-done" : "cloud-offline"} 
          size={16} 
          color={isOnline ? colors.success : colors.error} 
        />
        <Text style={styles.statusText}>
          {isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>
      
      {pendingCount > 0 && (
        <View style={styles.pendingSection}>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>
              {pendingCount}
            </Text>
          </View>
          <Text style={styles.pendingText}>
            {pendingCount === 1 ? 'change pending' : 'changes pending'}
          </Text>
        </View>
      )}
      
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
          disabled={!isOnline || isSyncing}
          activeOpacity={0.7}
        >
          {isSyncing ? (
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
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 10,
    borderRadius: borderRadius.md,
    ...shadows.md,
  },
  offlineContainer: {
    backgroundColor: `${colors.error}15`,
    borderColor: colors.error,
  },
  onlineContainer: {
    backgroundColor: `${colors.warning}15`,
    borderColor: colors.warning,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 4,
    fontWeight: '500',
    fontSize: 12,
    color: colors.text,
  },
  pendingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContainer: {
    backgroundColor: colors.error,
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  pendingText: {
    fontWeight: '500',
    fontSize: 12,
    color: colors.text,
  },
  syncSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncText: {
    marginRight: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  disabledButton: {
    backgroundColor: colors.textSecondary,
    opacity: 0.7,
  },
  syncButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default OfflineStatusBar; 