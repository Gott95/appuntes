import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import 'react-native-reanimated';
import { AuthProvider, useAuthContext } from '@/lib/auth-context';
import { UpdateProvider } from '@/lib/update-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOTAUpdates } from '@/hooks/useOTAUpdates';

function RootLayoutNav() {
  const { session, profile, loading } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme();
  useOTAUpdates();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      if (profile && !profile.has_set_password) {
        router.replace('/(auth)/set-password');
      } else if (profile && profile.has_set_password) {
        router.replace('/(tabs)');
      }
    } else if (session && !inAuthGroup && profile && !profile.has_set_password) {
      router.replace('/(auth)/set-password');
    }
  }, [session, profile, loading, segments, router]);

  if (loading) {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar hidden />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="installment/[id]" options={{ headerShown: false }} />
        </Stack>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar hidden />
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="installment/[id]" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <UpdateProvider>
        <RootLayoutNav />
      </UpdateProvider>
    </AuthProvider>
  );
}
