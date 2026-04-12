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
import MembersPage from './features/members/MembersPage';

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
  const { currentPage, navigate, sidebarOpen, setSidebarOpen } = useAppStore();

  if (isLocked) return <LockScreen />;

  return (
    <div className="app-shell">
      {/* Backdrop — closes sidebar on click */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        currentPage={currentPage}
        onNavigate={navigate}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-content">
        <Topbar
          title={PAGES[currentPage].label}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <div className="page-area">
          <PageRouter page={currentPage} />
        </div>
        <BottomNav currentPage={currentPage} onNavigate={navigate} />
      </div>
    </div>
  );
}

function Sidebar({ isOpen, currentPage, onNavigate, onClose }: {
  isOpen: boolean;
  currentPage: AppPage;
  onNavigate: (p: AppPage) => void;
  onClose: () => void;
}) {
  return (
    <nav className={`sidebar${isOpen ? ' open' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--sp-5) var(--sp-6)', borderBottom: '1px solid var(--border)', marginBottom: 'var(--sp-3)' }}>
        <span style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>🏠 HomeHub</span>
        <button
          style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}
          onClick={onClose}
          title="Close menu"
        >✕</button>
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

function Topbar({ title, onMenuClick }: { title: string; onMenuClick: () => void }) {
  const { lock, activeMember } = useAuthStore();
  const { theme, setTheme } = useAppStore();
  return (
    <header className="topbar">
      <button className="btn btn--ghost btn--icon" onClick={onMenuClick} title="Menu">☰</button>
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
          style={{ background: activeMember.color, cursor: 'pointer', overflow: 'hidden' }}
          title={activeMember.name}
          onClick={lock}
        >
          {activeMember.avatar_url
            ? <img src={activeMember.avatar_url} alt={activeMember.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : activeMember.name.slice(0, 2).toUpperCase()
          }
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
  if (page === 'members')   return <MembersPage />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 'var(--sp-4)', color: 'var(--text-2)' }}>
      <span style={{ fontSize: 56 }}>{PAGES[page].icon}</span>
      <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text)' }}>{PAGES[page].label}</h2>
      <p style={{ fontSize: 'var(--text-sm)' }}>Coming soon</p>
    </div>
  );
}
