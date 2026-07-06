import { supabase } from './supabase';

export interface VaultEntry {
  id: string;
  user_id: string;
  month: number;
  year: number;
  balance: number;
  note: string | null;
  is_manual_adjustment: boolean;
  created_at: string;
  updated_at: string;
}

export async function getVaultEntries(userId: string): Promise<VaultEntry[]> {
  const { data } = await supabase
    .from('vault_entries')
    .select('*')
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  return (data || []) as VaultEntry[];
}

export async function getVaultEntry(userId: string, month: number, year: number): Promise<VaultEntry | null> {
  const { data } = await supabase
    .from('vault_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .single();

  if (!data) return null;
  return data as unknown as VaultEntry;
}

export async function getCurrentBalance(userId: string): Promise<number> {
  const { data } = await supabase
    .from('vault_entries')
    .select('balance')
    .eq('user_id', userId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .single();

  return (data as any)?.balance || 0;
}

export async function saveVaultEntry(
  userId: string,
  month: number,
  year: number,
  balance: number,
  note?: string,
  isManual: boolean = false
): Promise<void> {
  await (supabase as any).from('vault_entries').upsert(
    {
      user_id: userId,
      month,
      year,
      balance,
      note: note || null,
      is_manual_adjustment: isManual,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,month,year' }
  );
}

export async function deleteVaultEntry(id: string): Promise<void> {
  await supabase.from('vault_entries').delete().eq('id', id);
}

export async function getTotalSaved(userId: string): Promise<number> {
  const entries = await getVaultEntries(userId);
  if (entries.length === 0) return 0;
  return entries[0].balance;
}

export async function getMonthlyGrowth(userId: string): Promise<{ month: string; amount: number }[]> {
  const entries = await getVaultEntries(userId);
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  return entries
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    })
    .map((e) => ({
      month: `${monthNames[e.month - 1]} ${e.year}`,
      amount: e.balance,
    }));
}
