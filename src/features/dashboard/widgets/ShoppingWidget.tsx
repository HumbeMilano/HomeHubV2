import { useEffect } from 'react';
import { useShoppingStore } from '../../../store/shoppingStore';
import styles from './ShoppingWidget.module.css';

export default function ShoppingWidget() {
  const { lists, items, fetchAll } = useShoppingStore();

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const featured = lists.find((l) => l.is_featured);
  const listItems = featured ? items.filter((i) => i.list_id === featured.id) : [];
  const unchecked = listItems.filter((i) => !i.checked);
  const checked   = listItems.filter((i) => i.checked);

  if (!featured) {
    return (
      <div className={styles.root}>
        <h3 className={styles.title}>🛒 Shopping</h3>
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
          <li key={item.id} className={styles.item}>
            <span className={styles.checkbox} />
            {item.name}
          </li>
        ))}
        {checked.map((item) => (
          <li key={item.id} className={`${styles.item} ${styles.itemChecked}`}>
            <span className={`${styles.checkbox} ${styles.checkboxDone}`}>✓</span>
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
