import { create } from 'zustand';
import type { AppPage, CalendarItem, Theme } from '../types';

export type Language = 'es' | 'en';

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
  autoLockMinutes: number;   // 0 = never; options: 0, 1, 5, 10, 30
  householdName: string;
  language: Language;
  photoSlideInterval: number; // ms between slides; options: 10000–120000
  dashboardEditMode: boolean;

  navigate: (page: AppPage) => void;
  setDashboardEditMode: (v: boolean) => void;
  setTheme: (theme: Theme) => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  openModal: (id: string, props?: Record<string, unknown>) => void;
  closeModal: () => void;
  goCalendar: (intent?: CalendarIntent) => void;
  clearCalendarIntent: () => void;
  setAutoLockMinutes: (minutes: number) => void;
  setHouseholdName: (name: string) => void;
  setLanguage: (lang: Language) => void;
  setPhotoSlideInterval: (ms: number) => void;
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('homehub-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialAutoLock(): number {
  const stored = localStorage.getItem('homehub-autolock');
  const parsed = stored !== null ? parseInt(stored, 10) : NaN;
  return isNaN(parsed) ? 10 : parsed;
}

function getInitialHouseholdName(): string {
  return localStorage.getItem('homehub-household-name') ?? 'Mi Hogar';
}

function getInitialSlideInterval(): number {
  const s = localStorage.getItem('homehub-slide-interval');
  const n = s !== null ? parseInt(s, 10) : NaN;
  return isNaN(n) ? 30_000 : n;
}

function getInitialLanguage(): Language {
  const stored = localStorage.getItem('homehub-language');
  if (stored === 'es' || stored === 'en') return stored;
  return navigator.language.startsWith('es') ? 'es' : 'en';
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  previousPage: null,
  theme: getInitialTheme(),
  sidebarOpen: false,
  settingsOpen: false,
  modal: null,
  calendarIntent: null,
  autoLockMinutes: getInitialAutoLock(),
  householdName: getInitialHouseholdName(),
  language: getInitialLanguage(),
  photoSlideInterval: getInitialSlideInterval(),
  dashboardEditMode: false,

  navigate: (page) => set((s) => ({ currentPage: page, previousPage: s.currentPage, sidebarOpen: false })),
  setDashboardEditMode: (v) => set({ dashboardEditMode: v }),
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
  setAutoLockMinutes: (minutes) => {
    localStorage.setItem('homehub-autolock', String(minutes));
    set({ autoLockMinutes: minutes });
  },
  setHouseholdName: (name) => {
    localStorage.setItem('homehub-household-name', name);
    set({ householdName: name });
  },
  setLanguage: (lang) => {
    localStorage.setItem('homehub-language', lang);
    set({ language: lang });
  },
  setPhotoSlideInterval: (ms) => {
    localStorage.setItem('homehub-slide-interval', String(ms));
    set({ photoSlideInterval: ms });
  },
}));
