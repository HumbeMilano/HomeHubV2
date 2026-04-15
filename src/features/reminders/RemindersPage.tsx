import { useEffect, useState } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { Bell, Plus, Pencil, X, Trash2, FileText, ChevronRight } from 'lucide-react';
import type { Reminder } from '../../types';
import { useRemindersStore } from '../../store/remindersStore';
import { useAuthStore } from '../../store/authStore';
import { subscribeToTable } from '../../lib/realtime';
import ReminderForm from './ReminderForm';
import styles from './RemindersPage.module.css';

export default function RemindersPage() {
  const { reminders, fetchAll, deleteReminder } = useRemindersStore();
  const { activeMember } = useAuthStore();
  const [modal,  setModal]  = useState<Reminder | 'new' | null>(null);
  const [detail, setDetail] = useState<Reminder | null>(null);

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
                <div
                  key={r.id}
                  className={`${styles.row} ${group === 'past' ? styles.rowPast : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setDetail(r)}
                >
                  <div className={styles.rowIcon}><Bell size={16} /></div>
                  <div className={styles.rowInfo}>
                    <span className={styles.rowTitle}>{r.title}</span>
                    <span className={styles.rowMeta}>
                      {dateStr}
                      {r.is_recurring && ` · ${r.recurrence_rule}`}
                    </span>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
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

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <ReminderDetailSheet
              reminder={detail}
              onEdit={() => { setModal(detail); setDetail(null); }}
              onDelete={() => {
                if (confirm(`Delete "${detail.title}"?`)) {
                  deleteReminder(detail.id);
                  setDetail(null);
                }
              }}
              onClose={() => setDetail(null)}
            />
          </div>
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

// ── Reminder Detail Sheet ──────────────────────────────────────────────────
function ReminderDetailSheet({ reminder, onEdit, onDelete, onClose }: {
  reminder: Reminder;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const timeStr = formatReminderTime(reminder);
  const recurrenceLabel: Record<string, string> = {
    daily: 'Daily', weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', padding: 'var(--sp-2) 0' }}>
      <div className="modal-handle" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)', padding: '0 var(--sp-1)' }}>
        <Bell size={20} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 3 }} />
        <h3 style={{ flex: 1, fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
          {reminder.title}
        </h3>
        <button className="btn btn--ghost btn--icon" style={{ width: 32, height: 32 }} onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Details */}
      <div style={{
        background: 'var(--bg-3)', borderRadius: 'var(--r-lg)',
        overflow: 'hidden', margin: '0 var(--sp-1)',
      }}>
        {/* Date/time */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-4)',
          borderBottom: (reminder.is_recurring || reminder.body) ? '0.5px solid var(--border)' : 'none',
        }}>
          <Bell size={15} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: 'var(--text)' }}>{timeStr}</span>
        </div>

        {/* Recurrence */}
        {reminder.is_recurring && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-4)',
            borderBottom: reminder.body ? '0.5px solid var(--border)' : 'none',
          }}>
            <Bell size={15} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: 'var(--text)' }}>
              {recurrenceLabel[reminder.recurrence_rule] ?? reminder.recurrence_rule}
            </span>
          </div>
        )}

        {/* Notes */}
        {reminder.body && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)', padding: 'var(--sp-4)' }}>
            <FileText size={15} style={{ color: 'var(--text-2)', flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 14, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {reminder.body}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', padding: '0 var(--sp-1)' }}>
        <button
          className="btn btn--danger"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={onDelete}
        >
          <Trash2 size={14} /> Delete
        </button>
        <button
          className="btn btn--primary"
          style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={onEdit}
        >
          <Pencil size={14} /> Edit
        </button>
      </div>
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
