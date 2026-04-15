import { useEffect, useRef, useState } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth,
  isToday, isSameDay, parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, X, Calendar, Plus } from 'lucide-react';
import type { CalendarItem, FinBill, ReminderCategory, RepeatRule } from '../../types';
import { useCalendarStore } from '../../store/calendarStore';
import { useFinanceStore } from '../../store/financeStore';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { subscribeToTable } from '../../lib/realtime';
import { EventDetailBody, EventListRow } from './EventDetail';
import styles from './CalendarPage.module.css';

// ── Palette ────────────────────────────────────────────────────────────────
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

// ── Bill color ─────────────────────────────────────────────────────────────
const BILL_COLOR = '#6EC895';

function billsToItems(
  bills: FinBill[],
  year: number,
  month: number,
  getEffectiveAmount: (b: FinBill, y: number, m: number) => number,
): CalendarItem[] {
  return bills
    .filter((b) => b.due_day != null)
    .map((b) => {
      const maxDay = new Date(year, month, 0).getDate();
      const day    = Math.min(b.due_day!, maxDay);
      const amt    = getEffectiveAmount(b, year, month);
      const label  = amt % 1 === 0 ? `$${amt}` : `$${amt.toFixed(2)}`;
      return {
        id:                `bill-${b.id}`,
        type:              'reminder' as const,
        title:             `${b.name} · ${label}`,
        color:             BILL_COLOR,
        all_day:           true,
        start_at:          new Date(year, month - 1, day).toISOString(),
        end_at:            null,
        repeat:            'monthly'  as const,
        notes:             null,
        reminder_category: 'bill'     as const,
        member_id:         null,
        created_at:        '',
      };
    });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}

function itemsForDay(items: CalendarItem[], day: Date): CalendarItem[] {
  return items.filter((item) => {
    const start = parseISO(item.start_at);
    if (isSameDay(start, day)) return true;
    if (item.end_at) {
      const end = parseISO(item.end_at);
      return day >= start && day <= end;
    }
    return false;
  }).sort((a, b) => a.start_at.localeCompare(b.start_at));
}

// ── Long-press hook ────────────────────────────────────────────────────────
function useLongPress(onPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired  = useRef(false);
  function start() { fired.current = false; timer.current = setTimeout(() => { fired.current = true; onPress(); }, ms); }
  function stop()  { if (timer.current) clearTimeout(timer.current); }
  return {
    onPointerDown:  start,
    onPointerUp:    stop,
    onPointerLeave: stop,
  };
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { items, fetchAll, deleteItem } = useCalendarStore();
  const { bills, getEffectiveAmount }   = useFinanceStore();
  const { activeMember } = useAuthStore();
  const { calendarIntent, clearCalendarIntent } = useAppStore();
  const [month,       setMonth]       = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [form,        setForm]        = useState<{ item?: CalendarItem; defaultDate?: Date } | null>(null);
  const [detail,      setDetail]      = useState<CalendarItem | null>(null);

  // Consume navigation intent from widgets
  useEffect(() => {
    if (!calendarIntent) return;
    if (calendarIntent.day) setSelectedDay(calendarIntent.day);
    if (calendarIntent.openAdd) setForm({ defaultDate: calendarIntent.day ?? new Date() });
    if (calendarIntent.openEdit) setForm({ item: calendarIntent.openEdit });
    if (calendarIntent.detail) setDetail(calendarIntent.detail);
    clearCalendarIntent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const start     = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end       = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days      = eachDayOfInterval({ start, end });
  const year      = month.getFullYear();
  const mon       = month.getMonth() + 1;
  const billItems = billsToItems(bills, year, mon, getEffectiveAmount);
  const allItems  = [...items, ...billItems];
  const dayItems  = itemsForDay(allItems, selectedDay);

  function openAddForm(day: Date) {
    setSelectedDay(day);
    setForm({ defaultDate: day });
  }

  return (
    <div className={styles.root}>
      {/* ── Left: Month grid ──────────────────────────────── */}
      <div className={styles.gridPanel}>
        <div className={styles.monthNav}>
          <button className="btn btn--ghost btn--icon" onClick={() => setMonth((m) => subMonths(m, 1))}>
            <ChevronLeft size={18} />
          </button>
          <h2 className={styles.monthTitle}>{format(month, 'MMMM yyyy')}</h2>
          <button className="btn btn--ghost btn--icon" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day-name header */}
        <div className={styles.dayNames}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
            <span key={d} className={styles.dayName}>{d}</span>
          ))}
        </div>

        {/* Day cells */}
        <div className={styles.grid}>
          {days.map((day) => (
            <DayCell
              key={day.toISOString()}
              day={day}
              month={month}
              items={itemsForDay(allItems, day)}
              selectedDay={selectedDay}
              onSelect={setSelectedDay}
              onAdd={openAddForm}
            />
          ))}
        </div>
      </div>

      {/* ── Right: Day panel ──────────────────────────────── */}
      <div className={styles.dayPanel}>
        <div className={styles.dayPanelHeader}>
          <div>
            <div className={styles.dayPanelDate}>{format(selectedDay, 'EEEE')}</div>
            <div className={styles.dayPanelNum}>{format(selectedDay, 'MMMM d, yyyy')}</div>
          </div>
          <button
            className="btn btn--ghost btn--icon"
            onClick={() => openAddForm(selectedDay)}
            title="Add event"
          >
            <Plus size={16} />
          </button>
        </div>

        {dayItems.length === 0 ? (
          <div className={styles.dayEmpty}>
            <Calendar size={32} />
            <p>No events</p>
          </div>
        ) : (
          <DayEventList
            items={dayItems}
            onView={setDetail}
          />
        )}
      </div>

      {/* ── Detail sheet ─────────────────────────────────── */}
      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <ItemDetailSheet
              item={detail}
              onEdit={() => { setDetail(null); setForm({ item: detail }); }}
              onDelete={(id) => { if (confirm(`Delete "${detail.title}"?`)) { deleteItem(id); setDetail(null); } }}
              onClose={() => setDetail(null)}
            />
          </div>
        </div>
      )}

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

