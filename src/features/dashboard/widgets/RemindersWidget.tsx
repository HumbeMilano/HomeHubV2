import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { format, addDays, startOfDay, isAfter, isBefore, isToday, parseISO } from 'date-fns';
import { Calendar, Bell, DollarSign, ChevronRight } from 'lucide-react';
import { useCalendarStore } from '../../../store/calendarStore';
import { useFinanceStore } from '../../../store/financeStore';
import { useAuthStore } from '../../../store/authStore';
import type { CalendarItem, FinBill } from '../../../types';
import { EventDetailSheet } from '../../calendar/EventDetail';
import { ItemForm } from '../../calendar/CalendarPage';
import ConfirmModal from '../../../components/ConfirmModal';
import styles from './RemindersWidget.module.css';

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

function typeIcon(item: CalendarItem) {
  if (item.reminder_category === 'bill') return <DollarSign size={11} />;
  if (item.type === 'event')             return <Calendar   size={11} />;
  return                                        <Bell       size={11} />;
}

function typeLabel(item: CalendarItem) {
  if (item.reminder_category === 'bill') return 'Bill';
  if (item.type === 'event')             return 'Event';
  return 'Reminder';
}

export default function RemindersWidget() {
  const { items, fetchAll, deleteItem } = useCalendarStore();
  const { bills, getEffectiveAmount } = useFinanceStore();
  const { activeMember } = useAuthStore();
  const [detail,        setDetail]        = useState<CalendarItem | null>(null);
  const [editItem,      setEditItem]      = useState<CalendarItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CalendarItem | null>(null);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const now   = startOfDay(new Date());
  const limit = addDays(now, 7);
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const billItems = billsToItems(bills, year, month, getEffectiveAmount);
  const allItems  = [...items, ...billItems];

  const upcoming = allItems
    .filter((item) => {
      const d = parseISO(item.start_at);
      return (isToday(d) || isAfter(d, now)) && isBefore(d, limit);
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .slice(0, 7);

  return (
    <>
      <div className={styles.root}>
        <h3 className={styles.title}><Calendar size={14} /> Upcoming</h3>
        {upcoming.length === 0 ? (
          <p className={styles.empty}>Nothing in the next 7 days</p>
        ) : (
          <ul className={styles.list}>
            {upcoming.map((item) => (
              <li
                key={item.id}
                className={styles.item}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); setDetail(item); }}
              >
                <span className={styles.dot} style={{ background: item.color }} />
                <span className={styles.itemTitle}>{item.title}</span>
                <span className={styles.itemMeta}>
                  <span className={styles.typeBadge} style={{ color: item.color }}>
                    {typeIcon(item)} {typeLabel(item)}
                  </span>
                  <span className={styles.itemDate}>
                    {item.all_day
                      ? format(parseISO(item.start_at), 'MMM d')
                      : format(parseISO(item.start_at), 'MMM d, h:mm a')}
                  </span>
                </span>
                <ChevronRight size={12} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {detail && createPortal(
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <EventDetailSheet
              item={detail}
              onEdit={() => { setEditItem(detail); setDetail(null); }}
              onDelete={() => setConfirmDelete(detail)}
              onClose={() => setDetail(null)}
            />
          </div>
        </div>,
        document.body,
      )}

      {editItem && createPortal(
        <div className="modal-backdrop" onClick={() => setEditItem(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <ItemForm
              existing={editItem}
              defaultDate={parseISO(editItem.start_at)}
              memberId={activeMember?.id ?? null}
              onClose={() => setEditItem(null)}
            />
          </div>
        </div>,
        document.body,
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
    </>
  );
}
