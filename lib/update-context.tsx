import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import Constants from 'expo-constants';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface UpdateContextType {
  hasUpdate: boolean;
  latestBuildUrl: string;
  latestBuildNotes: string;
  currentBuild: string;
  latestBuild: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const UpdateContext = createContext<UpdateContextType>({
  hasUpdate: false,
  latestBuildUrl: '',
  latestBuildNotes: '',
  currentBuild: '1',
  latestBuild: '1',
  loading: false,
  error: null,
  refresh: async () => {},
});

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestBuildUrl, setLatestBuildUrl] = useState('');
  const [latestBuildNotes, setLatestBuildNotes] = useState('');
  const [latestBuild, setLatestBuild] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentBuild = String(
    (Constants as any).expoConfig?.android?.versionCode ||
    (Constants as any).expoConfig?.version ||
    '1'
  );

  const checkForUpdate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const snap = await getDoc(doc(db, 'app_config', 'update'));
      if (!snap.exists()) {
        setHasUpdate(false);
        return;
      }

      const data = snap.data();
      const latest = String(data.latest_build || '1');
      setLatestBuild(latest);
      setLatestBuildUrl(data.latest_build_url || '');
      setLatestBuildNotes(data.latest_build_notes || '');

      const latestNum = parseInt(latest, 10);
      const currentNum = parseInt(currentBuild, 10);

      if (isNaN(latestNum) || isNaN(currentNum)) {
        setHasUpdate(false);
      } else {
        setHasUpdate(latestNum > currentNum);
      }
    } catch (e) {
      setError('No se pudo verificar actualizaciones');
      setHasUpdate(false);
    } finally {
      setLoading(false);
    }
  }, [currentBuild]);

  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  return (
    <UpdateContext.Provider
      value={{ hasUpdate, latestBuildUrl, latestBuildNotes, currentBuild, latestBuild, loading, error, refresh: checkForUpdate }}
    >
      {children}
    </UpdateContext.Provider>
  );
}

export function useAppUpdate() {
  return useContext(UpdateContext);
}
