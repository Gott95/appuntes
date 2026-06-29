import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/lib/auth-context';
import { formatCurrency, getCurrentMonth, getMonthFullName, getMonthRange } from '@/lib/utils';
import { Colors } from '@/lib/theme';

interface Transaction {
  id: string;
  amount: number;
  description: string;
  type: 'expense' | 'income';
  date: string;
  category_id: string | null;
  categories: { name: string; icon: string } | null;
}

export default function TransactionsScreen() {
  const { user } = useAuthContext();
  const { month, year } = getCurrentMonth();
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isShared, setIsShared] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const { startDate, endDate } = getMonthRange(month, year);

    const [transRes, catRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, categories(name, icon)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false }),
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id),
    ]);

    setTransactions(transRes.data || []);
    setCategories(catRes.data || []);
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

  const filteredTransactions = transactions.filter((t) => {
    if (filterType === 'all') return true;
    return t.type === filterType;
  });

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleAdd = async () => {
    if (!user || !description.trim() || !amount) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      description: description.trim(),
      amount: parsedAmount,
      type,
      category_id: selectedCategory,
      date: selectedDate,
      is_shared: isShared,
      created_by: user.id,
    } as any);

    if (error) {
      Alert.alert('Error', 'No se pudo guardar la transacción');
      return;
    }

    setDescription('');
    setAmount('');
    setSelectedCategory(null);
    setIsShared(false);
    setShowAddModal(false);
    fetchData();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar', '¿Eliminar esta transacción?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('transactions').delete().eq('id', id);
          fetchData();
        },
      },
    ]);
  };

  const variableCategories = categories.filter((c) => c.type === 'variable');


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: 52 }]}>
        <Text style={[styles.headerTitle, { color: colors.surface }]}>Bitácora</Text>
        <Text style={[styles.headerMonth, { color: colors.surface + 'bf' }]}>{getMonthFullName(month)} {year}</Text>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderLeftColor: colors.expense, shadowColor: colors.shadow }]}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Gastos</Text>
          <Text style={[styles.summaryAmount, { color: colors.expense }]}>
            {formatCurrency(totalExpense)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderLeftColor: colors.income, shadowColor: colors.shadow }]}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Ingresos</Text>
          <Text style={[styles.summaryAmount, { color: colors.income }]}>
            {formatCurrency(totalIncome)}
          </Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'expense', 'income'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filterType === f && { backgroundColor: colors.primary }, filterType !== f && { backgroundColor: colors.surfaceVariant }]}
            onPress={() => setFilterType(f)}
          >
            <Text
              style={[
                styles.filterText,
                filterType === f ? { color: colors.surface, fontWeight: '700' } : { color: colors.textSecondary },
              ]}
            >
              {f === 'all' ? 'Todos' : f === 'expense' ? 'Gastos' : 'Ingresos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredTransactions.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Sin transacciones este mes</Text>
        ) : (
          filteredTransactions.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.transactionItem, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}
              onLongPress={() => handleDelete(t.id)}
            >
              <View style={styles.transactionLeft}>
                <Text style={styles.transactionIcon}>
                  {t.categories?.icon || (t.type === 'expense' ? '📤' : '📥')}
                </Text>
                <View>
                  <Text style={[styles.transactionDesc, { color: colors.text }]}>{t.description}</Text>
                  <Text style={[styles.transactionMeta, { color: colors.textSecondary }]}>
                    {t.categories?.name || 'Sin categoría'} · {t.date}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.transactionAmount,
                  { color: t.type === 'income' ? colors.income : colors.expense },
                ]}
              >
                {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.shadow }]} onPress={() => setShowAddModal(true)}>
        <Text style={[styles.fabText, { color: colors.surface }]}>+</Text>
      </TouchableOpacity>

      {/* Add Transaction Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAddModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nueva transacción</Text>

            {/* Type selector */}
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeButton, type === 'expense' && { backgroundColor: colors.expense + '1a', borderWidth: 1, borderColor: colors.expense }, type !== 'expense' && { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setType('expense')}
              >
                <Text style={[styles.typeText, type === 'expense' ? { fontWeight: '600', color: colors.text } : { color: colors.textSecondary }]}>
                  📤 Gasto
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, type === 'income' && { backgroundColor: colors.income + '1a', borderWidth: 1, borderColor: colors.income }, type !== 'income' && { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setType('income')}
              >
                <Text style={[styles.typeText, type === 'income' ? { fontWeight: '600', color: colors.text } : { color: colors.textSecondary }]}>
                  📥 Ingreso
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.modalInput, { borderColor: colors.border, color: colors.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Descripción"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.modalInput, { borderColor: colors.border, color: colors.text }]}
              value={amount}
              onChangeText={setAmount}
              placeholder="Monto"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.modalInput, { borderColor: colors.border, color: colors.text }]}
              value={selectedDate}
              onChangeText={setSelectedDate}
              placeholder="Fecha (YYYY-MM-DD)"
              placeholderTextColor={colors.textTertiary}
            />

            {type === 'expense' && (
              <>
                <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Categoría</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {variableCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryChip, selectedCategory === cat.id ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceVariant }]}
                      onPress={() =>
                        setSelectedCategory(selectedCategory === cat.id ? null : cat.id)
                      }
                    >
                      <Text style={[styles.categoryChipText, { color: colors.text }]}>
                        {cat.icon} {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Shared toggle */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 }}
              onPress={() => setIsShared(!isShared)}
            >
              <View style={{
                width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                borderColor: isShared ? colors.primary : colors.textTertiary,
                backgroundColor: isShared ? colors.primary : 'transparent',
                justifyContent: 'center', alignItems: 'center',
              }}>
                {isShared && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>✓</Text>}
              </View>
              <Text style={{ fontSize: 14, color: colors.text, fontWeight: '500' }}>
                Compartido con la pareja
              </Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButtonCancel, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={[styles.modalButtonTextCancel, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButtonConfirm, { backgroundColor: colors.primary }]} onPress={handleAdd}>
                <Text style={[styles.modalButtonTextConfirm, { color: colors.surface }]}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  headerMonth: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 3,
    elevation: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  summaryLabel: {
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 40,
    fontWeight: '500',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    elevation: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  transactionIcon: {
    fontSize: 20,
  },
  transactionDesc: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 28,
    lineHeight: 30,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  typeText: {
    fontSize: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  categoryScroll: {
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 13,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButtonCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonConfirm: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonTextCancel: {
    fontSize: 16,
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
