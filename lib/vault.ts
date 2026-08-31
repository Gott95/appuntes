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
  limit,
} from 'firebase/firestore';
import { db } from './firebase';

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
  const entriesRef = collection(db, 'users', userId, 'vaultEntries');
  const q = query(entriesRef, orderBy('year', 'desc'), orderBy('month', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as VaultEntry));
}

export async function getVaultEntry(userId: string, month: number, year: number): Promise<VaultEntry | null> {
  const entriesRef = collection(db, 'users', userId, 'vaultEntries');
  const q = query(
    entriesRef,
    where('month', '==', month),
    where('year', '==', year),
    limit(1)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as VaultEntry;
}

export async function getCurrentBalance(userId: string): Promise<number> {
  const entriesRef = collection(db, 'users', userId, 'vaultEntries');
  const q = query(entriesRef, orderBy('year', 'desc'), orderBy('month', 'desc'), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return 0;
  return snapshot.docs[0].data()?.balance || 0;
}

export async function saveVaultEntry(
  userId: string,
  month: number,
  year: number,
  balance: number,
  note?: string,
  isManual: boolean = false
): Promise<void> {
  const existing = await getVaultEntry(userId, month, year);

  if (existing) {
    const entryRef = doc(db, 'users', userId, 'vaultEntries', existing.id);
    await updateDoc(entryRef, {
      balance,
      note: note || null,
      is_manual_adjustment: isManual,
      updated_at: new Date().toISOString(),
    });
  } else {
    const entriesRef = collection(db, 'users', userId, 'vaultEntries');
    await addDoc(entriesRef, {
      user_id: userId,
      month,
      year,
      balance,
      note: note || null,
      is_manual_adjustment: isManual,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}

export async function deleteVaultEntry(id: string, userId?: string): Promise<void> {
  if (!userId) throw new Error('userId required for Firestore');
  const entryRef = doc(db, 'users', userId, 'vaultEntries', id);
  await deleteDoc(entryRef);
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
