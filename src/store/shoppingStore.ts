import { create } from 'zustand';
import type { ShoppingList, ShoppingItem } from '../types';
import { supabase } from '../lib/supabase';
import { createBroadcastChannel } from '../lib/broadcast';
import { subscribeToTable } from '../lib/realtime';
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
      supabase.from('shopping_lists').select('id,name,store_category,color,is_featured,created_by,created_at').order('name').limit(500),
      supabase.from('shopping_items').select('id,list_id,name,checked,checked_by,checked_at,created_at').order('created_at').limit(500),
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
    set((s) => ({
      lists: s.lists.map((l) => ({ ...l, is_featured: l.id === id })),
    }));
    const { error: e1 } = await supabase
      .from('shopping_lists')
      .update({ is_featured: false })
      .not('id', 'is', null);
    if (id) {
      const { error: e2 } = await supabase
        .from('shopping_lists')
        .update({ is_featured: true })
        .eq('id', id);
      if (e1 || e2) { await get().fetchAll(); return; }
    } else if (e1) {
      await get().fetchAll(); return;
    }
    bc.post('LIST_FEATURED', { id });
  },

  setLists: (lists) => set({ lists }),
  setItems: (items) => set({ items }),
}));

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

const _unsubShoppingBc = bc.listen((msg) => {
  const store = useShoppingStore.getState();
  if (msg.type === 'LIST_INSERT') {
    if (!isObj(msg.payload) || typeof msg.payload.id !== 'string') return;
    const l = msg.payload as unknown as ShoppingList;
    if (!store.lists.find((x) => x.id === l.id)) store.setLists([...store.lists, l]);
  } else if (msg.type === 'LIST_DELETE') {
    if (!isObj(msg.payload) || typeof msg.payload.id !== 'string') return;
    const { id } = msg.payload as { id: string };
    store.setLists(store.lists.filter((l) => l.id !== id));
    store.setItems(store.items.filter((i) => i.list_id !== id));
  } else if (msg.type === 'ITEM_INSERT') {
    if (!isObj(msg.payload) || typeof msg.payload.id !== 'string') return;
    const i = msg.payload as unknown as ShoppingItem;
    if (!store.items.find((x) => x.id === i.id)) store.setItems([...store.items, i]);
  } else if (msg.type === 'ITEM_TOGGLE') {
    if (!isObj(msg.payload) || typeof msg.payload.id !== 'string') return;
    const { id, patch } = msg.payload as { id: string; patch: Partial<ShoppingItem> };
    store.setItems(store.items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  } else if (msg.type === 'ITEM_DELETE') {
    if (!isObj(msg.payload) || typeof msg.payload.id !== 'string') return;
    const { id } = msg.payload as { id: string };
    store.setItems(store.items.filter((i) => i.id !== id));
  } else if (msg.type === 'LIST_FEATURED') {
    if (!isObj(msg.payload)) return;
    const id = typeof msg.payload.id === 'string' ? msg.payload.id : null;
    store.setLists(store.lists.map((l) => ({ ...l, is_featured: l.id === id })));
  }
});
const _unsubListsRt = subscribeToTable<ShoppingList>({
  table: 'shopping_lists',
  onData: ({ eventType, new: row, old }) => {
    const store = useShoppingStore.getState();
    if (eventType === 'INSERT' && row && !store.lists.find((l) => l.id === row.id))
      store.setLists([...store.lists, row]);
    else if (eventType === 'UPDATE' && row)
      store.setLists(store.lists.map((l) => (l.id === row.id ? row : l)));
    else if (eventType === 'DELETE' && old) {
      store.setLists(store.lists.filter((l) => l.id !== old.id));
      store.setItems(store.items.filter((i) => i.list_id !== old.id));
    }
  },
});

const _unsubItemsRt = subscribeToTable<ShoppingItem>({
  table: 'shopping_items',
  onData: ({ eventType, new: row, old }) => {
    const store = useShoppingStore.getState();
    if (eventType === 'INSERT' && row && !store.items.find((i) => i.id === row.id))
      store.setItems([...store.items, row]);
    else if (eventType === 'UPDATE' && row)
      store.setItems(store.items.map((i) => (i.id === row.id ? row : i)));
    else if (eventType === 'DELETE' && old)
      store.setItems(store.items.filter((i) => i.id !== old.id));
  },
});

if (import.meta.hot) import.meta.hot.dispose(() => { _unsubListsRt(); _unsubItemsRt(); _unsubShoppingBc(); bc.close(); });
