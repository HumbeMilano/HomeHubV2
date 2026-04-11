import { create } from 'zustand';
import type { Member } from '../types';

interface AuthState {
  activeMember: Member | null;
  isLocked: boolean;
  pinError: boolean;

  setActiveMember: (member: Member | null) => void;
  lock: () => void;
  unlock: (member: Member) => void;
  setPinError: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  activeMember: null,
  isLocked: true,
  pinError: false,

  setActiveMember: (member) => set({ activeMember: member }),
  lock: () => set({ activeMember: null, isLocked: true, pinError: false }),
  unlock: (member) => set({ activeMember: member, isLocked: false, pinError: false }),
  setPinError: (v) => set({ pinError: v }),
}));
