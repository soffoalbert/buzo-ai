import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../api/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureRetrieveWithFallback } from '../services/authService';

interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface AuthState {
  user: User | null;
  session: any | null;
  loading: boolean;
  initialized: boolean;
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    initialized: false,
  });

  // Initialize auth state
  const initializeAuth = useCallback(async () => {
    try {
      // Get stored session and user data
      const [sessionData, userData] = await Promise.all([
        secureRetrieveWithFallback('session'),
        secureRetrieveWithFallback('auth_user')
      ]);

      if (sessionData && userData) {
        const session = JSON.parse(sessionData);
        const user = JSON.parse(userData);

        // Verify session with Supabase
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (currentSession) {
          setState({
            user,
            session: currentSession,
            loading: false,
            initialized: true,
          });
          return;
        }
      }

      // No valid session found
      setState({
        user: null,
        session: null,
        loading: false,
        initialized: true,
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      setState({
        user: null,
        session: null,
        loading: false,
        initialized: true,
      });
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    initializeAuth();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event);
        
        if (event === 'SIGNED_IN') {
          const user = session?.user ?? null;
          setState({
            user,
            session,
            loading: false,
            initialized: true,
          });
        } else if (event === 'SIGNED_OUT') {
          // Clear stored data
          await AsyncStorage.removeItem('userId');
          await AsyncStorage.removeItem('secure_session');
          await AsyncStorage.removeItem('secure_auth_user');
          
          setState({
            user: null,
            session: null,
            loading: false,
            initialized: true,
          });
        }
      }
    );

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [initializeAuth]);

  return {
    user: state.user,
    session: state.session,
    loading: state.loading,
    initialized: state.initialized,
    isAuthenticated: !!state.session && !!state.user,
  };
}; 