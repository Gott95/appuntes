import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '@/lib/auth-context';
import {
  Household,
  HouseholdMember,
  HouseholdSettings,
  getUserHousehold,
  getHouseholdMembers,
  createHousehold,
  joinHousehold,
  updateHouseholdSettings,
  removeMember,
  deleteHousehold,
} from '@/lib/household';

export function useHousehold() {
  const { user } = useAuthContext();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadHousehold = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const hh = await getUserHousehold(user.id);
    setHousehold(hh);

    if (hh) {
      const mems = await getHouseholdMembers(hh.id);
      setMembers(mems);
      setIsAdmin(mems.some(m => m.user_id === user.id && m.role === 'admin'));
    } else {
      setMembers([]);
      setIsAdmin(false);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadHousehold();
  }, [loadHousehold]);

  const handleCreateHousehold = async (name: string) => {
    if (!user) return null;
    const hh = await createHousehold(user.id, name);
    if (hh) {
      setHousehold(hh);
      const mems = await getHouseholdMembers(hh.id);
      setMembers(mems);
      setIsAdmin(true);
    }
    return hh;
  };

  const handleJoinHousehold = async (code: string) => {
    if (!user) return null;
    const hh = await joinHousehold(user.id, code);
    if (hh) {
      setHousehold(hh);
      const mems = await getHouseholdMembers(hh.id);
      setMembers(mems);
      setIsAdmin(false);
    }
    return hh;
  };

  const handleUpdateSettings = async (settings: Partial<HouseholdSettings>) => {
    if (!household) return;
    await updateHouseholdSettings(household.id, settings);
    setHousehold({ ...household, settings: { ...household.settings, ...settings } });
  };

  const handleRemoveMember = async (userId: string) => {
    if (!household) return;
    await removeMember(household.id, userId);
    setMembers(members.filter(m => m.user_id !== userId));
  };

  const handleLeaveHousehold = async () => {
    if (!household || !user) return;
    await removeMember(household.id, user.id);
    setHousehold(null);
    setMembers([]);
    setIsAdmin(false);
  };

  const handleDeleteHousehold = async () => {
    if (!household) return;
    await deleteHousehold(household.id);
    setHousehold(null);
    setMembers([]);
    setIsAdmin(false);
  };

  return {
    household,
    members,
    loading,
    isAdmin,
    createHousehold: handleCreateHousehold,
    joinHousehold: handleJoinHousehold,
    updateSettings: handleUpdateSettings,
    removeMember: handleRemoveMember,
    leaveHousehold: handleLeaveHousehold,
    deleteHousehold: handleDeleteHousehold,
    refresh: loadHousehold,
  };
}
