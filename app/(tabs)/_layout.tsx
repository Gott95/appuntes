import { Tabs } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import CustomTabBar from '@/components/CustomTabBar';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Registro',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="analysis"
        options={{
          title: 'Análisis',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="installments"
        options={{
          title: 'Cuotas',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="household"
        options={{
          title: 'Hogar',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}
