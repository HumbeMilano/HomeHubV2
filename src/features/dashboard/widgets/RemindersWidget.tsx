import { useEffect } from 'react';
import { format, isPast } from 'date-fns';
import { Bell } from 'lucide-react';
import { useRemindersStore } from '../../../store/remindersStore';
import styles from './RemindersWidget.module.css';

export default function RemindersWidget() {
  const { reminders, fetchAll } = useRemindersStore();

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const upcoming = reminders
    .filter((r) => !isPast(new Date(r.due_at)) || r.is_all_day)
    .sort((a, b) => a.due_at.localeCompare(b.due_at))
    .slice(0, 6);

  return (
    <div className={styles.root}>
      <h3 className={styles.title}><Bell size={14} /> Reminders</h3>
      {upcoming.length === 0 ? (
        <p className={styles.empty}>No upcoming reminders</p>
      ) : (
        <ul className={styles.list}>
          {upcoming.map((r) => (
            <li key={r.id} className={styles.item}>
              <span className={styles.itemTitle}>{r.title}</span>
              <span className={styles.itemDate}>
                {r.is_all_day
                  ? format(new Date(r.due_at), 'MMM d')
                  : format(new Date(r.due_at), 'MMM d, h:mm a')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
