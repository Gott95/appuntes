import React, { useEffect } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '@/lib/theme';

interface SkeletonBlockProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

function SkeletonBlock({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonBlockProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withDelay(
        Math.random() * 200,
        withTiming(0.7, {
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
        })
      ),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: Colors.light.surfaceVariant,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function AnalysisSkeleton() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: 52 }]}>
        <SkeletonBlock width={140} height={28} borderRadius={6} style={{ opacity: 1, backgroundColor: colors.surface + '30' }} />
        <SkeletonBlock width={220} height={14} borderRadius={4} style={{ opacity: 1, backgroundColor: colors.surface + '20', marginTop: 8 }} />
      </View>

      {/* Comparison Card Skeleton */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <SkeletonBlock width={180} height={12} borderRadius={4} />
        <View style={styles.comparisonRow}>
          <View style={styles.comparisonItem}>
            <SkeletonBlock width={70} height={10} borderRadius={4} />
            <SkeletonBlock width={100} height={20} borderRadius={6} style={{ marginTop: 8 }} />
          </View>
          <SkeletonBlock width={28} height={28} borderRadius={14} />
          <View style={styles.comparisonItem}>
            <SkeletonBlock width={70} height={10} borderRadius={4} />
            <SkeletonBlock width={100} height={20} borderRadius={6} style={{ marginTop: 8 }} />
          </View>
        </View>
        <SkeletonBlock width="60%" height={14} borderRadius={4} style={{ alignSelf: 'center' }} />
      </View>

      {/* Chart Skeleton */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <SkeletonBlock width={120} height={16} borderRadius={4} />
        <SkeletonBlock width={160} height={10} borderRadius={4} style={{ marginTop: 4, marginBottom: 16 }} />
        <View style={styles.chartSkeleton}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={styles.chartBarGroup}>
              <SkeletonBlock width={24} height={60 + Math.random() * 80} borderRadius={6} />
              <SkeletonBlock width={24} height={40 + Math.random() * 60} borderRadius={6} />
            </View>
          ))}
        </View>
        <View style={styles.legendRow}>
          <SkeletonBlock width={50} height={10} borderRadius={4} />
          <SkeletonBlock width={50} height={10} borderRadius={4} />
        </View>
      </View>

      {/* Monthly Breakdown Skeleton */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <SkeletonBlock width={120} height={16} borderRadius={4} style={{ marginBottom: 16 }} />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={styles.listItem}>
            <View style={{ flex: 1 }}>
              <SkeletonBlock width={120} height={14} borderRadius={4} />
              <SkeletonBlock width={180} height={10} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <SkeletonBlock width={80} height={16} borderRadius={4} />
              <SkeletonBlock width={90} height={10} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 22,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  card: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  comparisonItem: {
    alignItems: 'center',
  },
  chartSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 160,
    alignItems: 'flex-end',
  },
  chartBarGroup: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'flex-end',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 12,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
});
