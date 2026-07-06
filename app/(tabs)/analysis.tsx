import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Modal,
  useColorScheme,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BarChart } from 'react-native-chart-kit';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/lib/auth-context';
import { Colors } from '@/lib/theme';
import { AnalysisSkeleton } from '@/components/AnalysisSkeleton';
import {
  formatCurrency,
  getMonthFullName,
  getMonthName,
  getMonthRange,
  getLast6Months,
} from '@/lib/utils';
import { getMonthlyPaidInstallments } from '@/lib/installments';

interface MonthData {
  month: number;
  year: number;
  salary: number;
  fixedExpenses: number;
  variableExpenses: number;
  income: number;
  paidInstallments: number;
  totalExpenses: number;
  balance: number;
}

interface TransactionDetail {
  id: string;
  amount: number;
  description: string;
  type: string;
  date: string;
  categories: { name: string; icon: string } | null;
}

interface FixedDetail {
  id: string;
  name: string;
  amount: number;
  categories: { name: string; icon: string } | null;
}

interface CategoryBreakdown {
  name: string;
  icon: string;
  total: number;
}

export default function AnalysisScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);
  const [monthsData, setMonthsData] = useState<MonthData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<MonthData | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailTransactions, setDetailTransactions] = useState<TransactionDetail[]>([]);
  const [detailFixed, setDetailFixed] = useState<FixedDetail[]>([]);
  const [detailCategories, setDetailCategories] = useState<CategoryBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const screenWidth = Dimensions.get('window').width;

  const fetchAllMonths = useCallback(async () => {
    if (!user) return;

    const last6 = getLast6Months();

    const monthPromises = last6.map(async ({ month, year }) => {
      const { startDate, endDate } = getMonthRange(month, year);

      const [salaryRes, fixedRes, transRes] = await Promise.all([
        supabase
          .from('salary_entries')
          .select('amount')
          .eq('user_id', user.id),
        supabase
          .from('fixed_expenses')
          .select('amount')
          .eq('user_id', user.id)
          .eq('is_active', true),
        supabase
          .from('transactions')
          .select('amount, type')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate),
      ]);

      const salary = (salaryRes.data || []).reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
      const fixedExpenses = (fixedRes.data || []).reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
      const variableExpenses = (transRes.data || [])
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      const income = (transRes.data || [])
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
      const paidInstallments = await getMonthlyPaidInstallments(user.id, month, year);
      const totalExpenses = fixedExpenses + variableExpenses;
      const balance = salary - totalExpenses + income - paidInstallments;

      return {
        month,
        year,
        salary,
        fixedExpenses,
        variableExpenses,
        income,
        paidInstallments,
        totalExpenses,
        balance,
      };
    });

    const results = await Promise.all(monthPromises);
    setMonthsData(results);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchAllMonths();
    }, [fetchAllMonths])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllMonths();
    setRefreshing(false);
  };

  const handleBarPress = async (index: number) => {
    const monthData = monthsData[index];
    setSelectedMonth(monthData);

    if (!user) return;

    const { startDate, endDate } = getMonthRange(monthData.month, monthData.year);

    const [transRes, fixedRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, categories(name, icon)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false }),
      supabase
        .from('fixed_expenses')
        .select('*, categories(name, icon)')
        .eq('user_id', user.id)
        .eq('is_active', true),
    ]);

    const transactions = (transRes.data || []) as TransactionDetail[];
    setDetailTransactions(transactions);
    setDetailFixed((fixedRes.data || []) as FixedDetail[]);

    const categoryMap = new Map<string, { name: string; icon: string; total: number }>();
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      const key = t.categories?.name || 'Otros';
      const existing = categoryMap.get(key);
      if (existing) {
        existing.total += t.amount;
      } else {
        categoryMap.set(key, {
          name: t.categories?.name || 'Otros',
          icon: t.categories?.icon || '📦',
          total: t.amount,
        });
      }
    }
    const sorted = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);
    setDetailCategories(sorted);

    setShowDetail(true);
  };

  const chartData = {
    labels: monthsData.map((m) => getMonthName(m.month)),
    datasets: [
      {
        data: monthsData.map((m) => m.totalExpenses || 0),
        color: () => colors.expense,
      },
      {
        data: monthsData.map((m) => m.salary || 0),
        color: () => colors.income,
      },
    ],
    legend: ['Gastos', 'Salario'],
  };

  const comparison = monthsData.length >= 2
    ? {
        current: monthsData[monthsData.length - 1],
        previous: monthsData[monthsData.length - 2],
        diff: monthsData[monthsData.length - 1].balance - monthsData[monthsData.length - 2].balance,
        savingMore: monthsData[monthsData.length - 1].balance > monthsData[monthsData.length - 2].balance,
      }
    : null;

  if (loading) {
    return <AnalysisSkeleton />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: 52 }]}>
        <Text style={[styles.headerTitle, { color: colors.surface }]}>Análisis</Text>
        <Text style={[styles.headerSub, { color: colors.surface + 'bf' }]}>Comparativa de los últimos 6 meses</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Comparison Card */}
        {comparison && (
          <View style={[styles.comparisonCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.comparisonTitle, { color: colors.textSecondary }]}>Comparación con mes anterior</Text>
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonItem}>
                <Text style={[styles.comparisonLabel, { color: colors.textTertiary }]}>Mes actual</Text>
                <Text style={[styles.comparisonValue, { color: colors.text }]}>
                  {formatCurrency(comparison.current.balance)}
                </Text>
              </View>
              <Text style={styles.comparisonArrow}>
                {comparison.savingMore ? '📈' : '📉'}
              </Text>
              <View style={styles.comparisonItem}>
                <Text style={[styles.comparisonLabel, { color: colors.textTertiary }]}>Mes anterior</Text>
                <Text style={[styles.comparisonValue, { color: colors.text }]}>
                  {formatCurrency(comparison.previous.balance)}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.comparisonDiff,
                { color: comparison.savingMore ? colors.income : colors.expense },
              ]}
            >
              {comparison.savingMore ? '↑' : '↓'}{' '}
              {formatCurrency(Math.abs(comparison.diff))}{' '}
              {comparison.savingMore ? 'más' : 'menos'} que el mes anterior
            </Text>
          </View>
        )}

        {/* Bar Chart */}
        {monthsData.length > 0 && (
          <View style={[styles.chartContainer, { backgroundColor: colors.surface }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Salario vs Gastos</Text>
            <Text style={[styles.chartHint, { color: colors.textTertiary }]}>Toca una barra para ver el detalle</Text>
            <BarChart
              data={chartData}
              width={screenWidth - 32}
              height={220}
              yAxisLabel="$"
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: colors.surface,
                backgroundGradientFrom: colors.surface,
                backgroundGradientTo: colors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(${parseInt(colors.text.slice(1,3),16)}, ${parseInt(colors.text.slice(3,5),16)}, ${parseInt(colors.text.slice(5,7),16)}, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(${parseInt(colors.textSecondary.slice(1,3),16)}, ${parseInt(colors.textSecondary.slice(3,5),16)}, ${parseInt(colors.textSecondary.slice(5,7),16)}, ${opacity})`,
                barPercentage: 0.7,
                propsForBackgroundLines: {
                  strokeDasharray: '',
                  stroke: colors.borderLight,
                },
              }}
              style={styles.chart}
            />
          </View>
        )}

        {/* Monthly Breakdown */}
        <View style={[styles.breakdownSection, { backgroundColor: colors.surface }]}>
          <Text style={[styles.breakdownTitle, { color: colors.text }]}>Detalle mensual</Text>
          {monthsData.map((m, i) => (
            <TouchableOpacity
              key={`${m.month}-${m.year}`}
              style={[styles.breakdownItem, { borderBottomColor: colors.borderLight }]}
              onPress={() => handleBarPress(i)}
            >
              <View style={styles.breakdownLeft}>
                <Text style={[styles.breakdownMonth, { color: colors.text }]}>
                  {getMonthFullName(m.month)} {m.year}
                </Text>
                <Text style={[styles.breakdownSub, { color: colors.textTertiary }]}>
                  Fijos: {formatCurrency(m.fixedExpenses)} · Variables: {formatCurrency(m.variableExpenses)}
                </Text>
              </View>
              <View style={styles.breakdownRight}>
                <Text
                  style={[
                    styles.breakdownBalance,
                    { color: m.balance >= 0 ? colors.income : colors.expense },
                  ]}
                >
                  {formatCurrency(m.balance)}
                </Text>
                <Text style={[styles.breakdownSalary, { color: colors.textTertiary }]}>
                  Salario: {formatCurrency(m.salary)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={showDetail} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: colors.shadow + '66' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selectedMonth && getMonthFullName(selectedMonth.month)}{' '}
                {selectedMonth?.year}
              </Text>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Text style={[styles.modalClose, { color: colors.textTertiary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Summary */}
              <View style={styles.detailSummary}>
                <View style={[styles.detailSummaryItem, { backgroundColor: colors.surfaceVariant }]}>
                  <Text style={[styles.detailSummaryLabel, { color: colors.textSecondary }]}>Salario</Text>
                    <Text style={[styles.detailSummaryValue, { color: colors.income }]}>
                      {formatCurrency(selectedMonth?.salary || 0)}
                    </Text>
                  </View>
                <View style={[styles.detailSummaryItem, { backgroundColor: colors.surfaceVariant }]}>
                  <Text style={[styles.detailSummaryLabel, { color: colors.textSecondary }]}>Gastos Fijos</Text>
                    <Text style={[styles.detailSummaryValue, { color: colors.expense }]}>
                      {formatCurrency(selectedMonth?.fixedExpenses || 0)}
                    </Text>
                  </View>
                <View style={[styles.detailSummaryItem, { backgroundColor: colors.surfaceVariant }]}>
                  <Text style={[styles.detailSummaryLabel, { color: colors.textSecondary }]}>Gastos Variables</Text>
                    <Text style={[styles.detailSummaryValue, { color: colors.warning }]}>
                    {formatCurrency(selectedMonth?.variableExpenses || 0)}
                  </Text>
                </View>
              </View>

              {/* Category Breakdown */}
              {detailCategories.length > 0 && (
                <>
                  <Text style={[styles.detailSectionTitle, { color: colors.text }]}>Top Categorías</Text>
                  {detailCategories.slice(0, 5).map((cat, i) => {
                    const maxTotal = detailCategories[0]?.total || 1;
                    const barWidth = `${(cat.total / maxTotal) * 100}%`;
                    return (
                      <View key={i} style={[styles.categoryItem, { borderBottomColor: colors.borderLight }]}>
                        <View style={styles.categoryHeader}>
                          <Text style={styles.categoryIcon}>{cat.icon}</Text>
                          <Text style={[styles.categoryName, { color: colors.text }]}>{cat.name}</Text>
                          <Text style={[styles.categoryTotal, { color: colors.text }]}>{formatCurrency(cat.total)}</Text>
                        </View>
                        <View style={[styles.categoryBarBg, { backgroundColor: colors.surfaceVariant }]}>
                          <View style={[styles.categoryBarFill, { backgroundColor: colors.primary, width: barWidth as any }]} />
                        </View>
                      </View>
                    );
                  })}
                </>
              )}

              {/* Fixed Expenses */}
              <Text style={[styles.detailSectionTitle, { color: colors.text }]}>Gastos Fijos</Text>
              {detailFixed.map((f) => (
                <View key={f.id} style={[styles.detailItem, { borderBottomColor: colors.borderLight }]}>
                  <Text style={styles.detailItemIcon}>
                    {f.categories?.icon || '📦'}
                  </Text>
                  <Text style={[styles.detailItemName, { color: colors.text }]}>{f.name}</Text>
                  <Text style={[styles.detailItemAmount, { color: colors.text }]}>
                    {formatCurrency(f.amount)}
                  </Text>
                </View>
              ))}

              {/* Transactions */}
              <Text style={[styles.detailSectionTitle, { color: colors.text }]}>Transacciones</Text>
              {detailTransactions.map((t) => (
                <View key={t.id} style={[styles.detailItem, { borderBottomColor: colors.borderLight }]}>
                  <Text style={styles.detailItemIcon}>
                    {t.categories?.icon || (t.type === 'expense' ? '📤' : '📥')}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailItemName, { color: colors.text }]}>{t.description}</Text>
                    <Text style={[styles.detailItemDate, { color: colors.textTertiary }]}>{t.date}</Text>
                  </View>
                  <Text
                    style={[
                      styles.detailItemAmount,
                      { color: t.type === 'income' ? colors.income : colors.expense },
                    ]}
                  >
                    {t.type === 'income' ? '+' : '-'}
                    {formatCurrency(t.amount)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  comparisonCard: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  comparisonTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  comparisonItem: {
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '500',
  },
  comparisonValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  comparisonArrow: {
    fontSize: 28,
  },
  comparisonDiff: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  chartContainer: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  chartHint: {
    fontSize: 12,
    marginBottom: 14,
  },
  chart: {
    borderRadius: 12,
    marginLeft: -16,
  },
  breakdownSection: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  breakdownLeft: {
    flex: 1,
  },
  breakdownMonth: {
    fontSize: 14,
    fontWeight: '600',
  },
  breakdownSub: {
    fontSize: 12,
    marginTop: 2,
  },
  breakdownRight: {
    alignItems: 'flex-end',
  },
  breakdownBalance: {
    fontSize: 15,
    fontWeight: '700',
  },
  breakdownSalary: {
    fontSize: 11,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalClose: {
    fontSize: 24,
  },
  detailSummary: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  detailSummaryItem: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  detailSummaryLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  detailSummaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 10,
  },
  detailItemIcon: {
    fontSize: 18,
  },
  detailItemName: {
    fontSize: 14,
    flex: 1,
  },
  detailItemDate: {
    fontSize: 11,
  },
  detailItemAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  categoryItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  categoryName: {
    fontSize: 13,
    flex: 1,
    fontWeight: '500',
  },
  categoryTotal: {
    fontSize: 13,
    fontWeight: '700',
  },
  categoryBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: 6,
    borderRadius: 3,
  },
});
