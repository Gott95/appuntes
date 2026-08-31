import { initializeApp, getApps, getApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyA5W7Jz-O7sq8gl0OxX1nDhqYZlkuFqM4E",
  authDomain: "appuntes-3b7fb.firebaseapp.com",
  projectId: "appuntes-3b7fb",
  storageBucket: "appuntes-3b7fb.firebasestorage.app",
  messagingSenderId: "186353173470",
  appId: "1:186353173470:android:b0a904d7132fed2396d34f"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth: Auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getReactNativePersistence } = require('firebase/auth');
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

const db = getFirestore(app);

export { app, auth, db };
