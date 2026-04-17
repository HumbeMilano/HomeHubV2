import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useShoppingStore } from '../../store/shoppingStore';
import { SkeletonCard } from '../../components/Skeleton';
import { useAuthStore } from '../../store/authStore';
import ShoppingCard from './ShoppingCard';
import styles from './ShoppingPage.module.css';

const LIST_COLORS = ['#fb923c', '#60a5fa', '#34d399', '#f472b6', '#facc15', '#818cf8', '#38bdf8', '#ef4444'];

export default function ShoppingPage() {
  const { lists, items, loading, fetchAll, addList } = useShoppingStore();
  const { activeMember } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LIST_COLORS[0]);

  useEffect(() => { fetchAll(); }, [fetchAll]);


  async function handleAddList(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await addList({
      name: newName.trim(),
      color: newColor,
      store_category: null,
      is_featured: false,
      created_by: activeMember?.id ?? null,
    });
    setNewName('');
    setNewColor(LIST_COLORS[0]);
    setShowForm(false);
  }

  if (loading && lists.length === 0) {
    return (
      <div className={styles.root}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--sp-4)' }}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={4} />)}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <h2 className={styles.heading}>Shopping</h2>
        </div>
        <button className="btn btn--primary" style={{ display:'flex', alignItems:'center', gap:4 }} onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} /> New list
        </button>
      </div>

      {showForm && (
        <form className={styles.newListForm} onSubmit={handleAddList}>
          <input
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="List name…"
            autoFocus
            required
          />
          <div className={styles.colorRow}>
            {LIST_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={styles.colorSwatch}
                style={{
                  background: c,
                  outline: newColor === c ? '3px solid var(--text)' : '3px solid transparent',
                  outlineOffset: 2,
                }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <button type="submit" className="btn btn--primary btn--sm">Create</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {lists.length === 0 ? (
        <div className={styles.empty}>
          <div style={{ fontSize: 48 }}>🛒</div>
          <p>No lists yet. Create one to get started.</p>
        </div>
      ) : (
        <div className={`${styles.grid} list-item-stagger`}>
          {lists.map((list) => (
            <ShoppingCard
              key={list.id}
              list={list}
              items={items.filter((i) => i.list_id === list.id)}
              allItems={items}
            />
          ))}
        </div>
      )}
    </div>
  );
}
