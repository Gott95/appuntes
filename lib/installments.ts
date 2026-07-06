import { supabase } from './supabase';

export interface InstallmentPlan {
  id: string;
  user_id: string;
  name: string;
  store: string;
  category_id: string | null;
  total_amount: number;
  down_payment: number;
  financed_amount: number;
  installment_count: number;
  installment_amount: number;
  payment_frequency: string;
  interest_type: string;
  tna: number | null;
  tea: number | null;
  tem: number | null;
  cft: number | null;
  amortization_system: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string;
  is_shared: boolean;
  created_by: string | null;
  created_at: string;
}

export interface InstallmentPayment {
  id: string;
  plan_id: string;
  user_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  capital_amount: number;
  interest_amount: number;
  iva_amount: number;
  status: string;
  paid_amount: number;
  paid_date: string | null;
  payment_method: string;
  notes: string;
  created_at: string;
}

export interface PlanWithPayments extends InstallmentPlan {
  payments: InstallmentPayment[];
  total_paid: number;
  total_remaining: number;
  percentage_paid: number;
  months_remaining: number;
  next_payment: InstallmentPayment | null;
}

// --- CALCULATIONS ---

export function calculateTEM(tna: number): number {
  return tna / 12;
}

export function calculateTEMCompound(tna: number): number {
  return Math.pow(1 + tna, 1 / 12) - 1;
}

export function calculateFrenchCuota(capital: number, tem: number, n: number): number {
  if (tem === 0) return capital / n;
  const factor = Math.pow(1 + tem, n);
  return capital * (tem * factor) / (factor - 1);
}

export function generateAmortizationSchedule(
  capital: number,
  cuotaAmount: number,
  tem: number,
  n: number,
  startDate: string
): { capital: number; interest: number; iva: number; balance: number; dueDate: string }[] {
  const schedule = [];
  let balance = capital;

  for (let i = 0; i < n; i++) {
    const interest = balance * tem;
    const iva = interest * 0.21;
    const capitalPayment = cuotaAmount - interest - iva;
    balance = Math.max(0, balance - capitalPayment);

    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i + 1);

    schedule.push({
      capital: Math.round(capitalPayment * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      iva: Math.round(iva * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      dueDate: dueDate.toISOString().split('T')[0],
    });
  }

  return schedule;
}

export function calculateTotalCost(
  installmentAmount: number,
  installmentCount: number,
  downPayment: number,
  interestType: string,
  tem: number | null,
  financedAmount: number
): { totalFinanced: number; totalInterest: number; totalIVA: number; totalCost: number } {
  if (interestType === 'zero' || !tem) {
    return {
      totalFinanced: installmentAmount * installmentCount,
      totalInterest: 0,
      totalIVA: 0,
      totalCost: downPayment + installmentAmount * installmentCount,
    };
  }

  let totalInterest = 0;
  let totalIVA = 0;
  let balance = financedAmount;

  for (let i = 0; i < installmentCount; i++) {
    const interest = balance * tem;
    const iva = interest * 0.21;
    const capitalPayment = installmentAmount - interest - iva;
    totalInterest += interest;
    totalIVA += iva;
    balance = Math.max(0, balance - capitalPayment);
  }

  return {
    totalFinanced: installmentAmount * installmentCount,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalIVA: Math.round(totalIVA * 100) / 100,
    totalCost: Math.round((downPayment + installmentAmount * installmentCount) * 100) / 100,
  };
}

export function calculateEndDate(startDate: string, installmentCount: number): string {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + installmentCount);
  return date.toISOString().split('T')[0];
}

export function calculateMonthsRemaining(endDate: string): number {
  const now = new Date();
  now.setDate(1);
  const end = new Date(endDate);
  end.setDate(1);
  const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  return Math.max(months, 0);
}

// --- CRUD ---

