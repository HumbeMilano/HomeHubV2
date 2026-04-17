import { X } from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import styles from './Toast.module.css';

export default function Toaster() {
  const { toasts, removeToast } = useToastStore();
  if (toasts.length === 0) return null;
  return (
    <div className={styles.container}>
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
          <span>{t.message}</span>
          <button className={styles.close} onClick={() => removeToast(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
