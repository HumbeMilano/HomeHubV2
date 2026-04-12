import { useEffect, useState, useRef } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth,
  isToday, isSameDay, parseISO, differenceInMinutes, addDays,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Pencil, Trash2, Calendar, Bell } from 'lucide-react';
import type { CalendarItem, ReminderCategory, RepeatRule } from '../../types';
import { useCalendarStore } from '../../store/calendarStore';
import { useAuthStore } from '../../store/authStore';
import { subscribeToTable } from '../../lib/realtime';
import styles from './CalendarPage.module.css';

// ── Colour palette ─────────────────────────────────────────────────────────
const EVENT_COLORS = [
  '#5b5bf6', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#a855f7', '#ec4899',
];
const REMINDER_CATEGORIES: { value: ReminderCategory; label: string }[] = [
  { value: 'personal',    label: 'Personal' },
  { value: 'to_do',       label: 'To-do' },
  { value: 'bill',        label: 'Bill / Payment' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'other',       label: 'Other' },
];
const REPEAT_OPTIONS: { value: RepeatRule; label: string }[] = [
  { value: 'none',    label: 'No repeat' },
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function itemColor(item: CalendarItem, alpha = 1): string {
  if (item.type === 'event') return item.color;
  // reminders: translucent version
  const hex = item.color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function itemsForDay(items: CalendarItem[], day: Date): CalendarItem[] {
  return items.filter((item) => {
    const start = parseISO(item.start_at);
    if (isSameDay(start, day)) return true;
    // multi-day events
    if (item.end_at) {
      const end = parseISO(item.end_at);
      return day >= start && day <= end;
    }
    return false;
  }).sort((a, b) => a.start_at.localeCompare(b.start_at));
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { items, fetchAll, deleteItem } = useCalendarStore();
  const { activeMember } = useAuthStore();
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [form, setForm] = useState<{ item?: CalendarItem; defaultDate?: Date } | null>(null);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
  }, []);

  // Month grid days
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end   = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days  = eachDayOfInterval({ start, end });

  const dayItems = itemsForDay(items, selectedDay);

  return (
    <div className={styles.root}>
      {/* ── Left: Month grid ─────────────────────────────── */}
      <div className={styles.gridPanel}>
        {/* Month nav */}
        <div className={styles.monthNav}>
          <button className="btn btn--ghost btn--icon" onClick={() => setMonth((m) => subMonths(m, 1))}>
            <ChevronLeft size={18} />
          </button>
          <h2 className={styles.monthTitle}>{format(month, 'MMMM yyyy')}</h2>
          <button className="btn btn--ghost btn--icon" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day names */}
        <div className={styles.dayNames}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
            <span key={d} className={styles.dayName}>{d}</span>
          ))}
        </div>

        {/* Day cells */}
        <div className={styles.grid}>
          {days.map((day) => {
            const dayEvents = itemsForDay(items, day);
            const isSelected = isSameDay(day, selectedDay);
            return (
              <div
                key={day.toISOString()}
                className={[
                  styles.cell,
                  !isSameMonth(day, month) ? styles.cellOtherMonth : '',
                  isToday(day) ? styles.cellToday : '',
                  isSelected ? styles.cellSelected : '',
                ].join(' ')}
                onClick={() => setSelectedDay(day)}
              >
                <span className={styles.cellNum}>{format(day, 'd')}</span>
                <div className={styles.cellChips}>
                  {dayEvents.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      className={styles.chip}
                      style={{
                        background: itemColor(item, item.type === 'reminder' ? 0.25 : 1),
                        color: item.type === 'event' ? '#fff' : item.color,
                        border: item.type === 'reminder' ? `1px solid ${item.color}` : 'none',
                      }}
                    >
                      {item.title}
                    </span>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className={styles.chipMore}>+{dayEvents.length - 3}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Day panel ─────────────────────────────── */}
      <div className={styles.dayPanel}>
        <div className={styles.dayPanelHeader}>
          <div>
            <div className={styles.dayPanelDate}>{format(selectedDay, 'EEEE')}</div>
            <div className={styles.dayPanelNum}>{format(selectedDay, 'MMMM d, yyyy')}</div>
          </div>
          <button
            className="btn btn--primary btn--sm"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setForm({ defaultDate: selectedDay })}
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {/* Timeline + all-day section */}
        {dayItems.length === 0 ? (
          <div className={styles.dayEmpty}>
            <Calendar size={32} />
            <p>No events. Tap + to add one.</p>
          </div>
        ) : (
          <DayTimeline
            day={selectedDay}
            items={dayItems}
            onEdit={(item) => setForm({ item })}
            onDelete={deleteItem}
          />
        )}
      </div>

      {/* ── Form modal ───────────────────────────────────── */}
      {form && (
        <div className="modal-backdrop" onClick={() => setForm(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <ItemForm
              existing={form.item}
              defaultDate={form.defaultDate ?? selectedDay}
              memberId={activeMember?.id ?? null}
              onClose={() => setForm(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Day timeline ──────────────────────────────────────────────────────────
function DayTimeline({ day, items, onEdit, onDelete }: {
  day: Date;
  items: CalendarItem[];
  onEdit: (item: CalendarItem) => void;
  onDelete: (id: string) => void;
}) {
  const allDay  = items.filter((i) => i.all_day);
  const timed   = items.filter((i) => !i.all_day);
  const HOUR_H  = 56; // px per hour
  const START_H = 6;  // timeline starts at 6am
  const hours   = Array.from({ length: 18 }, (_, i) => i + START_H); // 6am–midnight

  function topPx(item: CalendarItem): number {
    const start = parseISO(item.start_at);
    const h = start.getHours() + start.getMinutes() / 60;
    return Math.max(0, (h - START_H) * HOUR_H);
  }

  function heightPx(item: CalendarItem): number {
    if (!item.end_at) return HOUR_H * 0.75;
    const mins = differenceInMinutes(parseISO(item.end_at), parseISO(item.start_at));
    return Math.max(24, (mins / 60) * HOUR_H);
  }

  return (
    <div className={styles.timeline}>
      {/* All-day events */}
      {allDay.length > 0 && (
        <div className={styles.allDayRow}>
          <span className={styles.allDayLabel}>All day</span>
          <div className={styles.allDayItems}>
            {allDay.map((item) => (
              <ItemCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}

      {/* Timed grid */}
      <div className={styles.timeGrid}>
        {/* Hour labels + lines */}
        {hours.map((h) => (
          <div key={h} className={styles.hourRow} style={{ height: HOUR_H }}>
            <span className={styles.hourLabel}>{h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`}</span>
            <div className={styles.hourLine} />
          </div>
        ))}

        {/* Timed event blocks */}
        <div className={styles.eventLayer}>
          {timed.map((item) => (
            <div
              key={item.id}
              className={styles.eventBlock}
              style={{
                top: topPx(item),
                height: heightPx(item),
                background: itemColor(item, item.type === 'reminder' ? 0.2 : 1),
                borderLeft: `3px solid ${item.color}`,
                color: item.type === 'event' ? '#fff' : item.color,
              }}
              onClick={() => onEdit(item)}
            >
              <span className={styles.eventBlockTitle}>{item.title}</span>
              {item.end_at && (
                <span className={styles.eventBlockTime}>
                  {format(parseISO(item.start_at), 'h:mm')}–{format(parseISO(item.end_at), 'h:mm a')}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Item card (all-day) ───────────────────────────────────────────────────
function ItemCard({ item, onEdit, onDelete }: {
  item: CalendarItem;
  onEdit: (item: CalendarItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={styles.itemCard}
      style={{
        background: itemColor(item, item.type === 'reminder' ? 0.15 : 1),
        borderLeft: `3px solid ${item.color}`,
        color: item.type === 'event' ? '#fff' : item.color,
      }}
    >
      <span className={styles.itemCardTitle}>{item.title}</span>
      <div className={styles.itemCardActions}>
        <button onClick={() => onEdit(item)}><Pencil size={12} /></button>
        <button onClick={() => { if (confirm(`Delete "${item.title}"?`)) onDelete(item.id); }}><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

// ── Add/Edit form ─────────────────────────────────────────────────────────
function ItemForm({ existing, defaultDate, memberId, onClose }: {
  existing?: CalendarItem;
  defaultDate: Date;
  memberId: string | null;
  onClose: () => void;
}) {
  const { addItem, updateItem } = useCalendarStore();

  const dateStr = format(defaultDate, 'yyyy-MM-dd');
  const [itemType,  setItemType]  = useState<'event' | 'reminder'>(existing?.type ?? 'event');
  const [title,     setTitle]     = useState(existing?.title ?? '');
  const [color,     setColor]     = useState(existing?.color ?? EVENT_COLORS[0]);
  const [allDay,    setAllDay]    = useState(existing?.all_day ?? false);
  const [startDate, setStartDate] = useState(existing ? format(parseISO(existing.start_at), 'yyyy-MM-dd') : dateStr);
  const [startTime, setStartTime] = useState(existing && !existing.all_day ? format(parseISO(existing.start_at), 'HH:mm') : '09:00');
  const [endDate,   setEndDate]   = useState(existing?.end_at ? format(parseISO(existing.end_at), 'yyyy-MM-dd') : dateStr);
  const [endTime,   setEndTime]   = useState(existing?.end_at ? format(parseISO(existing.end_at), 'HH:mm') : '10:00');
  const [repeat,    setRepeat]    = useState<RepeatRule>(existing?.repeat ?? 'none');
  const [notes,     setNotes]     = useState(existing?.notes ?? '');
  const [remCat,    setRemCat]    = useState<ReminderCategory>(existing?.reminder_category ?? 'personal');
  const [saving,    setSaving]    = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    const startIso = allDay
      ? new Date(`${startDate}T00:00:00`).toISOString()
      : new Date(`${startDate}T${startTime}:00`).toISOString();

    const endIso = (() => {
      if (allDay) {
        return startDate !== endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null;
      }
      return endTime ? new Date(`${endDate}T${endTime}:00`).toISOString() : null;
    })();

    const payload: Omit<CalendarItem, 'id' | 'created_at'> = {
      type: itemType,
      title: title.trim(),
      color,
      all_day: allDay,
      start_at: startIso,
      end_at: endIso,
      repeat,
      notes: notes.trim() || null,
      reminder_category: itemType === 'reminder' ? remCat : null,
      member_id: memberId,
    };

    try {
      if (existing) {
        await updateItem(existing.id, payload);
      } else {
        await addItem(payload);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.form}>
      <div className={styles.formHeader}>
        <h3 className={styles.formTitle}>{existing ? 'Edit' : 'New'} {itemType}</h3>
        <button className="btn btn--ghost btn--icon" style={{ width: 32, height: 32 }} onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Event / Reminder toggle */}
      {!existing && (
        <div className={styles.typeToggle}>
          <button
            type="button"
            className={`${styles.typeBtn} ${itemType === 'event' ? styles.typeBtnActive : ''}`}
            onClick={() => setItemType('event')}
          >
            <Calendar size={14} /> Event
          </button>
          <button
            type="button"
            className={`${styles.typeBtn} ${itemType === 'reminder' ? styles.typeBtnActive : ''}`}
            onClick={() => setItemType('reminder')}
          >
            <Bell size={14} /> Reminder
          </button>
        </div>
      )}

      <form onSubmit={submit} className={styles.formBody}>
        {/* Title */}
        <div className="field">
          <label>Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add title…" required autoFocus />
        </div>

        {/* Color (events only get solid colors, reminders use same palette shown translucent) */}
        <div className="field">
          <label>Color</label>
          <div className={styles.colorRow}>
            {EVENT_COLORS.map((c) => (
              <button
                key={c} type="button"
                className={styles.colorSwatch}
                style={{
                  background: itemType === 'event' ? c : `rgba(${parseInt(c.slice(1,3),16)},${parseInt(c.slice(3,5),16)},${parseInt(c.slice(5,7),16)},0.35)`,
                  outline: color === c ? '2px solid var(--text)' : '2px solid transparent',
                  outlineOffset: 2,
                  border: `2px solid ${c}`,
                }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        {/* All day */}
        <label className={styles.toggleRow}>
          <span>All day</span>
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        </label>

        {/* Dates */}
        <div className={styles.dateRow}>
          <div className="field" style={{ flex: 1 }}>
            <label>Start date</label>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          {!allDay && (
            <div className="field" style={{ flex: 1 }}>
              <label>Start time</label>
              <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          )}
        </div>

        {/* End date/time — for events always shown; for reminders only when not all-day */}
        {(itemType === 'event' || !allDay) && (
          <div className={styles.dateRow}>
            <div className="field" style={{ flex: 1 }}>
              <label>End date</label>
              <input className="input" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            {!allDay && (
              <div className="field" style={{ flex: 1 }}>
                <label>End time</label>
                <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            )}
          </div>
        )}

        {/* Reminder category */}
        {itemType === 'reminder' && (
          <div className="field">
            <label>Category</label>
            <select className="input" value={remCat} onChange={(e) => setRemCat(e.target.value as ReminderCategory)}>
              {REMINDER_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Repeat */}
        <div className="field">
          <label>Repeat</label>
          <select className="input" value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatRule)}>
            {REPEAT_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="field">
          <label>Notes</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" style={{ resize: 'none' }} />
        </div>

        <div className={styles.formActions}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : existing ? 'Save changes' : 'Add'}
          </button>
        </div>
      </form>
    </div>
  );
}
