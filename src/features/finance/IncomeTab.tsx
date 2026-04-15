import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { FinIncome } from '../../types';
import { useFinanceStore } from '../../store/financeStore';
import { useMembersStore } from '../../store/membersStore';
import { fmt, clamp } from '../../lib/utils';
import styles from './IncomeTab.module.css';

const SWIPE_THRESHOLD = 80;
const INCOME_TYPES = ['salary', 'part-time', 'freelance', 'bonus', 'investment', 'business', 'other'];

// ── Swipeable income card ────────────────────────────────────────────────────
function IncomeCard({ item, onEdit }: { item: FinIncome; onEdit: () => void }) {
  const { deleteIncome } = useFinanceStore();
  const { members } = useMembersStore();
  const dragRef = useRef<number | null>(null);
  const [dx, setDx] = useState(0);

  const person      = members.find((m) => m.id === item.person_id);
  const sharedPeople = item.shared_people
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current === null) return;
    setDx(clamp(e.clientX - dragRef.current, -130, 0));
  }
  async function onPointerUp() {
    if (dragRef.current === null) return;
    dragRef.current = null;
    if (dx < -SWIPE_THRESHOLD) await deleteIncome(item.id);
    setDx(0);
  }

  return (
    <div className={styles.card}>
      <div className={styles.swipeBg} style={{ opacity: dx < -20 ? 1 : 0 }}>
        <span className={styles.swipeBgLabel}>Delete</span>
        <Trash2 size={20} color="#fff" />
      </div>

      <div
        className={styles.cardInner}
        style={{
          transform:  `translateX(${dx}px)`,
          transition: dx === 0 ? 'transform 300ms cubic-bezier(0.34,1.56,0.64,1)' : 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragRef.current = null; setDx(0); }}
      >
        <div className={styles.cardLeft}>
          <div className={styles.cardDesc}>{item.description}</div>
          <div className={styles.cardMeta}>
            {format(new Date(item.date), 'MMM d')}
            {' · '}
            {item.type}
            {person && (
              <span className={styles.personBadge} style={{ background: `${person.color}22`, color: person.color }}>
                {person.name}
              </span>
            )}
            {item.is_shared && (
              <span className={styles.sharedBadge}>
                shared{sharedPeople.length > 0 ? ` · ${sharedPeople.map((m) => m!.name).join(', ')}` : ''}
              </span>
            )}
          </div>
        </div>
        <span className={styles.cardAmount}>+{fmt(item.amount)}</span>
        <button
          className="btn btn--ghost btn--icon"
          style={{ width: 30, height: 30, flexShrink: 0 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          <Pencil size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main tab ─────────────────────────────────────────────────────────────────
export default function IncomeTab() {
  const { workMonth, workYear, addIncome, updateIncome, getIncomeForMonth } = useFinanceStore();
  const [modal, setModal] = useState<FinIncome | 'new' | null>(null);
  const monthIncome = getIncomeForMonth(workMonth, workYear);
  const total = monthIncome.reduce((s, i) => s + i.amount, 0);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.hint}>swipe left → delete</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
            Total: <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>{fmt(total)}</strong>
          </span>
          <button
            className="btn btn--primary"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setModal('new')}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {monthIncome.map((item) => (
          <IncomeCard key={item.id} item={item} onEdit={() => setModal(item)} />
        ))}
        {monthIncome.length === 0 && (
          <div className={styles.empty}>No income recorded this month</div>
        )}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <IncomeForm
              existing={modal === 'new' ? undefined : modal}
              workMonth={workMonth}
              workYear={workYear}
              onSave={async (data) => {
                if (modal === 'new') await addIncome(data);
                else await updateIncome(modal.id, data);
                setModal(null);
              }}
              onClose={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Income form ──────────────────────────────────────────────────────────────
type IncomeKind = 'personal' | 'shared';

function IncomeForm({
  existing, workMonth, workYear, onSave, onClose,
}: {
  existing?: FinIncome;
  workMonth: number;
  workYear: number;
  onSave: (data: Omit<FinIncome, 'id' | 'created_at'>) => Promise<void>;
  onClose: () => void;
}) {
  const { accounts } = useFinanceStore();
  const { members }  = useMembersStore();

  const defaultDate = format(new Date(workYear, workMonth - 1, 15), 'yyyy-MM-dd');

  const [kind,         setKind]         = useState<IncomeKind>(
    existing?.is_shared ? 'shared' : 'personal'
  );
  const [description,  setDescription]  = useState(existing?.description ?? '');
  const [amount,       setAmount]        = useState(String(existing?.amount ?? ''));
  const [date,         setDate]          = useState(
    existing ? format(new Date(existing.date), 'yyyy-MM-dd') : defaultDate
  );
  const [type,         setType]          = useState(existing?.type ?? 'salary');
  const [personId,     setPersonId]      = useState(existing?.person_id ?? '');
  const [accId,        setAccId]         = useState(existing?.account_id ?? '');
  const [sharedPeople, setSharedPeople]  = useState<string[]>(existing?.shared_people ?? []);
  const [saving,       setSaving]        = useState(false);

  function toggleShared(id: string) {
    setSharedPeople((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      description:  description.trim(),
      amount:       parseFloat(amount) || 0,
      date:         new Date(date + 'T12:00:00').toISOString(),
      type,
      person_id:    kind === 'personal' ? (personId || null) : null,
      is_shared:    kind === 'shared',
      shared_people: kind === 'shared' ? sharedPeople : [],
      account_id:   accId || null,
    });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className={styles.formRoot}>
      <div className="modal-handle" />

      {/* ── Personal / Shared toggle ── */}
      <div className={styles.kindToggle}>
        {(['personal', 'shared'] as IncomeKind[]).map((k) => (
          <button
            key={k}
            type="button"
            className={`${styles.kindBtn} ${kind === k ? styles.kindBtnActive : ''}`}
            onClick={() => setKind(k)}
          >
            {k === 'personal' ? 'Personal' : 'Shared'}
          </button>
        ))}
      </div>

      {/* ── Description ── */}
      <div className="field">
        <label>Description *</label>
        <input className="input" value={description}
          onChange={(e) => setDescription(e.target.value)} required autoFocus />
      </div>

      {/* ── Amount | Date ── */}
      <div className={styles.row2}>
        <div className="field">
          <label>Amount *</label>
          <input className="input" type="number" step="0.01" min="0"
            value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="field">
          <label>Date</label>
          <input className="input" type="date" value={date}
            onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {/* ── Type ── */}
      <div className="field">
        <label>Type</label>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {INCOME_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* ── Personal: Person + Account ── */}
      {kind === 'personal' && (
        <div className={styles.row2}>
          <div className="field">
            <label>Person</label>
            <select className="input" value={personId}
              onChange={(e) => setPersonId(e.target.value)}>
              <option value="">— household —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Account</label>
            <select className="input" value={accId}
              onChange={(e) => setAccId(e.target.value)}>
              <option value="">— none —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Shared: note + checkboxes + account ── */}
      {kind === 'shared' && (
        <>
          <p className={styles.sharedNote}>
            Shared income is pooled into the household fund and deducted from each participant's owed total.
          </p>
          <div className={styles.memberList}>
            {members.map((m) => {
              const sel = sharedPeople.includes(m.id);
              return (
                <label key={m.id} className={styles.memberRow}>
                  <input
                    type="checkbox"
                    checked={sel}
                    onChange={() => toggleShared(m.id)}
                  />
                  <span className={styles.memberDot} style={{ background: m.color }}>
                    {m.name.charAt(0)}
                  </span>
                  <span className={styles.memberName}>{m.name}</span>
                </label>
              );
            })}
          </div>
          <div className="field">
            <label>Account</label>
            <select className="input" value={accId} onChange={(e) => setAccId(e.target.value)}>
              <option value="">— none —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* ── Actions ── */}
      <div className={styles.formActions}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
