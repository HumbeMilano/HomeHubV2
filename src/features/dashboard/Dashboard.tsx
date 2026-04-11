import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import type { AppPage } from '../../types';
import styles from './Dashboard.module.css';

interface AppTile {
  page: AppPage;
  label: string;
  icon: string;
  color: string;
  description: string;
}

const APP_TILES: AppTile[] = [
  { page: 'calendar',  label: 'Calendar',     icon: '📅', color: '#818cf8', description: 'Chores, bills & events' },
  { page: 'chores',    label: 'Chores',       icon: '✅', color: '#34d399', description: 'Rotation & tracking' },
  { page: 'shopping',  label: 'Shopping',     icon: '🛒', color: '#fb923c', description: 'Lists by store' },
  { page: 'reminders', label: 'Reminders',    icon: '🔔', color: '#f472b6', description: 'Never forget' },
  { page: 'finance',   label: 'Finance',      icon: '💰', color: '#4ade80', description: 'Bills, budgets & more' },
  { page: 'notes',     label: 'Notes',        icon: '📝', color: '#facc15', description: 'Sticky board' },
  { page: 'members',   label: 'Members',      icon: '👥', color: '#60a5fa', description: 'Household profiles' },
];

export default function Dashboard() {
  const { activeMember } = useAuthStore();
  const { navigate } = useAppStore();

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.greeting}>
            {greeting()}, {activeMember?.name.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className={styles.sub}>What would you like to do today?</p>
        </div>
      </header>

      <div className={styles.grid}>
        {APP_TILES.map((tile) => (
          <button
            key={tile.page}
            className={styles.tile}
            onClick={() => navigate(tile.page)}
            style={{ '--tile-color': tile.color } as React.CSSProperties}
          >
            <span className={styles.tileIcon}>{tile.icon}</span>
            <span className={styles.tileLabel}>{tile.label}</span>
            <span className={styles.tileDesc}>{tile.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
