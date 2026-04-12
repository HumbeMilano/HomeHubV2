import { useState } from 'react';
import { format } from 'date-fns';
import type { Reminder, RecurrenceRule } from '../../types';
import { useRemindersStore } from '../../store/remindersStore';

interface Props {
  existing?: Reminder;
  memberId: string | null;
  onClose: () => void;
}

const RECURRENCE_OPTIONS: { value: RecurrenceRule; label: string }[] = [
  { value: 'daily',    label: 'Daily' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly',  label: 'Monthly' },
];

export default function ReminderForm({ existing, memberId, onClose }: Props) {
  const { addReminder, updateReminder } = useRemindersStore();

  const [title, setTitle]           = useState(existing?.title ?? '');
  const [body, setBody]             = useState(existing?.body ?? '');
  const [isRecurring, setIsRecurring] = useState(existing?.is_recurring ?? false);
  const [recurrence, setRecurrence] = useState<RecurrenceRule>(existing?.recurrence_rule ?? 'weekly');
  const [isAllDay, setIsAllDay]     = useState(existing?.is_all_day ?? true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const existingDate      = existing ? format(new Date(existing.due_at), 'yyyy-MM-dd') : '';
  const existingStartTime = existing && !existing.is_all_day
    ? format(new Date(existing.due_at), 'HH:mm') : '';
  const existingEndTime   = existing?.end_at && !existing.is_all_day
    ? format(new Date(existing.end_at), 'HH:mm') : '';

  const [date, setDate]           = useState(existingDate);
  const [startTime, setStartTime] = useState(existingStartTime);
  const [endTime, setEndTime]     = useState(existingEndTime);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSaving(true);
    setError('');

    const due_at = isAllDay
      ? new Date(`${date}T00:00:00`).toISOString()
      : new Date(`${date}T${startTime}:00`).toISOString();

    const end_at = (!isAllDay && endTime)
      ? new Date(`${date}T${endTime}:00`).toISOString()
      : null;

    try {
      const payload = {
        title,
        body: body || null,
        due_at,
        end_at,
        is_all_day: isAllDay,
        is_recurring: isRecurring,
        recurrence_rule: recurrence,
        member_id: memberId,
      };
      if (existing) {
        await updateReminder(existing.id, payload);
      } else {
        await addReminder(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      <div className="modal-handle" />
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
        {existing ? 'Edit Reminder' : 'New Reminder'}
      </h2>

      {/* Title */}
      <div className="field">
        <label htmlFor="reminder-title">Title *</label>
        <input
          id="reminder-title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Meeting with team"
          required
          autoFocus
        />
      </div>

      {/* Date */}
      <div className="field">
        <label htmlFor="reminder-date">Date *</label>
        <input
          id="reminder-date"
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      {/* All day toggle */}
      <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={isAllDay}
          onChange={(e) => {
            setIsAllDay(e.target.checked);
            if (e.target.checked) { setStartTime(''); setEndTime(''); }
          }}
        />
        <span style={{ fontSize: 'var(--text-sm)' }}>All day</span>
      </label>

      {/* Start / End time — only when not all day */}
      {!isAllDay && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
          <div className="field">
            <label htmlFor="reminder-start">Start time *</label>
            <input
              id="reminder-start"
              className="input"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="reminder-end">
              End time <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id="reminder-end"
              className="input"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="field">
        <label htmlFor="reminder-notes">Notes</label>
        <textarea
          id="reminder-notes"
          className="input"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Optional details…"
          style={{ resize: 'vertical' }}
        />
      </div>

      {/* Recurring */}
      <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
        />
        <span style={{ fontSize: 'var(--text-sm)' }}>Recurring reminder</span>
      </label>

      {isRecurring && (
        <div className="field">
          <label htmlFor="reminder-recurrence">Repeat</label>
          <select
            id="reminder-recurrence"
            className="input"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as RecurrenceRule)}
          >
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--danger)', margin: 0 }}>
          Error: {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Add reminder'}
        </button>
      </div>
    </form>
  );
}
