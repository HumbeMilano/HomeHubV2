import { create } from 'zustand';
import type { CalendarItem } from '../types';
import { supabase } from '../lib/supabase';
import { createBroadcastChannel } from '../lib/broadcast';
import { uid } from '../lib/utils';

const bc = createBroadcastChannel<unknown>('calendar');

interface CalendarState {
  items: CalendarItem[];
  loading: boolean;

  fetchAll: () => Promise<void>;
  addItem: (data: Omit<CalendarItem, 'id' | 'created_at'>) => Promise<CalendarItem>;
  updateItem: (id: string, patch: Partial<CalendarItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  setItems: (items: CalendarItem[]) => void;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  items: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    const { data } = await supabase.from('calendar_items').select('*').order('start_at');
    set({ items: (data ?? []) as CalendarItem[], loading: false });
  },

  addItem: async (data) => {
    const newItem: CalendarItem = { ...data, id: uid(), created_at: new Date().toISOString() };
    set((s) => ({ items: [...s.items, newItem].sort((a, b) => a.start_at.localeCompare(b.start_at)) }));
    const { data: inserted, error } = await supabase.from('calendar_items').insert(newItem).select().single();
    if (error) {
      set((s) => ({ items: s.items.filter((i) => i.id !== newItem.id) }));
      throw error;
    }
    const saved = inserted as CalendarItem;
    set((s) => ({ items: s.items.map((i) => (i.id === newItem.id ? saved : i)) }));
    bc.post('INSERT', saved);
    return saved;
  },

  updateItem: async (id, patch) => {
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    const { error } = await supabase.from('calendar_items').update(patch).eq('id', id);
    if (error) { await get().fetchAll(); throw error; }
    bc.post('UPDATE', { id, patch });
  },

  deleteItem: async (id) => {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    const { error } = await supabase.from('calendar_items').delete().eq('id', id);
    if (error) { await get().fetchAll(); throw error; }
    bc.post('DELETE', { id });
  },

  setItems: (items) => set({ items }),
}));

bc.listen((msg) => {
  const store = useCalendarStore.getState();
  if (msg.type === 'INSERT') {
    const item = msg.payload as unknown as CalendarItem;
    if (!store.items.find((i) => i.id === item.id)) {
      store.setItems([...store.items, item].sort((a, b) => a.start_at.localeCompare(b.start_at)));
    }
  } else if (msg.type === 'UPDATE') {
    const { id, patch } = msg.payload as unknown as { id: string; patch: Partial<CalendarItem> };
    store.setItems(store.items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  } else if (msg.type === 'DELETE') {
    const { id } = msg.payload as unknown as { id: string };
    store.setItems(store.items.filter((i) => i.id !== id));
  }
});
