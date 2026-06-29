import { useEffect, useState } from 'react';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

export function useOTAUpdates() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      if (__DEV__) return;

      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setUpdateAvailable(true);
        downloadUpdate();
      }
    } catch (e) {
      // silent
    }
  };

  const downloadUpdate = async () => {
    try {
      setIsDownloading(true);
      const update = await Updates.fetchUpdateAsync();
      if (update.isNew) {
        Alert.alert(
          'Actualización lista',
          'La app se reiniciará para aplicar los cambios.',
          [{ text: 'OK', onPress: () => Updates.reloadAsync() }]
        );
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo descargar la actualización.');
    } finally {
      setIsDownloading(false);
    }
  };

  return { updateAvailable, isDownloading, checkForUpdates, downloadUpdate };
}
