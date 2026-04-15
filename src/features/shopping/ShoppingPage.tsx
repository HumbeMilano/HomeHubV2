import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ShoppingList, ShoppingItem } from '../../types';
import { useShoppingStore } from '../../store/shoppingStore';
import { useAuthStore } from '../../store/authStore';
import { subscribeToTable } from '../../lib/realtime';
import ShoppingCard from './ShoppingCard';
import styles from './ShoppingPage.module.css';

const LIST_COLORS = ['#fb923c', '#60a5fa', '#34d399', '#f472b6', '#facc15', '#818cf8', '#38bdf8', '#ef4444'];

export default function ShoppingPage() {
  const { lists, items, fetchAll, addList } = useShoppingStore();
  const { activeMember } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LIST_COLORS[0]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Cross-device Realtime sync
  useEffect(() => {
    const unsubLists = subscribeToTable<ShoppingList>({
      table: 'shopping_lists',
      onData: ({ eventType, new: row, old }) => {
        const store = useShoppingStore.getState();
        if (eventType === 'INSERT' && row && !store.lists.find((l) => l.id === row.id)) {
          store.setLists([...store.lists, row]);
        } else if (eventType === 'UPDATE' && row) {
          store.setLists(store.lists.map((l) => (l.id === row.id ? row : l)));
        } else if (eventType === 'DELETE' && old) {
          store.setLists(store.lists.filter((l) => l.id !== old.id));
          store.setItems(store.items.filter((i) => i.list_id !== old.id));
        }
      },
    });

    const unsubItems = subscribeToTable<ShoppingItem>({
      table: 'shopping_items',
      onData: ({ eventType, new: row, old }) => {
        const store = useShoppingStore.getState();
        if (eventType === 'INSERT' && row && !store.items.find((i) => i.id === row.id)) {
          store.setItems([...store.items, row]);
        } else if (eventType === 'UPDATE' && row) {
          store.setItems(store.items.map((i) => (i.id === row.id ? row : i)));
        } else if (eventType === 'DELETE' && old) {
          store.setItems(store.items.filter((i) => i.id !== old.id));
        }
      },
    });

    return () => { unsubLists(); unsubItems(); };
  }, []);

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
        <div className={styles.grid}>
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
