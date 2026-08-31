import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { useEffect, useState, useCallback } from 'react';
import { db } from './firebase';

export interface ChatMessage {
  id: string;
  household_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { email: string } | null;
}

export async function getMessages(householdId: string, limitCount = 50): Promise<ChatMessage[]> {
  const messagesRef = collection(db, 'households', householdId, 'messages');
  const q = query(messagesRef, orderBy('created_at', 'asc'));
  const snapshot = await getDocs(q);

  const messages: ChatMessage[] = [];
  const docs = snapshot.docs.slice(-limitCount);

  for (const msgDoc of docs) {
    const msgData = msgDoc.data();
    const userRef = doc(db, 'users', msgData.user_id);
    const userSnap = await getDoc(userRef);

    messages.push({
      id: msgDoc.id,
      ...msgData,
      profiles: userSnap.exists() ? { email: userSnap.data().email } : null,
    } as ChatMessage);
  }

  return messages;
}

export async function sendMessage(
  householdId: string,
  userId: string,
  content: string
): Promise<boolean> {
  try {
    const messagesRef = collection(db, 'households', householdId, 'messages');
    await addDoc(messagesRef, {
      household_id: householdId,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('Error sending message:', error);
    return false;
  }
}

export function useChatMessages(householdId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMessages = useCallback(async () => {
    if (!householdId) return;
    setLoading(true);
    const msgs = await getMessages(householdId);
    setMessages(msgs);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;

    loadMessages();

    const messagesRef = collection(db, 'households', householdId, 'messages');
    const q = query(messagesRef, orderBy('created_at', 'asc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const newMessages: ChatMessage[] = [];

      for (const msgDoc of snapshot.docs) {
        const msgData = msgDoc.data();
        const userRef = doc(db, 'users', msgData.user_id);
        const userSnap = await getDoc(userRef);

        newMessages.push({
          id: msgDoc.id,
          ...msgData,
          profiles: userSnap.exists() ? { email: userSnap.data().email } : null,
        } as ChatMessage);
      }

      setMessages(newMessages);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [householdId, loadMessages]);

  return { messages, loading, loadMessages };
}

export function useActivityFeed(householdId: string | null) {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    if (!householdId) return;

    const loadInitial = async () => {
      const activityRef = collection(db, 'households', householdId, 'activity');
      const q = query(activityRef, orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);

      const items: any[] = [];
      const docs = snapshot.docs.slice(0, 30);

      for (const actDoc of docs) {
        const actData = actDoc.data();
        const userRef = doc(db, 'users', actData.user_id);
        const userSnap = await getDoc(userRef);

        items.push({
          id: actDoc.id,
          ...actData,
          profiles: userSnap.exists() ? { email: userSnap.data().email } : null,
        });
      }

      setActivities(items);
    };

    loadInitial();

    const activityRef = collection(db, 'households', householdId, 'activity');
    const q = query(activityRef, orderBy('created_at', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const newActivities: any[] = [];
      const docs = snapshot.docs.slice(0, 30);

      for (const actDoc of docs) {
        const actData = actDoc.data();
        const userRef = doc(db, 'users', actData.user_id);
        const userSnap = await getDoc(userRef);

        newActivities.push({
          id: actDoc.id,
          ...actData,
          profiles: userSnap.exists() ? { email: userSnap.data().email } : null,
        });
      }

      setActivities(newActivities);
    });

    return () => unsubscribe();
  }, [householdId]);

  return { activities };
}
