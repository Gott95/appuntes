import { supabase } from './supabase';

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
  const { data } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('is_completed', false)
    .order('created_at', { ascending: false });

  return (data || []) as SavingsGoal[];
}

export async function getAllSavingsGoals(userId: string): Promise<SavingsGoal[]> {
  const { data } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId)
    .order('is_completed', { ascending: true })
    .order('created_at', { ascending: false });

  return (data || []) as SavingsGoal[];
}

export async function createSavingsGoal(
  userId: string,
  goal: Omit<SavingsGoal, 'id' | 'user_id' | 'current_amount' | 'is_completed' | 'created_at'>
): Promise<SavingsGoal | null> {
  const { data, error } = await supabase
    .from('savings_goals')
    .insert({ ...goal, user_id: userId } as any)
    .select()
    .single();

  if (error) {
    console.error('Error creating savings goal:', error.message);
    return null;
  }

  return data ? (data as SavingsGoal) : null;
}

export async function updateSavingsGoal(
  goalId: string,
  updates: Partial<Pick<SavingsGoal, 'name' | 'target_amount' | 'deadline' | 'icon' | 'color' | 'is_completed'>>
): Promise<void> {
  await (supabase as any)
    .from('savings_goals')
    .update(updates)
    .eq('id', goalId);
}

export async function deleteSavingsGoal(goalId: string): Promise<void> {
  await supabase.from('savings_goals').delete().eq('id', goalId);
}

export async function addToGoal(
  userId: string,
  goalId: string,
  amount: number,
  note?: string
): Promise<boolean> {
  const { error: entryError } = await supabase.from('savings_entries').insert({
    goal_id: goalId,
    user_id: userId,
    amount,
    note: note || null,
  } as any);

  if (entryError) return false;

  const { data: goal } = await supabase
    .from('savings_goals')
    .select('current_amount, target_amount')
    .eq('id', goalId)
    .single();

  if (!goal) return false;

  const newAmount = (goal as any).current_amount + amount;
  const isCompleted = newAmount >= (goal as any).target_amount;

  await (supabase as any)
    .from('savings_goals')
    .update({ current_amount: newAmount, is_completed: isCompleted })
    .eq('id', goalId);

  return true;
}

export async function getGoalEntries(goalId: string): Promise<SavingsEntry[]> {
  const { data } = await supabase
    .from('savings_entries')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false });

  return (data || []) as SavingsEntry[];
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
