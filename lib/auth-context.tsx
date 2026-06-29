import { createContext, useContext, ReactNode, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth as useAuthHook, UserProfile } from '@/hooks/useAuth';
import { Session, User } from '@supabase/supabase-js';

const TIMEOUT_MS = 5 * 60 * 1000;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  setPassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  getUserName: () => string;
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthHook();
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/active/) && nextState.match(/background/)) {
        backgroundTime.current = Date.now();
      }

      if (appState.current.match(/background/) && nextState.match(/active/)) {
        if (backgroundTime.current && auth.session) {
          const elapsed = Date.now() - backgroundTime.current;
          if (elapsed >= TIMEOUT_MS) {
            auth.signOut();
          }
        }
        backgroundTime.current = null;
      }

      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [auth.session]);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}
