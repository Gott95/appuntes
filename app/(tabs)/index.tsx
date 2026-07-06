import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/lib/auth-context';
import { formatCurrency, getCurrentMonth, getMonthFullName, getMonthRange } from '@/lib/utils';
import { Colors } from '@/lib/theme';
import { getMonthlyBudget, calculateAndAdjustBudgets } from '@/lib/budget';
import { sendBudgetAlert } from '@/lib/notifications';
import {
  SavingsGoal,
  getSavingsGoals,
  getProgressPercent,
} from '@/lib/savings';
import { getMonthlyInstallmentsTotal, getMonthlyPaidInstallments, PlanWithPayments, getAllPlansWithPayments } from '@/lib/installments';

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category_id: string | null;
  categories: { name: string; icon: string } | null;
}

interface Transaction {
  id: string;
  amount: number;
  description: string;
  type: 'expense' | 'income';
  date: string;
}

export default function DashboardScreen() {
  const { user, getUserName } = useAuthContext();
  const { month, year } = getCurrentMonth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [refreshing, setRefreshing] = useState(false);
  const [totalSalary, setTotalSalary] = useState(0);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [budgetData, setBudgetData] = useState<{
    currentWeek: number;
    currentSpent: number;
    currentBudget: number;
    isOver: boolean;
  } | null>(null);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [installmentsTotal, setInstallmentsTotal] = useState(0);
  const [paidInstallments, setPaidInstallments] = useState(0);
  const [activeInstallmentPlans, setActiveInstallmentPlans] = useState<PlanWithPayments[]>([]);
  const [savingsThisMonth, setSavingsThisMonth] = useState(0);
  const router = useRouter();

  const totalFixed = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalVariable = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = totalSalary - totalFixed - totalVariable + totalIncome - paidInstallments;

  const fetchData = useCallback(async () => {
    if (!user) return;

    const { startDate, endDate } = getMonthRange(month, year);

    const [salaryRes, fixedRes, transRes, savingsRes] = await Promise.all([
      supabase
        .from('salary_entries')
        .select('amount')
        .eq('user_id', user.id),
      supabase
        .from('fixed_expenses')
        .select('*, categories(name, icon)')
        .eq('user_id', user.id)
        .eq('is_active', true),
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .limit(10),
      supabase
        .from('savings_entries')
        .select('amount')
        .eq('user_id', user.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59'),
    ]);

    const salaryTotal = (salaryRes.data || []).reduce((sum: number, e: any) => sum + e.amount, 0);
    setTotalSalary(salaryTotal);
    setFixedExpenses(fixedRes.data || []);
    setTransactions(transRes.data || []);

    const savingsTotal = (savingsRes.data || []).reduce((sum: number, e: any) => sum + e.amount, 0);
    setSavingsThisMonth(savingsTotal);

    const budget = await getMonthlyBudget(user.id);
    setMonthlyBudget(budget);

    if (budget > 0) {
      const bd = await calculateAndAdjustBudgets(user.id, month, year, budget);
      setBudgetData(bd);

      if (bd.isOver) {
        sendBudgetAlert(bd.currentWeek, bd.currentSpent, bd.currentBudget);
      }
    }

    const goals = await getSavingsGoals(user.id);
    setSavingsGoals(goals);

    const [installments, installmentPlans, paidInstall] = await Promise.all([
      getMonthlyInstallmentsTotal(user.id, month, year),
      getAllPlansWithPayments(user.id),
      getMonthlyPaidInstallments(user.id, month, year),
    ]);
    setInstallmentsTotal(installments);
    setPaidInstallments(paidInstall);
    setActiveInstallmentPlans(installmentPlans.filter((p) => p.status === 'active').slice(0, 3));
  }, [user, month, year]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: 52 }]}>
        <Text style={[styles.greeting, { color: colors.surface }]}>Bienvenido, {getUserName()}</Text>
        <Text style={[styles.month, { color: colors.surface + 'cc' }]}>{getMonthFullName(month)} {year}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Balance Card */}
        <View style={[styles.card, { backgroundColor: balance >= 0 ? colors.success + '12' : colors.error + '12', borderLeftColor: balance >= 0 ? colors.success : colors.error }]}>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Balance del mes</Text>
          <Text style={[styles.cardAmount, { color: colors.text }]}>{formatCurrency(balance)}</Text>
        </View>

        {/* Weekly Budget Card */}
        {monthlyBudget > 0 && budgetData && (
          <View style={[styles.card, {
            backgroundColor: budgetData.isOver ? colors.error + '12' : colors.primary + '12',
            borderLeftColor: budgetData.isOver ? colors.error : colors.primary,
          }]}>
            <View style={styles.budgetHeader}>
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
                Presupuesto Semana {budgetData.currentWeek}/4
              </Text>
              {budgetData.isOver && (
                <Text style={[styles.budgetOverBadge, { backgroundColor: colors.error, color: '#fff' }]}>
                  EXCEDIDO
                </Text>
              )}
            </View>
            <View style={styles.budgetBarBg}>
              <View style={[
                styles.budgetBarFill,
                {
                  width: `${Math.min((budgetData.currentSpent / budgetData.currentBudget) * 100, 100)}%`,
                  backgroundColor: budgetData.isOver ? colors.error : colors.primary,
                },
              ]} />
            </View>
            <View style={styles.budgetDetails}>
              <Text style={[styles.budgetDetailText, { color: colors.text }]}>
                Gastado: {formatCurrency(budgetData.currentSpent)}
              </Text>
              <Text style={[styles.budgetDetailText, { color: colors.textSecondary }]}>
                / {formatCurrency(budgetData.currentBudget)}
              </Text>
            </View>
            <Text style={[styles.budgetRemaining, { color: budgetData.isOver ? colors.error : colors.success }]}>
              {budgetData.isOver
                ? `Excedido por ${formatCurrency(budgetData.currentSpent - budgetData.currentBudget)}`
                : `Disponible: ${formatCurrency(budgetData.currentBudget - budgetData.currentSpent)}`
              }
            </Text>
          </View>
        )}

        {/* Summary Row */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryItem, { backgroundColor: colors.surface }]}>
            <Text style={styles.summaryIcon}>💰</Text>
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Ingresos</Text>
            <Text style={[styles.summaryAmount, { color: colors.income }]}>
              {formatCurrency(totalSalary + totalIncome)}
            </Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: colors.surface }]}>
            <Text style={styles.summaryIcon}>📌</Text>
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Fijos</Text>
            <Text style={[styles.summaryAmount, { color: colors.expense }]}>
              {formatCurrency(totalFixed)}
            </Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: colors.surface }]}>
            <Text style={styles.summaryIcon}>🛒</Text>
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Variables</Text>
            <Text style={[styles.summaryAmount, { color: colors.warning }]}>
              {formatCurrency(totalVariable)}
            </Text>
          </View>
        </View>

        {/* Fixed Expenses Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Gastos Fijos</Text>
          {fixedExpenses.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Sin gastos fijos registrados</Text>
          ) : (
            fixedExpenses.map((expense) => (
              <View
                key={expense.id}
                style={[styles.listItem, { borderBottomColor: colors.borderLight }]}
              >
                <View style={styles.itemLeft}>
                  <Text style={styles.itemIcon}>
                    {expense.categories?.icon || '📦'}
                  </Text>
                  <View>
                    <Text style={[styles.itemName, { color: colors.text }]}>{expense.name}</Text>
                    <Text style={[styles.itemCategory, { color: colors.textTertiary }]}>
                      {expense.categories?.name || 'Sin categoría'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.itemAmount, { color: colors.text }]}>{formatCurrency(expense.amount)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Recent Transactions */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Últimas transacciones</Text>
          {transactions.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Sin transacciones este mes</Text>
          ) : (
            transactions.map((t) => (
              <View key={t.id} style={[styles.listItem, { borderBottomColor: colors.borderLight }]}>
                <View>
                  <Text style={[styles.itemName, { color: colors.text }]}>{t.description}</Text>
                  <Text style={[styles.itemCategory, { color: colors.textTertiary }]}>{t.date}</Text>
                </View>
                <Text
                  style={[
                    styles.itemAmount,
                    { color: t.type === 'income' ? colors.income : colors.expense },
                  ]}
                >
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Installments Summary */}
        {(installmentsTotal > 0 || paidInstallments > 0 || activeInstallmentPlans.length > 0) && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Cuotas este mes</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/installments')}>
                <Text style={[styles.sectionLink, { color: colors.primary }]}>Ver todas →</Text>
              </TouchableOpacity>
            </View>
            {installmentsTotal > 0 ? (
              <View style={[styles.card, { backgroundColor: colors.warning + '12', borderLeftColor: colors.warning, margin: 0, marginBottom: 12 }]}>
                <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>A pagar en cuotas</Text>
                <Text style={[styles.cardAmount, { color: colors.text }]}>{formatCurrency(installmentsTotal)}</Text>
              </View>
            ) : paidInstallments > 0 ? (
              <View style={[styles.card, { backgroundColor: colors.success + '12', borderLeftColor: colors.success, margin: 0, marginBottom: 12 }]}>
                <Text style={[styles.cardLabel, { color: colors.success }]}>✓ Cuota pagada este mes</Text>
                <Text style={[styles.cardAmount, { color: colors.success }]}>{formatCurrency(paidInstallments)}</Text>
              </View>
            ) : null}
            {activeInstallmentPlans.map((plan) => (
              <View
                key={plan.id}
                style={[styles.listItem, { borderBottomColor: colors.borderLight }]}
              >
                <View style={styles.itemLeft}>
                  <Text style={styles.itemIcon}>{plan.interest_type === 'zero' ? '🏷️' : '🏦'}</Text>
                  <View>
                    <Text style={[styles.itemName, { color: colors.text }]}>{plan.name}</Text>
                    <Text style={[styles.itemCategory, { color: colors.textTertiary }]}>
                      {plan.installment_count - Math.round(plan.total_paid / plan.installment_amount)} cuotas restantes
                    </Text>
                  </View>
                </View>
                <Text style={[styles.itemAmount, { color: colors.warning }]}>{formatCurrency(plan.installment_amount)}/mes</Text>
              </View>
            ))}
          </View>
        )}

        {/* Savings Goals */}
        {savingsGoals.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Metas de ahorro</Text>
            {savingsGoals.map((goal) => {
              const pct = getProgressPercent(goal.current_amount, goal.target_amount);
              return (
                <View
                  key={goal.id}
                  style={[styles.goalItem, { borderBottomColor: colors.borderLight }]}
                >
                  <View style={styles.goalLeft}>
                    <Text style={styles.goalIcon}>{goal.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.goalName, { color: colors.text }]}>{goal.name}</Text>
                      <View style={styles.goalBarBg}>
                        <View style={[styles.goalBarFill, { width: `${pct}%`, backgroundColor: goal.color }]} />
                      </View>
                      <Text style={[styles.goalAmounts, { color: colors.textSecondary }]}>
                        {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.goalPercent, { color: goal.color }]}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  month: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  card: {
    margin: 16,
    padding: 24,
    borderRadius: 20,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardLabel: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardAmount: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetOverBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  budgetBarBg: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 4,
    marginTop: 10,
    marginBottom: 8,
  },
  budgetBarFill: {
    height: 8,
    borderRadius: 4,
  },
  budgetDetails: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  budgetDetailText: {
    fontSize: 14,
    fontWeight: '600',
  },
  budgetRemaining: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 10,
  },
  summaryItem: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  summaryIcon: {
    fontSize: 18,
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '500',
  },
  summaryAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
    fontWeight: '500',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemIcon: {
    fontSize: 18,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  goalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  goalIcon: {
    fontSize: 24,
  },
  goalName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  goalBarBg: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 3,
    marginBottom: 4,
    overflow: 'hidden',
  },
  goalBarFill: {
    height: 6,
    borderRadius: 3,
    maxWidth: '100%' as any,
  },
  goalAmounts: {
    fontSize: 11,
    fontWeight: '500',
  },
  goalPercent: {
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 12,
  },
});
