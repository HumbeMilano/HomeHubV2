import { create } from 'zustand';
import type { AppPage, CalendarItem, Theme } from '../types';

export interface CalendarIntent {
  day?: Date;
  openAdd?: boolean;
  openEdit?: CalendarItem;
  detail?: CalendarItem;
}

interface AppState {
  currentPage: AppPage;
  previousPage: AppPage | null;
  theme: Theme;
  sidebarOpen: boolean;
  settingsOpen: boolean;
  modal: { id: string; props?: Record<string, unknown> } | null;
  calendarIntent: CalendarIntent | null;

  navigate: (page: AppPage) => void;
  setTheme: (theme: Theme) => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  openModal: (id: string, props?: Record<string, unknown>) => void;
  closeModal: () => void;
  goCalendar: (intent?: CalendarIntent) => void;
  clearCalendarIntent: () => void;
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('homehub-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  previousPage: null,
  theme: getInitialTheme(),
  sidebarOpen: false,
  settingsOpen: false,
  modal: null,
  calendarIntent: null,

  navigate: (page) => set((s) => ({ currentPage: page, previousPage: s.currentPage, sidebarOpen: false })),
  setTheme: (theme) => {
    localStorage.setItem('homehub-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  openModal: (id, props) => set({ modal: { id, props } }),
  closeModal: () => set({ modal: null }),
  goCalendar: (intent) => set((s) => ({
    currentPage: 'calendar',
    previousPage: s.currentPage,
    sidebarOpen: false,
    calendarIntent: intent ?? null,
  })),
  clearCalendarIntent: () => set({ calendarIntent: null }),
}));
