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

export async function getBudgetOverride(userId: string, month: number, year: number, week: number): Promise<number | null> {
  const { data } = await supabase
    .from('budget_overrides')
    .select('adjusted_amount')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .eq('week_number', week)
    .single();

  return (data as any)?.adjusted_amount ?? null;
}

export async function saveBudgetOverride(
  userId: string,
  month: number,
  year: number,
  week: number,
  originalAmount: number,
  adjustedAmount: number
): Promise<void> {
  await (supabase as any).from('budget_overrides').upsert(
    {
      user_id: userId,
      month,
      year,
      week_number: week,
      original_amount: originalAmount,
      adjusted_amount: adjustedAmount,
    },
    { onConflict: 'user_id,month,year,week_number' }
  );
}

export async function getWeekBudget(
  userId: string,
  month: number,
  year: number,
  week: number,
  monthlyBudget: number
): Promise<number> {
  const override = await getBudgetOverride(userId, month, year, week);
  if (override !== null) return override;
  return monthlyBudget / 4;
}

export async function calculateAndAdjustBudgets(
  userId: string,
  month: number,
  year: number,
  monthlyBudget: number
): Promise<{ currentWeek: number; currentSpent: number; currentBudget: number; isOver: boolean }> {
  const currentWeek = getWeekOfMonth(new Date());
  const weeklyBudget = monthlyBudget / 4;
  const currentSpent = await getWeeklySpending(userId, month, year, currentWeek);

  for (let w = 1; w < currentWeek; w++) {
    const weekSpent = await getWeeklySpending(userId, month, year, w);
    if (weekSpent > weeklyBudget) {
      const overspend = weekSpent - weeklyBudget;
      const remainingWeeks = 4 - w;
      const reductionPerWeek = overspend / remainingWeeks;

      for (let rw = w + 1; rw <= 4; rw++) {
        const existingOverride = await getBudgetOverride(userId, month, year, rw);
        const baseBudget = existingOverride !== null ? existingOverride : weeklyBudget;
        const newBudget = Math.max(0, baseBudget - reductionPerWeek);
        await saveBudgetOverride(userId, month, year, rw, weeklyBudget, newBudget);
      }
    }
  }

  const currentBudget = await getWeekBudget(userId, month, year, currentWeek, monthlyBudget);

  return {
    currentWeek,
    currentSpent,
    currentBudget,
    isOver: currentSpent > currentBudget,
  };
}
