import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plus, CheckCircle2, Circle } from 'lucide-react';
import type { Chore } from '../../types';
import { useChoresStore } from '../../store/choresStore';
import { useAuthStore } from '../../store/authStore';
import { subscribeToTable } from '../../lib/realtime';
import ChoreForm from './ChoreForm';
import styles from './ChoresPage.module.css';

export default function ChoresPage() {
  const { chores, completions, fetchAll, deleteChore, toggleComplete } = useChoresStore();
  const { activeMember } = useAuthStore();
  const [modal, setModal] = useState<{ chore?: Chore } | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    return subscribeToTable<Chore>({
      table: 'chores',
      onData: ({ eventType, new: row, old }) => {
        const store = useChoresStore.getState();
        if (eventType === 'INSERT' && row) {
          if (!store.chores.find((c) => c.id === row.id)) {
            store.setChores([...store.chores, row]);
          }
        } else if (eventType === 'UPDATE' && row) {
          store.setChores(store.chores.map((c) => (c.id === row.id ? row : c)));
        } else if (eventType === 'DELETE' && old) {
          store.setChores(store.chores.filter((c) => c.id !== old.id));
        }
      },
    });
  }, []);

  function isDoneToday(chore: Chore) {
    return completions.some(
      (c) => c.chore_id === chore.id && c.scheduled_date === today && !!c.completed_at
    );
  }

  const todo = chores.filter((c) => !isDoneToday(c));
  const done = chores.filter((c) => isDoneToday(c));

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <h2 className={styles.heading}>Chores</h2>
        </div>
        <button
          className="btn btn--primary"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={() => setModal({})}
        >
          <Plus size={14} /> Add chore
        </button>
      </div>

      {chores.length === 0 ? (
        <div className={styles.empty}>
          <div style={{ fontSize: 48 }}>✅</div>
          <p>No chores yet. Add one to get started.</p>
        </div>
      ) : (
        <div className={styles.kanban}>
          <KanbanColumn
            title="To Do"
            chores={todo}
            accentColor="var(--color-chores)"
            isDoneToday={isDoneToday}
            onToggle={(id) => {
              if (!activeMember) { alert('Select a household member first (Settings → Members).'); return; }
              toggleComplete(id, activeMember.id, today).catch((e) => alert(`Could not save: ${e?.message ?? e}`));
            }}
            onEdit={(chore) => setModal({ chore })}
            onDelete={(id, title) => { if (confirm(`Delete "${title}"?`)) deleteChore(id); }}
          />
          <KanbanColumn
            title="Done"
            chores={done}
            accentColor="var(--success)"
            isDoneToday={isDoneToday}
            onToggle={(id) => {
              if (!activeMember) { alert('Select a household member first (Settings → Members).'); return; }
              toggleComplete(id, activeMember.id, today).catch((e) => alert(`Could not save: ${e?.message ?? e}`));
            }}
            onEdit={(chore) => setModal({ chore })}
            onDelete={(id, title) => { if (confirm(`Delete "${title}"?`)) deleteChore(id); }}
          />
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <ChoreForm existing={modal.chore} onClose={() => setModal(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

interface KanbanColumnProps {
  title: string;
  chores: Chore[];
  accentColor: string;
  isDoneToday: (chore: Chore) => boolean;
  onToggle: (id: string) => void;
  onEdit: (chore: Chore) => void;
  onDelete: (id: string, title: string) => void;
}

function KanbanColumn({ title, chores, accentColor, isDoneToday, onToggle, onEdit, onDelete }: KanbanColumnProps) {
  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <span className={styles.columnDot} style={{ background: accentColor }} />
        <span className={styles.columnTitle}>{title}</span>
        <span className={styles.columnCount}>{chores.length}</span>
      </div>
      <div className={styles.columnBody}>
        {chores.length === 0 && (
          <p className={styles.columnEmpty}>
            {title === 'To Do' ? 'All done!' : 'Nothing completed yet.'}
          </p>
        )}
        {chores.map((chore) => {
          const done = isDoneToday(chore);
          return (
            <div key={chore.id} className={`${styles.choreCard} ${done ? styles.choreCardDone : ''}`}>
              <button
                className={`${styles.toggleBtn} ${done ? styles.toggleBtnDone : ''}`}
                onClick={() => onToggle(chore.id)}
                title={done ? 'Mark incomplete' : 'Mark done'}
                style={done ? { borderColor: accentColor, background: accentColor } : {}}
              >
                {done
                  ? <CheckCircle2 size={18} color="#fff" />
                  : <Circle size={18} color="var(--text-3)" />
                }
              </button>
              <div className={styles.choreInfo}>
                <span className={styles.choreTitle}>{chore.title}</span>
                {chore.recurrence_rule && chore.recurrence_rule !== 'none' && (
                  <span className={styles.choreMeta}>{chore.recurrence_rule}</span>
                )}
              </div>
              <div className={styles.choreActions}>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => onEdit(chore)}
                >Edit</button>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => onDelete(chore.id, chore.title)}
                  style={{ color: 'var(--danger)' }}
                >✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
