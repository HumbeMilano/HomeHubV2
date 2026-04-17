import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useShoppingStore } from '../../../store/shoppingStore';
import { useAuthStore } from '../../../store/authStore';
import ItemInput from '../../shopping/ItemInput';
import styles from './ShoppingWidget.module.css';

export default function ShoppingWidget() {
  const { lists, items, fetchAll, toggleItem, deleteItem } = useShoppingStore();
  const { activeMember } = useAuthStore();

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const memberId  = activeMember?.id ?? null;
  const featured  = lists.find((l) => l.is_featured);
  const listItems = featured ? items.filter((i) => i.list_id === featured.id) : [];
  const unchecked = listItems.filter((i) => !i.checked);
  const checked   = listItems.filter((i) => i.checked);

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
          <li key={item.id} className={`${styles.item} ${styles.itemClickable}`}>
            <button
              className={styles.checkbox}
              onClick={() => toggleItem(item.id, memberId)}
              aria-label="Mark done"
            />
            <span className={styles.itemName} onClick={() => toggleItem(item.id, memberId)}>
              {item.name}
            </span>
            {item.quantity && <span className={styles.qty}>{item.quantity}</span>}
            <button className={styles.itemDelete} onClick={() => deleteItem(item.id)} aria-label="Remove">
              <X size={11} />
            </button>
          </li>
        ))}

        {checked.length > 0 && <li className={styles.separator} />}

        {checked.map((item) => (
          <li key={item.id} className={`${styles.item} ${styles.itemChecked} ${styles.itemClickable}`}>
            <button
              className={`${styles.checkbox} ${styles.checkboxDone}`}
              onClick={() => toggleItem(item.id, memberId)}
              aria-label="Unmark"
            >✓</button>
            <span className={styles.itemName} onClick={() => toggleItem(item.id, memberId)}>
              {item.name}
            </span>
            {item.quantity && <span className={styles.qty}>{item.quantity}</span>}
            <button className={styles.itemDelete} onClick={() => deleteItem(item.id)} aria-label="Remove">
              <X size={11} />
            </button>
          </li>
        ))}
      </ul>

      <ItemInput listId={featured.id} listItems={listItems} allItems={items} />
    </div>
  );
}
