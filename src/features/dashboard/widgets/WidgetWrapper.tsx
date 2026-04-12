import type { ReactNode } from 'react';
import { GripVertical, X } from 'lucide-react';
import styles from './WidgetWrapper.module.css';

interface Props {
  label: string;
  editMode: boolean;
  onRemove: () => void;
  children: ReactNode;
}

export default function WidgetWrapper({ label, editMode, onRemove, children }: Props) {
  return (
    <div className={`${styles.wrapper} ${editMode ? styles.editing : ''}`}>
      {editMode && (
        <div className={styles.chrome}>
          <span className={`${styles.dragHandle} drag-handle`}>
            <GripVertical size={14} />
            {label}
          </span>
          <button
            className={styles.removeBtn}
            onMouseDown={(e) => { e.stopPropagation(); onRemove(); }}
            title="Remove widget"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <div className={styles.content}>{children}</div>
    </div>
  );
}
