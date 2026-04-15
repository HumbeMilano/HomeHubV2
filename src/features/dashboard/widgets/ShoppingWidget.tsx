import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useShoppingStore } from '../../../store/shoppingStore';
import { useAuthStore } from '../../../store/authStore';
import styles from './ShoppingWidget.module.css';

export default function ShoppingWidget() {
  const { lists, items, fetchAll, toggleItem, addItem } = useShoppingStore();
  const { activeMember } = useAuthStore();
  const [newItem, setNewItem] = useState('');

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const memberId  = activeMember?.id ?? null;
  const featured  = lists.find((l) => l.is_featured);
  const listItems = featured ? items.filter((i) => i.list_id === featured.id) : [];
  const unchecked = listItems.filter((i) => !i.checked);
  const checked   = listItems.filter((i) => i.checked);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim() || !featured) return;
    await addItem({
      list_id:    featured.id,
      name:       newItem.trim(),
      category:   null,
      quantity:   null,
      checked:    false,
      checked_by: null,
      checked_at: null,
    });
    setNewItem('');
  }

  if (!featured) {
    return (
      <div className={styles.root}>
        <h3 className={styles.title}>Shopping</h3>
        <p className={styles.empty}>No featured list. Mark a list with ★ in Shopping.</p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <h3 className={styles.title}>
        <span className={styles.dot} style={{ background: featured.color }} />
        {featured.name}
        <span className={styles.count}>{unchecked.length}/{listItems.length}</span>
      </h3>

      <ul className={styles.list}>
        {unchecked.map((item) => (
          <li
            key={item.id}
            className={`${styles.item} ${styles.itemClickable}`}
            onClick={() => toggleItem(item.id, memberId)}
          >
            <span className={styles.checkbox} />
            {item.name}
          </li>
        ))}
        {checked.length > 0 && <li className={styles.separator} />}
        {checked.map((item) => (
          <li
            key={item.id}
            className={`${styles.item} ${styles.itemChecked} ${styles.itemClickable}`}
            onClick={() => toggleItem(item.id, memberId)}
          >
            <span className={`${styles.checkbox} ${styles.checkboxDone}`}>✓</span>
            {item.name}
          </li>
        ))}
      </ul>

      <form className={styles.addRow} onSubmit={handleAdd}>
        <input
          className={styles.addInput}
          placeholder="Add item…"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
        />
        <button type="submit" className={styles.addBtn} disabled={!newItem.trim()}>
          <Plus size={14} />
        </button>
      </form>
    </div>
  );
}
