import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  format,
} from 'date-fns';
import type { CalendarEvent } from '../../types';
import EventChip from './EventChip';
import styles from './MonthView.module.css';

interface Props {
  date: Date;                          // any date within the displayed month
  events: CalendarEvent[];
  onDayClick: (day: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MonthView({ date, events, onDayClick, onEventClick }: Props) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function eventsForDay(day: Date) {
    return events.filter((e) => isSameDay(new Date(e.start_time), day));
  }

  return (
    <div className={styles.root}>
      {/* Day-of-week headers */}
      <div className={styles.header}>
        {DOW.map((d) => (
          <div key={d} className={styles.dowCell}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className={styles.grid}>
        {days.map((day) => {
          const dayEvents = eventsForDay(day);
          const inMonth = isSameMonth(day, date);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`${styles.cell} ${!inMonth ? styles.cellOtherMonth : ''} ${today ? styles.cellToday : ''}`}
              onClick={() => onDayClick(day)}
            >
              <span className={`${styles.dayNum} ${today ? styles.dayNumToday : ''}`}>
                {format(day, 'd')}
              </span>
              <div className={styles.events}>
                {dayEvents.slice(0, 3).map((ev) => (
                  <EventChip key={ev.id} event={ev} onClick={onEventClick} compact />
                ))}
                {dayEvents.length > 3 && (
                  <span className={styles.more}>+{dayEvents.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
