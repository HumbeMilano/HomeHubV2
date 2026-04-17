import { useEffect } from 'react';
import {
  Home, CalendarDays, ShoppingCart, Wallet,
  FileText, CheckSquare, Bell, Settings, Sun, Moon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from './store/authStore';
import { useAppStore } from './store/appStore';
import { useIdleTimer } from './lib/useIdleTimer';
import type { AppPage, Member } from './types';
import Dashboard from './features/dashboard/Dashboard';
import CalendarPage from './features/calendar/CalendarPage';
import ShoppingPage from './features/shopping/ShoppingPage';
import FinancePage from './features/finance/FinancePage';
import NotesPage from './features/notes/NotesPage';
import ChoresPage from './features/chores/ChoresPage';
import PageTransition from './components/PageTransition';
import SettingsPanel from './components/SettingsPanel';
import LockScreen from './features/lockscreen/LockScreen';
import RemindersPage from './features/reminders/RemindersPage';
import Toaster from './components/Toast';

const NAV_PAGES: { page: AppPage; label: string; icon: LucideIcon }[] = [
  { page: 'dashboard',  label: 'Home',      icon: Home },
  { page: 'calendar',   label: 'Calendar',  icon: CalendarDays },
  { page: 'finance',    label: 'Finance',   icon: Wallet },
  { page: 'shopping',   label: 'Shopping',  icon: ShoppingCart },
  { page: 'notes',      label: 'Notes',     icon: FileText },
  { page: 'chores',     label: 'Chores',    icon: CheckSquare },
  { page: 'reminders',  label: 'Reminders', icon: Bell },
];

export default function App() {
  const { activeMember, verifyMemberExists, lock } = useAuthStore();
  const { currentPage, navigate, settingsOpen, setSettingsOpen, theme, setTheme } = useAppStore();

  useEffect(() => { verifyMemberExists(); }, [verifyMemberExists]);

  // Auto-lock on inactivity (only when a member is active)
  useIdleTimer();

  if (!activeMember) return <LockScreen />;

  return (
    <div className="app-shell">
      {/* Slim icon sidebar — desktop (expands on hover) */}
      <SlimSidebar
        currentPage={currentPage}
        onNavigate={navigate}
        onSettings={() => setSettingsOpen(true)}
        onLock={lock}
        activeMember={activeMember}
        theme={theme}
        onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />

      {/* Main content */}
      <main className="main-content">
        <div className="page-area">
          <PageTransition page={currentPage}>
            <PageRouter page={currentPage} />
          </PageTransition>
        </div>
      </main>

      {/* Floating pill dock — mobile */}
      <BottomDock currentPage={currentPage} onNavigate={navigate} />

      {/* Settings / members panel */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}

/* ── Slim sidebar (desktop) — expands on hover ────────────────────────────── */
function SlimSidebar({ currentPage, onNavigate, onSettings, onLock, activeMember, theme, onThemeToggle }: {
  currentPage: AppPage;
  onNavigate: (p: AppPage) => void;
  onSettings: () => void;
  onLock: () => void;
  activeMember: Member | null;
  theme: string;
  onThemeToggle: () => void;
}) {
  return (
    <nav className="sidebar">
      {/* Member avatar — click to LOCK the screen */}
      <button
        className="nav-item"
        onClick={onLock}
        title={activeMember ? `Lock (${activeMember.name})` : 'Lock'}
        aria-label="Lock screen"
      >
        <div className="sidebar-avatar" style={{ background: activeMember?.color ?? 'var(--bg-4)' }}>
          {activeMember?.avatar_url
            ? <img src={activeMember.avatar_url} alt={activeMember.name} />
            : <span>{activeMember ? activeMember.name.slice(0, 2).toUpperCase() : '?'}</span>
          }
        </div>
        <span className="sidebar-label">{activeMember?.name ?? 'Lock'}</span>
      </button>

      <div style={{ height: 6, flexShrink: 0 }} />

      {/* Nav items */}
      {NAV_PAGES.map(({ page, label, icon: Icon }) => (
        <button
          key={page}
          className={`nav-item${currentPage === page ? ' active' : ''}`}
          onClick={() => onNavigate(page)}
          aria-label={label}
          aria-current={currentPage === page ? 'page' : undefined}
        >
          <Icon size={20} style={{ flexShrink: 0 }} />
          <span className="sidebar-label">{label}</span>
        </button>
      ))}

      <div className="sidebar-spacer" />

      {/* Theme toggle */}
      <button
        className="nav-item"
        onClick={onThemeToggle}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun size={18} style={{ flexShrink: 0 }} /> : <Moon size={18} style={{ flexShrink: 0 }} />}
        <span className="sidebar-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
      </button>

      {/* Settings */}
      <button className="nav-item" onClick={onSettings} aria-label="Settings">
        <Settings size={18} style={{ flexShrink: 0 }} />
        <span className="sidebar-label">Settings</span>
      </button>
    </nav>
  );
}

/* ── Floating pill dock (mobile) ─────────────────────────────────────────── */
function BottomDock({ currentPage, onNavigate }: {
  currentPage: AppPage;
  onNavigate: (p: AppPage) => void;
}) {
  return (
    <nav className="bottom-dock">
      {NAV_PAGES.map(({ page, label, icon: Icon }) => (
        <button
          key={page}
          className={`nav-item${currentPage === page ? ' active' : ''}`}
          onClick={() => onNavigate(page)}
          aria-label={label}
          aria-current={currentPage === page ? 'page' : undefined}
        >
          <Icon size={22} />
          <span className="nav-item__label">{label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ── Page router ─────────────────────────────────────────────────────────── */
function PageRouter({ page }: { page: AppPage }) {
  if (page === 'dashboard')  return <Dashboard />;
  if (page === 'calendar')   return <CalendarPage />;
  if (page === 'shopping')   return <ShoppingPage />;
  if (page === 'finance')    return <FinancePage />;
  if (page === 'notes')      return <NotesPage />;
  if (page === 'chores')     return <ChoresPage />;
  if (page === 'reminders')  return <RemindersPage />;
  return null;
}
