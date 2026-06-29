import { supabase } from './supabase';
import { useEffect, useState, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ChatMessage {
  id: string;
  household_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { email: string } | null;
}

export async function getMessages(householdId: string, limit = 50): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from('household_messages')
    .select('*, profiles(email)')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).reverse() as ChatMessage[];
}

export async function sendMessage(
  householdId: string,
  userId: string,
  content: string
): Promise<boolean> {
  const { error } = await supabase.from('household_messages').insert({
    household_id: householdId,
    user_id: userId,
    content,
  } as any);

  return !error;
}

export function useChatMessages(householdId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

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

    const chan = supabase
      .channel(`chat:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'household_messages',
          filter: `household_id=eq.${householdId}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', newMsg.user_id)
            .single();

          setMessages(prev => [...prev, { ...newMsg, profiles: profile }]);
        }
      )
      .subscribe();

    setChannel(chan);

    return () => {
      chan.unsubscribe();
    };
  }, [householdId, loadMessages]);

  return { messages, loading, loadMessages };
}

export function useActivityFeed(householdId: string | null) {
  const [activities, setActivities] = useState<any[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!householdId) return;

    (async () => {
      const { data } = await supabase
        .from('household_activity')
        .select('*, profiles(email)')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(30);

      setActivities(data || []);
    })();

    const chan = supabase
      .channel(`activity:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'household_activity',
          filter: `household_id=eq.${householdId}`,
        },
        async (payload) => {
          const newActivity = payload.new as any;
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', newActivity.user_id)
            .single();

          setActivities(prev => [{ ...newActivity, profiles: profile }, ...prev].slice(0, 30));
        }
      )
      .subscribe();

    setChannel(chan);

    return () => {
      chan.unsubscribe();
    };
  }, [householdId]);

  return { activities };
}
