import { create } from 'zustand';
import type { AppPage, Theme } from '../types';

interface AppState {
  currentPage: AppPage;
  theme: Theme;
  sidebarOpen: boolean;
  modal: { id: string; props?: Record<string, unknown> } | null;

  navigate: (page: AppPage) => void;
  setTheme: (theme: Theme) => void;
  setSidebarOpen: (open: boolean) => void;
  openModal: (id: string, props?: Record<string, unknown>) => void;
  closeModal: () => void;
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('homehub-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  theme: getInitialTheme(),
  sidebarOpen: false,
  modal: null,

  navigate: (page) => set({ currentPage: page, sidebarOpen: false }),
  setTheme: (theme) => {
    localStorage.setItem('homehub-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openModal: (id, props) => set({ modal: { id, props } }),
  closeModal: () => set({ modal: null }),
}));
