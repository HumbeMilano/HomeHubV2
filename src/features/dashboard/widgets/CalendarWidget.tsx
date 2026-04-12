import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday } from 'date-fns';
import styles from './CalendarWidget.module.css';

export default function CalendarWidget() {
  const [month] = useState(new Date());

  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end   = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days  = eachDayOfInterval({ start, end });

  return (
    <div className={styles.root}>
      <h3 className={styles.title}>📅 {format(month, 'MMMM yyyy')}</h3>
      <div className={styles.grid}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
          <span key={d} className={styles.dayName}>{d}</span>
        ))}
        {days.map((day) => (
          <span
            key={day.toISOString()}
            className={`${styles.day}
              ${!isSameMonth(day, month) ? styles.dayOther : ''}
              ${isToday(day) ? styles.dayToday : ''}
            `}
          >
            {format(day, 'd')}
          </span>
        ))}
      </div>
    </div>
  );
}
