import { supabase } from './supabase';

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  settings: HouseholdSettings;
  created_at: string;
}

export interface HouseholdSettings {
  shared_expenses: boolean;
  shared_goals: boolean;
  shared_budget: boolean;
  chat_enabled: boolean;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profiles?: { email: string } | null;
}

export interface HouseholdActivity {
  id: string;
  household_id: string;
  user_id: string;
  type: string;
  data: any;
  created_at: string;
  profiles?: { email: string } | null;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createHousehold(userId: string, name: string): Promise<Household | null> {
  const inviteCode = generateInviteCode();

  const { data, error } = await supabase
    .from('households')
    .insert({ name, invite_code: inviteCode, created_by: userId } as any)
    .select()
    .single();

  if (error) {
    console.error('Error creating household:', error.message);
    return null;
  }
  if (!data) return null;

  const householdData = data as any;

  const { error: memberError } = await supabase.from('household_members').insert({
    household_id: householdData.id,
    user_id: userId,
    role: 'admin',
  } as any);

  if (memberError) {
    console.error('Error adding member:', memberError.message);
  }

  return householdData as Household;
}

export async function joinHousehold(userId: string, inviteCode: string): Promise<Household | null> {
  const { data: household } = await supabase
    .from('households')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (!household) return null;

  const hhData = household as any;

  const { error } = await supabase.from('household_members').insert({
    household_id: hhData.id,
    user_id: userId,
    role: 'member',
  } as any);

  if (error) return null;

  await logActivity(hhData.id, userId, 'member_joined', {});

  return hhData as Household;
}

export async function getUserHousehold(userId: string): Promise<Household | null> {
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .single();

  if (!membership) return null;

  const { data } = await supabase
    .from('households')
    .select('*')
    .eq('id', (membership as any).household_id)
    .single();

  return data ? (data as Household) : null;
}

export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const { data } = await supabase
    .from('household_members')
    .select('*, profiles(email)')
    .eq('household_id', householdId);

  return (data || []) as HouseholdMember[];
}

export async function removeMember(householdId: string, userId: string): Promise<void> {
  await supabase
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', userId);
}

export async function updateHouseholdSettings(
  householdId: string,
  settings: Partial<HouseholdSettings>
): Promise<void> {
  const { data: current } = await supabase
    .from('households')
    .select('settings')
    .eq('id', householdId)
    .single();

  const currentSettings = (current as any)?.settings || {};
  const updated = { ...currentSettings, ...settings };

  await (supabase as any)
    .from('households')
    .update({ settings: updated })
    .eq('id', householdId);
}

export async function deleteHousehold(householdId: string): Promise<void> {
  await supabase.from('households').delete().eq('id', householdId);
}

export async function logActivity(
  householdId: string,
  userId: string,
  type: string,
  data: any
): Promise<void> {
  await supabase.from('household_activity').insert({
    household_id: householdId,
    user_id: userId,
    type,
    data,
  } as any);
}

export async function getActivity(householdId: string, limit = 20): Promise<HouseholdActivity[]> {
  const { data } = await supabase
    .from('household_activity')
    .select('*, profiles(email)')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []) as HouseholdActivity[];
}

export async function getSharedTransactions(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const { data: members } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId);

  if (!members || members.length === 0) return [];

  const userIds = members.map((m: any) => m.user_id);

  const { data } = await supabase
    .from('transactions')
    .select('*, profiles(email)')
    .eq('is_shared', true)
    .in('user_id', userIds)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  return data || [];
}

export async function getSharedExpenses(householdId: string): Promise<any[]> {
  const { data: members } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId);

  if (!members || members.length === 0) return [];

  const userIds = members.map((m: any) => m.user_id);

  const { data } = await supabase
    .from('fixed_expenses')
    .select('*, categories(name, icon)')
    .in('user_id', userIds)
    .eq('is_active', true);

  return data || [];
}

export async function getSharedSavingsGoals(householdId: string): Promise<any[]> {
  const { data: members } = await supabase
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId);

  if (!members || members.length === 0) return [];

  const userIds = members.map((m: any) => m.user_id);

  const { data } = await supabase
    .from('savings_goals')
    .select('*')
    .in('user_id', userIds)
    .eq('is_completed', false);

  return data || [];
}

export function isHouseholdAdmin(members: HouseholdMember[], userId: string): boolean {
  return members.some(m => m.user_id === userId && m.role === 'admin');
}
