import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface SubscribeOptions<T> {
  table: string;
  event?: ChangeEvent;
  filter?: string;
  onData: (payload: { eventType: string; new: T | null; old: T | null }) => void;
}

/**
 * Subscribe to Postgres row-level changes via Supabase Realtime.
 * Returns a cleanup function — call it on component unmount.
 */
export function subscribeToTable<T>({
  table,
  event = '*',
  filter,
  onData,
}: SubscribeOptions<T>): () => void {
  const uid = Math.random().toString(36).slice(2, 9);
  let channel: RealtimeChannel = supabase.channel(`realtime:${table}:${uid}`);

  const config: Parameters<typeof channel.on>[1] = {
    event,
    schema: 'public',
    table,
    ...(filter ? { filter } : {}),
  };

  channel = channel.on(
    'postgres_changes' as Parameters<typeof channel.on>[0],
    config,
    (payload) => {
      onData({
        eventType: payload.eventType,
        new: (payload.new as T) ?? null,
        old: (payload.old as T) ?? null,
      });
    }
  );

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
