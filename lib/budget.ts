import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export function getWeekOfMonth(date: Date): number {
  const day = date.getDate();
  return Math.min(Math.ceil(day / 7), 4);
}

export function getWeekRange(month: number, year: number, week: number): { startDate: string; endDate: string } {
  const startDay = (week - 1) * 7 + 1;
  const endDay = Math.min(week * 7, new Date(year, month, 0).getDate());

  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    startDate: `${year}-${pad(month)}-${pad(startDay)}`,
    endDate: `${year}-${pad(month)}-${pad(endDay)}`,
  };
}

export async function getMonthlyBudget(userId: string): Promise<number> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return 0;
  return userSnap.data()?.monthly_budget || 0;
}

export async function setMonthlyBudget(userId: string, amount: number): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { monthly_budget: amount });
}

async function getMonthlySpendingThrough(userId: string, month: number, year: number, week: number): Promise<number> {
  if (week < 1) return 0;

  const pad = (n: number) => String(n).padStart(2, '0');
  const { endDate } = getWeekRange(month, year, week);

  const transactionsRef = collection(db, 'users', userId, 'transactions');
  const q = query(
    transactionsRef,
    where('type', '==', 'expense'),
    where('date', '>=', `${year}-${pad(month)}-01`),
    where('date', '<=', endDate)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
}

export async function getWeeklySpending(userId: string, month: number, year: number, week: number): Promise<number> {
  const { startDate, endDate } = getWeekRange(month, year, week);

  const transactionsRef = collection(db, 'users', userId, 'transactions');
  const q = query(
    transactionsRef,
    where('type', '==', 'expense'),
    where('date', '>=', startDate),
    where('date', '<=', endDate)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
}

export interface WeeklyBudgetResult {
  currentWeek: number;
  currentSpent: number;
  currentBudget: number;
  isOver: boolean;
  monthSpent: number;
  monthRemaining: number;
  weeksRemaining: number;
}

export async function calculateAndAdjustBudgets(
  userId: string,
  month: number,
  year: number,
  monthlyBudget: number
): Promise<WeeklyBudgetResult> {
  const currentWeek = getWeekOfMonth(new Date());
  const weeksRemaining = 4 - currentWeek + 1;

  const monthSpent = await getMonthlySpendingThrough(userId, month, year, currentWeek);
  const currentSpent = await getWeeklySpending(userId, month, year, currentWeek);

  const spentBeforeWeek = Math.max(0, monthSpent - currentSpent);
  const currentBudget = Math.max(0, (monthlyBudget - spentBeforeWeek) / weeksRemaining);
  const monthRemaining = Math.max(0, monthlyBudget - monthSpent);

  return {
    currentWeek,
    currentSpent,
    currentBudget,
    isOver: currentSpent > currentBudget,
    monthSpent,
    monthRemaining,
    weeksRemaining,
  };
}
