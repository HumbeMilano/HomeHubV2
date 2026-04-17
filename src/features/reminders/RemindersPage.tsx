import { useEffect, useState } from 'react';
import { format, isPast, isToday, parseISO } from 'date-fns';
import { Bell, Plus, ChevronRight } from 'lucide-react';
import type { CalendarItem } from '../../types';
import { useCalendarStore } from '../../store/calendarStore';
import { useAuthStore } from '../../store/authStore';
import { subscribeToTable } from '../../lib/realtime';
import ConfirmModal from '../../components/ConfirmModal';
import { ItemForm } from '../calendar/CalendarPage';
import { EventDetailSheet } from '../calendar/EventDetail';
import styles from './RemindersPage.module.css';

export default function RemindersPage() {
  const { items, fetchAll, deleteItem } = useCalendarStore();
  const { activeMember } = useAuthStore();
  const [modal,         setModal]         = useState<CalendarItem | 'new' | null>(null);
  const [detail,        setDetail]        = useState<CalendarItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CalendarItem | null>(null);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Cross-device Realtime sync (calendar_items table shared with CalendarPage)
  useEffect(() => {
    return subscribeToTable<CalendarItem>({
      table: 'calendar_items',
      onData: ({ eventType, new: row, old }) => {
        const store = useCalendarStore.getState();
        if (eventType === 'INSERT' && row && !store.items.find((i) => i.id === row.id)) {
          store.setItems([...store.items, row].sort((a, b) => a.start_at.localeCompare(b.start_at)));
        } else if (eventType === 'UPDATE' && row) {
          store.setItems(store.items.map((i) => (i.id === row.id ? row : i)));
        } else if (eventType === 'DELETE' && old) {
          store.setItems(store.items.filter((i) => i.id !== old.id));
        }
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reminders = items.filter((i) => i.type === 'reminder');
  const grouped   = groupReminders(reminders);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Reminders</h2>
        <button
          className="btn btn--primary"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={() => setModal('new')}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {(['today', 'upcoming', 'past'] as const).map((group) => {
        const groupItems = grouped[group];
        if (!groupItems.length) return null;
        return (
          <section key={group}>
            <h3 className={styles.groupLabel}>{group}</h3>
            <div className="list-item-stagger">
              {groupItems.map((r) => {
                const dateStr = formatReminderTime(r);
                return (
                  <button
                    key={r.id}
                    className={`${styles.row} ${group === 'past' ? styles.rowPast : ''}`}
                    onClick={() => setDetail(r)}
                  >
                    <div className={styles.rowIcon}><Bell size={16} /></div>
                    <div className={styles.rowInfo}>
                      <span className={styles.rowTitle}>{r.title}</span>
                      <span className={styles.rowMeta}>
                        {dateStr}
                        {r.repeat && r.repeat !== 'none' && ` · ${r.repeat}`}
                      </span>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
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
            <EventDetailSheet
              item={detail}
              onEdit={() => { setModal(detail); setDetail(null); }}
              onDelete={() => setConfirmDelete(detail)}
              onClose={() => setDetail(null)}
            />
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <ItemForm
              existing={modal === 'new' ? undefined : modal}
              defaultDate={modal === 'new' ? new Date() : parseISO((modal as CalendarItem).start_at)}
              memberId={activeMember?.id ?? null}
              onClose={() => setModal(null)}
            />
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmDelete !== null}
        message={`Delete "${confirmDelete?.title}"?`}
        danger
        onConfirm={() => {
          if (confirmDelete) {
            deleteItem(confirmDelete.id);
            setConfirmDelete(null);
            setDetail(null);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function formatReminderTime(r: CalendarItem): string {
  const start = parseISO(r.start_at);
  if (r.all_day) return format(start, 'MMM d') + ' · All day';
  const startStr = format(start, 'MMM d, h:mm a');
  if (r.end_at) return `${startStr} – ${format(parseISO(r.end_at), 'h:mm a')}`;
  return startStr;
}

function groupReminders(reminders: CalendarItem[]) {
  const today: CalendarItem[]    = [];
  const upcoming: CalendarItem[] = [];
  const past: CalendarItem[]     = [];
  for (const r of reminders) {
    const d = parseISO(r.start_at);
    if (isToday(d)) today.push(r);
    else if (isPast(d)) past.push(r);
    else upcoming.push(r);
  }
  return { today, upcoming, past };
}
