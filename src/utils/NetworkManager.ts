import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import syncQueueService from '../services/syncQueueService';

// Network state listener singleton
let globalNetworkListeners: ((isConnected: boolean) => void)[] = [];
let currentNetworkState: boolean | null = null;

/**
 * Initialize network status listener
 */
export const initNetworkListener = (): () => void => {
  // Subscribe to network state changes
  const unsubscribe = NetInfo.addEventListener(state => {
    const isConnected = Boolean(state.isConnected && state.isInternetReachable);
    
    // Check if state has changed
    if (currentNetworkState !== isConnected) {
      currentNetworkState = isConnected;
      
      // Notify all listeners
      globalNetworkListeners.forEach(listener => listener(isConnected));
      
      // If we're back online, try to sync
      if (isConnected) {
        console.log('Network connection restored, triggering sync...');
        syncQueueService.synchronizeBudgets(true).catch(error => {
          console.error('Error syncing after reconnection:', error);
        });
      }
    }
  });
  
  return unsubscribe;
};

/**
 * Add a network state change listener
 * @param listener Function to call when network state changes
 * @returns Function to remove the listener
 */
export const addNetworkListener = (listener: (isConnected: boolean) => void): () => void => {
  globalNetworkListeners.push(listener);
  
  // If we already have a network state, call the listener immediately
  if (currentNetworkState !== null) {
    listener(currentNetworkState);
  }
  
  // Return a function to remove the listener
  return () => {
    globalNetworkListeners = globalNetworkListeners.filter(l => l !== listener);
  };
};

/**
 * React hook to get and subscribe to network status
 * @returns Current network connection status
 */
export const useNetworkStatus = (): boolean => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  
  useEffect(() => {
    // Check current status
    const checkStatus = async () => {
      try {
        const state = await NetInfo.fetch();
        setIsConnected(Boolean(state.isConnected && state.isInternetReachable));
      } catch (error) {
        console.error('Error checking network status:', error);
      }
    };
    
    checkStatus();
    
    // Subscribe to changes
    const removeListener = addNetworkListener(setIsConnected);
    
    // Cleanup
    return removeListener;
  }, []);
  
  return isConnected;
};

export default {
  initNetworkListener,
  addNetworkListener,
  useNetworkStatus,
}; 