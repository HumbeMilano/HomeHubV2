import { useEffect, useState } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { Bell, Plus, Pencil, X } from 'lucide-react';
import type { Reminder } from '../../types';
import { useRemindersStore } from '../../store/remindersStore';
import { useAuthStore } from '../../store/authStore';
import { subscribeToTable } from '../../lib/realtime';
import ReminderForm from './ReminderForm';
import styles from './RemindersPage.module.css';

export default function RemindersPage() {
  const { reminders, fetchAll, deleteReminder } = useRemindersStore();
  const { activeMember } = useAuthStore();
  const [modal, setModal] = useState<Reminder | 'new' | null>(null);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Cross-device Realtime sync
  useEffect(() => {
    return subscribeToTable<Reminder>({
      table: 'reminders',
      onData: ({ eventType, new: row, old }) => {
        const store = useRemindersStore.getState();
        if (eventType === 'INSERT' && row) {
          if (!store.reminders.find((r) => r.id === row.id)) {
            store.setReminders([...store.reminders, row].sort((a, b) => a.due_at.localeCompare(b.due_at)));
          }
        } else if (eventType === 'UPDATE' && row) {
          store.setReminders(store.reminders.map((r) => (r.id === row.id ? row : r)));
        } else if (eventType === 'DELETE' && old) {
          store.setReminders(store.reminders.filter((r) => r.id !== old.id));
        }
      },
    });
  }, []);

  const grouped = groupReminders(reminders);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Reminders</h2>
        <button className="btn btn--primary" style={{ display:'flex', alignItems:'center', gap:4 }} onClick={() => setModal('new')}><Plus size={14} /> Add</button>
      </div>

      {(['today', 'upcoming', 'past'] as const).map((group) => {
        const items = grouped[group];
        if (!items.length) return null;
        return (
          <section key={group}>
            <h3 className={styles.groupLabel}>{group}</h3>
            {items.map((r) => {
              const dateStr = formatReminderTime(r);
              return (
                <div key={r.id} className={`${styles.row} ${group === 'past' ? styles.rowPast : ''}`}>
                  <div className={styles.rowIcon}><Bell size={16} /></div>
                  <div className={styles.rowInfo}>
                    <span className={styles.rowTitle}>{r.title}</span>
                    <span className={styles.rowMeta}>
                      {dateStr}
                      {r.is_recurring && ` · ${r.recurrence_rule}`}
                    </span>
                  </div>
                  <button className="btn btn--ghost btn--icon" style={{ width: 30, height: 30 }} onClick={() => setModal(r)}><Pencil size={14} /></button>
                  <button
                    className="btn btn--ghost btn--icon"
                    style={{ color: 'var(--danger)', width: 30, height: 30 }}
                    onClick={() => { if (confirm(`Delete "${r.title}"?`)) deleteReminder(r.id); }}
                  ><X size={14} /></button>
                </div>
              );
            })}
          </section>
        );
      })}

      {reminders.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', paddingTop: 80 }}>
          <Bell size={48} style={{ margin: '0 auto' }} />
          <p style={{ marginTop: 'var(--sp-4)' }}>No reminders yet.</p>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <ReminderForm
              existing={modal === 'new' ? undefined : modal}
              memberId={activeMember?.id ?? null}
              onClose={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatReminderTime(r: Reminder): string {
  const start = new Date(r.due_at);
  if (r.is_all_day) return format(start, 'MMM d') + ' · All day';
  const startStr = format(start, 'MMM d, h:mm a');
  if (r.end_at) return `${startStr} – ${format(new Date(r.end_at), 'h:mm a')}`;
  return startStr;
}

function groupReminders(reminders: Reminder[]) {
  const today: Reminder[] = [];
  const upcoming: Reminder[] = [];
  const past: Reminder[] = [];
  for (const r of reminders) {
    const d = new Date(r.due_at);
    if (isToday(d)) today.push(r);
    else if (isPast(d)) past.push(r);
    else upcoming.push(r);
  }
  return { today, upcoming, past };
}
