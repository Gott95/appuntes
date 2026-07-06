import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Switch,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../hooks/useAuth';
import {
  PlanWithPayments,
  getAllPlansWithPayments,
  createInstallmentPlan,
  deleteInstallmentPlan,
  calculateTEM,
  calculateFrenchCuota,
  calculateEndDate,
  generateAmortizationSchedule,
} from '../../lib/installments';
import { formatCurrency } from '../../lib/utils';
import { Colors, BorderRadius, FontSize, FontWeight } from '../../lib/theme';

export default function InstallmentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [plans, setPlans] = useState<PlanWithPayments[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [store, setStore] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [installmentCount, setInstallmentCount] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [interestType, setInterestType] = useState<'zero' | 'fixed'>('zero');
  const [tna, setTna] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [autoCalculate, setAutoCalculate] = useState(true);
  const [isShared, setIsShared] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [myPortion, setMyPortion] = useState('');

  const loadData = useCallback(async () => {
    if (!user) return;
    const data = await getAllPlansWithPayments(user.id);
    setPlans(data);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const activePlans = plans.filter((p) => p.status === 'active');
  const paidPlans = plans.filter((p) => p.status === 'paid');

  const totalDebt = activePlans.reduce((sum, p) => sum + p.total_remaining, 0);
  const monthlyTotal = activePlans.reduce((sum, p) => {
    const nextPay = p.next_payment;
    return sum + (nextPay ? nextPay.amount : p.installment_amount);
  }, 0);

  const resetForm = () => {
    setName('');
    setStore('');
    setTotalAmount('');
    setDownPayment('');
    setInstallmentCount('');
    setInstallmentAmount('');
    setInterestType('zero');
    setTna('');
    setStartDate(new Date());
    setIsShared(false);
    setPartnerName('');
    setMyPortion('');
    setAutoCalculate(true);
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('Error', 'Ingresa el nombre del producto');
      return;
    }
    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      Alert.alert('Error', 'Ingresa el precio total');
      return;
    }
    if (!installmentCount || parseInt(installmentCount) <= 0) {
      Alert.alert('Error', 'Ingresa la cantidad de cuotas');
      return;
    }

    const total = parseFloat(totalAmount);
    const seña = parseFloat(downPayment || '0');
    const cuotas = parseInt(installmentCount);

    if (isShared) {
      if (!partnerName.trim()) {
        Alert.alert('Error', 'Ingresa el nombre del socio');
        return;
      }
      if (!myPortion || parseFloat(myPortion) <= 0) {
        Alert.alert('Error', 'Ingresa tu porción de la cuota');
        return;
      }
    }

    let cuotaMonto = parseFloat(installmentAmount || '0');
    let financed: number;
    let tem: number | null = null;

    if (isShared) {
      const myPortionNum = parseFloat(myPortion);
      financed = myPortionNum * cuotas;
      cuotaMonto = myPortionNum;
      if (financed + seña > total) {
        Alert.alert('Error', 'Tu porción excede el precio total');
        return;
      }
    } else {
      financed = total - seña;
      if (financed <= 0) {
        Alert.alert('Error', 'El monto financiado debe ser mayor a 0');
        return;
      }
      if (interestType === 'fixed' && tna) {
        tem = calculateTEM(parseFloat(tna) / 100);
        cuotaMonto = calculateFrenchCuota(financed, tem, cuotas);
        setInstallmentAmount(cuotaMonto.toFixed(2));
      } else if (autoCalculate && !installmentAmount) {
        cuotaMonto = financed / cuotas;
        setInstallmentAmount(cuotaMonto.toFixed(2));
      } else if (!cuotaMonto) {
        cuotaMonto = financed / cuotas;
      }
    }

    const startStr = startDate.toISOString().split('T')[0];

    const schedule = tem
      ? generateAmortizationSchedule(financed, cuotaMonto, tem, cuotas, startStr)
      : Array.from({ length: cuotas }, (_, i) => {
          const dueDate = new Date(startStr);
          dueDate.setMonth(dueDate.getMonth() + i + 1);
          return {
            capital: cuotaMonto,
            interest: 0,
            iva: 0,
            balance: 0,
            dueDate: dueDate.toISOString().split('T')[0],
          };
        });

    const payments = schedule.map((s: { capital: number; interest: number; iva: number; dueDate: string }, i: number) => ({
      plan_id: '',
      installment_number: i + 1,
      due_date: s.dueDate,
      amount: Math.round(cuotaMonto * 100) / 100,
      capital_amount: s.capital,
      interest_amount: s.interest,
      iva_amount: s.iva,
      status: 'pending' as const,
      paid_amount: 0,
      paid_date: null,
      payment_method: 'cash',
      notes: '',
    }));

    const plan = await createInstallmentPlan(user.id, {
      name: name.trim(),
      store: store.trim(),
      category_id: null,
      total_amount: total,
      down_payment: seña,
      financed_amount: Math.round(financed * 100) / 100,
      installment_count: cuotas,
      installment_amount: Math.round(cuotaMonto * 100) / 100,
      payment_frequency: 'monthly',
      interest_type: isShared ? 'zero' : interestType,
      tna: !isShared && interestType === 'fixed' && tna ? parseFloat(tna) : null,
      tea: null,
      tem: tem,
      cft: null,
      amortization_system: 'french',
      start_date: startStr,
      status: 'active',
      notes: '',
      is_shared: isShared,
      partner_name: isShared ? partnerName.trim() : '',
      created_by: null,
    }, payments);

    if (plan) {
      resetForm();
      setShowCreateModal(false);
      loadData();
    } else {
      Alert.alert('Error', 'No se pudo crear el plan');
    }
  };

  const handleDelete = (plan: PlanWithPayments) => {
    Alert.alert(
      'Eliminar plan',
      `¿Eliminar "${plan.name}"? Se borrarán todas las cuotas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteInstallmentPlan(plan.id);
            loadData();
          },
        },
      ]
    );
  };

  const renderPlanCard = (plan: PlanWithPayments) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    const currentMonthPayment = plan.payments.find(
      (p) => p.status === 'paid' && p.due_date.startsWith(currentMonthStr)
    );
    const nextPendingPayment = plan.payments.find(
      (p) => (p.status === 'pending' || p.status === 'overdue') && p.due_date > currentMonthStr
    ) || plan.payments.find((p) => p.status === 'pending' || p.status === 'overdue');

    const daysUntilNext = nextPendingPayment
      ? Math.ceil((new Date(nextPendingPayment.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    return (
      <TouchableOpacity
        key={plan.id}
        style={styles.planCard}
        onPress={() => {
          router.push(`/installment/${plan.id}`);
        }}
        onLongPress={() => handleDelete(plan)}
      >
        <View style={styles.planHeader}>
          <View style={styles.planIcon}>
            <Text style={styles.planIconText}>
              {plan.interest_type === 'zero' ? '🏷️' : '🏦'}
            </Text>
          </View>
          <View style={styles.planInfo}>
            <Text style={styles.planName} numberOfLines={1}>{plan.name}</Text>
            {plan.is_shared && plan.partner_name ? (
              <View style={styles.sharedBadge}>
                <Text style={styles.sharedBadgeText}>👥 {plan.partner_name}</Text>
              </View>
            ) : (
              <Text style={styles.planStore}>{plan.store || 'Sin comercio'}</Text>
            )}
          </View>
          <View style={styles.planAmounts}>
            <Text style={styles.planCuota}>{formatCurrency(plan.installment_amount)}</Text>
            <Text style={styles.planCuotaLabel}>/mes</Text>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${plan.percentage_paid}%`,
                backgroundColor:
                  plan.percentage_paid >= 100
                    ? Colors.light.success
                    : plan.percentage_paid >= 50
                    ? Colors.light.primary
                    : Colors.light.warning,
              },
            ]}
          />
        </View>

        <View style={styles.planStats}>
          <View style={styles.planStat}>
            <Text style={styles.planStatValue}>{plan.installment_count} cuotas</Text>
            <Text style={styles.planStatLabel}>total</Text>
          </View>
          <View style={styles.planStat}>
            <Text style={[styles.planStatValue, { color: Colors.light.success }]}>
              {formatCurrency(plan.total_paid)}
            </Text>
            <Text style={styles.planStatLabel}>pagado</Text>
          </View>
          <View style={styles.planStat}>
            <Text style={[styles.planStatValue, { color: Colors.light.warning }]}>
              {formatCurrency(plan.total_remaining)}
            </Text>
            <Text style={styles.planStatLabel}>falta</Text>
          </View>
          {currentMonthPayment ? (
            <View style={styles.planStat}>
              <Text style={[styles.planStatValue, { color: Colors.light.success }]}>✓ Pagado</Text>
              <Text style={styles.planStatLabel}>este mes</Text>
            </View>
          ) : daysUntilNext !== null ? (
            <View style={styles.planStat}>
              <Text
                style={[
                  styles.planStatValue,
                  {
                    color: daysUntilNext <= 3 ? Colors.light.error : Colors.light.textSecondary,
                  },
                ]}
              >
                {daysUntilNext <= 0 ? 'Vence hoy' : `${daysUntilNext}d`}
              </Text>
              <Text style={styles.planStatLabel}>próxima</Text>
            </View>
          ) : null}
        </View>

        {plan.interest_type === 'fixed' && (
          <View style={styles.interestBadge}>
            <Text style={styles.interestBadgeText}>TNA {plan.tna}%</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cuotas</Text>
        <Text style={styles.headerSubtitle}>
          {activePlans.length} plan{activePlans.length !== 1 ? 'es' : ''} activo{activePlans.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary */}
        {activePlans.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Ionicons name="wallet" size={20} color={Colors.light.error} />
                <Text style={styles.summaryValue}>{formatCurrency(totalDebt)}</Text>
                <Text style={styles.summaryLabel}>Debo</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name="calendar" size={20} color={Colors.light.primary} />
                <Text style={styles.summaryValue}>{formatCurrency(monthlyTotal)}</Text>
                <Text style={styles.summaryLabel}>Este mes</Text>
              </View>
            </View>
          </View>
        )}

        {/* Active Plans */}
        {activePlans.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={Colors.light.textTertiary} />
            <Text style={styles.emptyText}>No tenés planes de cuotas</Text>
            <Text style={styles.emptySubtext}>Agregá un producto que estés pagando a cuotas</Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Planes activos</Text>
            {activePlans.map(renderPlanCard)}
          </View>
        )}

        {/* Paid Plans */}
        {paidPlans.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Planes completados</Text>
            {paidPlans.map(renderPlanCard)}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          resetForm();
          setShowCreateModal(true);
        }}
      >
        <Ionicons name="add" size={28} color={Colors.light.surface} />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowCreateModal(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Nuevo plan de cuotas</Text>

              {/* Name */}
              <Text style={styles.fieldLabel}>Nombre del producto *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ej: iPhone 15 Pro"
                placeholderTextColor={Colors.light.textTertiary}
              />

              {/* Store */}
              <Text style={styles.fieldLabel}>Comercio / Banco</Text>
              <TextInput
                style={styles.input}
                value={store}
                onChangeText={setStore}
                placeholder="Ej: Mercado Libre, Galicia"
                placeholderTextColor={Colors.light.textTertiary}
              />

              {/* Total Amount */}
              <Text style={styles.fieldLabel}>Precio total *</Text>
              <TextInput
                style={styles.input}
                value={totalAmount}
                onChangeText={(t) => {
                  setTotalAmount(t);
                  if (autoCalculate && installmentCount) {
                    const total = parseFloat(t || '0');
                    const seña = parseFloat(downPayment || '0');
                    const cuotas = parseInt(installmentCount);
                    if (total > 0 && cuotas > 0) {
                      setInstallmentAmount(((total - seña) / cuotas).toFixed(2));
                    }
                  }
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.light.textTertiary}
              />

              {/* Down Payment */}
              <Text style={styles.fieldLabel}>Seña / Pago inicial</Text>
              <TextInput
                style={styles.input}
                value={downPayment}
                onChangeText={(t) => {
                  setDownPayment(t);
                  if (autoCalculate && totalAmount && installmentCount) {
                    const total = parseFloat(totalAmount);
                    const seña = parseFloat(t || '0');
                    const cuotas = parseInt(installmentCount);
                    if (total > 0 && cuotas > 0) {
                      setInstallmentAmount(((total - seña) / cuotas).toFixed(2));
                    }
                  }
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.light.textTertiary}
              />

              {/* Installment Count */}
              <Text style={styles.fieldLabel}>Cantidad de cuotas *</Text>
              <TextInput
                style={styles.input}
                value={installmentCount}
                onChangeText={(t) => {
                  setInstallmentCount(t);
                  if (autoCalculate && totalAmount) {
                    const total = parseFloat(totalAmount);
                    const seña = parseFloat(downPayment || '0');
                    const cuotas = parseInt(t);
                    if (total > 0 && cuotas > 0) {
                      setInstallmentAmount(((total - seña) / cuotas).toFixed(2));
                    }
                  }
                }}
                keyboardType="numeric"
                placeholder="12"
                placeholderTextColor={Colors.light.textTertiary}
              />

              {/* Interest Type */}
              <Text style={styles.fieldLabel}>Tipo de interés</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[styles.radioOption, interestType === 'zero' && styles.radioActive]}
                  onPress={() => setInterestType('zero')}
                >
                  <Text style={[styles.radioText, interestType === 'zero' && styles.radioTextActive]}>
                    Tasa 0%
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.radioOption, interestType === 'fixed' && styles.radioActive]}
                  onPress={() => setInterestType('fixed')}
                >
                  <Text style={[styles.radioText, interestType === 'fixed' && styles.radioTextActive]}>
                    Con interés
                  </Text>
                </TouchableOpacity>
              </View>

              {/* TNA */}
              {interestType === 'fixed' && (
                <>
                  <Text style={styles.fieldLabel}>TNA (Tasa Nominal Anual) %</Text>
                  <TextInput
                    style={styles.input}
                    value={tna}
                    onChangeText={(t) => {
                      setTna(t);
                      if (t && totalAmount && installmentCount) {
                        const total = parseFloat(totalAmount);
                        const seña = parseFloat(downPayment || '0');
                        const cuotas = parseInt(installmentCount);
                        const tem = calculateTEM(parseFloat(t) / 100);
                        const cuota = total - seña;
                        const factor = Math.pow(1 + tem, cuotas);
                        const cuotaMonto = cuota * (tem * factor) / (factor - 1);
                        setInstallmentAmount(cuotaMonto.toFixed(2));
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="Ej: 42"
                    placeholderTextColor={Colors.light.textTertiary}
                  />
                </>
              )}

              {/* Installment Amount - only show when NOT shared */}
              {!isShared && (
                <>
                  <Text style={styles.fieldLabel}>Monto por cuota *</Text>
                  <TextInput
                    style={[styles.input, autoCalculate && styles.inputDisabled]}
                    value={installmentAmount}
                    onChangeText={setInstallmentAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.light.textTertiary}
                    editable={!autoCalculate || interestType === 'fixed'}
                  />
                </>
              )}

              {/* Start Date */}
              <Text style={styles.fieldLabel}>Fecha de primera cuota</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={{ color: Colors.light.text }}>
                  {startDate.toLocaleDateString('es-AR')}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (date) setStartDate(date);
                  }}
                />
              )}

              {/* Shared Toggle */}
              <View style={styles.sharedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Cuota compartida</Text>
                  <Text style={{ fontSize: 12, color: Colors.light.textTertiary }}>
                    Dividir la cuota con otra persona
                  </Text>
                </View>
                <Switch
                  value={isShared}
                  onValueChange={setIsShared}
                  trackColor={{ false: Colors.light.border, true: Colors.light.primary + '50' }}
                  thumbColor={isShared ? Colors.light.primary : Colors.light.textTertiary}
                />
              </View>

              {isShared && (
                <>
                  <Text style={styles.fieldLabel}>Nombre del socio *</Text>
                  <TextInput
                    style={styles.input}
                    value={partnerName}
                    onChangeText={setPartnerName}
                    placeholder="Nombre"
                    placeholderTextColor={Colors.light.textTertiary}
                  />

                  <Text style={styles.fieldLabel}>Tu porción mensual *</Text>
                  <TextInput
                    style={styles.input}
                    value={myPortion}
                    onChangeText={setMyPortion}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.light.textTertiary}
                  />
                </>
              )}

              {/* Preview */}
              {totalAmount && installmentCount && (
                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>Resumen</Text>
                  {isShared && partnerName && (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Compartida con:</Text>
                      <Text style={[styles.previewValue, { color: Colors.light.primary }]}>{partnerName}</Text>
                    </View>
                  )}
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Precio total:</Text>
                    <Text style={styles.previewValue}>{formatCurrency(parseFloat(totalAmount))}</Text>
                  </View>
                  {downPayment && parseFloat(downPayment) > 0 && (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Seña:</Text>
                      <Text style={styles.previewValue}>-{formatCurrency(parseFloat(downPayment))}</Text>
                    </View>
                  )}
                  <View style={[styles.previewRow, styles.previewTotal]}>
                    <Text style={styles.previewTotalLabel}>{isShared ? 'Mi financiamiento:' : 'Financiado:'}</Text>
                    <Text style={styles.previewTotalValue}>
                      {formatCurrency(
                        isShared
                          ? parseFloat(myPortion || '0') * parseInt(installmentCount || '0')
                          : parseFloat(totalAmount) - parseFloat(downPayment || '0')
                      )}
                    </Text>
                  </View>
                  {isShared && (
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Socio paga:</Text>
                      <Text style={[styles.previewValue, { color: Colors.light.textSecondary }]}>
                        {formatCurrency(
                          parseFloat(totalAmount) - parseFloat(downPayment || '0') - parseFloat(myPortion || '0') * parseInt(installmentCount || '0')
                        )}
                      </Text>
                    </View>
                  )}
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>{isShared ? 'Mi cuota:' : 'Cuota mensual:'}</Text>
                    <Text style={[styles.previewValue, { color: Colors.light.primary, fontWeight: '700' }]}>
                      {myPortion && isShared
                        ? formatCurrency(parseFloat(myPortion))
                        : installmentAmount
                        ? formatCurrency(parseFloat(installmentAmount))
                        : '-'}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Cuotas:</Text>
                    <Text style={styles.previewValue}>{installmentCount} meses</Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Finaliza:</Text>
                    <Text style={styles.previewValue}>
                      {calculateEndDate(startDate.toISOString().split('T')[0], parseInt(installmentCount || '0')).split('-').slice(1, 3).join('/')} 
                    </Text>
                  </View>
                  {interestType === 'fixed' && tna && (
                    <>
                      <View style={styles.previewRow}>
                        <Text style={styles.previewLabel}>TNA:</Text>
                        <Text style={[styles.previewValue, { color: Colors.light.error }]}>{tna}%</Text>
                      </View>
                      <View style={styles.previewRow}>
                        <Text style={styles.previewLabel}>Total intereses:</Text>
                        <Text style={[styles.previewValue, { color: Colors.light.error }]}>
                          {formatCurrency(
                            parseFloat(installmentAmount || '0') * parseInt(installmentCount || '0') -
                              (parseFloat(totalAmount) - parseFloat(downPayment || '0'))
                          )}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonConfirm} onPress={handleCreate}>
                <Text style={styles.modalButtonConfirmText}>Crear plan</Text>
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
    backgroundColor: Colors.light.background,
  },
  header: {
    backgroundColor: Colors.light.primary,
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.light.surface,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.light.surface + 'bf',
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: Colors.light.surface,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: BorderRadius.lg,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.light.text,
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.light.border,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.light.textSecondary,
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    color: Colors.light.textTertiary,
  },
  planCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: BorderRadius.lg,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planIconText: {
    fontSize: 22,
  },
  planInfo: {
    flex: 1,
    marginLeft: 12,
  },
  planName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
  },
  planStore: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: Colors.light.primary + '15',
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  sharedBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.light.primary,
    fontWeight: FontWeight.medium,
  },
  planAmounts: {
    alignItems: 'flex-end',
  },
  planCuota: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.light.primary,
  },
  planCuotaLabel: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.light.surfaceVariant,
    borderRadius: 3,
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  planStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planStat: {
    alignItems: 'center',
  },
  planStatValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
  },
  planStatLabel: {
    fontSize: FontSize.xs,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  interestBadge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.light.error + '15',
    borderRadius: BorderRadius.sm,
  },
  interestBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.light.error,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.light.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.light.text,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.light.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.light.surfaceVariant,
    borderRadius: BorderRadius.md,
    padding: 14,
    fontSize: FontSize.base,
    color: Colors.light.text,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  sharedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  radioOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.surfaceVariant,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  radioActive: {
    backgroundColor: Colors.light.primary + '15',
    borderColor: Colors.light.primary,
  },
  radioText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.light.textSecondary,
  },
  radioTextActive: {
    color: Colors.light.primary,
    fontWeight: FontWeight.semibold,
  },
  previewCard: {
    backgroundColor: Colors.light.surfaceVariant,
    borderRadius: BorderRadius.md,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
  },
  previewValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
  },
  previewTotal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.border,
    paddingTop: 8,
    marginTop: 4,
  },
  previewTotalLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
  },
  previewTotalValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.light.text,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.surfaceVariant,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.light.textSecondary,
  },
  modalButtonConfirm: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.light.surface,
  },
});
