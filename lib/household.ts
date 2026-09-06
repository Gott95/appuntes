import {
  collection,
  collectionGroup,
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

  try {
    const householdsRef = collection(db, 'households');
    const docRef = await addDoc(householdsRef, {
      name,
      invite_code: inviteCode,
      created_by: userId,
      settings: {
        shared_expenses: false,
        shared_goals: false,
        shared_budget: false,
        chat_enabled: true,
      },
      created_at: new Date().toISOString(),
    });

    const membersRef = collection(db, 'households', docRef.id, 'members');
    await addDoc(membersRef, {
      household_id: docRef.id,
      user_id: userId,
      role: 'admin',
      joined_at: new Date().toISOString(),
    });

    return {
      id: docRef.id,
      name,
      invite_code: inviteCode,
      created_by: userId,
      settings: {
        shared_expenses: false,
        shared_goals: false,
        shared_budget: false,
        chat_enabled: true,
      },
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error creating household:', error);
    return null;
  }
}

export async function joinHousehold(userId: string, inviteCode: string): Promise<Household | null> {
  const householdsRef = collection(db, 'households');
  const q = query(householdsRef, where('invite_code', '==', inviteCode.toUpperCase()));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const householdDoc = snapshot.docs[0];
  const householdData = householdDoc.data() as Household;

  try {
    const membersRef = collection(db, 'households', householdDoc.id, 'members');
    await addDoc(membersRef, {
      household_id: householdDoc.id,
      user_id: userId,
      role: 'member',
      joined_at: new Date().toISOString(),
    });

    await logActivity(householdDoc.id, userId, 'member_joined', {});

    const { id: _hhId, ...hhRest } = householdData as any;
    return { id: householdDoc.id, ...hhRest } as Household;
  } catch (error) {
    console.error('Error joining household:', error);
    return null;
  }
}

export async function getUserHousehold(userId: string): Promise<Household | null> {
  // First check if user created a household
  const householdsRef = collection(db, 'households');
  const createdQ = query(householdsRef, where('created_by', '==', userId));
  const createdSnap = await getDocs(createdQ);

  if (!createdSnap.empty) {
    const hhDoc = createdSnap.docs[0];
    return { id: hhDoc.id, ...hhDoc.data() } as Household;
  }

  // Use collection group query to find household via members subcollection
  const memberQ = query(
    collectionGroup(db, 'members'),
    where('user_id', '==', userId)
  );
  const memberSnap = await getDocs(memberQ);

  if (!memberSnap.empty) {
    // Get the parent household document
    const memberDoc = memberSnap.docs[0];
    const householdRef = doc(db, 'households', memberDoc.ref.parent.parent!.id);
    const householdSnap = await getDoc(householdRef);
    if (householdSnap.exists()) {
      return { id: householdSnap.id, ...householdSnap.data() } as Household;
    }
  }

  return null;
}

export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const membersRef = collection(db, 'households', householdId, 'members');
  const snapshot = await getDocs(membersRef);

  const members: HouseholdMember[] = [];
  for (const memberDoc of snapshot.docs) {
    const memberData = memberDoc.data();
    const userRef = doc(db, 'users', memberData.user_id);
    const userSnap = await getDoc(userRef);

    members.push({
      id: memberDoc.id,
      ...memberData,
      profiles: userSnap.exists() ? { email: userSnap.data().email } : null,
    } as HouseholdMember);
  }

  return members;
}

export async function removeMember(householdId: string, userId: string): Promise<void> {
  const membersRef = collection(db, 'households', householdId, 'members');
  const q = query(membersRef, where('user_id', '==', userId));
  const snapshot = await getDocs(q);

  for (const memDoc of snapshot.docs) {
    await deleteDoc(memDoc.ref);
  }
}

