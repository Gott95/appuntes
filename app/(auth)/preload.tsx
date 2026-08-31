import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/lib/auth-context';
import { Colors } from '@/lib/theme';
import { getCurrentMonth, getMonthRange } from '@/lib/utils';
import { getMonthlyBudget, calculateAndAdjustBudgets } from '@/lib/budget';
import { getSavingsGoals } from '@/lib/savings';
import { getMonthlyInstallmentsTotal, getAllPlansWithPayments } from '@/lib/installments';

export default function PreloadScreen() {
  const { user } = useAuthContext();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const [status, setStatus] = useState('Cargando datos...');
  const fadeAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.8))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    preloadData();
  }, []);

  const preloadData = async () => {
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    const { month, year } = getCurrentMonth();
    const { startDate, endDate } = getMonthRange(month, year);

    try {
      setStatus('Cargando perfil...');
      await new Promise((r) => setTimeout(r, 300));

      setStatus('Cargando salario...');
      const salaryRef = collection(db, 'users', user.uid, 'salaryEntries');
      const salaryQ = query(
        salaryRef,
        where('month', '==', month),
        where('year', '==', year)
      );
      await getDocs(salaryQ);
      await new Promise((r) => setTimeout(r, 200));

      setStatus('Cargando gastos fijos...');
      const expensesRef = collection(db, 'users', user.uid, 'fixedExpenses');
      const expensesQ = query(expensesRef, where('is_active', '==', true));
      await getDocs(expensesQ);
      await new Promise((r) => setTimeout(r, 200));

      setStatus('Cargando transacciones...');
      const transRef = collection(db, 'users', user.uid, 'transactions');
      const transQ = query(
        transRef,
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      await getDocs(transQ);
      await new Promise((r) => setTimeout(r, 200));

      setStatus('Cargando categorías...');
      const catsRef = collection(db, 'users', user.uid, 'categories');
      await getDocs(catsRef);
      await new Promise((r) => setTimeout(r, 200));

      setStatus('Cargando presupuesto...');
      const budget = await getMonthlyBudget(user.uid);
      if (budget > 0) {
        await calculateAndAdjustBudgets(user.uid, month, year, budget);
      }
      await new Promise((r) => setTimeout(r, 200));

      setStatus('Cargando metas de ahorro...');
      await getSavingsGoals(user.uid);
      await new Promise((r) => setTimeout(r, 200));

      setStatus('Cargando cuotas...');
      await Promise.all([
        getMonthlyInstallmentsTotal(user.uid, month, year),
        getAllPlansWithPayments(user.uid),
      ]);

      setStatus('¡Listo!');
      await new Promise((r) => setTimeout(r, 400));

      router.replace('/(tabs)');
    } catch {
      setStatus('Cargando...');
      await new Promise((r) => setTimeout(r, 500));
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.primary }]}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={styles.logo}>💰</Text>
        <Text style={styles.title}>AppUntes</Text>
        <Text style={styles.status}>{status}</Text>
        <View style={styles.dots}>
          <Animated.View style={[styles.dot, { opacity: fadeAnim }]} />
          <Animated.View style={[styles.dot, { opacity: fadeAnim }]} />
          <Animated.View style={[styles.dot, { opacity: fadeAnim }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    marginBottom: 12,
  },
  status: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginBottom: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
});
