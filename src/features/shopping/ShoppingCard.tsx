import { Star, X, Check } from 'lucide-react';
import type { ShoppingList, ShoppingItem } from '../../types';
import { useShoppingStore } from '../../store/shoppingStore';
import { useAuthStore } from '../../store/authStore';
import ItemInput from './ItemInput';
import styles from './ShoppingCard.module.css';

interface Props {
  list: ShoppingList;
  items: ShoppingItem[];
  allItems: ShoppingItem[];
}

export default function ShoppingCard({ list, items, allItems }: Props) {
  const { toggleItem, deleteItem, deleteList, setFeatured } = useShoppingStore();
  const { activeMember } = useAuthStore();

  const unchecked = items.filter((i) => !i.checked);
  const checked   = items.filter((i) => i.checked);

  async function handleDeleteList() {
    if (!confirm(`Delete list "${list.name}" and all its items?`)) return;
    await deleteList(list.id);
  }

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.dot} style={{ background: list.color }} />
        <span className={styles.name}>{list.name}</span>
        <span className={styles.count}>{unchecked.length}/{items.length}</span>
        <button
          className={`${styles.featuredBtn} ${list.is_featured ? styles.featuredActive : ''}`}
          onClick={() => setFeatured(list.is_featured ? null : list.id)}
          title={list.is_featured ? 'Remove from dashboard' : 'Show on dashboard'}
        ><Star size={14} /></button>
        <button className={styles.deleteBtn} onClick={handleDeleteList} title="Delete list">
          <X size={14} />
        </button>
      </div>

      {/* Unchecked items */}
      <ul className={styles.itemList}>
        {unchecked.map((item) => (
          <li key={item.id} className={styles.item}>
            <button
              className={styles.checkbox}
              onClick={() => toggleItem(item.id, activeMember?.id ?? null)}
              title="Mark done"
            />
            <span className={styles.itemName}>{item.name}</span>
            {item.quantity && <span className={styles.qty}>{item.quantity}</span>}
            <button className={styles.itemDelete} onClick={() => deleteItem(item.id)} title="Remove">
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>

      {/* Checked items */}
      {checked.length > 0 && (
        <>
          <div className={styles.separator}>checked</div>
          <ul className={styles.itemList}>
            {checked.map((item) => (
              <li key={item.id} className={`${styles.item} ${styles.itemChecked}`}>
                <button
                  className={`${styles.checkbox} ${styles.checkboxChecked}`}
                  onClick={() => toggleItem(item.id, activeMember?.id ?? null)}
                  title="Unmark"
                ><Check size={10} /></button>
                <span className={styles.itemName}>{item.name}</span>
                <button className={styles.itemDelete} onClick={() => deleteItem(item.id)} title="Remove">
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <ItemInput listId={list.id} listItems={items} allItems={allItems} />
    </div>
  );
}
