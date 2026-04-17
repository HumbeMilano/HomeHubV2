import { create } from 'zustand';
import type { Member } from '../types';
import { supabase } from '../lib/supabase';
import { createBroadcastChannel } from '../lib/broadcast';
import { uid } from '../lib/utils';
import { useAuthStore } from './authStore';

const bc = createBroadcastChannel<unknown>('members');

type NewMember = { name: string; color: string; pin?: string };

interface MembersState {
  members: Member[];
  loading: boolean;

  fetchAll: () => Promise<void>;
  addMember: (data: NewMember) => Promise<Member>;
  updateMember: (id: string, patch: Partial<Member> & { pin?: string }) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  setMembers: (m: Member[]) => void;
}

export const useMembersStore = create<MembersState>((set, get) => ({
  members: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('household_members')
      .select('*')
      .order('name');
    set({ members: (data ?? []) as Member[], loading: false });
  },

  addMember: async (data) => {
    const newMember: Member = {
      ...data,
      id: uid(),
      avatar_url: null,
      supabase_user_id: null,
      created_at: new Date().toISOString(),
    };
    // Optimistic
    set((s) => ({ members: [...s.members, newMember] }));

    const { data: inserted, error } = await supabase
      .from('household_members')
      .insert({ ...newMember, pin: data.pin ?? null })
      .select()
      .single();

    if (error) {
      set((s) => ({ members: s.members.filter((m) => m.id !== newMember.id) }));
      throw error;
    }
    const saved = inserted as Member;
    set((s) => ({ members: s.members.map((m) => (m.id === newMember.id ? saved : m)) }));
    bc.post('INSERT', saved);
    return saved;
  },

  updateMember: async (id, patch) => {
    set((s) => ({
      members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
    const { error } = await supabase.from('household_members').update(patch).eq('id', id);
    if (error) { await get().fetchAll(); throw error; }

    // Keep authStore in sync if the active member was updated
    const active = useAuthStore.getState().activeMember;
    if (active?.id === id) {
      const updated = get().members.find((m) => m.id === id);
      if (updated) useAuthStore.getState().setActiveMember(updated);
    }

    bc.post('UPDATE', { id, patch });
  },

  deleteMember: async (id) => {
    set((s) => ({ members: s.members.filter((m) => m.id !== id) }));
    const { error } = await supabase.from('household_members').delete().eq('id', id);
    if (error) { await get().fetchAll(); throw error; }

    // Lock the app if the deleted member was the active one
    if (useAuthStore.getState().activeMember?.id === id) {
      useAuthStore.getState().lock();
    }

    bc.post('DELETE', { id });
  },

  setMembers: (members) => set({ members }),
}));

// Sync other tabs via BroadcastChannel
const _unsubMembersBc = bc.listen((msg) => {
  const store = useMembersStore.getState();
  if (msg.type === 'INSERT') {
    const m = msg.payload as unknown as Member;
    if (!store.members.find((x) => x.id === m.id)) {
      store.setMembers([...store.members, m]);
    }
  } else if (msg.type === 'UPDATE') {
    const { id, patch } = msg.payload as unknown as { id: string; patch: Partial<Member> };
    store.setMembers(store.members.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  } else if (msg.type === 'DELETE') {
    const { id } = msg.payload as unknown as { id: string };
    store.setMembers(store.members.filter((m) => m.id !== id));
  }
});
if (import.meta.hot) import.meta.hot.dispose(() => { _unsubMembersBc(); bc.close(); });
