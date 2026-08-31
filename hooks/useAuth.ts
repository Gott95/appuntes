import { useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export interface UserProfile {
  id: string;
  email: string;
  has_set_password: boolean;
  monthly_budget: number;
  created_at: string;
}

const DEFAULT_FIXED_CATEGORIES = [
  { name: 'Suscripciones Stream', icon: '📺' },
  { name: 'Suscripciones IA', icon: '🤖' },
  { name: 'Cuotas Bancarias', icon: '🏦' },
  { name: 'Servicios Casa', icon: '🏠' },
  { name: 'Internet/Phone', icon: '📱' },
  { name: 'Seguros', icon: '🛡️' },
  { name: 'Otro Fijo', icon: '📦' },
];

const DEFAULT_VARIABLE_CATEGORIES = [
  { name: 'Comida', icon: '🍔' },
  { name: 'Gasolina', icon: '⛽' },
  { name: 'Cerveza/Alcohol', icon: '🍺' },
  { name: 'Cigarros', icon: '🚬' },
  { name: 'Ropa', icon: '👕' },
  { name: 'Salud', icon: '💊' },
  { name: 'Entretenimiento', icon: '🎮' },
  { name: 'Transporte', icon: '🚌' },
  { name: 'Otro Variable', icon: '📦' },
];

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureProfile = useCallback(async (userId: string, email: string) => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      setProfile(userSnap.data() as UserProfile);
      return;
    }

    const newProfile: UserProfile = {
      id: userId,
      email,
      has_set_password: false,
      monthly_budget: 0,
      created_at: new Date().toISOString(),
    };

    try {
      await setDoc(userRef, newProfile);

      const batch = writeBatch(db);

      DEFAULT_FIXED_CATEGORIES.forEach((cat) => {
        const catRef = doc(collection(db, 'users', userId, 'categories'));
        batch.set(catRef, {
          user_id: userId,
          name: cat.name,
          type: 'fixed',
          icon: cat.icon,
          is_default: true,
          created_at: new Date().toISOString(),
        });
      });

      DEFAULT_VARIABLE_CATEGORIES.forEach((cat) => {
        const catRef = doc(collection(db, 'users', userId, 'categories'));
        batch.set(catRef, {
          user_id: userId,
          name: cat.name,
          type: 'variable',
          icon: cat.icon,
          is_default: true,
          created_at: new Date().toISOString(),
        });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error creating profile:', error);
    }

    setProfile(newProfile);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await ensureProfile(firebaseUser.uid, firebaseUser.email || '');
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ensureProfile]);

  const signIn = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result;
  };

  const signUp = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result;
  };

  const setPassword = async (newPassword: string) => {
    if (!user) throw new Error('No user logged in');
    await updatePassword(user, newPassword);
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { has_set_password: true });
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  };

  const getUserName = (): string => {
    if (!profile?.email) return '';
    const localPart = profile.email.split('@')[0];
    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  };

  return {
    session: user ? { user } : null,
    user,
    profile,
    loading,
    signIn,
    signUp,
    setPassword,
    signOut,
    getUserName,
    refreshProfile: () => {
      if (user) ensureProfile(user.uid, user.email || '');
    },
  };
}
