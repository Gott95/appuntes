import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  PlanWithPayments,
  InstallmentPayment,
  getPlanWithPayments,
  markPaymentAsPaid,
  markPaymentAsPending,
  deleteInstallmentPlan,
  calculateTotalCost,
  generateAmortizationSchedule,
} from '../../lib/installments';
import { formatCurrency } from '../../lib/utils';
import { Colors, BorderRadius, FontSize, FontWeight } from '../../lib/theme';

export default function InstallmentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plan, setPlan] = useState<PlanWithPayments | null>(null);
  const [showAmortization, setShowAmortization] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<InstallmentPayment | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');

  const loadPlan = useCallback(async () => {
    if (!id) return;
    const data = await getPlanWithPayments(id);
    setPlan(data);
  }, [id]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const handleMarkPaid = (payment: InstallmentPayment) => {
    setSelectedPayment(payment);
    setPayAmount(payment.amount.toString());
    setPayDate(new Date());
    setPayMethod('cash');
    setShowPayModal(true);
  };

  const confirmPayment = async () => {
    if (!selectedPayment) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }
    const dateStr = payDate.toISOString().split('T')[0];
    console.log('Paying:', { paymentId: selectedPayment.id, amount, dateStr, payMethod });
    const success = await markPaymentAsPaid(selectedPayment.id, amount, dateStr, payMethod);
    console.log('Payment result:', success);
    if (success) {
      setShowPayModal(false);
      setSelectedPayment(null);
      loadPlan();
    } else {
      Alert.alert('Error', 'No se pudo registrar el pago');
    }
  };

  const handleUnmarkPaid = (payment: InstallmentPayment) => {
    Alert.alert(
      'Desmarcar pago',
      `¿Quitar el pago de la cuota #${payment.installment_number}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desmarcar',
          style: 'destructive',
          onPress: async () => {
            await markPaymentAsPending(payment.id);
            loadPlan();
          },
        },
      ]
    );
  };

  const handleDeletePlan = () => {
    Alert.alert(
      'Eliminar plan',
      `¿Eliminar "${plan?.name}"? Se borrarán todas las cuotas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteInstallmentPlan(plan!.id);
            router.back();
          },
        },
      ]
    );
  };

  if (!plan) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </View>
    );
  }

  const costInfo = calculateTotalCost(
    plan.installment_amount,
    plan.installment_count,
    plan.down_payment,
    plan.interest_type,
    plan.tem,
    plan.financed_amount
  );

  const amortization = plan.tem
    ? generateAmortizationSchedule(plan.financed_amount, plan.installment_amount, plan.tem, plan.installment_count, plan.start_date)
    : [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.surface} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{plan.name}</Text>
          <Text style={styles.headerStore}>{plan.store || 'Sin comercio'}</Text>
        </View>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeletePlan}>
          <Ionicons name="trash-outline" size={20} color={Colors.light.surface} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressCircle}>
            <Text style={styles.progressPercent}>{plan.percentage_paid}%</Text>
            <Text style={styles.progressLabel}>pagado</Text>
          </View>
          <View style={styles.progressDetails}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel2}>Cuota mensual</Text>
              <Text style={styles.progressValue}>{formatCurrency(plan.installment_amount)}</Text>
            </View>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel2}>Ya pagado</Text>
              <Text style={[styles.progressValue, { color: Colors.light.success }]}>
                {formatCurrency(plan.total_paid)}
              </Text>
            </View>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel2}>Falta pagar</Text>
              <Text style={[styles.progressValue, { color: Colors.light.warning }]}>
                {formatCurrency(plan.total_remaining)}
              </Text>
            </View>
          </View>
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsCard}>
          <View style={styles.metricItem}>
            <Ionicons name="calendar" size={20} color={Colors.light.primary} />
            <Text style={styles.metricValue}>{plan.months_remaining} meses</Text>
            <Text style={styles.metricLabel}>restantes</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Ionicons name="time" size={20} color={Colors.light.warning} />
            <Text style={styles.metricValue}>
              {plan.next_payment
                ? new Date(plan.next_payment.due_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
                : '—'}
            </Text>
            <Text style={styles.metricLabel}>próxima cuota</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Ionicons name="flag" size={20} color={Colors.light.success} />
            <Text style={styles.metricValue}>
              {plan.end_date.split('-').slice(1, 3).join('/')}
            </Text>
            <Text style={styles.metricLabel}>finaliza</Text>
          </View>
        </View>

        {/* Cost Summary */}
        <View style={styles.costCard}>
          <Text style={styles.costTitle}>Resumen de costos</Text>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Precio total:</Text>
            <Text style={styles.costValue}>{formatCurrency(plan.total_amount)}</Text>
          </View>
          {plan.down_payment > 0 && (
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Seña:</Text>
              <Text style={styles.costValue}>-{formatCurrency(plan.down_payment)}</Text>
            </View>
          )}
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Monto financiado:</Text>
            <Text style={styles.costValue}>{formatCurrency(plan.financed_amount)}</Text>
          </View>
          {plan.interest_type === 'fixed' && (
            <>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>TNA:</Text>
                <Text style={[styles.costValue, { color: Colors.light.error }]}>{plan.tna}%</Text>
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Intereses totales:</Text>
                <Text style={[styles.costValue, { color: Colors.light.error }]}>
                  {formatCurrency(costInfo.totalInterest)}
                </Text>
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>IVA (21%):</Text>
                <Text style={[styles.costValue, { color: Colors.light.error }]}>
                  {formatCurrency(costInfo.totalIVA)}
                </Text>
              </View>
            </>
          )}
          <View style={[styles.costRow, styles.costTotal]}>
            <Text style={styles.costTotalLabel}>Total a pagar:</Text>
            <Text style={styles.costTotalValue}>{formatCurrency(costInfo.totalCost)}</Text>
          </View>
        </View>

        {/* Payments List */}
        <View style={styles.paymentsCard}>
          <Text style={styles.paymentsTitle}>Cuotas ({plan.payments.filter((p) => p.status === 'paid').length}/{plan.installment_count})</Text>
          {plan.payments.map((payment) => (
            <View
              key={payment.id}
              style={[
                styles.paymentItem,
                payment.status === 'paid' && styles.paymentPaid,
                payment.status === 'overdue' && styles.paymentOverdue,
              ]}
            >
              <View style={styles.paymentLeft}>
                <View
                  style={[
                    styles.paymentNumber,
                    payment.status === 'paid' && styles.paymentNumberPaid,
                    payment.status === 'overdue' && styles.paymentNumberOverdue,
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentNumberText,
                      payment.status === 'paid' && styles.paymentNumberTextPaid,
                    ]}
                  >
                    {payment.status === 'paid' ? '✓' : payment.installment_number}
                  </Text>
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentDate}>
                    {new Date(payment.due_date).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </Text>
                  {payment.status === 'paid' && payment.paid_date && (
                    <Text style={styles.paymentPaidDate}>
                      Pagado: {new Date(payment.paid_date).toLocaleDateString('es-AR')}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.paymentRight}>
                <Text
                  style={[
                    styles.paymentAmount,
                    payment.status === 'paid' && { color: Colors.light.success },
                  ]}
                >
                  {formatCurrency(payment.status === 'paid' ? payment.paid_amount : payment.amount)}
                </Text>
                {payment.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.payButton}
                    onPress={() => handleMarkPaid(payment)}
                  >
                    <Text style={styles.payButtonText}>Pagar</Text>
                  </TouchableOpacity>
                )}
                {payment.status === 'paid' && (
                  <TouchableOpacity
                    style={styles.undoButton}
                    onPress={() => handleUnmarkPaid(payment)}
                  >
                    <Ionicons name="arrow-undo" size={14} color={Colors.light.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Amortization Table (if interest-bearing) */}
        {plan.interest_type === 'fixed' && amortization.length > 0 && (
          <View style={styles.amortizationCard}>
            <TouchableOpacity
              style={styles.amortizationHeader}
              onPress={() => setShowAmortization(!showAmortization)}
            >
              <Text style={styles.amortizationTitle}>Tabla de amortización</Text>
              <Ionicons
                name={showAmortization ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={Colors.light.textSecondary}
              />
            </TouchableOpacity>
            {showAmortization && (
              <View style={styles.amortizationTable}>
                <View style={styles.amortizationRowHeader}>
                  <Text style={[styles.amortCell, styles.amortCellHeader]}>#</Text>
                  <Text style={[styles.amortCell, styles.amortCellHeader, { flex: 2 }]}>Capital</Text>
                  <Text style={[styles.amortCell, styles.amortCellHeader, { flex: 2 }]}>Interés</Text>
                  <Text style={[styles.amortCell, styles.amortCellHeader, { flex: 2 }]}>IVA</Text>
                  <Text style={[styles.amortCell, styles.amortCellHeader, { flex: 2 }]}>Saldo</Text>
                </View>
                {amortization.map((row, i) => (
                  <View key={i} style={styles.amortizationRow}>
                    <Text style={styles.amortCell}>{i + 1}</Text>
                    <Text style={[styles.amortCell, { flex: 2 }]}>{formatCurrency(row.capital)}</Text>
                    <Text style={[styles.amortCell, { flex: 2, color: Colors.light.error }]}>
                      {formatCurrency(row.interest)}
                    </Text>
                    <Text style={[styles.amortCell, { flex: 2, color: Colors.light.error }]}>
                      {formatCurrency(row.iva)}
                    </Text>
                    <Text style={[styles.amortCell, { flex: 2 }]}>{formatCurrency(row.balance)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Pay Modal */}
      <Modal visible={showPayModal} transparent animationType="slide">
        <View style={styles.payModalOverlay}>
          <TouchableOpacity style={styles.payModalBackdrop} onPress={() => setShowPayModal(false)} />
          <View style={styles.payModalContent}>
            <View style={styles.payModalHandle} />
            <Text style={styles.payModalTitle}>
              Pagar cuota #{selectedPayment?.installment_number}
            </Text>

            <Text style={styles.fieldLabel}>Monto</Text>
            <TextInput
              style={styles.payInput}
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="numeric"
              placeholderTextColor={Colors.light.textTertiary}
            />

            <Text style={styles.fieldLabel}>Fecha de pago</Text>
            <TouchableOpacity
              style={styles.payInput}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: Colors.light.text }}>
                {payDate.toLocaleDateString('es-AR')}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={payDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setPayDate(date);
                }}
              />
            )}

            <Text style={styles.fieldLabel}>Medio de pago</Text>
            <View style={styles.methodGroup}>
              {[
                { key: 'cash', label: 'Efectivo', icon: '💵' },
                { key: 'debit', label: 'Débito', icon: '💳' },
                { key: 'transfer', label: 'Transferencia', icon: '🏦' },
                { key: 'card', label: 'Crédito', icon: '💳' },
              ].map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.methodOption, payMethod === m.key && styles.methodActive]}
                  onPress={() => setPayMethod(m.key)}
                >
                  <Text style={styles.methodIcon}>{m.icon}</Text>
                  <Text
                    style={[styles.methodLabel, payMethod === m.key && styles.methodLabelActive]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.payModalButtons}>
              <TouchableOpacity
                style={styles.payModalCancel}
                onPress={() => setShowPayModal(false)}
              >
                <Text style={styles.payModalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.payModalConfirm} onPress={confirmPayment}>
                <Text style={styles.payModalConfirmText}>Confirmar pago</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSize.base,
    color: Colors.light.textSecondary,
  },
  header: {
    backgroundColor: Colors.light.primary,
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.light.surface,
  },
  headerStore: {
    fontSize: FontSize.sm,
    color: Colors.light.surface + 'bf',
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  progressCard: {
    flexDirection: 'row',
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
  progressCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.light.primary,
  },
  progressLabel: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
  },
  progressDetails: {
    flex: 1,
    marginLeft: 20,
    justifyContent: 'center',
    gap: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel2: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
  },
  progressValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
  },
  metricsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surface,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: BorderRadius.lg,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.light.text,
  },
  metricLabel: {
    fontSize: FontSize.xs,
    color: Colors.light.textSecondary,
  },
  metricDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
  },
  costCard: {
    backgroundColor: Colors.light.surface,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: BorderRadius.lg,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  costTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
    marginBottom: 12,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  costLabel: {
    fontSize: FontSize.sm,
    color: Colors.light.textSecondary,
  },
  costValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
  },
  costTotal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.light.border,
    paddingTop: 8,
    marginTop: 4,
  },
  costTotalLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
  },
  costTotalValue: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.light.text,
  },
  paymentsCard: {
    backgroundColor: Colors.light.surface,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: BorderRadius.lg,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  paymentsTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
    marginBottom: 12,
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.light.border,
  },
  paymentPaid: {
    opacity: 0.6,
  },
  paymentOverdue: {
    backgroundColor: Colors.light.error + '08',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentNumberPaid: {
    backgroundColor: Colors.light.success + '20',
  },
  paymentNumberOverdue: {
    backgroundColor: Colors.light.error + '20',
  },
  paymentNumberText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
  },
  paymentNumberTextPaid: {
    color: Colors.light.success,
  },
  paymentInfo: {
    marginLeft: 12,
  },
  paymentDate: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.light.text,
  },
  paymentPaidDate: {
    fontSize: FontSize.xs,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
  paymentRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  paymentAmount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
  },
  payButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: Colors.light.primary,
    borderRadius: BorderRadius.sm,
  },
  payButtonText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.light.surface,
  },
  undoButton: {
    padding: 4,
  },
  amortizationCard: {
    backgroundColor: Colors.light.surface,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: BorderRadius.lg,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  amortizationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amortizationTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.light.text,
  },
  amortizationTable: {
    marginTop: 12,
  },
  amortizationRowHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: 4,
  },
  amortizationRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  amortCell: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.light.text,
  },
  amortCellHeader: {
    fontWeight: FontWeight.semibold,
    color: Colors.light.textSecondary,
  },
  payModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  payModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  payModalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 12,
  },
  payModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.light.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  payModalTitle: {
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
  payInput: {
    backgroundColor: Colors.light.surfaceVariant,
    borderRadius: BorderRadius.md,
    padding: 14,
    fontSize: FontSize.base,
    color: Colors.light.text,
  },
  methodGroup: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  methodOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.surfaceVariant,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodActive: {
    backgroundColor: Colors.light.primary + '15',
    borderColor: Colors.light.primary,
  },
  methodIcon: {
    fontSize: 18,
  },
  methodLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  methodLabelActive: {
    color: Colors.light.primary,
  },
  payModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  payModalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.surfaceVariant,
    alignItems: 'center',
  },
  payModalCancelText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    color: Colors.light.textSecondary,
  },
  payModalConfirm: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.light.success,
    alignItems: 'center',
  },
  payModalConfirmText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.light.surface,
  },
});
