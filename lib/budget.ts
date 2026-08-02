import { supabase } from './supabase';

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
  const { data } = await supabase
    .from('profiles')
    .select('monthly_budget')
    .eq('id', userId)
    .single();

  return (data as any)?.monthly_budget || 0;
}

export async function setMonthlyBudget(userId: string, amount: number): Promise<void> {
  await (supabase as any)
    .from('profiles')
    .update({ monthly_budget: amount })
    .eq('id', userId);
}

async function getMonthlySpendingThrough(userId: string, month: number, year: number, week: number): Promise<number> {
  if (week < 1) return 0;

  const pad = (n: number) => String(n).padStart(2, '0');
  const { endDate } = getWeekRange(month, year, week);

  const { data } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', `${year}-${pad(month)}-01`)
    .lte('date', endDate);

  return (data || []).reduce((sum: number, t: any) => sum + t.amount, 0);
}

export async function getWeeklySpending(userId: string, month: number, year: number, week: number): Promise<number> {
  const { startDate, endDate } = getWeekRange(month, year, week);

  const { data } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', startDate)
    .lte('date', endDate);

  return (data || []).reduce((sum: number, t: any) => sum + t.amount, 0);
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
