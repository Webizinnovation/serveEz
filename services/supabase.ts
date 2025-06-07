import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://njkllbogrrqwxxgmsmyr.supabase.co';
// process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qa2xsYm9ncnJxd3h4Z21zbXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxMTk2OTcsImV4cCI6MjA1NDY5NTY5N30.QLTT9epGNRGtq7Y3GcqzStjhuDIlMZh2QbOStu8tKz4';
// process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const webStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(key);
      }
      return null;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch {}
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});

/**
 * Removes all active Supabase realtime subscriptions
 * Call this function during logout to prevent subscription errors
 */
export const removeAllSubscriptions = () => {
  try {
    // Get all channels from Supabase
    const allChannels = supabase.getChannels();
    
    // Remove each channel
    allChannels.forEach(channel => {
      if (channel) {
        console.log(`Removing channel: ${channel.topic}`);
        supabase.removeChannel(channel);
      }
    });
    
    console.log(`Cleaned up ${allChannels.length} Supabase channels`);
  } catch (error) {
    console.error('Error removing Supabase subscriptions:', error);
  }
}; 