export async function getInstallmentPlans(userId: string): Promise<InstallmentPlan[]> {
  const { data } = await supabase
    .from('installment_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  return (data || []) as InstallmentPlan[];
}

export async function getAllInstallmentPlans(userId: string): Promise<InstallmentPlan[]> {
  const { data } = await supabase
    .from('installment_plans')
    .select('*')
    .eq('user_id', userId)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });

  return (data || []) as InstallmentPlan[];
}

export async function getPlanWithPayments(planId: string): Promise<PlanWithPayments | null> {
  const { data: plan } = await supabase
    .from('installment_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (!plan) return null;

  const { data: payments } = await supabase
    .from('installment_payments')
    .select('*')
    .eq('plan_id', planId)
    .order('installment_number', { ascending: true });

  const p = plan as InstallmentPlan;
  const pays = (payments || []) as InstallmentPayment[];

  const totalPaid = pays
    .filter((pay) => pay.status === 'paid')
    .reduce((sum, pay) => sum + pay.paid_amount, 0);

  const totalRemaining = p.financed_amount - totalPaid;
  const percentagePaid = p.financed_amount > 0
    ? Math.min(Math.round((totalPaid / p.financed_amount) * 100), 100)
    : 0;

  const monthsRemaining = calculateMonthsRemaining(p.end_date);
  const nextPayment = pays.find((pay) => pay.status === 'pending' || pay.status === 'overdue') || null;

  return {
    ...p,
    payments: pays,
    total_paid: totalPaid,
    total_remaining: Math.max(0, totalRemaining),
    percentage_paid: percentagePaid,
    months_remaining: monthsRemaining,
    next_payment: nextPayment,
  };
}

export async function getAllPlansWithPayments(userId: string): Promise<PlanWithPayments[]> {
  const plans = await getInstallmentPlans(userId);
  const plansWithPayments: PlanWithPayments[] = [];

  for (const plan of plans) {
    const { data: payments } = await supabase
      .from('installment_payments')
      .select('*')
      .eq('plan_id', plan.id)
      .order('installment_number', { ascending: true });

    const pays = (payments || []) as InstallmentPayment[];
    const totalPaid = pays
      .filter((pay) => pay.status === 'paid')
      .reduce((sum, pay) => sum + pay.paid_amount, 0);

    const totalRemaining = plan.financed_amount - totalPaid;
    const percentagePaid = plan.financed_amount > 0
      ? Math.min(Math.round((totalPaid / plan.financed_amount) * 100), 100)
      : 0;

    const monthsRemaining = calculateMonthsRemaining(plan.end_date);
    const nextPayment = pays.find((pay) => pay.status === 'pending' || pay.status === 'overdue') || null;

    plansWithPayments.push({
      ...plan,
      payments: pays,
      total_paid: totalPaid,
      total_remaining: Math.max(0, totalRemaining),
      percentage_paid: percentagePaid,
      months_remaining: monthsRemaining,
      next_payment: nextPayment,
    });
  }

  return plansWithPayments;
}

export async function createInstallmentPlan(
  userId: string,
  plan: Omit<InstallmentPlan, 'id' | 'user_id' | 'created_at' | 'end_date'>,
  payments: Omit<InstallmentPayment, 'id' | 'user_id' | 'created_at'>[]
): Promise<InstallmentPlan | null> {
  const endDate = calculateEndDate(plan.start_date, plan.installment_count);

  const { data, error } = await supabase
    .from('installment_plans')
    .insert({ ...plan, user_id: userId, end_date: endDate } as any)
    .select()
    .single();

  if (error || !data) {
    console.error('Error creating installment plan:', error?.message);
    return null;
  }

  const newPlan = data as InstallmentPlan;

  if (payments.length > 0) {
    const paymentsToInsert = payments.map((pay) => ({
      ...pay,
      user_id: userId,
      plan_id: newPlan.id,
    }));

    const { error: payError } = await supabase
      .from('installment_payments')
      .insert(paymentsToInsert as any);

    if (payError) {
      console.error('Error creating installment payments:', payError.message);
    }
  }

  return newPlan;
}

export async function updateInstallmentPlan(
  planId: string,
  updates: Partial<Pick<InstallmentPlan, 'name' | 'store' | 'category_id' | 'notes' | 'status' | 'is_shared'>>
): Promise<void> {
  await (supabase as any)
    .from('installment_plans')
    .update(updates)
    .eq('id', planId);
}

export async function deleteInstallmentPlan(planId: string): Promise<void> {
  await supabase.from('installment_plans').delete().eq('id', planId);
}

export async function markPaymentAsPaid(
  paymentId: string,
  paidAmount: number,
  paidDate: string,
  paymentMethod: string = 'cash'
): Promise<boolean> {
  console.log('markPaymentAsPaid:', { paymentId, paidAmount, paidDate, paymentMethod });
  const { data, error } = await (supabase as any)
    .from('installment_payments')
    .update({
      status: 'paid',
      paid_amount: paidAmount,
      paid_date: paidDate,
      payment_method: paymentMethod,
    })
    .eq('id', paymentId)
    .select();

  if (error) {
    console.error('Error marking payment as paid:', error.message);
    return false;
  }

  console.log('markPaymentAsPaid result:', data);
  return true;
}

export async function markPaymentAsPending(paymentId: string): Promise<boolean> {
  const { error } = await (supabase as any)
    .from('installment_payments')
    .update({
      status: 'pending',
      paid_amount: 0,
      paid_date: null,
      payment_method: 'cash',
    })
    .eq('id', paymentId);

  return !error;
}

export async function getMonthlyInstallmentsTotal(userId: string, month: number, year: number): Promise<number> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data } = await supabase
    .from('installment_payments')
    .select('amount, installment_plans!inner(user_id, status)')
    .gte('due_date', startDate)
    .lte('due_date', endDate)
    .neq('status', 'paid');

  if (!data) return 0;

  return data
    .filter((item: any) => item.installment_plans?.user_id === userId && item.installment_plans?.status === 'active')
    .reduce((sum: number, item: any) => sum + item.amount, 0);
}

