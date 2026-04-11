import type { CalendarEvent } from '../../types';
import styles from './EventChip.module.css';

interface Props {
  event: CalendarEvent;
  onClick?: (e: CalendarEvent) => void;
  compact?: boolean;
}

const TYPE_COLORS: Record<CalendarEvent['type'], string> = {
  chore:    'var(--color-chores)',
  reminder: 'var(--color-reminders)',
  bill:     'var(--color-finance)',
};

export default function EventChip({ event, onClick, compact }: Props) {
  const color = event.color ?? TYPE_COLORS[event.type];
  return (
    <button
      className={`${styles.chip} ${compact ? styles.compact : ''}`}
      style={{ '--chip-color': color } as React.CSSProperties}
      onClick={(e) => { e.stopPropagation(); onClick?.(event); }}
      title={event.title}
    >
      <span className={styles.dot} />
      <span className={styles.label}>{event.title}</span>
    </button>
  );
}
