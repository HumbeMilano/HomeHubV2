import { useState } from 'react';
import {
  format, addMonths, subMonths, addWeeks, subWeeks,
} from 'date-fns';
import type { CalendarEvent } from '../../types';
import MonthView from './MonthView';
import WeekView from './WeekView';
import { useCalendarEvents } from './useCalendar';
import { getWeekDays } from '../../lib/utils';
import ChoreForm from '../chores/ChoreForm';
import styles from './CalendarPage.module.css';

type ViewType = 'month' | 'week';

export default function CalendarPage() {
  const [viewType, setViewType] = useState<ViewType>('month');
  const [viewDate, setViewDate] = useState(new Date());
  const [modal, setModal] = useState<{ startTime?: Date } | null>(null);

  const events = useCalendarEvents(viewDate, viewType);
  const weekDays = getWeekDays(viewDate);

  function navigate(dir: -1 | 1) {
    if (viewType === 'month') {
      setViewDate((d) => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
    } else {
      setViewDate((d) => dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1));
    }
  }

  function handleCellClick(startTime: Date) {
    // startTime already carries the exact hour + snapped minutes from WeekView
    setModal({ startTime });
  }

  function handleDayClick(day: Date) {
    // Clicking a month-view day → switch to week view for that day
    setViewDate(day);
    setViewType('week');
  }

  function handleEventClick(event: CalendarEvent) {
    console.log('event clicked', event);
    // TODO: open event detail / edit modal
  }

  const title =
    viewType === 'month'
      ? format(viewDate, 'MMMM yyyy')
      : `${format(weekDays[0], 'MMM d')} – ${format(weekDays[6], 'MMM d, yyyy')}`;

  return (
    <div className={styles.root}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.navGroup}>
          <button className="btn btn--ghost btn--icon" onClick={() => navigate(-1)}>‹</button>
          <h2 className={styles.title}>{title}</h2>
          <button className="btn btn--ghost btn--icon" onClick={() => navigate(1)}>›</button>
        </div>

        <div className={styles.viewToggle}>
          <button
            className={`btn ${viewType === 'month' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setViewType('month')}
          >
            Month
          </button>
          <button
            className={`btn ${viewType === 'week' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setViewType('week')}
          >
            Week
          </button>
        </div>

        <button className="btn btn--primary" onClick={() => setModal({})}>
          + Add
        </button>
      </div>

      {/* Calendar body */}
      <div className={styles.body}>
        {viewType === 'month' ? (
          <MonthView
            date={viewDate}
            events={events}
            onDayClick={handleDayClick}
            onEventClick={handleEventClick}
          />
        ) : (
          <WeekView
            weekDays={weekDays}
            events={events}
            onCellClick={handleCellClick}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      {/* Add chore / event modal */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <ChoreForm
              defaultStartTime={modal.startTime}
              onClose={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
