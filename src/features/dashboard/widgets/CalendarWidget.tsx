import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isToday, isSameDay, parseISO,
} from 'date-fns';
import { X, Pencil, Trash2, Plus, ChevronLeft, Bell, Calendar, DollarSign } from 'lucide-react';
import { useCalendarStore } from '../../../store/calendarStore';
import { useFinanceStore } from '../../../store/financeStore';
import { useAppStore } from '../../../store/appStore';
import type { CalendarItem, FinBill } from '../../../types';
import styles from './CalendarWidget.module.css';

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

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
}

function itemBg(item: CalendarItem) {
  if (item.type === 'event') return item.color;
  const { r, g, b } = hexToRgb(item.color);
  return `rgba(${r},${g},${b},0.2)`;
}

function itemsForDay(items: CalendarItem[], day: Date) {
  return items.filter((item) => {
    const start = parseISO(item.start_at);
    if (isSameDay(start, day)) return true;
    if (item.end_at) {
      const end = parseISO(item.end_at);
      return day >= start && day <= end;
    }
    return false;
  });
}

function typeBadge(item: CalendarItem) {
  if (item.reminder_category === 'bill') return { icon: <DollarSign size={10} />, label: 'Bill' };
  if (item.type === 'event')             return { icon: <Calendar   size={10} />, label: 'Event' };
  return                                        { icon: <Bell       size={10} />, label: 'Reminder' };
}

// ── Widget ────────────────────────────────────────────────────────────────────
export default function CalendarWidget() {
  const [month,      setMonth]      = useState(new Date());
  const [popupDay,   setPopupDay]   = useState<Date | null>(null);
  const [detailItem, setDetailItem] = useState<CalendarItem | null>(null);
  const { items, fetchAll, deleteItem } = useCalendarStore();
  const { bills, getEffectiveAmount }   = useFinanceStore();
  const { goCalendar } = useAppStore();

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const year      = month.getFullYear();
  const mon       = month.getMonth() + 1;
  const billItems = billsToItems(bills, year, mon, getEffectiveAmount);
  const allItems  = [...items, ...billItems];

  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end   = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days  = eachDayOfInterval({ start, end });

  function prevMonth() { setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; }); }
  function nextMonth() { setMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; }); }

  function closePopup() { setPopupDay(null); setDetailItem(null); }

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
        {days.map((day) => {
          const dayItems = itemsForDay(allItems, day);
          const chips    = dayItems.slice(0, 2);
          const more     = dayItems.length - chips.length;
          return (
            <span
              key={day.toISOString()}
              className={[
                styles.day,
                !isSameMonth(day, month) ? styles.dayOther : '',
                isToday(day) ? styles.dayToday : '',
                popupDay && isSameDay(day, popupDay) ? styles.daySelected : '',
              ].join(' ')}
              onClick={() => { setDetailItem(null); setPopupDay(day); }}
            >
              <span className={styles.dayNum}>{format(day, 'd')}</span>
              {chips.map((item) => (
                <span
                  key={item.id}
                  className={styles.chip}
                  style={{
                    background: itemBg(item),
                    color: item.type === 'event' ? '#fff' : item.color,
                    border: item.type === 'reminder' ? `1px solid ${item.color}` : 'none',
                  }}
                >
                  {item.title}
                </span>
              ))}
              {more > 0 && <span className={styles.chipMore}>+{more}</span>}
            </span>
          );
        })}
      </div>

      {/* Popup portal */}
      {popupDay && createPortal(
        <div className={styles.modalBackdrop} onClick={closePopup}>
          <div className={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
            {detailItem ? (
              /* ── Detail view ── */
              <ItemDetail
                item={detailItem}
                onBack={() => setDetailItem(null)}
                onEdit={() => { closePopup(); goCalendar({ day: popupDay, openEdit: detailItem }); }}
                onDelete={() => {
                  if (confirm(`Delete "${detailItem.title}"?`)) {
                    deleteItem(detailItem.id);
                    closePopup();
                  }
                }}
              />
            ) : (
              /* ── Event list ── */
              <DayEventList
                date={popupDay}
                items={itemsForDay(allItems, popupDay)}
                onSelect={setDetailItem}
                onAdd={() => { closePopup(); goCalendar({ day: popupDay, openAdd: true }); }}
                onClose={closePopup}
              />
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ── Day event list ─────────────────────────────────────────────────────────
function DayEventList({ date, items, onSelect, onAdd, onClose }: {
  date: Date;
  items: CalendarItem[];
  onSelect: (item: CalendarItem) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const sorted = [...items].sort((a, b) => {
    if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
    return a.start_at.localeCompare(b.start_at);
  });

  return (
    <>
      <div className={styles.popupHeader}>
        <span className={styles.popupDate}>{format(date, 'EEEE, MMM d')}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={styles.popupClose}
            title="Add event"
            onClick={onAdd}
          ><Plus size={13} /></button>
          <button className={styles.popupClose} onClick={onClose}><X size={13} /></button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>
          No events — double-tap to add
        </p>
      ) : (
        <div className={styles.popupItems}>
          {sorted.map((item) => {
            const badge = typeBadge(item);
            return (
              <div
                key={item.id}
                className={styles.popupItem}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelect(item)}
              >
                <span className={styles.popupItemDot} style={{ background: item.color }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.popupItemTitle}>{item.title}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 1 }}>
                    <span style={{ fontSize: 10, color: item.color, display: 'flex', alignItems: 'center', gap: 2 }}>
                      {badge.icon} {badge.label}
                    </span>
                    {!item.all_day && (
                      <span className={styles.popupItemTime}>
                        {format(parseISO(item.start_at), 'h:mm a')}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronLeft size={12} style={{ color: 'var(--text-3)', transform: 'rotate(180deg)', flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Item detail ───────────────────────────────────────────────────────────
function ItemDetail({ item, onBack, onEdit, onDelete }: {
  item: CalendarItem;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isBill = item.id.startsWith('bill-');
  const badge  = typeBadge(item);

  const timeStr = item.all_day
    ? 'All day'
    : (() => {
        const s = format(parseISO(item.start_at), 'h:mm a');
        return item.end_at ? `${s} – ${format(parseISO(item.end_at), 'h:mm a')}` : s;
      })();

  return (
    <>
      <div className={styles.popupHeader}>
        <button className={styles.popupClose} onClick={onBack} title="Back">
          <ChevronLeft size={13} />
        </button>
        <span className={styles.popupDate}>{format(parseISO(item.start_at), 'MMM d')}</span>
        {!isBill && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className={styles.popupClose} onClick={onEdit} title="Edit"><Pencil size={12} /></button>
            <button className={styles.popupClose} style={{ color: 'var(--danger)' }} onClick={onDelete} title="Delete"><Trash2 size={12} /></button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
        {/* Color + title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ width: 4, minHeight: 36, borderRadius: 2, background: item.color, flexShrink: 0, marginTop: 3 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{item.title}</div>
            <span style={{ fontSize: 11, color: item.color, display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
              {badge.icon} {badge.label}
            </span>
          </div>
        </div>

        {/* Time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)' }}>
          <Calendar size={13} />
          {format(parseISO(item.start_at), 'EEE, MMM d')} · {timeStr}
        </div>

        {/* Repeat */}
        {item.repeat !== 'none' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)' }}>
            <Bell size={13} /> Repeats {item.repeat}
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <div style={{
            background: 'var(--bg-3)', borderRadius: 10, padding: '8px 10px',
            fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5,
          }}>
            {item.notes}
          </div>
        )}
      </div>
    </>
  );
}
