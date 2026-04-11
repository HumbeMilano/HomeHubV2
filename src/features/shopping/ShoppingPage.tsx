import { useEffect, useState } from 'react';
import type { ShoppingList, ShoppingItem } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { subscribeToTable } from '../../lib/realtime';
import { createBroadcastChannel } from '../../lib/broadcast';
import { uid } from '../../lib/utils';
import styles from './ShoppingPage.module.css';

const bc = createBroadcastChannel<unknown>('shopping');

export default function ShoppingPage() {
  const { activeMember } = useAuthStore();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newListName, setNewListName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [showAddList, setShowAddList] = useState(false);

  const activeList = lists.find((l) => l.id === activeListId);
  const activeItems = items.filter((i) => i.list_id === activeListId);

  // Load lists
  useEffect(() => {
    supabase.from('shopping_lists').select('*').order('name').then(({ data }) => {
      const l = (data ?? []) as ShoppingList[];
      setLists(l);
      if (l.length > 0 && !activeListId) setActiveListId(l[0].id);
    });
  }, []);

  // Load items when active list changes
  useEffect(() => {
    if (!activeListId) return;
    supabase
      .from('shopping_items')
      .select('*')
      .eq('list_id', activeListId)
      .order('created_at')
      .then(({ data }) => setItems((data ?? []) as ShoppingItem[]));
  }, [activeListId]);

  // Realtime subscriptions
  useEffect(() => {
    const unsub1 = subscribeToTable<ShoppingItem>({
      table: 'shopping_items',
      onData: ({ eventType, new: row, old }) => {
        if (eventType === 'INSERT' && row) setItems((prev) => [...prev.filter((i) => i.id !== row.id), row]);
        if (eventType === 'UPDATE' && row) setItems((prev) => prev.map((i) => i.id === row.id ? row : i));
        if (eventType === 'DELETE' && old) setItems((prev) => prev.filter((i) => i.id !== old.id));
      },
    });
    const unsub2 = subscribeToTable<ShoppingList>({
      table: 'shopping_lists',
      onData: ({ eventType, new: row, old }) => {
        if (eventType === 'INSERT' && row) setLists((prev) => [...prev.filter((l) => l.id !== row.id), row]);
        if (eventType === 'DELETE' && old) setLists((prev) => prev.filter((l) => l.id !== old.id));
      },
    });
    const unsubBc = bc.listen((msg) => {
      if (msg.type === 'ITEM_TOGGLED') {
        const { id, checked, checked_by, checked_at } = msg.payload as ShoppingItem;
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, checked, checked_by, checked_at } : i));
      }
    });
    return () => { unsub1(); unsub2(); unsubBc(); };
  }, []);

  async function addList() {
    if (!newListName.trim()) return;
    const list: ShoppingList = {
      id: uid(), name: newListName.trim(),
      store_category: null, color: '#fb923c',
      created_by: activeMember?.id ?? null,
      created_at: new Date().toISOString(),
    };
    setLists((prev) => [...prev, list]);
    setActiveListId(list.id);
    setNewListName('');
    setShowAddList(false);
    await supabase.from('shopping_lists').insert(list);
  }

  async function addItem() {
    if (!newItemName.trim() || !activeListId) return;
    const item: ShoppingItem = {
      id: uid(), list_id: activeListId,
      name: newItemName.trim(), category: null, quantity: null,
      checked: false, checked_by: null, checked_at: null,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [...prev, item]);
    setNewItemName('');
    await supabase.from('shopping_items').insert(item);
    bc.post('ITEM_ADDED', item);
  }

  async function toggleItem(item: ShoppingItem) {
    const now = new Date().toISOString();
    const updated: ShoppingItem = {
      ...item,
      checked: !item.checked,
      checked_by: !item.checked ? (activeMember?.id ?? null) : null,
      checked_at: !item.checked ? now : null,
    };
    setItems((prev) => prev.map((i) => i.id === item.id ? updated : i));
    await supabase.from('shopping_items').update({
      checked: updated.checked, checked_by: updated.checked_by, checked_at: updated.checked_at,
    }).eq('id', item.id);
    bc.post('ITEM_TOGGLED', updated);
  }

  async function deleteList(listId: string) {
    if (!confirm('Delete this list and all its items?')) return;
    setLists((prev) => prev.filter((l) => l.id !== listId));
    setItems((prev) => prev.filter((i) => i.list_id !== listId));
    if (activeListId === listId) setActiveListId(lists.find((l) => l.id !== listId)?.id ?? null);
    await supabase.from('shopping_items').delete().eq('list_id', listId);
    await supabase.from('shopping_lists').delete().eq('id', listId);
  }

  const unchecked = activeItems.filter((i) => !i.checked);
  const checked = activeItems.filter((i) => i.checked);

  return (
    <div className={styles.root}>
      {/* Lists sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>Lists</span>
          <button className="btn btn--ghost btn--icon" onClick={() => setShowAddList(true)} title="New list">+</button>
        </div>

        {showAddList && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)', padding: 'var(--sp-2)' }}>
            <input
              className="input"
              placeholder="List name…"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addList()}
              autoFocus
            />
            <button className="btn btn--primary btn--sm" onClick={addList}>Add</button>
          </div>
        )}

        {lists.map((list) => (
          <div key={list.id} className={styles.listTabWrapper}>
            <button
              className={`${styles.listTab} ${activeListId === list.id ? styles.listTabActive : ''}`}
              onClick={() => setActiveListId(list.id)}
            >
              <span className={styles.listDot} style={{ background: list.color }} />
              {list.name}
            </button>
            <button
              className={styles.listDelete}
              onClick={() => deleteList(list.id)}
              title="Delete list"
            >✕</button>
          </div>
        ))}
      </aside>

      {/* Items area */}
      <main className={styles.main}>
        {activeList ? (
          <>
            <h2 className={styles.listName}>{activeList.name}</h2>

            {/* Add item input */}
            <div className={styles.addRow}>
              <input
                className="input"
                placeholder="Add item…"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
              />
              <button className="btn btn--primary" onClick={addItem}>Add</button>
            </div>

            {/* Unchecked items */}
            <div className={styles.itemList}>
              {unchecked.map((item) => (
                <ItemRow key={item.id} item={item} onToggle={toggleItem} />
              ))}
            </div>

            {/* Checked items */}
            {checked.length > 0 && (
              <>
                <p className={styles.sectionLabel}>Checked off ({checked.length})</p>
                <div className={styles.itemList}>
                  {checked.map((item) => (
                    <ItemRow key={item.id} item={item} onToggle={toggleItem} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', paddingTop: 80 }}>
            <div style={{ fontSize: 48 }}>🛒</div>
            <p style={{ marginTop: 'var(--sp-4)' }}>Create a list to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function ItemRow({ item, onToggle }: { item: ShoppingItem; onToggle: (i: ShoppingItem) => void }) {
  return (
    <div
      className={styles.itemRow}
      onClick={() => onToggle(item)}
    >
      <span className={`${styles.itemCheck} ${item.checked ? styles.itemCheckDone : ''}`}>
        {item.checked ? '✓' : ''}
      </span>
      <span className={`${styles.itemName} ${item.checked ? styles.itemNameDone : ''}`}>
        {item.name}
      </span>
    </div>
  );
}
