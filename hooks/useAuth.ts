import { useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureProfile = useCallback(async (userId: string, email: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data as unknown as UserProfile);
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: userId, email, has_set_password: false } as any);

    if (profileError) {
      setProfile({ id: userId, email, has_set_password: false, monthly_budget: 0, created_at: new Date().toISOString() });
      return;
    }

    const cats = [
      ...DEFAULT_FIXED_CATEGORIES.map((c) => ({
        user_id: userId,
        name: c.name,
        type: 'fixed' as const,
        icon: c.icon,
        is_default: true,
      })),
      ...DEFAULT_VARIABLE_CATEGORIES.map((c) => ({
        user_id: userId,
        name: c.name,
        type: 'variable' as const,
        icon: c.icon,
        is_default: true,
      })),
    ];

    await supabase.from('categories').insert(cats as any);
    setProfile({ id: userId, email, has_set_password: false, monthly_budget: 0, created_at: new Date().toISOString() });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        ensureProfile(session.user.id, session.user.email || '');
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        ensureProfile(session.user.id, session.user.email || '');
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [ensureProfile]);

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  const setPassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    if (session?.user) {
      await (supabase as any)
        .from('profiles')
        .update({ has_set_password: true })
        .eq('id', session.user.id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  const getUserName = (): string => {
    if (!profile?.email) return '';
    const localPart = profile.email.split('@')[0];
    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  };

  return {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signIn,
    signUp,
    setPassword,
    signOut,
    getUserName,
    refreshProfile: () => {
      if (session?.user) ensureProfile(session.user.id, session.user.email || '');
    },
  };
}
