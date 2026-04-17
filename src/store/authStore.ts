import { create } from 'zustand';
import type { Member } from '../types';
import { supabase } from '../lib/supabase';

function loadMember(): Member | null {
  try { return JSON.parse(localStorage.getItem('homehub-member') ?? 'null'); }
  catch { return null; }
}

interface AuthState {
  activeMember: Member | null;
  isLocked: boolean;
  pinError: boolean;

  setActiveMember: (member: Member | null) => void;
  lock: () => void;
  unlock: (member: Member) => void;
  setPinError: (v: boolean) => void;
  verifyMemberExists: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  activeMember: loadMember(),
  isLocked: false,
  pinError: false,

  setActiveMember: (member) => {
    if (member) localStorage.setItem('homehub-member', JSON.stringify(member));
    else localStorage.removeItem('homehub-member');
    set({ activeMember: member });
  },
  lock: () => {
    localStorage.removeItem('homehub-member');
    set({ activeMember: null, isLocked: true, pinError: false });
  },
  unlock: (member) => {
    localStorage.setItem('homehub-member', JSON.stringify(member));
    set({ activeMember: member, isLocked: false, pinError: false });
  },
  setPinError: (v) => set({ pinError: v }),

  verifyMemberExists: async () => {
    const { activeMember } = get();
    if (!activeMember) return;
    const { data } = await supabase
      .from('household_members')
      .select('id')
      .eq('id', activeMember.id)
      .single();
    if (!data) {
      localStorage.removeItem('homehub-member');
      set({ activeMember: null, isLocked: true });
    }
  },
}));