export async function updateHouseholdSettings(
  householdId: string,
  settings: Partial<HouseholdSettings>
): Promise<void> {
  const householdRef = doc(db, 'households', householdId);
  const householdSnap = await getDoc(householdRef);

  if (!householdSnap.exists()) return;

  const currentSettings = householdSnap.data()?.settings || {};
  const updated = { ...currentSettings, ...settings };

  await updateDoc(householdRef, { settings: updated });
}

export async function deleteHousehold(householdId: string): Promise<void> {
  const householdRef = doc(db, 'households', householdId);
  await deleteDoc(householdRef);
}

export async function logActivity(
  householdId: string,
  userId: string,
  type: string,
  data: any
): Promise<void> {
  const activityRef = collection(db, 'households', householdId, 'activity');
  await addDoc(activityRef, {
    household_id: householdId,
    user_id: userId,
    type,
    data,
    created_at: new Date().toISOString(),
  });
}

export async function getActivity(householdId: string, limitCount = 20): Promise<HouseholdActivity[]> {
  const activityRef = collection(db, 'households', householdId, 'activity');
  const q = query(activityRef, orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);

  const activities: HouseholdActivity[] = [];
  const docs = snapshot.docs.slice(0, limitCount);

  for (const actDoc of docs) {
    const actData = actDoc.data();
    const userRef = doc(db, 'users', actData.user_id);
    const userSnap = await getDoc(userRef);

    activities.push({
      id: actDoc.id,
      ...actData,
      profiles: userSnap.exists() ? { email: userSnap.data().email } : null,
    } as HouseholdActivity);
  }

  return activities;
}

export async function getSharedTransactions(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const membersRef = collection(db, 'households', householdId, 'members');
  const membersSnap = await getDocs(membersRef);

  if (membersSnap.empty) return [];

  const userIds = membersSnap.docs.map((doc) => doc.data().user_id);
  const transactions: any[] = [];

  for (const userId of userIds) {
    const transRef = collection(db, 'users', userId, 'transactions');
    const q = query(
      transRef,
      where('is_shared', '==', true),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const snapshot = await getDocs(q);

    for (const transDoc of snapshot.docs) {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      transactions.push({
        id: transDoc.id,
        ...transDoc.data(),
        profiles: userSnap.exists() ? { email: userSnap.data().email } : null,
      });
    }
  }

  return transactions.sort((a, b) => (b.date > a.date ? 1 : -1));
}

export async function getSharedExpenses(householdId: string): Promise<any[]> {
  const membersRef = collection(db, 'households', householdId, 'members');
  const membersSnap = await getDocs(membersRef);

  if (membersSnap.empty) return [];

  const userIds = membersSnap.docs.map((m) => m.data().user_id);
  const expenses: any[] = [];

  for (const userId of userIds) {
    const expRef = collection(db, 'users', userId, 'fixedExpenses');
    const q = query(expRef, where('is_active', '==', true));
    const snapshot = await getDocs(q);

    for (const expDoc of snapshot.docs) {
      expenses.push({
        id: expDoc.id,
        ...expDoc.data(),
      });
    }
  }

  return expenses;
}

export async function getSharedSavingsGoals(householdId: string): Promise<any[]> {
  const membersRef = collection(db, 'households', householdId, 'members');
  const membersSnap = await getDocs(membersRef);

  if (membersSnap.empty) return [];

  const userIds = membersSnap.docs.map((m) => m.data().user_id);
  const goals: any[] = [];

  for (const userId of userIds) {
    const goalsRef = collection(db, 'users', userId, 'savingsGoals');
    const q = query(goalsRef, where('is_completed', '==', false));
    const snapshot = await getDocs(q);

    for (const goalDoc of snapshot.docs) {
      goals.push({
        id: goalDoc.id,
        ...goalDoc.data(),
      });
    }
  }

  return goals;
}

export function isHouseholdAdmin(members: HouseholdMember[], userId: string): boolean {
  return members.some(m => m.user_id === userId && m.role === 'admin');
}
