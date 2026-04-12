import { useState, useEffect } from 'react';
import styles from './NotesWidget.module.css';

const STORAGE_KEY = 'homehub-dash-note';

export default function NotesWidget() {
  const [text, setText] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');

  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(STORAGE_KEY, text), 500);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <div className={styles.root}>
      <h3 className={styles.title}>📝 Quick note</h3>
      <textarea
        className={styles.area}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type anything…"
      />
    </div>
  );
}
