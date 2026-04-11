import { useAuthStore } from './store/authStore';
import { useAppStore } from './store/appStore';
import type { AppPage } from './types';
import LockScreen from './features/lockscreen/LockScreen';
import Dashboard from './features/dashboard/Dashboard';
import CalendarPage from './features/calendar/CalendarPage';
import ChoresPage from './features/chores/ChoresPage';
import ShoppingPage from './features/shopping/ShoppingPage';
import RemindersPage from './features/reminders/RemindersPage';
import FinancePage from './features/finance/FinancePage';
import NotesPage from './features/notes/NotesPage';

const PAGES: Record<AppPage, { label: string; icon: string }> = {
  dashboard:  { label: 'Dashboard',  icon: '🏠' },
  calendar:   { label: 'Calendar',   icon: '📅' },
  chores:     { label: 'Chores',     icon: '✅' },
  shopping:   { label: 'Shopping',   icon: '🛒' },
  reminders:  { label: 'Reminders',  icon: '🔔' },
  finance:    { label: 'Finance',    icon: '💰' },
  notes:      { label: 'Notes',      icon: '📝' },
  members:    { label: 'Members',    icon: '👥' },
};

export default function App() {
  const { isLocked } = useAuthStore();
  const { currentPage, navigate } = useAppStore();

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <div className="app-shell">
      <Sidebar currentPage={currentPage} onNavigate={navigate} />
      <div className="main-content">
        <Topbar title={PAGES[currentPage].label} />
        <div className="page-area">
          <PageRouter page={currentPage} />
        </div>
        <BottomNav currentPage={currentPage} onNavigate={navigate} />
      </div>
    </div>
  );
}


function Sidebar({ currentPage, onNavigate }: { currentPage: AppPage; onNavigate: (p: AppPage) => void }) {
  return (
    <nav className="sidebar">
      <div style={{ padding: '0 var(--sp-5) var(--sp-6)', borderBottom: '1px solid var(--border)', marginBottom: 'var(--sp-3)' }}>
        <span style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>🏠 HomeHub</span>
      </div>
      {(Object.keys(PAGES) as AppPage[]).map((page) => (
        <button
          key={page}
          className={`nav-item${currentPage === page ? ' active' : ''}`}
          onClick={() => onNavigate(page)}
        >
          <span className="nav-item__icon">{PAGES[page].icon}</span>
          {PAGES[page].label}
        </button>
      ))}
    </nav>
  );
}

function Topbar({ title }: { title: string }) {
  const { lock, activeMember } = useAuthStore();
  const { theme, setTheme } = useAppStore();
  return (
    <header className="topbar">
      <span className="topbar__title">{title}</span>
      <button
        className="btn btn--ghost btn--icon"
        title="Toggle theme"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      {activeMember && (
        <div
          className="avatar"
          style={{ background: activeMember.color, cursor: 'pointer' }}
          title={activeMember.name}
          onClick={lock}
        >
          {activeMember.name.slice(0, 2).toUpperCase()}
        </div>
      )}
    </header>
  );
}

function BottomNav({ currentPage, onNavigate }: { currentPage: AppPage; onNavigate: (p: AppPage) => void }) {
  const mobilePages: AppPage[] = ['dashboard', 'calendar', 'shopping', 'notes', 'finance'];
  return (
    <nav className="bottom-nav">
      {mobilePages.map((page) => (
        <button
          key={page}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '2px', fontSize: 'var(--text-xs)',
            color: currentPage === page ? 'var(--accent)' : 'var(--text-3)',
          }}
          onClick={() => onNavigate(page)}
        >
          <span style={{ fontSize: 20 }}>{PAGES[page].icon}</span>
          {PAGES[page].label}
        </button>
      ))}
    </nav>
  );
}

function PageRouter({ page }: { page: AppPage }) {
  if (page === 'dashboard') return <Dashboard />;
  if (page === 'calendar')  return <CalendarPage />;
  if (page === 'chores')    return <ChoresPage />;
  if (page === 'shopping')  return <ShoppingPage />;
  if (page === 'reminders') return <RemindersPage />;
  if (page === 'finance')   return <FinancePage />;
  if (page === 'notes')     return <NotesPage />;
  // Other pages built in later phases
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '60vh', gap: 'var(--sp-4)',
      color: 'var(--text-2)',
    }}>
      <span style={{ fontSize: 56 }}>{PAGES[page].icon}</span>
      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text)' }}>
        {PAGES[page].label}
      </h2>
      <p style={{ fontSize: 'var(--text-sm)' }}>Coming soon</p>
    </div>
  );
}
