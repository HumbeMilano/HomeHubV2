/**
 * Shared event detail components used by CalendarPage, CalendarWidget,
 * and RemindersWidget so the detail view looks identical everywhere.
 */
import { format, parseISO } from 'date-fns';
import { Calendar, Bell, DollarSign, FileText, Pencil, Trash2, ChevronRight, ArrowUpRight, X } from 'lucide-react';
import type { CalendarItem } from '../../types';
import { useAppStore } from '../../store/appStore';

const CATEGORY_LABELS: Record<string, string> = {
  personal:    'Personal',
  to_do:       'To-do',
  bill:        'Bill / Payment',
  appointment: 'Appointment',
  other:       'Other',
};

const REPEAT_LABELS: Record<string, string> = {
  daily:   'Daily',
  weekly:  'Weekly',
  monthly: 'Monthly',
  yearly:  'Yearly',
};

export function itemTypeBadge(item: CalendarItem): { icon: React.ReactNode; label: string } {
  if (item.reminder_category === 'bill') return { icon: <DollarSign size={10} />, label: 'Bill' };
  if (item.type === 'event')             return { icon: <Calendar   size={10} />, label: 'Event' };
  return                                        { icon: <Bell       size={10} />, label: 'Reminder' };
}

// ── Shared detail body ─────────────────────────────────────────────────────
// Used inside CalendarPage's bottom sheet AND widget popups.
export function EventDetailBody({ item, onEdit, onDelete }: {
  item: CalendarItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { navigate } = useAppStore();
  const isBill = item.id.startsWith('bill-');
  const badge  = itemTypeBadge(item);
  const categoryLabel = item.reminder_category ? CATEGORY_LABELS[item.reminder_category] : null;

  const timeStr = (() => {
    if (item.all_day) return 'All day';
    const s = format(parseISO(item.start_at), 'EEE, MMM d · h:mm a');
    return item.end_at ? `${s} – ${format(parseISO(item.end_at), 'h:mm a')}` : s;
  })();

  const repeatLabel = item.repeat !== 'none' ? REPEAT_LABELS[item.repeat] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Color bar + title + type badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{
          width: 5, minHeight: 42, borderRadius: 3,
          background: item.color, flexShrink: 0, marginTop: 2,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>
            {item.title}
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3,
            fontSize: 12, color: item.color, fontWeight: 600,
          }}>
            {badge.icon} {badge.label}
            {categoryLabel && ` · ${categoryLabel}`}
          </span>
        </div>
      </div>

      {/* Info rows */}
      <div style={{ background: 'var(--bg-3)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          borderBottom: (repeatLabel || item.notes) ? '0.5px solid var(--border)' : 'none',
        }}>
          <Calendar size={14} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
          <span style={{ fontSize: 14 }}>{timeStr}</span>
        </div>

        {repeatLabel && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            borderBottom: item.notes ? '0.5px solid var(--border)' : 'none',
          }}>
            <Bell size={14} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
            <span style={{ fontSize: 14 }}>Repeats {repeatLabel.toLowerCase()}</span>
          </div>
        )}

        {item.notes && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px' }}>
            <FileText size={14} style={{ color: 'var(--text-2)', flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {item.notes}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {isBill ? (
        <button
          className="btn btn--ghost"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={() => navigate('finance')}
        >
          <ArrowUpRight size={14} /> Manage in Finance
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
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
      )}
    </div>
  );
}

// ── Shared detail sheet — bottom sheet wrapping EventDetailBody ───────────
// Use this everywhere in the app. Render inside modal-backdrop + modal-sheet.
export function EventDetailSheet({ item, onEdit, onDelete, onClose }: {
  item: CalendarItem;
  onEdit: () => void;
  onDelete: () => void;
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
      <EventDetailBody item={item} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

// ── Shared event list row ──────────────────────────────────────────────────
// Used in CalendarPage day panel AND CalendarWidget day popup.
export function EventListRow({ item, onClick }: {
  item: CalendarItem;
  onClick: () => void;
}) {
  const badge = itemTypeBadge(item);
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 4px', cursor: 'pointer',
        borderBottom: '0.5px solid var(--border)',
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: item.color, flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{
            fontSize: 11, color: item.color, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            {badge.icon} {badge.label}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {item.all_day ? 'All day' : format(parseISO(item.start_at), 'h:mm a')}
          </span>
        </div>
      </div>
      <ChevronRight size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
    </div>
  );
}
