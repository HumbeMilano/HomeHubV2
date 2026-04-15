import { useState } from 'react';
import type { Chore, RecurrenceRule } from '../../types';
import { useChoresStore } from '../../store/choresStore';
import { useAuthStore } from '../../store/authStore';
import { format } from 'date-fns';

interface Props {
  defaultStartTime?: Date;   // pre-filled from calendar cell click
  onClose: () => void;
  existing?: Chore;
}

const RECURRENCE_OPTIONS: { value: RecurrenceRule; label: string }[] = [
  { value: 'none',     label: 'One-time' },
  { value: 'daily',    label: 'Daily' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly',  label: 'Monthly' },
];

export default function ChoreForm({ defaultStartTime, onClose, existing }: Props) {
  const { addChore, updateChore } = useChoresStore();
  const { activeMember } = useAuthStore();

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [recurrence, setRecurrence] = useState<RecurrenceRule>(existing?.recurrence_rule ?? 'weekly');
  const [saving, setSaving] = useState(false);

  // The start time shown in the form comes directly from the cell click —
  // this ensures the saved chore reflects exactly where the user clicked.
  const [scheduledTime] = useState(
    defaultStartTime ? format(defaultStartTime, "yyyy-MM-dd'T'HH:mm") : ''
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (existing) {
        await updateChore(existing.id, { title, description: description || null, category: category || null, recurrence_rule: recurrence });
      } else {
        await addChore({
          title,
          description: description || null,
          category: category || null,
          recurrence_rule: recurrence,
          created_by: activeMember?.id ?? null,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      <div className="modal-handle" />
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
        {existing ? 'Edit Chore' : 'New Chore'}
      </h2>

      <div className="field">
        <label htmlFor="chore-title">Title *</label>
        <input
          id="chore-title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Take out trash"
          required
          autoFocus
        />
      </div>

      {scheduledTime && (
        <div className="field">
          <label>Scheduled time</label>
          <input
            className="input"
            type="datetime-local"
            defaultValue={scheduledTime}
            readOnly
            style={{ color: 'var(--text-2)' }}
          />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
            Captured from your click on the calendar
          </span>
        </div>
      )}

      <div className="field">
        <label htmlFor="chore-desc">Notes</label>
        <textarea
          id="chore-desc"
          className="input"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details…"
          style={{ resize: 'vertical' }}
        />
      </div>

      <div className="field">
        <label htmlFor="chore-cat">Category</label>
        <input
          id="chore-cat"
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Kitchen, Bathroom…"
        />
      </div>

      <div className="field">
        <label htmlFor="chore-recurrence">Recurrence</label>
        <select
          id="chore-recurrence"
          className="input"
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as RecurrenceRule)}
        >
          {RECURRENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Add chore'}
        </button>
      </div>
    </form>
  );
}
