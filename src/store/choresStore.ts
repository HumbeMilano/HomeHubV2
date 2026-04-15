import { create } from 'zustand';
import type { Chore, ChoreAssignment, ChoreCompletion } from '../types';
import { supabase } from '../lib/supabase';
import { createBroadcastChannel } from '../lib/broadcast';
import { uid } from '../lib/utils';

const bc = createBroadcastChannel<unknown>('chores');

interface ChoresState {
  chores: Chore[];
  assignments: ChoreAssignment[];
  completions: ChoreCompletion[];
  loading: boolean;

  fetchAll: () => Promise<void>;
  addChore: (data: Omit<Chore, 'id' | 'created_at'>) => Promise<Chore>;
  updateChore: (id: string, patch: Partial<Chore>) => Promise<void>;
  deleteChore: (id: string) => Promise<void>;
  toggleComplete: (choreId: string, completedBy: string, scheduledDate: string) => Promise<void>;
  setChores: (chores: Chore[]) => void;
  setAssignments: (a: ChoreAssignment[]) => void;
  setCompletions: (c: ChoreCompletion[]) => void;
}

export const useChoresStore = create<ChoresState>((set, get) => ({
  chores: [],
  assignments: [],
  completions: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    const [{ data: chores }, { data: assignments }, { data: completions }] = await Promise.all([
      supabase.from('chores').select('*').order('title'),
      supabase.from('chore_assignments').select('*'),
      supabase.from('chore_completions').select('*').order('scheduled_date', { ascending: false }),
    ]);
    set({
      chores: (chores ?? []) as Chore[],
      assignments: (assignments ?? []) as ChoreAssignment[],
      completions: (completions ?? []) as ChoreCompletion[],
      loading: false,
    });
  },

  addChore: async (data) => {
    const newChore: Chore = { ...data, id: uid(), created_at: new Date().toISOString() };
    // Optimistic update
    set((s) => ({ chores: [...s.chores, newChore] }));

    const { data: inserted, error } = await supabase.from('chores').insert(newChore).select().single();
    if (error) {
      set((s) => ({ chores: s.chores.filter((c) => c.id !== newChore.id) }));
      throw error;
    }
    const saved = inserted as Chore;
    set((s) => ({ chores: s.chores.map((c) => (c.id === newChore.id ? saved : c)) }));
    bc.post('INSERT', saved);
    return saved;
  },

  updateChore: async (id, patch) => {
    set((s) => ({ chores: s.chores.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    const { error } = await supabase.from('chores').update(patch).eq('id', id);
    if (error) { await get().fetchAll(); throw error; }
    bc.post('UPDATE', { id, patch });
  },

  deleteChore: async (id) => {
    set((s) => ({ chores: s.chores.filter((c) => c.id !== id) }));
    const { error } = await supabase.from('chores').delete().eq('id', id);
    if (error) { await get().fetchAll(); throw error; }
    bc.post('DELETE', { id });
  },

  toggleComplete: async (choreId, completedBy, scheduledDate) => {
    const existing = get().completions.find(
      (c) => c.chore_id === choreId && c.scheduled_date === scheduledDate
    );

    if (existing?.completed_at) {
      // Un-complete
      set((s) => ({
        completions: s.completions.map((c) =>
          c.id === existing.id ? { ...c, completed_at: null } : c
        ),
      }));
      await supabase.from('chore_completions').update({ completed_at: null }).eq('id', existing.id);
    } else if (existing) {
      // Mark complete
      const now = new Date().toISOString();
      set((s) => ({
        completions: s.completions.map((c) =>
          c.id === existing.id ? { ...c, completed_at: now, completed_by: completedBy } : c
        ),
      }));
      await supabase.from('chore_completions')
        .update({ completed_at: now, completed_by: completedBy })
        .eq('id', existing.id);
    } else {
      // Create new completion record
      const row: ChoreCompletion = {
        id: uid(), chore_id: choreId,
        completed_by: completedBy,
        scheduled_date: scheduledDate,
        completed_at: new Date().toISOString(),
      };
      set((s) => ({ completions: [row, ...s.completions] }));
      const { error } = await supabase.from('chore_completions').insert(row);
      if (error) {
        set((s) => ({ completions: s.completions.filter((c) => c.id !== row.id) }));
        throw error;
      }
    }
    bc.post('COMPLETE', { choreId, scheduledDate });
  },

  setChores: (chores) => set({ chores }),
  setAssignments: (assignments) => set({ assignments }),
  setCompletions: (completions) => set({ completions }),
}));

// Listen for BroadcastChannel messages from other tabs
bc.listen((msg) => {
  const store = useChoresStore.getState();
  if (msg.type === 'INSERT') {
    const c = msg.payload as unknown as Chore;
    if (!store.chores.find((x) => x.id === c.id)) {
      store.setChores([...store.chores, c]);
    }
  } else if (msg.type === 'UPDATE') {
    const { id, patch } = msg.payload as unknown as { id: string; patch: Partial<Chore> };
    store.setChores(store.chores.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  } else if (msg.type === 'DELETE') {
    const { id } = msg.payload as unknown as { id: string };
    store.setChores(store.chores.filter((c) => c.id !== id));
  } else if (msg.type === 'COMPLETE') {
    // Re-fetch completions on cross-tab complete signal
    store.fetchAll();
  }
});
