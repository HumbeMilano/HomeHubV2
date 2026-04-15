import { create } from 'zustand';
import type { ShoppingList, ShoppingItem } from '../types';
import { supabase } from '../lib/supabase';
import { createBroadcastChannel } from '../lib/broadcast';
import { uid } from '../lib/utils';

const bc = createBroadcastChannel<unknown>('shopping');

interface ShoppingState {
  lists: ShoppingList[];
  items: ShoppingItem[];
  loading: boolean;

  fetchAll: () => Promise<void>;
  addList: (data: Omit<ShoppingList, 'id' | 'created_at'>) => Promise<ShoppingList>;
  deleteList: (id: string) => Promise<void>;
  addItem: (data: Omit<ShoppingItem, 'id' | 'created_at'>) => Promise<ShoppingItem>;
  toggleItem: (id: string, memberId: string | null) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  uncheckItem: (id: string) => Promise<void>;
  setFeatured: (id: string | null) => Promise<void>;
  setLists: (l: ShoppingList[]) => void;
  setItems: (i: ShoppingItem[]) => void;
}

export const useShoppingStore = create<ShoppingState>((set, get) => ({
  lists: [],
  items: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    const [{ data: lists }, { data: items }] = await Promise.all([
      supabase.from('shopping_lists').select('*').order('name'),
      supabase.from('shopping_items').select('*').order('created_at'),
    ]);
    set({
      lists: (lists ?? []) as ShoppingList[],
      items: (items ?? []) as ShoppingItem[],
      loading: false,
    });
  },

  addList: async (data) => {
    const newList: ShoppingList = { ...data, id: uid(), created_at: new Date().toISOString() };
    set((s) => ({ lists: [...s.lists, newList] }));
    const { data: inserted, error } = await supabase.from('shopping_lists').insert(newList).select().single();
    if (error) { set((s) => ({ lists: s.lists.filter((l) => l.id !== newList.id) })); throw error; }
    const saved = inserted as ShoppingList;
    set((s) => ({ lists: s.lists.map((l) => (l.id === newList.id ? saved : l)) }));
    bc.post('LIST_INSERT', saved);
    return saved;
  },

  deleteList: async (id) => {
    const prevLists = get().lists;
    const prevItems = get().items;
    set((s) => ({
      lists: s.lists.filter((l) => l.id !== id),
      items: s.items.filter((i) => i.list_id !== id),
    }));
    const { error } = await supabase.from('shopping_lists').delete().eq('id', id);
    if (error) { set({ lists: prevLists, items: prevItems }); throw error; }
    bc.post('LIST_DELETE', { id });
  },

  addItem: async (data) => {
    const newItem: ShoppingItem = { ...data, id: uid(), created_at: new Date().toISOString() };
    set((s) => ({ items: [...s.items, newItem] }));
    const { data: inserted, error } = await supabase.from('shopping_items').insert(newItem).select().single();
    if (error) { set((s) => ({ items: s.items.filter((i) => i.id !== newItem.id) })); throw error; }
    const saved = inserted as ShoppingItem;
    set((s) => ({ items: s.items.map((i) => (i.id === newItem.id ? saved : i)) }));
    bc.post('ITEM_INSERT', saved);
    return saved;
  },

  toggleItem: async (id, memberId) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const now = new Date().toISOString();
    const patch = item.checked
      ? { checked: false, checked_by: null, checked_at: null }
      : { checked: true, checked_by: memberId, checked_at: now };
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    const { error } = await supabase.from('shopping_items').update(patch).eq('id', id);
    if (error) { await get().fetchAll(); throw error; }
    bc.post('ITEM_TOGGLE', { id, patch });
  },

  uncheckItem: async (id) => {
    const patch = { checked: false, checked_by: null, checked_at: null };
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    const { error } = await supabase.from('shopping_items').update(patch).eq('id', id);
    if (error) { await get().fetchAll(); throw error; }
    bc.post('ITEM_TOGGLE', { id, patch });
  },

  deleteItem: async (id) => {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    const { error } = await supabase.from('shopping_items').delete().eq('id', id);
    if (error) { await get().fetchAll(); throw error; }
    bc.post('ITEM_DELETE', { id });
  },

  setFeatured: async (id) => {
    // Optimistic: unfeature all, then feature the target (or just unfeature if id is null)
    set((s) => ({
      lists: s.lists.map((l) => ({ ...l, is_featured: l.id === id })),
    }));
    // Unfeature all first, then feature the selected one
    const { error: e1 } = await supabase
      .from('shopping_lists')
      .update({ is_featured: false })
      .neq('id', id ?? '');
    if (id) {
      const { error: e2 } = await supabase
        .from('shopping_lists')
        .update({ is_featured: true })
        .eq('id', id);
      if (e1 || e2) { await get().fetchAll(); return; }
    } else {
      // unfeature all
      await supabase.from('shopping_lists').update({ is_featured: false }).gte('id', '');
    }
    bc.post('LIST_FEATURED', { id });
  },

  setLists: (lists) => set({ lists }),
  setItems: (items) => set({ items }),
}));

bc.listen((msg) => {
  const store = useShoppingStore.getState();
  if (msg.type === 'LIST_INSERT') {
    const l = msg.payload as unknown as ShoppingList;
    if (!store.lists.find((x) => x.id === l.id)) store.setLists([...store.lists, l]);
  } else if (msg.type === 'LIST_DELETE') {
    const { id } = msg.payload as unknown as { id: string };
    store.setLists(store.lists.filter((l) => l.id !== id));
    store.setItems(store.items.filter((i) => i.list_id !== id));
  } else if (msg.type === 'ITEM_INSERT') {
    const i = msg.payload as unknown as ShoppingItem;
    if (!store.items.find((x) => x.id === i.id)) store.setItems([...store.items, i]);
  } else if (msg.type === 'ITEM_TOGGLE') {
    const { id, patch } = msg.payload as unknown as { id: string; patch: Partial<ShoppingItem> };
    store.setItems(store.items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  } else if (msg.type === 'ITEM_DELETE') {
    const { id } = msg.payload as unknown as { id: string };
    store.setItems(store.items.filter((i) => i.id !== id));
  } else if (msg.type === 'LIST_FEATURED') {
    const { id } = msg.payload as unknown as { id: string | null };
    store.setLists(store.lists.map((l) => ({ ...l, is_featured: l.id === id })));
  }
});
