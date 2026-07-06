import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/lib/auth-context';
import { useAppUpdate } from '@/lib/update-context';
import SwipeableRow from '@/components/SwipeableRow';
import { formatCurrency, getCurrentMonth, getMonthFullName } from '@/lib/utils';
import { Colors } from '@/lib/theme';
import { getMonthlyBudget, setMonthlyBudget } from '@/lib/budget';
import { requestNotificationPermission, openNotificationSettings } from '@/lib/notifications';
import {
  SavingsGoal,
  getSavingsGoals,
  createSavingsGoal,
  deleteSavingsGoal,
  getProgressPercent,
  GOAL_ICONS,
  GOAL_COLORS,
} from '@/lib/savings';
import {
  VaultEntry,
  getVaultEntries,
  getCurrentBalance,
  saveVaultEntry,
  deleteVaultEntry,
} from '@/lib/vault';

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category_id: string | null;
  is_active: boolean;
  categories: { name: string; icon: string } | null;
}

interface SalaryEntry {
  id: string;
  job_name: string;
  amount: number;
}

export default function SettingsScreen() {
  const { user, profile, signOut, refreshProfile } = useAuthContext();
  const { hasUpdate, latestBuildUrl, latestBuildNotes, currentBuild, latestBuild } = useAppUpdate();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { month, year } = getCurrentMonth();
  const [refreshing, setRefreshing] = useState(false);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [salaryEntries, setSalaryEntries] = useState<SalaryEntry[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddSalary, setShowAddSalary] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'fixed' | 'variable'>('fixed');
  const [newCategoryIcon, setNewCategoryIcon] = useState('📦');
  const [monthlyBudget, setMonthlyBudgetState] = useState(0);
  const [budgetInput, setBudgetInput] = useState('');
  const [newJobName, setNewJobName] = useState('');
  const [newJobAmount, setNewJobAmount] = useState('');
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalIcon, setNewGoalIcon] = useState('🎯');
  const [newGoalColor, setNewGoalColor] = useState('#0891b2');
  const [showEditSalary, setShowEditSalary] = useState(false);
  const [editingSalary, setEditingSalary] = useState<SalaryEntry | null>(null);
  const [editJobName, setEditJobName] = useState('');
  const [editJobAmount, setEditJobAmount] = useState('');
  const [vaultEntries, setVaultEntries] = useState<VaultEntry[]>([]);
  const [vaultBalance, setVaultBalance] = useState(0);
  const [showVaultAdjust, setShowVaultAdjust] = useState(false);
  const [vaultAdjustAmount, setVaultAdjustAmount] = useState('');
  const [vaultAdjustNote, setVaultAdjustNote] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;

    const [fixedRes, catRes, budget, salaryRes, goals, vaultRes, balance] = await Promise.all([
      supabase
        .from('fixed_expenses')
        .select('*, categories(name, icon)')
        .eq('user_id', user.id)
        .eq('is_active', true),
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id),
      getMonthlyBudget(user.id),
      supabase
        .from('salary_entries')
        .select('*')
        .eq('user_id', user.id),
      getSavingsGoals(user.id),
      getVaultEntries(user.id),
      getCurrentBalance(user.id),
    ]);

    setFixedExpenses(fixedRes.data || []);
    setCategories(catRes.data || []);
    setMonthlyBudgetState(budget);
    setBudgetInput(budget > 0 ? String(budget) : '');
    setSalaryEntries(salaryRes.data || []);
    setSavingsGoals(goals);
    setVaultEntries(vaultRes);
    setVaultBalance(balance);
  }, [user, month, year]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    refreshProfile();
    setRefreshing(false);
  };

  const handleAddExpense = async () => {
    if (!user || !newExpenseName.trim() || !newExpenseAmount) return;

    const amount = parseFloat(newExpenseAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    const { error } = await supabase.from('fixed_expenses').insert({
      user_id: user.id,
      name: newExpenseName.trim(),
      amount,
      category_id: selectedCategory,
    } as any);

    if (error) {
      Alert.alert('Error', 'No se pudo guardar');
      return;
    }

    setNewExpenseName('');
    setNewExpenseAmount('');
    setSelectedCategory(null);
    setShowAddExpense(false);
    fetchData();
  };

  const handleDeleteExpense = (id: string) => {
    Alert.alert('Eliminar', '¿Eliminar este gasto fijo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('fixed_expenses').delete().eq('id', id);
          fetchData();
        },
      },
    ]);
  };

  const handleEditExpense = (expense: FixedExpense) => {
    setEditingExpense(expense);
    setNewExpenseName(expense.name);
    setNewExpenseAmount(expense.amount.toString());
    setSelectedCategory(expense.category_id || null);
    setShowEditExpense(true);
  };

  const handleSaveEditExpense = async () => {
    if (!editingExpense || !newExpenseName.trim() || !newExpenseAmount) return;

    const amount = parseFloat(newExpenseAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    const { error } = await (supabase as any).from('fixed_expenses').update({
      name: newExpenseName.trim(),
      amount,
      category_id: selectedCategory,
    }).eq('id', editingExpense.id);

    if (error) {
      Alert.alert('Error', 'No se pudo guardar');
      return;
    }

    setNewExpenseName('');
    setNewExpenseAmount('');
    setSelectedCategory(null);
    setEditingExpense(null);
    setShowEditExpense(false);
    fetchData();
  };

  const handleAddCategory = async () => {
    if (!user || !newCategoryName.trim()) return;

    const { error } = await supabase.from('categories').insert({
      user_id: user.id,
      name: newCategoryName.trim(),
      type: newCategoryType,
      icon: newCategoryIcon || '📦',
    } as any);

    if (error) {
      Alert.alert('Error', error.message || 'No se pudo guardar');
      return;
    }

    setNewCategoryName('');
    setNewCategoryType('fixed');
    setNewCategoryIcon('📦');
    setShowAddCategory(false);
    fetchData();
  };

  const handleDeleteCategory = (id: string) => {
    Alert.alert('Eliminar', '¿Eliminar esta categoría?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('categories').delete().eq('id', id);
          fetchData();
        },
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  };

  const fixedCategories = categories.filter((c) => c.type === 'fixed');
  const variableCategories = categories.filter((c) => c.type === 'variable');

  const handleSaveBudget = async () => {
    if (!user) return;

    const amount = parseFloat(budgetInput);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    await setMonthlyBudget(user.id, amount);
    setMonthlyBudgetState(amount);
    Alert.alert('Listo', `Presupuesto mensual: ${formatCurrency(amount)}`);
  };

  const handleRequestNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      Alert.alert('Notificaciones activadas', 'Recibirás alertas cuando excedas tu presupuesto semanal.');
    } else {
      Alert.alert(
        'Notificaciones denegadas',
        'Activa las notificaciones desde la configuración del sistema.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir ajustes', onPress: () => openNotificationSettings() },
        ]
      );
    }
  };

  const handleAddSalary = async () => {
    if (!user || !newJobName.trim() || !newJobAmount) return;

    const amount = parseFloat(newJobAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    const { error } = await supabase.from('salary_entries').upsert(
      {
        user_id: user.id,
        job_name: newJobName.trim(),
        amount,
      } as any,
      { onConflict: 'user_id,job_name' }
    );

    if (error) {
      Alert.alert('Error', 'No se pudo guardar');
      return;
    }

    setNewJobName('');
    setNewJobAmount('');
    setShowAddSalary(false);
    fetchData();
  };

  const handleDeleteSalary = (id: string) => {
    Alert.alert('Eliminar', '¿Eliminar esta entrada de salario?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('salary_entries').delete().eq('id', id);
          fetchData();
        },
      },
    ]);
  };

  const handleEditSalary = (entry: SalaryEntry) => {
    setEditingSalary(entry);
    setEditJobName(entry.job_name);
    setEditJobAmount(String(entry.amount));
    setShowEditSalary(true);
  };

  const handleSaveEditSalary = async () => {
    if (!editingSalary || !editJobName.trim() || !editJobAmount) return;

    const amount = parseFloat(editJobAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    const { error } = await (supabase as any)
      .from('salary_entries')
      .update({ job_name: editJobName.trim(), amount })
      .eq('id', editingSalary.id);

    if (error) {
      Alert.alert('Error', 'No se pudo actualizar');
      return;
    }

    setShowEditSalary(false);
    setEditingSalary(null);
    fetchData();
  };

  const handleAddGoal = async () => {
    if (!user || !newGoalName.trim() || !newGoalTarget) {
      Alert.alert('Error', 'Completa nombre y monto objetivo');
      return;
    }

    const target = parseFloat(newGoalTarget);
    if (isNaN(target) || target <= 0) {
      Alert.alert('Error', 'Ingresa un monto objetivo válido');
      return;
    }

    try {
      const goal = await createSavingsGoal(user.id, {
        name: newGoalName.trim(),
        target_amount: target,
        icon: newGoalIcon,
        color: newGoalColor,
        deadline: null,
      });

      if (goal) {
        setNewGoalName('');
        setNewGoalTarget('');
        setNewGoalIcon('🎯');
        setNewGoalColor('#0891b2');
        setShowAddGoal(false);
        fetchData();
      } else {
        Alert.alert('Error', 'No se pudo crear la meta');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo crear la meta');
    }
  };

  const handleDeleteGoal = (goal: SavingsGoal) => {
    Alert.alert('Eliminar meta', `¿Eliminar "${goal.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteSavingsGoal(goal.id);
          fetchData();
        },
      },
    ]);
  };

  const handleSaveVaultAdjust = async () => {
    if (!user || !vaultAdjustAmount) return;

    const amount = parseFloat(vaultAdjustAmount);
    if (isNaN(amount)) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    await saveVaultEntry(user.id, month, year, amount, vaultAdjustNote || 'Ajuste manual', true);
    setVaultAdjustAmount('');
    setVaultAdjustNote('');
    setShowVaultAdjust(false);
    fetchData();
  };

  const handleDeleteVaultEntry = (entry: VaultEntry) => {
    Alert.alert('Eliminar registro', `¿Eliminar el registro de ${getMonthFullName(entry.month)} ${entry.year}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteVaultEntry(entry.id);
          fetchData();
        },
      },
    ]);
  };


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: 52 }]}>
        <Text style={[styles.headerTitle, { color: colors.surface }]}>Ajustes</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

      {/* Profile Card */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Perfil</Text>
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.surface }]}>
              {profile?.email?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <View>
            <Text style={[styles.profileEmail, { color: colors.text }]}>{profile?.email}</Text>
            <Text style={[styles.profileStatus, { color: colors.success }]}>
              {profile?.has_set_password ? '✓ Contraseña configurada' : '⚠ Sin contraseña'}
            </Text>
          </View>
        </View>
      </View>

      {/* Update Card */}
      {hasUpdate && (
        <View style={[styles.card, { backgroundColor: colors.error + '08', borderLeftWidth: 4, borderLeftColor: colors.error }]}>
          <View style={styles.updateHeader}>
            <View style={styles.updateBadge}>
              <Text style={styles.updateBadgeText}>NEW</Text>
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Actualización disponible</Text>
          </View>
          {latestBuildNotes ? (
            <Text style={[styles.updateNotes, { color: colors.textSecondary }]}>{latestBuildNotes}</Text>
          ) : null}
          <Text style={[styles.updateVersion, { color: colors.textTertiary }]}>
            v{currentBuild} → v{latestBuild}
          </Text>
          {latestBuildUrl ? (
            <TouchableOpacity
              style={[styles.updateButton, { backgroundColor: colors.error }]}
              onPress={() => Linking.openURL(latestBuildUrl)}
            >
              <Text style={styles.updateButtonText}>Descargar actualización</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.updateNoUrl, { color: colors.textTertiary }]}>
              Pedile al develop que suba el link de descarga
            </Text>
          )}
        </View>
      )}

      {/* Budget Management */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Presupuesto mensual</Text>
        <Text style={[styles.budgetSubtitle, { color: colors.textTertiary }]}>
          Define el máximo que quieres gastar al mes. Se divide en 4 semanas.
        </Text>
        <View style={styles.budgetRow}>
          <TextInput
            style={[styles.budgetInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceVariant }]}
            value={budgetInput}
            onChangeText={setBudgetInput}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={[styles.budgetSaveButton, { backgroundColor: colors.primary }]}
            onPress={handleSaveBudget}
          >
            <Text style={[styles.budgetSaveText, { color: colors.surface }]}>Guardar</Text>
          </TouchableOpacity>
        </View>
        {monthlyBudget > 0 && (
          <Text style={[styles.budgetWeekly, { color: colors.primary }]}>
            Semanal: {formatCurrency(monthlyBudget / 4)}
          </Text>
        )}
        <TouchableOpacity onPress={handleRequestNotifications}>
          <Text style={[styles.budgetNotifLink, { color: colors.primary }]}>
            Activar alertas de presupuesto
          </Text>
        </TouchableOpacity>
      </View>

      {/* Fixed Expenses Management */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Gastos Fijos</Text>
          <TouchableOpacity onPress={() => setShowAddExpense(true)}>
            <Text style={[styles.addButton, { color: colors.primary }]}>+ Agregar</Text>
          </TouchableOpacity>
        </View>
        {fixedExpenses.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Sin gastos fijos</Text>
        ) : (
          fixedExpenses.map((expense) => (
            <TouchableOpacity
              key={expense.id}
              style={[styles.listItem, { borderBottomColor: colors.borderLight }]}
              onPress={() => handleEditExpense(expense)}
              onLongPress={() => handleDeleteExpense(expense.id)}
            >
              <View style={styles.itemLeft}>
                <Text style={styles.itemIcon}>
                  {expense.categories?.icon || '📦'}
                </Text>
                <Text style={[styles.itemName, { color: colors.text }]}>{expense.name}</Text>
              </View>
              <Text style={[styles.itemAmount, { color: colors.text }]}>{formatCurrency(expense.amount)}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Salary Management */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Trabajos / Salario</Text>
          <TouchableOpacity onPress={() => setShowAddSalary(true)}>
            <Text style={[styles.addButton, { color: colors.primary }]}>+ Agregar</Text>
          </TouchableOpacity>
        </View>
        {salaryEntries.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Sin entradas</Text>
        ) : (
          salaryEntries.map((entry) => (
            <SwipeableRow
              key={entry.id}
              onDelete={() => handleDeleteSalary(entry.id)}
              colors={colors}
            >
              <TouchableOpacity
                style={[styles.listItem, { borderBottomColor: colors.borderLight }]}
                onPress={() => handleEditSalary(entry)}
              >
                <Text style={[styles.itemName, { color: colors.text }]}>{entry.job_name}</Text>
                <Text style={[styles.itemAmount, { color: colors.text }]}>{formatCurrency(entry.amount)}</Text>
              </TouchableOpacity>
            </SwipeableRow>
          ))
        )}
      </View>

      {/* Categories Management */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Categorías</Text>
          <TouchableOpacity onPress={() => setShowAddCategory(true)}>
            <Text style={[styles.addButton, { color: colors.primary }]}>+ Nueva</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.categorySectionTitle, { color: colors.textTertiary }]}>Fijas</Text>
        {fixedCategories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryItem, { borderBottomColor: colors.borderLight }]}
            onLongPress={() => handleDeleteCategory(cat.id)}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text style={[styles.categoryName, { color: colors.text }]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}

        <Text style={[styles.categorySectionTitle, { marginTop: 12, color: colors.textTertiary }]}>Variables</Text>
        {variableCategories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryItem, { borderBottomColor: colors.borderLight }]}
            onLongPress={() => handleDeleteCategory(cat.id)}
          >
            <Text style={styles.categoryIcon}>{cat.icon}</Text>
            <Text style={[styles.categoryName, { color: colors.text }]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Savings Goals Management */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Metas de ahorro</Text>
          <TouchableOpacity onPress={() => setShowAddGoal(true)}>
            <Text style={[styles.addButton, { color: colors.primary }]}>+ Nueva</Text>
          </TouchableOpacity>
        </View>
        {savingsGoals.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Sin metas activas</Text>
        ) : (
          savingsGoals.map((goal) => {
            const pct = getProgressPercent(goal.current_amount, goal.target_amount);
            return (
              <TouchableOpacity
                key={goal.id}
                style={[styles.listItem, { borderBottomColor: colors.borderLight }]}
                onLongPress={() => handleDeleteGoal(goal)}
              >
                <View style={styles.itemLeft}>
                  <Text style={styles.itemIcon}>{goal.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, { color: colors.text }]}>{goal.name}</Text>
                    <View style={[styles.goalBarBg, { backgroundColor: colors.borderLight }]}>
                      <View style={[styles.goalBarFill, { width: `${pct}%`, backgroundColor: goal.color }]} />
                    </View>
                    <Text style={[styles.goalAmounts, { color: colors.textSecondary }]}>
                      {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.goalPercent, { color: goal.color }]}>{pct}%</Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Vault / Bóveda */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Bóveda</Text>
          <TouchableOpacity onPress={() => {
            setVaultAdjustAmount(String(vaultBalance));
            setShowVaultAdjust(true);
          }}>
            <Text style={[styles.addButton, { color: colors.primary }]}>Ajustar</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.vaultBalanceCard, { backgroundColor: colors.primary + '10', borderLeftColor: colors.primary }]}>
          <Text style={[styles.vaultBalanceLabel, { color: colors.textSecondary }]}>Total ahorrado</Text>
          <Text style={[styles.vaultBalanceAmount, { color: colors.text }]}>{formatCurrency(vaultBalance)}</Text>
        </View>
        {vaultEntries.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Sin registros. Ajusta el saldo inicial.</Text>
        ) : (
          vaultEntries.slice(0, 6).map((entry) => (
            <TouchableOpacity
              key={entry.id}
              style={[styles.listItem, { borderBottomColor: colors.borderLight }]}
              onLongPress={() => handleDeleteVaultEntry(entry)}
            >
              <View>
                <Text style={[styles.itemName, { color: colors.text }]}>
                  {getMonthFullName(entry.month)} {entry.year}
                </Text>
                {entry.note && (
                  <Text style={[styles.itemCategory, { color: colors.textTertiary }]}>{entry.note}</Text>
                )}
              </View>
              <Text style={[styles.itemAmount, { color: entry.is_manual_adjustment ? colors.primary : colors.text }]}>
                {formatCurrency(entry.balance)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={[styles.signOutButton, { backgroundColor: colors.error + '12' }]} onPress={handleSignOut}>
        <Text style={[styles.signOutText, { color: colors.error }]}>Cerrar sesión</Text>
      </TouchableOpacity>

      {/* Add Expense Modal */}
      <Modal visible={showAddExpense} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAddExpense(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Agregar gasto fijo</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              value={newExpenseName}
              onChangeText={setNewExpenseName}
              placeholder="Nombre del gasto"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              value={newExpenseAmount}
              onChangeText={setNewExpenseAmount}
              placeholder="Monto mensual"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {fixedCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    { backgroundColor: selectedCategory === cat.id ? colors.primary : colors.surfaceVariant },
                  ]}
                  onPress={() =>
                    setSelectedCategory(selectedCategory === cat.id ? null : cat.id)
                  }
                >
                  <Text style={[styles.categoryChipText, { color: selectedCategory === cat.id ? colors.surface : colors.text }]}>
                    {cat.icon} {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButtonCancel, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setShowAddExpense(false)}
              >
                <Text style={[styles.modalButtonTextCancel, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButtonConfirm, { backgroundColor: colors.primary }]} onPress={handleAddExpense}>
                <Text style={[styles.modalButtonTextConfirm, { color: colors.surface }]}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Expense Modal */}
      <Modal visible={showEditExpense} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowEditExpense(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Editar gasto fijo</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              value={newExpenseName}
              onChangeText={setNewExpenseName}
              placeholder="Nombre del gasto"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              value={newExpenseAmount}
              onChangeText={setNewExpenseAmount}
              placeholder="Monto mensual"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {fixedCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    { backgroundColor: selectedCategory === cat.id ? colors.primary : colors.surfaceVariant },
                  ]}
                  onPress={() =>
                    setSelectedCategory(selectedCategory === cat.id ? null : cat.id)
                  }
                >
                  <Text style={[styles.categoryChipText, { color: selectedCategory === cat.id ? colors.surface : colors.text }]}>
                    {cat.icon} {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButtonCancel, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setShowEditExpense(false)}
              >
                <Text style={[styles.modalButtonTextCancel, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButtonConfirm, { backgroundColor: colors.primary }]} onPress={handleSaveEditExpense}>
                <Text style={[styles.modalButtonTextConfirm, { color: colors.surface }]}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Category Modal */}
      <Modal visible={showAddCategory} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAddCategory(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nueva categoría</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="Nombre de la categoría"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              value={newCategoryIcon}
              onChangeText={setNewCategoryIcon}
              placeholder="Emoji (ej: 🍕)"
              placeholderTextColor={colors.textTertiary}
              maxLength={4}
            />
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Tipo</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeButton, { backgroundColor: newCategoryType === 'fixed' ? colors.primary : colors.surfaceVariant }]}
                onPress={() => setNewCategoryType('fixed')}
              >
                <Text style={{ fontSize: 13, color: newCategoryType === 'fixed' ? colors.surface : colors.textTertiary, fontWeight: newCategoryType === 'fixed' ? '700' : '400' }}>
                  📌 Fijo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, { backgroundColor: newCategoryType === 'variable' ? colors.primary : colors.surfaceVariant }]}
                onPress={() => setNewCategoryType('variable')}
              >
                <Text style={{ fontSize: 13, color: newCategoryType === 'variable' ? colors.surface : colors.textTertiary, fontWeight: newCategoryType === 'variable' ? '700' : '400' }}>
                  🛒 Variable
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButtonCancel, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setShowAddCategory(false)}
              >
                <Text style={[styles.modalButtonTextCancel, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButtonConfirm, { backgroundColor: colors.primary }]} onPress={handleAddCategory}>
                <Text style={[styles.modalButtonTextConfirm, { color: colors.surface }]}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Salary Modal */}
      <Modal visible={showAddSalary} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAddSalary(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Agregar salario</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              value={newJobName}
              onChangeText={setNewJobName}
              placeholder="Nombre del trabajo"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              value={newJobAmount}
              onChangeText={setNewJobAmount}
              placeholder="Monto"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButtonCancel, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setShowAddSalary(false)}
              >
                <Text style={[styles.modalButtonTextCancel, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButtonConfirm, { backgroundColor: colors.primary }]} onPress={handleAddSalary}>
                <Text style={[styles.modalButtonTextConfirm, { color: colors.surface }]}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Salary Modal */}
      <Modal visible={showEditSalary} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowEditSalary(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Editar salario</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              value={editJobName}
              onChangeText={setEditJobName}
              placeholder="Nombre del trabajo"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              value={editJobAmount}
              onChangeText={setEditJobAmount}
              placeholder="Monto"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButtonCancel, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setShowEditSalary(false)}
              >
                <Text style={[styles.modalButtonTextCancel, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButtonConfirm, { backgroundColor: colors.primary }]} onPress={handleSaveEditSalary}>
                <Text style={[styles.modalButtonTextConfirm, { color: colors.surface }]}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Goal Modal */}
      <Modal visible={showAddGoal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAddGoal(false)} />
          <ScrollView keyboardShouldPersistTaps="handled">
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nueva meta de ahorro</Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              value={newGoalName}
              onChangeText={setNewGoalName}
              placeholder="Nombre (ej: Viaje a Europa)"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              value={newGoalTarget}
              onChangeText={setNewGoalTarget}
              placeholder="Monto objetivo"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Icono</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {GOAL_ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.categoryChip, { backgroundColor: newGoalIcon === icon ? colors.primary : colors.surfaceVariant }]}
                  onPress={() => setNewGoalIcon(icon)}
                >
                  <Text style={styles.goalIconChip}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Color</Text>
            <View style={styles.colorRow}>
              {GOAL_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c, borderWidth: newGoalColor === c ? 3 : 0 }]}
                  onPress={() => setNewGoalColor(c)}
                />
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButtonCancel, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setShowAddGoal(false)}
              >
                <Text style={[styles.modalButtonTextCancel, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButtonConfirm, { backgroundColor: colors.primary }]} onPress={handleAddGoal}>
                <Text style={[styles.modalButtonTextConfirm, { color: colors.surface }]}>Crear meta</Text>
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Vault Adjust Modal */}
      <Modal visible={showVaultAdjust} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowVaultAdjust(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Ajustar bóveda</Text>
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Saldo actual: {formatCurrency(vaultBalance)}
            </Text>
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              value={vaultAdjustAmount}
              onChangeText={setVaultAdjustAmount}
              placeholder="Nuevo saldo"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
              value={vaultAdjustNote}
              onChangeText={setVaultAdjustNote}
              placeholder="Nota (opcional)"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButtonCancel, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setShowVaultAdjust(false)}
              >
                <Text style={[styles.modalButtonTextCancel, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButtonConfirm, { backgroundColor: colors.primary }]} onPress={handleSaveVaultAdjust}>
                <Text style={[styles.modalButtonTextConfirm, { color: colors.surface }]}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fc',
  },
  header: {
    backgroundColor: '#0a7ea4',
    paddingBottom: 22,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  budgetSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: 10,
  },
  budgetInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  budgetSaveButton: {
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
  },
  budgetSaveText: {
    fontSize: 14,
    fontWeight: '700',
  },
  budgetWeekly: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  budgetNotifLink: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    textDecorationLine: 'underline',
  },
  addButton: {
    fontSize: 13,
    color: '#0a7ea4',
    fontWeight: '700',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0a7ea4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  profileEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  profileStatus: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
    fontWeight: '500',
  },
  updateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  updateBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  updateBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  updateNotes: {
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  updateVersion: {
    fontSize: 12,
    marginBottom: 12,
  },
  updateButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  updateButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  updateNoUrl: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 13,
    color: '#bbb',
    textAlign: 'center',
    paddingVertical: 14,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  itemIcon: {
    fontSize: 18,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  itemCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  categorySectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a2e',
  },
  signOutButton: {
    margin: 16,
    marginTop: 24,
    marginBottom: 40,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 15,
    color: '#F44336',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    padding: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    color: '#1a1a2e',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 12,
    color: '#1a1a2e',
    backgroundColor: '#fafafa',
  },
  modalLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 10,
    fontWeight: '600',
  },
  categoryScroll: {
    marginBottom: 16,
  },
  categoryChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#0a7ea4',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#333',
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
  goalIconChip: {
    fontSize: 20,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderColor: '#fff',
  },
  vaultBalanceCard: {
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 14,
  },
  vaultBalanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  vaultBalanceAmount: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#0a7ea4',
  },
  typeText: {
    fontSize: 13,
    color: '#888',
  },
  typeTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButtonCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  modalButtonConfirm: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
  },
  modalButtonTextCancel: {
    fontSize: 15,
    color: '#888',
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '700',
  },
});
