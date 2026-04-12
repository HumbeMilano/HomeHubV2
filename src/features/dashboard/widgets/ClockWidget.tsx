import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import styles from './ClockWidget.module.css';

export default function ClockWidget() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={styles.root}>
      <span className={styles.time}>{format(now, 'HH:mm')}</span>
      <span className={styles.date}>{format(now, 'EEEE, MMM d')}</span>
    </div>
  );
}
