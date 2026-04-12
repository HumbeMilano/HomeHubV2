import { useEffect } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { Bell } from 'lucide-react';
import { useCalendarStore } from '../../../store/calendarStore';
import styles from './RemindersWidget.module.css';

export default function RemindersWidget() {
  const { items, fetchAll } = useCalendarStore();

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const upcoming = items
    .filter((item) => {
      const d = new Date(item.start_at);
      return item.type === 'reminder' && (!isPast(d) || isToday(d));
    })
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
              <span
                className={styles.dot}
                style={{ background: r.color }}
              />
              <span className={styles.itemTitle}>{r.title}</span>
              <span className={styles.itemDate}>
                {r.all_day
                  ? format(new Date(r.start_at), 'MMM d')
                  : format(new Date(r.start_at), 'MMM d, h:mm a')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
