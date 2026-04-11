import { useEffect, useState } from 'react';
import { format, isPast, isToday } from 'date-fns';
import type { Reminder, RecurrenceRule } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { subscribeToTable } from '../../lib/realtime';
import { uid } from '../../lib/utils';
import styles from './RemindersPage.module.css';

export default function RemindersPage() {
  const { activeMember } = useAuthStore();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [modal, setModal] = useState<Reminder | 'new' | null>(null);

  useEffect(() => {
    supabase.from('reminders').select('*').order('due_at').then(({ data }) => {
      setReminders((data ?? []) as Reminder[]);
    });
  }, []);

  useEffect(() => {
    return subscribeToTable<Reminder>({
      table: 'reminders',
      onData: ({ eventType, new: row, old }) => {
        if (eventType === 'INSERT' && row) setReminders((p) => [...p.filter((r) => r.id !== row.id), row].sort((a, b) => a.due_at.localeCompare(b.due_at)));
        if (eventType === 'UPDATE' && row) setReminders((p) => p.map((r) => r.id === row.id ? row : r));
        if (eventType === 'DELETE' && old) setReminders((p) => p.filter((r) => r.id !== old.id));
      },
    });
  }, []);

  async function deleteReminder(id: string) {
    setReminders((p) => p.filter((r) => r.id !== id));
    await supabase.from('reminders').delete().eq('id', id);
  }

  const grouped = groupReminders(reminders);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Reminders</h2>
        <button className="btn btn--primary" onClick={() => setModal('new')}>+ Add</button>
      </div>

      {(['today', 'upcoming', 'past'] as const).map((group) => {
        const items = grouped[group];
        if (!items.length) return null;
        return (
          <section key={group}>
            <h3 className={styles.groupLabel}>{group}</h3>
            {items.map((r) => (
              <div key={r.id} className={`${styles.row} ${group === 'past' ? styles.rowPast : ''}`}>
                <div className={styles.rowIcon}>🔔</div>
                <div className={styles.rowInfo}>
                  <span className={styles.rowTitle}>{r.title}</span>
                  <span className={styles.rowMeta}>
                    {format(new Date(r.due_at), 'MMM d, h:mm a')}
                    {r.is_recurring && ` · ${r.recurrence_rule}`}
                  </span>
                </div>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setModal(r)}
                >Edit</button>
                <button
                  className="btn btn--ghost btn--sm"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => deleteReminder(r.id)}
                >✕</button>
              </div>
            ))}
          </section>
        );
      })}

      {reminders.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', paddingTop: 80 }}>
          <div style={{ fontSize: 48 }}>🔔</div>
          <p style={{ marginTop: 'var(--sp-4)' }}>No reminders yet.</p>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <ReminderForm
              existing={modal === 'new' ? undefined : modal}
              memberId={activeMember?.id ?? null}
              onSave={(r) => {
                setReminders((p) => {
                  const filtered = p.filter((x) => x.id !== r.id);
                  return [...filtered, r].sort((a, b) => a.due_at.localeCompare(b.due_at));
                });
                setModal(null);
              }}
              onClose={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ReminderForm({
  existing, memberId, onSave, onClose
}: {
  existing?: Reminder;
  memberId: string | null;
  onSave: (r: Reminder) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [dueAt, setDueAt] = useState(
    existing?.due_at ? format(new Date(existing.due_at), "yyyy-MM-dd'T'HH:mm") : ''
  );
  const [isRecurring, setIsRecurring] = useState(existing?.is_recurring ?? false);
  const [recurrence, setRecurrence] = useState<RecurrenceRule>(existing?.recurrence_rule ?? 'weekly');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueAt) return;
    setSaving(true);
    const reminder: Reminder = {
      id: existing?.id ?? uid(),
      title, body: body || null,
      due_at: new Date(dueAt).toISOString(),
      is_recurring: isRecurring,
      recurrence_rule: recurrence,
      member_id: memberId,
      created_at: existing?.created_at ?? new Date().toISOString(),
    };
    if (existing) {
      await supabase.from('reminders').update(reminder).eq('id', reminder.id);
    } else {
      await supabase.from('reminders').insert(reminder);
    }
    setSaving(false);
    onSave(reminder);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      <div className="modal-handle" />
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
        {existing ? 'Edit Reminder' : 'New Reminder'}
      </h2>
      <div className="field">
        <label>Title *</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </div>
      <div className="field">
        <label>Date & Time *</label>
        <input className="input" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
      </div>
      <div className="field">
        <label>Notes</label>
        <textarea className="input" rows={2} value={body} onChange={(e) => setBody(e.target.value)} style={{ resize: 'vertical' }} />
      </div>
      <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', cursor: 'pointer' }}>
        <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
        <span style={{ fontSize: 'var(--text-sm)' }}>Recurring</span>
      </label>
      {isRecurring && (
        <div className="field">
          <label>Repeat</label>
          <select className="input" value={recurrence} onChange={(e) => setRecurrence(e.target.value as RecurrenceRule)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
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
