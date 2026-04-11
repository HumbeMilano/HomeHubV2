import { useRef } from 'react';
import {
  format, isSameDay, isToday, getHours, getMinutes, parseISO,
  differenceInMinutes,
} from 'date-fns';
import type { CalendarEvent } from '../../types';
import EventChip from './EventChip';
import styles from './WeekView.module.css';

interface Props {
  weekDays: Date[];                // 7 Date objects for the week (Sun–Sat)
  events: CalendarEvent[];
  onCellClick: (startTime: Date) => void;   // called with exact ISO time from clicked cell
  onEventClick: (event: CalendarEvent) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const CELL_HEIGHT = 60; // px per hour
const SNAP_MINUTES = 15;

export default function WeekView({ weekDays, events, onCellClick, onEventClick }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);

  /**
   * BUG FIX (built correctly from the start):
   * Capture the precise time from the mouse position within the clicked cell.
   * Each row = 1 hour (CELL_HEIGHT px). We calculate the fractional minute
   * within the cell by reading relativeY / cellHeight, then snap to SNAP_MINUTES.
   */
  function handleCellClick(
    e: React.MouseEvent<HTMLDivElement>,
    day: Date,
    hour: number
  ) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const rawMinutes = (relativeY / rect.height) * 60;
    const snappedMinutes = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;
    const clampedMinutes = Math.min(snappedMinutes, 59); // never bleed into next hour

    const clickedTime = new Date(day);
    clickedTime.setHours(hour, clampedMinutes, 0, 0);
    onCellClick(clickedTime);
  }

  function eventsForDayHour(day: Date, hour: number) {
    return events.filter((ev) => {
      const start = parseISO(ev.start_time);
      return isSameDay(start, day) && getHours(start) === hour;
    });
  }

  // Current time indicator
  const now = new Date();
  const nowMinuteOffset = getHours(now) * CELL_HEIGHT + (getMinutes(now) / 60) * CELL_HEIGHT;

  return (
    <div className={styles.root}>
      {/* Day headers row */}
      <div className={styles.headerRow}>
        <div className={styles.timeGutter} />
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={`${styles.dayHeader} ${isToday(day) ? styles.dayHeaderToday : ''}`}
          >
            <span className={styles.dowLabel}>{format(day, 'EEE')}</span>
            <span className={`${styles.dayNum} ${isToday(day) ? styles.dayNumToday : ''}`}>
              {format(day, 'd')}
            </span>
          </div>
        ))}
      </div>

      {/* Scrollable time grid */}
      <div className={styles.scrollArea} ref={gridRef}>
        <div className={styles.grid}>
          {HOURS.map((hour) => (
            <div key={hour} className={styles.hourRow}>
              {/* Time gutter label */}
              <div className={styles.hourLabel}>
                {hour === 0 ? '' : format(new Date().setHours(hour, 0, 0, 0), 'h a')}
              </div>

              {/* 7 day cells for this hour */}
              {weekDays.map((day) => {
                const cellEvents = eventsForDayHour(day, hour);
                return (
                  <div
                    key={day.toISOString()}
                    className={`${styles.cell} ${isToday(day) ? styles.cellToday : ''}`}
                    style={{ height: CELL_HEIGHT }}
                    data-hour={hour}
                    data-day={format(day, 'yyyy-MM-dd')}
                    onClick={(e) => handleCellClick(e, day, hour)}
                  >
                    {cellEvents.map((ev) => (
                      <EventChip key={ev.id} event={ev} onClick={onEventClick} />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Current-time red line — spans all 7 columns */}
          {isToday(weekDays[0]) || weekDays.some((d) => isToday(d)) ? (
            <div
              className={styles.nowLine}
              style={{ top: nowMinuteOffset }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Helper used by parent to compute event top offset inside a cell
export function eventTopOffset(event: CalendarEvent): number {
  const start = parseISO(event.start_time);
  return (getMinutes(start) / 60) * CELL_HEIGHT;
}

// Helper: duration in pixels
export function eventHeightPx(event: CalendarEvent): number {
  if (!event.end_time) return CELL_HEIGHT / 2;
  const mins = differenceInMinutes(parseISO(event.end_time), parseISO(event.start_time));
  return Math.max((mins / 60) * CELL_HEIGHT, 20);
}
