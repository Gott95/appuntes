import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/lib/theme';
import { useAppUpdate } from '@/lib/update-context';

const ICONS: Record<string, string> = {
  index: '🏠',
  transactions: '📋',
  analysis: '📊',
  installments: '💳',
  household: '👥',
  settings: '⚙️',
};

function TabItem({
  name,
  label,
  isActive,
  onPress,
  colors,
  showBadge,
}: {
  name: string;
  label: string;
  isActive: boolean;
  onPress: () => void;
  colors: typeof Colors.light;
  showBadge?: boolean;
}) {
  const scale = useSharedValue(1);
  const dropY = useSharedValue(0);
  const dropOpacity = useSharedValue(0);
  const dropScale = useSharedValue(0);
  const [ripples, setRipples] = useState<{ id: number }[]>([]);

  useEffect(() => {
    if (isActive) {
      scale.value = withSequence(
        withTiming(1.2, { duration: 150, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) })
      );
      dropY.value = 0;
      dropOpacity.value = 1;
      dropScale.value = 0;
      dropY.value = withSequence(
        withTiming(-20, { duration: 180, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 300, easing: Easing.bounce })
      );
      dropOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withDelay(350, withTiming(0, { duration: 200 }))
      );
      dropScale.value = withSequence(
        withDelay(200, withTiming(1.5, { duration: 150, easing: Easing.out(Easing.cubic) })),
        withDelay(200, withTiming(0, { duration: 100 }))
      );
      const id = Date.now();
      setRipples((prev) => [...prev, { id }]);
      setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
    }
  }, [isActive]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: dropY.value }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dropScale.value }],
    opacity: dropOpacity.value,
  }));

  return (
    <Pressable style={styles.tabItem} onPress={onPress}>
      <View style={styles.tabIconWrap}>
        <Animated.View style={iconStyle}>
          <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
            {ICONS[name] || '📦'}
          </Text>
        </Animated.View>
        {showBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>!</Text>
          </View>
        )}
        {ripples.map((r) => (
          <Animated.View
            key={r.id}
            style={[styles.ripple, rippleStyle, { backgroundColor: colors.primary + '18' }]}
            pointerEvents="none"
          />
        ))}
      </View>
      <Animated.View
        style={[
          styles.tabLabelWrap,
          isActive && { backgroundColor: colors.primary + '12' },
        ]}
      >
        <Text
          style={[
            styles.tabLabel,
            { color: isActive ? colors.primary : colors.textTertiary },
            isActive && styles.tabLabelActive,
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function CustomTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { hasUpdate } = useAppUpdate();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}
    >
      <View style={styles.tabsRow}>
        {state.routes.map((route, index) => {
          const isActive = state.index === index;
          const label = descriptors[route.key]?.options?.title || route.name;
          return (
            <TabItem
              key={route.key}
              name={route.name}
              label={label}
              isActive={isActive}
              onPress={() => navigation.navigate(route.name)}
              colors={colors}
              showBadge={route.name === 'settings' && hasUpdate}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tabIconWrap: {
    height: 32,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  tabIcon: {
    fontSize: 22,
  },
  tabIconActive: {
    fontSize: 26,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.light.surface,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
  },
  ripple: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  tabLabelWrap: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
});
