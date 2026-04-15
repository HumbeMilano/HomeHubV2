import {
  Home, CalendarDays, ShoppingCart, Wallet,
  FileText, CheckSquare, Settings, Sun, Moon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from './store/authStore';
import { useAppStore } from './store/appStore';
import type { AppPage, Member } from './types';
import Dashboard from './features/dashboard/Dashboard';
import CalendarPage from './features/calendar/CalendarPage';
import ShoppingPage from './features/shopping/ShoppingPage';
import FinancePage from './features/finance/FinancePage';
import NotesPage from './features/notes/NotesPage';
import ChoresPage from './features/chores/ChoresPage';
import PageTransition from './components/PageTransition';
import SettingsPanel from './components/SettingsPanel';

const NAV_PAGES: { page: AppPage; label: string; icon: LucideIcon }[] = [
  { page: 'dashboard', label: 'Home',     icon: Home },
  { page: 'calendar',  label: 'Calendar', icon: CalendarDays },
  { page: 'finance',   label: 'Finance',  icon: Wallet },
  { page: 'shopping',  label: 'Shopping', icon: ShoppingCart },
  { page: 'notes',     label: 'Notes',    icon: FileText },
  { page: 'chores',    label: 'Chores',   icon: CheckSquare },
];

export default function App() {
  const { activeMember } = useAuthStore();
  const { currentPage, navigate, settingsOpen, setSettingsOpen, theme, setTheme } = useAppStore();

  return (
    <div className="app-shell">
      {/* Slim icon sidebar — desktop */}
      <SlimSidebar
        currentPage={currentPage}
        onNavigate={navigate}
        onSettings={() => setSettingsOpen(true)}
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
    </div>
  );
}

/* ── Slim sidebar (desktop, icon-only) ────────────────────────────────────── */
function SlimSidebar({ currentPage, onNavigate, onSettings, activeMember, theme, onThemeToggle }: {
  currentPage: AppPage;
  onNavigate: (p: AppPage) => void;
  onSettings: () => void;
  activeMember: Member | null;
  theme: string;
  onThemeToggle: () => void;
}) {
  return (
    <nav className="sidebar">
      {/* Member avatar — first item */}
      <button
        className="nav-item"
        onClick={onSettings}
        title={activeMember ? activeMember.name : 'Settings'}
        style={activeMember ? {
          background: activeMember.color,
          borderRadius: '50%',
          width: 32,
          height: 32,
          fontSize: 12,
          fontWeight: 700,
          color: '#fff',
          overflow: 'hidden',
          padding: 0,
        } : undefined}
      >
        {activeMember
          ? (activeMember.avatar_url
              ? <img src={activeMember.avatar_url} alt={activeMember.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : activeMember.name.slice(0, 2).toUpperCase())
          : <Settings size={18} />}
      </button>

      <div className="sidebar-spacer" style={{ maxHeight: 8 }} />

      {/* Nav items */}
      {NAV_PAGES.map(({ page, icon: Icon }) => (
        <button
          key={page}
          className={`nav-item${currentPage === page ? ' active' : ''}`}
          onClick={() => onNavigate(page)}
          title={NAV_PAGES.find(n => n.page === page)?.label}
        >
          <Icon size={20} />
        </button>
      ))}

      <div className="sidebar-spacer" />

      {/* Theme toggle */}
      <button
        className="nav-item"
        onClick={onThemeToggle}
        title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Settings */}
      <button className="nav-item" onClick={onSettings} title="Settings">
        <Settings size={18} />
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
          title={label}
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
  if (page === 'dashboard') return <Dashboard />;
  if (page === 'calendar')  return <CalendarPage />;
  if (page === 'shopping')  return <ShoppingPage />;
  if (page === 'finance')   return <FinancePage />;
  if (page === 'notes')     return <NotesPage />;
  if (page === 'chores')    return <ChoresPage />;
  return null;
}
