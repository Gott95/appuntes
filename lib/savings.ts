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

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  icon: string;
  color: string;
  is_completed: boolean;
  created_at: string;
}

export interface SavingsEntry {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export async function getSavingsGoals(userId: string): Promise<SavingsGoal[]> {
  const goalsRef = collection(db, 'users', userId, 'savingsGoals');
  const q = query(
    goalsRef,
    where('is_completed', '==', false),
    orderBy('created_at', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SavingsGoal));
}

export async function getAllSavingsGoals(userId: string): Promise<SavingsGoal[]> {
  const goalsRef = collection(db, 'users', userId, 'savingsGoals');
  const q = query(goalsRef, orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SavingsGoal));
}

export async function createSavingsGoal(
  userId: string,
  goal: Omit<SavingsGoal, 'id' | 'user_id' | 'current_amount' | 'is_completed' | 'created_at'>
): Promise<SavingsGoal | null> {
  try {
    const goalsRef = collection(db, 'users', userId, 'savingsGoals');
    const docRef = await addDoc(goalsRef, {
      ...goal,
      user_id: userId,
      current_amount: 0,
      is_completed: false,
      created_at: new Date().toISOString(),
    });

    return {
      id: docRef.id,
      ...goal,
      user_id: userId,
      current_amount: 0,
      is_completed: false,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error creating savings goal:', error);
    return null;
  }
}

export async function updateSavingsGoal(
  goalId: string,
  updates: Partial<Pick<SavingsGoal, 'name' | 'target_amount' | 'deadline' | 'icon' | 'color' | 'is_completed'>>,
  userId?: string
): Promise<void> {
  if (!userId) throw new Error('userId required for Firestore');
  const goalRef = doc(db, 'users', userId, 'savingsGoals', goalId);
  await updateDoc(goalRef, updates);
}

export async function deleteSavingsGoal(goalId: string, userId?: string): Promise<void> {
  if (!userId) throw new Error('userId required for Firestore');
  const goalRef = doc(db, 'users', userId, 'savingsGoals', goalId);
  await deleteDoc(goalRef);
}

export async function addToGoal(
  userId: string,
  goalId: string,
  amount: number,
  note?: string
): Promise<boolean> {
  try {
    const entriesRef = collection(db, 'users', userId, 'savingsGoals', goalId, 'entries');
    await addDoc(entriesRef, {
      goal_id: goalId,
      user_id: userId,
      amount,
      note: note || null,
      created_at: new Date().toISOString(),
    });

    const goalRef = doc(db, 'users', userId, 'savingsGoals', goalId);
    const goalSnap = await getDoc(goalRef);

    if (!goalSnap.exists()) return false;

    const goalData = goalSnap.data();
    const newAmount = (goalData.current_amount || 0) + amount;
    const isCompleted = newAmount >= (goalData.target_amount || 0);

    await updateDoc(goalRef, { current_amount: newAmount, is_completed: isCompleted });

    return true;
  } catch (error) {
    console.error('Error adding to goal:', error);
    return false;
  }
}

export async function getGoalEntries(goalId: string, userId?: string): Promise<SavingsEntry[]> {
  if (!userId) throw new Error('userId required for Firestore');
  const entriesRef = collection(db, 'users', userId, 'savingsGoals', goalId, 'entries');
  const q = query(entriesRef, orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SavingsEntry));
}

export function getProgressPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}

export function getMonthsRemaining(deadline: string | null): number | null {
  if (!deadline) return null;
  const now = new Date();
  const end = new Date(deadline);
  const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  return Math.max(months, 0);
}

export function getMonthlyNeeded(current: number, target: number, monthsLeft: number | null): number | null {
  if (monthsLeft === null || monthsLeft <= 0) return null;
  const remaining = target - current;
  if (remaining <= 0) return 0;
  return remaining / monthsLeft;
}

export const GOAL_ICONS = ['🎯', '🏠', '🚗', '✈️', '💍', '📱', '💻', '🎓', '🏥', '🏖️', '🎸', '👗', '🎮', '📚', '💰', '🎁'];
export const GOAL_COLORS = ['#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#2563eb', '#ea580c'];
