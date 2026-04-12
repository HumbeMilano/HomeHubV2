import { create } from 'zustand';
import type { Reminder } from '../types';
import { supabase } from '../lib/supabase';
import { createBroadcastChannel } from '../lib/broadcast';
import { uid } from '../lib/utils';

const bc = createBroadcastChannel<unknown>('reminders');

interface RemindersState {
  reminders: Reminder[];
  loading: boolean;

  fetchAll: () => Promise<void>;
  addReminder: (data: Omit<Reminder, 'id' | 'created_at'>) => Promise<Reminder>;
  updateReminder: (id: string, patch: Partial<Reminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  setReminders: (r: Reminder[]) => void;
}

export const useRemindersStore = create<RemindersState>((set, get) => ({
  reminders: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    const { data } = await supabase.from('reminders').select('*').order('due_at');
    set({ reminders: (data ?? []) as Reminder[], loading: false });
  },

  addReminder: async (data) => {
    const newReminder: Reminder = {
      ...data,
      id: uid(),
      created_at: new Date().toISOString(),
    };
    set((s) => ({ reminders: [...s.reminders, newReminder].sort((a, b) => a.due_at.localeCompare(b.due_at)) }));

    const { data: inserted, error } = await supabase
      .from('reminders')
      .insert(newReminder)
      .select()
      .single();

    if (error) {
      set((s) => ({ reminders: s.reminders.filter((r) => r.id !== newReminder.id) }));
      throw error;
    }
    const saved = inserted as Reminder;
    set((s) => ({ reminders: s.reminders.map((r) => (r.id === newReminder.id ? saved : r)) }));
    bc.post('INSERT', saved);
    return saved;
  },

  updateReminder: async (id, patch) => {
    set((s) => ({
      reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    const { error } = await supabase.from('reminders').update(patch).eq('id', id);
    if (error) { await get().fetchAll(); throw error; }
    bc.post('UPDATE', { id, patch });
  },

  deleteReminder: async (id) => {
    set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) { await get().fetchAll(); throw error; }
    bc.post('DELETE', { id });
  },

  setReminders: (reminders) => set({ reminders }),
}));

// Sync other tabs via BroadcastChannel
bc.listen((msg) => {
  const store = useRemindersStore.getState();
  if (msg.type === 'INSERT') {
    const r = msg.payload as unknown as Reminder;
    if (!store.reminders.find((x) => x.id === r.id)) {
      store.setReminders([...store.reminders, r].sort((a, b) => a.due_at.localeCompare(b.due_at)));
    }
  } else if (msg.type === 'UPDATE') {
    const { id, patch } = msg.payload as unknown as { id: string; patch: Partial<Reminder> };
    store.setReminders(store.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  } else if (msg.type === 'DELETE') {
    const { id } = msg.payload as unknown as { id: string };
    store.setReminders(store.reminders.filter((r) => r.id !== id));
  }
});