// ── DayCell — extracted so useLongPress is a top-level hook call (fixes hooks violation) ──
interface DayCellProps {
  day: Date;
  month: Date;
  items: CalendarItem[];
  selectedDay: Date;
  onSelect: (day: Date) => void;
  onAdd: (day: Date) => void;
}

function DayCell({ day, month, items, selectedDay, onSelect, onAdd }: DayCellProps) {
  const longPress = useLongPress(() => onAdd(day));

  return (
    <div
      className={[
        styles.cell,
        !isSameMonth(day, month) ? styles.cellOtherMonth : '',
        isToday(day) ? styles.cellToday : '',
        isSameDay(day, selectedDay) ? styles.cellSelected : '',
      ].join(' ')}
      onClick={() => onSelect(day)}
      onDoubleClick={(e) => { e.stopPropagation(); onAdd(day); }}
      {...longPress}
    >
      <span className={styles.cellNum}>{format(day, 'd')}</span>
      <div className={styles.cellChips}>
        {items.slice(0, 3).map((item) => {
          const { r, g, b } = hexToRgb(item.color);
          return (
            <span
              key={item.id}
              className={styles.eventBar}
              style={{
                background: item.type === 'event'
                  ? item.color
                  : `rgba(${r},${g},${b},0.35)`,
                border: item.type === 'reminder' ? `1px solid ${item.color}` : 'none',
              }}
            />
          );
        })}
        {items.length > 3 && (
          <span className={styles.chipMore}>+{items.length - 3}</span>
        )}
      </div>
    </div>
  );
}

// ── DayEventList — uses shared EventListRow ───────────────────────────────
function DayEventList({ items, onView }: {
  items: CalendarItem[];
  onView: (item: CalendarItem) => void;
}) {
  const sorted = [...items].sort((a, b) => {
    if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
    return a.start_at.localeCompare(b.start_at);
  });
  return (
    <div className={styles.eventList}>
      {sorted.map((item) => (
        <EventListRow key={item.id} item={item} onClick={() => onView(item)} />
      ))}
    </div>
  );
}

// ── Item Detail Sheet — wraps shared EventDetailBody in a bottom sheet ────
function ItemDetailSheet({ item, onEdit, onDelete, onClose }: {
  item: CalendarItem;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', padding: 'var(--sp-2) 0' }}>
      <div className="modal-handle" />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn--ghost btn--icon" style={{ width: 32, height: 32 }} onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <EventDetailBody
        item={item}
        onEdit={onEdit}
        onDelete={() => onDelete(item.id)}
      />
    </div>
  );
}

// ── Add/Edit form ─────────────────────────────────────────────────────────
export function ItemForm({ existing, defaultDate, memberId, onClose }: {
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
  const [hasEnd,    setHasEnd]    = useState(!!existing?.end_at);
  const [repeat,    setRepeat]    = useState<RepeatRule>(existing?.repeat ?? 'none');
  const [notes,     setNotes]     = useState(existing?.notes ?? '');
  const [remCat,    setRemCat]    = useState<ReminderCategory>(existing?.reminder_category ?? 'personal');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setSaving(true);

    const startIso = allDay
      ? new Date(`${startDate}T00:00:00`).toISOString()
      : new Date(`${startDate}T${startTime}:00`).toISOString();

    const endIso = (() => {
      // Events always have an end; reminders only if toggled
      if (itemType !== 'event' && !hasEnd) return null;
      if (allDay) return new Date(`${endDate}T23:59:59`).toISOString();
      return new Date(`${endDate}T${endTime}:00`).toISOString();
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
      if (existing) { await updateItem(existing.id, payload); }
      else          { await addItem(payload); }
      onClose();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Error al guardar');
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

      {!existing && (
        <div className={styles.typeToggle}>
          <button type="button" className={`${styles.typeBtn} ${itemType === 'event' ? styles.typeBtnActive : ''}`} onClick={() => setItemType('event')}>
            <Calendar size={14} /> Event
          </button>
          <button type="button" className={`${styles.typeBtn} ${itemType === 'reminder' ? styles.typeBtnActive : ''}`} onClick={() => setItemType('reminder')}>
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

        {/* Color */}
        <div className="field">
          <label>Color</label>
          <div className={styles.colorRow}>
            {EVENT_COLORS.map((c) => {
              const { r, g, b } = hexToRgb(c);
              return (
                <button
                  key={c} type="button"
                  className={styles.colorSwatch}
                  style={{
                    background: itemType === 'event' ? c : `rgba(${r},${g},${b},0.35)`,
                    outline: color === c ? '2px solid var(--text)' : '2px solid transparent',
                    outlineOffset: 2,
                    border: `2px solid ${c}`,
                  }}
                  onClick={() => setColor(c)}
                />
              );
            })}
          </div>
        </div>

        {/* All day */}
        <label className={styles.toggleRow}>
          <span>All day</span>
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        </label>

        {/* Start */}
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

        {/* End — always shown for events; optional toggle for reminders */}
        {itemType === 'reminder' && (
          <label className={styles.toggleRow}>
            <span>End time</span>
            <input type="checkbox" checked={hasEnd} onChange={(e) => setHasEnd(e.target.checked)} />
          </label>
        )}
        {(itemType === 'event' || hasEnd) && (
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

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 8px' }}>{error}</p>
        )}
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