export async function getMonthlyPaidInstallments(userId: string, month: number, year: number): Promise<number> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data } = await supabase
    .from('installment_payments')
    .select('paid_amount, paid_date, due_date, installment_plans!inner(user_id)')
    .eq('status', 'paid')
    .gte('paid_date', startDate)
    .lte('paid_date', endDate);

  console.log('getMonthlyPaidInstallments:', { month, year, startDate, endDate, dataCount: data?.length, data });

  if (!data) return 0;

  return data
    .filter((item: any) => item.installment_plans?.user_id === userId)
    .reduce((sum: number, item: any) => sum + (item.paid_amount || 0), 0);
}

export async function getUpcomingPayments(userId: string, daysAhead: number = 30): Promise<(InstallmentPayment & { plan_name: string; plan_store: string })[]> {
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  const futureStr = futureDate.toISOString().split('T')[0];

  const { data } = await supabase
    .from('installment_payments')
    .select('*, installment_plans!inner(user_id, name, store, status)')
    .gte('due_date', today)
    .lte('due_date', futureStr)
    .eq('status', 'pending')
    .order('due_date', { ascending: true });

  if (!data) return [];

  return data
    .filter((item: any) => item.installment_plans?.user_id === userId && item.installment_plans?.status === 'active')
    .map((item: any) => ({
      ...item,
      plan_name: item.installment_plans?.name || '',
      plan_store: item.installment_plans?.store || '',
    }));
}

export async function getOverduePayments(userId: string): Promise<(InstallmentPayment & { plan_name: string })[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('installment_payments')
    .select('*, installment_plans!inner(user_id, name, status)')
    .lt('due_date', today)
    .eq('status', 'pending')
    .order('due_date', { ascending: true });

  if (!data) return [];

  return data
    .filter((item: any) => item.installment_plans?.user_id === userId && item.installment_plans?.status === 'active')
    .map((item: any) => ({
      ...item,
      plan_name: item.installment_plans?.name || '',
    }));
}
