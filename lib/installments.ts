import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

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
  partner_name: string;
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

export async function getInstallmentPlans(userId: string): Promise<InstallmentPlan[]> {
  const plansRef = collection(db, 'users', userId, 'installmentPlans');
  const q = query(plansRef, where('status', '==', 'active'), orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as InstallmentPlan));
}

export async function getAllInstallmentPlans(userId: string): Promise<InstallmentPlan[]> {
  const plansRef = collection(db, 'users', userId, 'installmentPlans');
  const q = query(plansRef, orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as InstallmentPlan));
}

export async function getPlanWithPayments(planId: string, userId: string): Promise<PlanWithPayments | null> {
  const planRef = doc(db, 'users', userId, 'installmentPlans', planId);
  const planSnap = await getDoc(planRef);

  if (!planSnap.exists()) return null;

  const planData = { id: planSnap.id, ...planSnap.data() } as InstallmentPlan;

  const paymentsRef = collection(db, 'users', userId, 'installmentPlans', planId, 'payments');
  const q = query(paymentsRef, orderBy('installment_number', 'asc'));
  const paymentsSnap = await getDocs(q);

  const payments = paymentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as InstallmentPayment));

  const totalPaid = payments
    .filter((pay) => pay.status === 'paid')
    .reduce((sum, pay) => sum + pay.paid_amount, 0);

  const totalRemaining = planData.financed_amount - totalPaid;
  const percentagePaid = planData.financed_amount > 0
    ? Math.min(Math.round((totalPaid / planData.financed_amount) * 100), 100)
    : 0;

  const monthsRemaining = calculateMonthsRemaining(planData.end_date);
  const nextPayment = payments.find((pay) => pay.status === 'pending' || pay.status === 'overdue') || null;

  return {
    ...planData,
    payments,
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
    const result = await getPlanWithPayments(plan.id, userId);
    if (result) {
      plansWithPayments.push(result);
    }
  }

  return plansWithPayments;
}

