import { useEffect, useState } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isToday, isSameDay,
} from 'date-fns';
import { X } from 'lucide-react';
import { useCalendarStore } from '../../../store/calendarStore';
import styles from './CalendarWidget.module.css';

export default function CalendarWidget() {
  const [month, setMonth]       = useState(new Date());
  const [selected, setSelected] = useState<Date | null>(null);
  const { items, fetchAll, addItem } = useCalendarStore();

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end   = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days  = eachDayOfInterval({ start, end });

  function hasEvent(day: Date) {
    return items.some((item) => isSameDay(new Date(item.start_at), day));
  }

  function prevMonth() { setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; }); }
  function nextMonth() { setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; }); }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button className={styles.navBtn} onClick={prevMonth}>‹</button>
        <h3 className={styles.title}>{format(month, 'MMM yyyy')}</h3>
        <button className={styles.navBtn} onClick={nextMonth}>›</button>
      </div>

      <div className={styles.grid}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
          <span key={d} className={styles.dayName}>{d}</span>
        ))}
        {days.map((day) => (
          <span
            key={day.toISOString()}
            className={[
              styles.day,
              !isSameMonth(day, month) ? styles.dayOther : '',
              isToday(day) ? styles.dayToday : '',
              selected && isSameDay(day, selected) ? styles.daySelected : '',
            ].join(' ')}
            onClick={() => setSelected(day)}
          >
            {format(day, 'd')}
            {hasEvent(day) && !isToday(day) && <span className={styles.dot} />}
          </span>
        ))}
      </div>

      {/* Quick-add popup */}
      {selected && (
        <QuickAddPopup
          date={selected}
          onSave={async (title, isAllDay, time) => {
            const due = new Date(selected);
            if (!isAllDay && time) {
              const [h, m] = time.split(':').map(Number);
              due.setHours(h, m, 0, 0);
            }
            await addItem({
              type: 'reminder',
              title,
              color: '#5b5bf6',
              all_day: isAllDay,
              start_at: due.toISOString(),
              end_at: null,
              repeat: 'none',
              notes: null,
              reminder_category: 'personal',
              member_id: null,
            });
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function QuickAddPopup({ date, onSave, onClose }: {
  date: Date;
  onSave: (title: string, isAllDay: boolean, time: string) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle]     = useState('');
  const [isAllDay, setAllDay] = useState(true);
  const [time, setTime]       = useState('09:00');
  const [saving, setSaving]   = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSave(title.trim(), isAllDay, time);
    setSaving(false);
  }

  return (
    <div className={styles.popup}>
      <div className={styles.popupHeader}>
        <span className={styles.popupDate}>{format(date, 'EEE, MMM d')}</span>
        <button className={styles.popupClose} onClick={onClose}><X size={12} /></button>
      </div>
      <form onSubmit={submit} className={styles.popupForm}>
        <input
          className={`input ${styles.popupInput}`}
          placeholder="Event title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
        />
        <label className={styles.popupRow}>
          <input type="checkbox" checked={isAllDay} onChange={(e) => setAllDay(e.target.checked)} />
          All day
        </label>
        {!isAllDay && (
          <input
            type="time"
            className={`input ${styles.popupInput}`}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        )}
        <button type="submit" className="btn btn--primary btn--sm" disabled={saving || !title.trim()}>
          {saving ? '…' : 'Save'}
        </button>
      </form>
    </div>
  );
}
