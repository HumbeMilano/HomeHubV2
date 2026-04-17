import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isToday, isSameDay, parseISO,
} from 'date-fns';
import { X, Plus, ChevronLeft } from 'lucide-react';
import { useCalendarStore } from '../../../store/calendarStore';
import ConfirmModal from '../../../components/ConfirmModal';
import { useFinanceStore } from '../../../store/financeStore';
import { useAuthStore } from '../../../store/authStore';
import type { CalendarItem, FinBill } from '../../../types';
import { EventDetailSheet, itemTypeBadge } from '../../calendar/EventDetail';
import { ItemForm } from '../../calendar/CalendarPage';
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

// ── Widget ────────────────────────────────────────────────────────────────────
export default function CalendarWidget() {
  const [month,       setMonth]       = useState(new Date());
  const [popupDay,    setPopupDay]    = useState<Date | null>(null);
  const [detailItem,  setDetailItem]  = useState<CalendarItem | null>(null);
  const [formDate,    setFormDate]    = useState<Date | null>(null);
  const [editItem,    setEditItem]    = useState<CalendarItem | null>(null);
  const [confirmItem, setConfirmItem] = useState<CalendarItem | null>(null);
  const { items, fetchAll, deleteItem } = useCalendarStore();
  const { bills, getEffectiveAmount }   = useFinanceStore();
  const { activeMember } = useAuthStore();

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

  function closePopup() { setPopupDay(null); setDetailItem(null); setEditItem(null); }
  function closeForm()  { setFormDate(null); setEditItem(null); }

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
            <button
              key={day.toISOString()}
              className={[
                styles.day,
                !isSameMonth(day, month) ? styles.dayOther : '',
                isToday(day) ? styles.dayToday : '',
                popupDay && isSameDay(day, popupDay) ? styles.daySelected : '',
              ].join(' ')}
              aria-label={format(day, 'MMMM d, yyyy') + (dayItems.length ? `, ${dayItems.length} event${dayItems.length > 1 ? 's' : ''}` : '')}
              aria-pressed={popupDay ? isSameDay(day, popupDay) : false}
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
            </button>
          );
        })}
      </div>

      {/* Day list — bottom sheet */}
      {popupDay && !detailItem && createPortal(
        <div className="modal-backdrop" onClick={closePopup}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <DayEventList
              date={popupDay}
              items={itemsForDay(allItems, popupDay)}
              onSelect={setDetailItem}
              onAdd={() => { closePopup(); setFormDate(popupDay); }}
              onClose={closePopup}
            />
          </div>
        </div>,
        document.body,
      )}

      {/* Detail sheet */}
      {detailItem && createPortal(
        <div className="modal-backdrop" onClick={closePopup}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <EventDetailSheet
              item={detailItem}
              onEdit={() => { closePopup(); setEditItem(detailItem); setFormDate(parseISO(detailItem.start_at)); }}
              onDelete={() => setConfirmItem(detailItem)}
              onClose={closePopup}
            />
          </div>
        </div>,
        document.body,
      )}

      {/* Add / Edit form */}
      {formDate && createPortal(
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <ItemForm
              existing={editItem ?? undefined}
              defaultDate={formDate}
              memberId={activeMember?.id ?? null}
              onClose={closeForm}
            />
          </div>
        </div>,
        document.body,
      )}

      <ConfirmModal
        open={confirmItem !== null}
        message={`Delete "${confirmItem?.title}"?`}
        danger
        onConfirm={() => {
          if (confirmItem) {
            deleteItem(confirmItem.id);
            setConfirmItem(null);
            closePopup();
          }
        }}
        onCancel={() => setConfirmItem(null)}
      />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--sp-2) 0' }}>
      <div className="modal-handle" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--sp-4)' }}>
        <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{format(date, 'EEEE, MMM d')}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn--ghost btn--icon" style={{ width: 32, height: 32 }} title="Add event" onClick={onAdd}>
            <Plus size={14} />
          </button>
          <button className="btn btn--ghost btn--icon" style={{ width: 32, height: 32 }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '12px 0' }}>
          No events — double-tap to add
        </p>
      ) : (
        <div className={styles.popupItems}>
          {sorted.map((item) => {
            const badge = itemTypeBadge(item);
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
    </div>
  );
}
