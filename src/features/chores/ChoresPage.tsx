import { useEffect, useState } from 'react';
import { format } from 'date-fns';
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

  // Supabase Realtime subscription for cross-device sync
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

  const grouped = groupByCategory(chores);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Chores</h2>
        <button className="btn btn--primary" onClick={() => setModal({})}>+ Add chore</button>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} className={styles.section}>
          <h3 className={styles.categoryLabel}>{category}</h3>
          <div className={styles.list}>
            {items.map((chore) => {
              const done = isDoneToday(chore);
              return (
                <div
                  key={chore.id}
                  className={`${styles.choreRow} ${done ? styles.choreDone : ''}`}
                >
                  <button
                    className={`${styles.checkBtn} ${done ? styles.checkBtnDone : ''}`}
                    onClick={() => activeMember && toggleComplete(chore.id, activeMember.id, today)}
                    title={done ? 'Mark incomplete' : 'Mark done'}
                  >
                    {done ? '✓' : ''}
                  </button>
                  <div className={styles.choreInfo}>
                    <span className={styles.choreTitle}>{chore.title}</span>
                    <span className={styles.choreMeta}>
                      {chore.recurrence_rule === 'none' ? 'One-time' : chore.recurrence_rule}
                      {chore.rotation_enabled ? ' · rotating' : ''}
                    </span>
                  </div>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setModal({ chore })}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => { if (confirm(`Delete "${chore.title}"?`)) deleteChore(chore.id); }}
                    style={{ color: 'var(--danger)' }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {chores.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', paddingTop: '80px' }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <p style={{ marginTop: 'var(--sp-4)' }}>No chores yet. Add one to get started.</p>
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

function groupByCategory(chores: Chore[]): Record<string, Chore[]> {
  return chores.reduce<Record<string, Chore[]>>((acc, chore) => {
    const key = chore.category ?? 'General';
    (acc[key] ??= []).push(chore);
    return acc;
  }, {});
}
