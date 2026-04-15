import { useRef, useState } from 'react';
import type { ShoppingItem } from '../../types';
import { useShoppingStore } from '../../store/shoppingStore';
import styles from './ItemInput.module.css';

interface Props {
  listId: string;
  listItems: ShoppingItem[];   // items of this list only
  allItems: ShoppingItem[];    // items across all lists (for suggestions)
}

export default function ItemInput({ listId, listItems, allItems }: Props) {
  const { addItem, uncheckItem } = useShoppingStore();

  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [dupState, setDupState] = useState<'unchecked' | 'checked' | null>(null);
  const [dupId, setDupId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build deduplicated suggestion list from all items history
  const suggestions = value.trim().length > 0
    ? Array.from(new Set(
        allItems
          .map((i) => i.name)
          .filter((n) => n.toLowerCase().includes(value.toLowerCase()))
      )).slice(0, 6)
    : [];

  function checkDuplicate(name: string) {
    const dup = listItems.find((i) => i.name.toLowerCase() === name.toLowerCase());
    if (!dup) return null;
    return dup;
  }

  async function submit(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;

    const dup = checkDuplicate(trimmed);
    if (dup) {
      setDupId(dup.id);
      setDupState(dup.checked ? 'checked' : 'unchecked');
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      await addItem({
        list_id: listId,
        name: trimmed,
        category: null,
        quantity: null,
        checked: false,
        checked_by: null,
        checked_at: null,
      });
      setValue('');
      setDupState(null);
      setDupId(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleUncheck() {
    if (!dupId) return;
    await uncheckItem(dupId);
    setDupState(null);
    setDupId(null);
    setValue('');
  }

  return (
    <div className={styles.root}>
      <div className={styles.inputWrap}>
        <input
          ref={inputRef}
          className={styles.input}
          value={value}
          placeholder="+ Add item…"
          onChange={(e) => { setValue(e.target.value); setDupState(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(value); } }}
          disabled={saving}
        />

        {open && suggestions.length > 0 && (
          <ul className={styles.dropdown}>
            {suggestions.map((name) => {
              const inList = listItems.some((i) => i.name.toLowerCase() === name.toLowerCase());
              return (
                <li
                  key={name}
                  className={styles.suggestion}
                  onMouseDown={() => submit(name)}
                >
                  {name}
                  {inList && <span className={styles.inList}>ya en lista</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {dupState === 'unchecked' && (
        <p className={styles.dupMsg}>
          <span>"{value.trim()}" ya está en la lista.</span>
          <button className={styles.dupDismiss} onClick={() => { setDupState(null); setValue(''); }}>OK</button>
        </p>
      )}

      {dupState === 'checked' && (
        <p className={styles.dupMsg}>
          <span>"{value.trim()}" está marcado. ¿Desmarcarlo?</span>
          <button className={styles.dupAction} onClick={handleUncheck}>Desmarcar</button>
          <button className={styles.dupDismiss} onClick={() => { setDupState(null); setValue(''); }}>Cancelar</button>
        </p>
      )}
    </div>
  );
}
