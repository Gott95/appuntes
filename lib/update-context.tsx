import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

interface UpdateContextType {
  hasUpdate: boolean;
  latestBuildUrl: string;
  latestBuildNotes: string;
  currentBuild: string;
  latestBuild: string;
  refresh: () => void;
}

const UpdateContext = createContext<UpdateContextType>({
  hasUpdate: false,
  latestBuildUrl: '',
  latestBuildNotes: '',
  currentBuild: '1',
  latestBuild: '1',
  refresh: () => {},
});

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestBuildUrl, setLatestBuildUrl] = useState('');
  const [latestBuildNotes, setLatestBuildNotes] = useState('');
  const [latestBuild, setLatestBuild] = useState('1');

  const currentBuild = String(
    (Constants as any).expoConfig?.android?.versionCode ||
    (Constants as any).expoConfig?.version ||
    '1'
  );

  const checkForUpdate = async () => {
    try {
      const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['latest_build', 'latest_build_url', 'latest_build_notes']);

      if (!data) return;

      const config: Record<string, string> = {};
      data.forEach((row: any) => {
        config[row.key] = row.value;
      });

      const latest = config.latest_build || '1';
      setLatestBuild(latest);
      setLatestBuildUrl(config.latest_build_url || '');
      setLatestBuildNotes(config.latest_build_notes || '');
      setHasUpdate(parseInt(latest) > parseInt(currentBuild));
    } catch {
      // silent
    }
  };

  useEffect(() => {
    checkForUpdate();
  }, []);

  return (
    <UpdateContext.Provider
      value={{ hasUpdate, latestBuildUrl, latestBuildNotes, currentBuild, latestBuild, refresh: checkForUpdate }}
    >
      {children}
    </UpdateContext.Provider>
  );
}

export function useAppUpdate() {
  return useContext(UpdateContext);
}
