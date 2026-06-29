import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { Database } from './database.types';

const memoryStorage: Record<string, string> = {};

const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') return memoryStorage[key] || null;
      const SecureStore = require('expo-secure-store');
      return await SecureStore.getItemAsync(key);
    } catch {
      return memoryStorage[key] || null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (Platform.OS === 'web') { memoryStorage[key] = value; return; }
      const SecureStore = require('expo-secure-store');
      await SecureStore.setItemAsync(key, value);
    } catch {
      memoryStorage[key] = value;
    }
  },
  removeItem: async (key: string) => {
    try {
      if (Platform.OS === 'web') { delete memoryStorage[key]; return; }
      const SecureStore = require('expo-secure-store');
      await SecureStore.deleteItemAsync(key);
    } catch {
      delete memoryStorage[key];
    }
  },
};

const SUPABASE_URL = 'https://ielnxqgbvglrdiolwqlt.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllbG54cWdidmdscmRpb2x3cWx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MjY0NDYsImV4cCI6MjA5ODEwMjQ0Nn0.uKCuWXRzVD-yToiDAPRfqHQJJWRKm_KjvxjOycOhzxY';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