export async function createInstallmentPlan(
  userId: string,
  plan: Omit<InstallmentPlan, 'id' | 'user_id' | 'created_at' | 'end_date'>,
  payments: Omit<InstallmentPayment, 'id' | 'user_id' | 'created_at'>[]
): Promise<InstallmentPlan | null> {
  const endDate = calculateEndDate(plan.start_date, plan.installment_count);

  try {
    const plansRef = collection(db, 'users', userId, 'installmentPlans');
    const docRef = await addDoc(plansRef, {
      ...plan,
      user_id: userId,
      end_date: endDate,
      created_at: new Date().toISOString(),
    });

    if (payments.length > 0) {
      const batch = writeBatch(db);

      payments.forEach((pay) => {
        const payRef = doc(collection(db, 'users', userId, 'installmentPlans', docRef.id, 'payments'));
        batch.set(payRef, {
          ...pay,
          user_id: userId,
          plan_id: docRef.id,
          created_at: new Date().toISOString(),
        });
      });

      await batch.commit();
    }

    return {
      id: docRef.id,
      ...plan,
      user_id: userId,
      end_date: endDate,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error creating installment plan:', error);
    return null;
  }
}

export async function updateInstallmentPlan(
  planId: string,
  updates: Partial<Pick<InstallmentPlan, 'name' | 'store' | 'category_id' | 'notes' | 'status' | 'is_shared'>>,
  userId?: string
): Promise<void> {
  if (!userId) throw new Error('userId required for Firestore');
  const planRef = doc(db, 'users', userId, 'installmentPlans', planId);
  await updateDoc(planRef, updates);
}

export async function updateInstallmentPlanDetails(
  planId: string,
  name: string,
  store: string,
  startDate: string,
  userId?: string,
  partnerName?: string,
): Promise<boolean> {
  if (!userId) throw new Error('userId required for Firestore');

  const planRef = doc(db, 'users', userId, 'installmentPlans', planId);
  const planSnap = await getDoc(planRef);

  if (!planSnap.exists()) return false;

  const planData = planSnap.data();
  const endDate = calculateEndDate(startDate, planData.installment_count);

  const updateData: any = { name, store, start_date: startDate, end_date: endDate };
  if (partnerName !== undefined) {
    updateData.partner_name = partnerName;
  }

  await updateDoc(planRef, updateData);

  const paymentsRef = collection(db, 'users', userId, 'installmentPlans', planId, 'payments');
  const q = query(paymentsRef, orderBy('installment_number', 'asc'));
  const paymentsSnap = await getDocs(q);

  for (const payDoc of paymentsSnap.docs) {
    const payData = payDoc.data();
    if (payData.status === 'paid') continue;

    const newDueDate = new Date(startDate);
    newDueDate.setMonth(newDueDate.getMonth() + payData.installment_number);

    await updateDoc(payDoc.ref, { due_date: newDueDate.toISOString().split('T')[0] });
  }

  return true;
}

export async function deleteInstallmentPlan(planId: string, userId?: string): Promise<void> {
  if (!userId) throw new Error('userId required for Firestore');
  const planRef = doc(db, 'users', userId, 'installmentPlans', planId);
  await deleteDoc(planRef);
}

export async function markPaymentAsPaid(
  paymentId: string,
  paidAmount: number,
  paidDate: string,
  userId?: string,
  planId?: string,
  paymentMethod: string = 'cash'
): Promise<boolean> {
  if (!userId || !planId) throw new Error('userId and planId required for Firestore');

  try {
    const payRef = doc(db, 'users', userId, 'installmentPlans', planId, 'payments', paymentId);
    await updateDoc(payRef, {
      status: 'paid',
      paid_amount: paidAmount,
      paid_date: paidDate,
      payment_method: paymentMethod,
    });
    return true;
  } catch (error) {
    console.error('Error marking payment as paid:', error);
    return false;
  }
}

export async function markPaymentAsPending(paymentId: string, userId?: string, planId?: string): Promise<boolean> {
  if (!userId || !planId) throw new Error('userId and planId required for Firestore');

  try {
    const payRef = doc(db, 'users', userId, 'installmentPlans', planId, 'payments', paymentId);
    await updateDoc(payRef, {
      status: 'pending',
      paid_amount: 0,
      paid_date: null,
      payment_method: 'cash',
    });
    return true;
  } catch (error) {
    console.error('Error marking payment as pending:', error);
    return false;
  }
}

export async function applyExtraPayment(
  paymentId: string,
  paidAmount: number,
  paidDate: string,
  userId?: string,
  planId?: string,
  paymentMethod: string = 'cash'
): Promise<boolean> {
  if (!userId || !planId) throw new Error('userId and planId required for Firestore');

  try {
    const payRef = doc(db, 'users', userId, 'installmentPlans', planId, 'payments', paymentId);
    const paySnap = await getDoc(payRef);

    if (!paySnap.exists()) return false;

    const currentPayment = paySnap.data();

    await updateDoc(payRef, {
      status: 'paid',
      paid_amount: paidAmount,
      paid_date: paidDate,
      payment_method: paymentMethod,
    });

    const excess = paidAmount - currentPayment.amount;
    if (excess <= 0) return true;

    const paymentsRef = collection(db, 'users', userId, 'installmentPlans', planId, 'payments');
    const q = query(paymentsRef, where('status', '==', 'pending'), orderBy('installment_number', 'asc'));
    const pendingSnap = await getDocs(q);

    if (pendingSnap.empty) return true;

    let remaining = excess;

    for (const pendingDoc of pendingSnap.docs) {
      if (remaining <= 0) break;

      const pendingData = pendingDoc.data();

      if (remaining >= pendingData.amount) {
        await updateDoc(pendingDoc.ref, {
          status: 'paid',
          paid_amount: pendingData.amount,
          paid_date: paidDate,
          payment_method: paymentMethod,
        });
        remaining -= pendingData.amount;
      } else {
        const newAmount = Math.round((pendingData.amount - remaining) * 100) / 100;
        await updateDoc(pendingDoc.ref, { amount: newAmount });
        remaining = 0;
      }
    }

    return true;
  } catch (error) {
    console.error('Error applying extra payment:', error);
    return false;
  }
}

export async function getMonthlyInstallmentsTotal(userId: string, month: number, year: number): Promise<number> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const plansRef = collection(db, 'users', userId, 'installmentPlans');
  const plansQ = query(plansRef, where('status', '==', 'active'));
  const plansSnap = await getDocs(plansQ);

  let total = 0;

  for (const planDoc of plansSnap.docs) {
    const paymentsRef = collection(db, 'users', userId, 'installmentPlans', planDoc.id, 'payments');
    const q = query(
      paymentsRef,
      where('status', '!=', 'paid'),
      where('due_date', '>=', startDate),
      where('due_date', '<=', endDate)
    );
    const snapshot = await getDocs(q);

    snapshot.docs.forEach((doc) => {
      total += doc.data().amount || 0;
    });
  }

  return total;
}

export async function getMonthlyPaidInstallments(userId: string, month: number, year: number): Promise<number> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const plansRef = collection(db, 'users', userId, 'installmentPlans');
  const plansSnap = await getDocs(plansRef);

  let total = 0;

  for (const planDoc of plansSnap.docs) {
    const paymentsRef = collection(db, 'users', userId, 'installmentPlans', planDoc.id, 'payments');
    const q = query(
      paymentsRef,
      where('status', '==', 'paid'),
      where('due_date', '>=', startDate),
      where('due_date', '<=', endDate)
    );
    const snapshot = await getDocs(q);

    snapshot.docs.forEach((doc) => {
      total += doc.data().paid_amount || 0;
    });
  }

  return total;
}

export async function getUpcomingPayments(userId: string, daysAhead: number = 30): Promise<(InstallmentPayment & { plan_name: string; plan_store: string })[]> {
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  const futureStr = futureDate.toISOString().split('T')[0];

  const plansRef = collection(db, 'users', userId, 'installmentPlans');
  const plansQ = query(plansRef, where('status', '==', 'active'));
  const plansSnap = await getDocs(plansQ);

  const upcoming: (InstallmentPayment & { plan_name: string; plan_store: string })[] = [];

  for (const planDoc of plansSnap.docs) {
    const planData = planDoc.data();
    const paymentsRef = collection(db, 'users', userId, 'installmentPlans', planDoc.id, 'payments');
    const q = query(
      paymentsRef,
      where('status', '==', 'pending'),
      where('due_date', '>=', today),
      where('due_date', '<=', futureStr)
    );
    const snapshot = await getDocs(q);

    snapshot.docs.forEach((doc) => {
      upcoming.push({
        id: doc.id,
        ...doc.data(),
        plan_name: planData.name || '',
        plan_store: planData.store || '',
      } as InstallmentPayment & { plan_name: string; plan_store: string });
    });
  }

  return upcoming.sort((a, b) => (a.due_date > b.due_date ? 1 : -1));
}

export async function getOverduePayments(userId: string): Promise<(InstallmentPayment & { plan_name: string })[]> {
  const today = new Date().toISOString().split('T')[0];

  const plansRef = collection(db, 'users', userId, 'installmentPlans');
  const plansQ = query(plansRef, where('status', '==', 'active'));
  const plansSnap = await getDocs(plansQ);

  const overdue: (InstallmentPayment & { plan_name: string })[] = [];

  for (const planDoc of plansSnap.docs) {
    const planData = planDoc.data();
    const paymentsRef = collection(db, 'users', userId, 'installmentPlans', planDoc.id, 'payments');
    const q = query(
      paymentsRef,
      where('status', '==', 'pending'),
      where('due_date', '<', today)
    );
    const snapshot = await getDocs(q);

    snapshot.docs.forEach((doc) => {
      overdue.push({
        id: doc.id,
        ...doc.data(),
        plan_name: planData.name || '',
      } as InstallmentPayment & { plan_name: string });
    });
  }

  return overdue.sort((a, b) => (a.due_date > b.due_date ? 1 : -1));
}
