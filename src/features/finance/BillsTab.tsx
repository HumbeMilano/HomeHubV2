import { useState, useRef } from 'react';
import { subMonths } from 'date-fns';
import { Plus, Pencil, Check, Trash2, Zap } from 'lucide-react';
import type { FinBill, BillType, BillSplit } from '../../types';
import { useFinanceStore } from '../../store/financeStore';
import { useMembersStore } from '../../store/membersStore';
import { fmt, clamp } from '../../lib/utils';
import styles from './BillsTab.module.css';

const SWIPE_THRESHOLD = 80;

// ── Swipeable bill card ──────────────────────────────────────────────────────
function BillCard({ bill, onEdit }: { bill: FinBill; onEdit: () => void }) {
  const {
    workMonth, workYear,
    getBillStatus, setBillStatus, hideFromMonth, getEffectiveAmount, categories,
  } = useFinanceStore();
  const { members } = useMembersStore();

  const dragRef = useRef<number | null>(null);
  const [dx, setDx] = useState(0);

  const status    = getBillStatus(bill.id, workMonth, workYear);
  const isPaid    = status === 'paid';
  const effective = getEffectiveAmount(bill, workYear, workMonth);
  const cat       = categories.find((c) => c.id === bill.category_id);

  // Delta vs previous month
  const prevDate = subMonths(new Date(workYear, workMonth - 1, 1), 1);
  const prevAmt  = getEffectiveAmount(bill, prevDate.getFullYear(), prevDate.getMonth() + 1);
  const delta    = effective - prevAmt;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current === null) return;
    setDx(clamp(e.clientX - dragRef.current, -130, 130));
  }
  async function onPointerUp() {
    if (dragRef.current === null) return;
    dragRef.current = null;
    if (dx > SWIPE_THRESHOLD)       await setBillStatus(bill.id, isPaid ? 'pending' : 'paid');
    else if (dx < -SWIPE_THRESHOLD) await hideFromMonth(bill.id, workYear, workMonth);
    setDx(0);
  }

  const splitChips = bill.splits.length > 0
    ? bill.splits.map((s) => {
        const m = members.find((x) => x.id === s.person_id);
        if (!m) return null;
        const amt = s.type === 'equal'
          ? effective / bill.splits.length
          : s.type === 'percent'
          ? effective * s.value / 100
          : s.value;
        return { member: m, amount: amt };
      }).filter(Boolean)
    : [];

  return (
    <div className={styles.card}>
      <div
        className={styles.swipeBgRight}
        style={{ background: dx > 20 ? 'var(--success)' : 'transparent', opacity: dx > 0 ? 1 : 0 }}
      >
        <Check size={20} color="#fff" />
        <span className={styles.swipeBgLabel}>{isPaid ? 'Unpay' : 'Paid'}</span>
      </div>
      <div
        className={styles.swipeBgLeft}
        style={{ background: dx < -20 ? 'var(--danger)' : 'transparent', opacity: dx < 0 ? 1 : 0 }}
      >
        <span className={styles.swipeBgLabel}>Remove</span>
        <Trash2 size={20} color="#fff" />
      </div>

      <div
        className={`${styles.cardInner} ${isPaid ? styles.cardPaid : ''}`}
        style={{
          transform:  `translateX(${dx}px)`,
          transition: dx === 0 ? 'transform 300ms cubic-bezier(0.34,1.56,0.64,1)' : 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragRef.current = null; setDx(0); }}
      >
        <button
          className={`${styles.payBtn} ${isPaid ? styles.payBtnPaid : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setBillStatus(bill.id, isPaid ? 'pending' : 'paid'); }}
        >
          {isPaid && <Check size={13} strokeWidth={3} />}
        </button>

        <div className={styles.cardInfo}>
          <div className={styles.cardName}>
            {bill.name}
            {bill.auto_pay && <span className={styles.autoBadge}><Zap size={10} /> auto</span>}
          </div>
          <div className={styles.cardMeta}>
            {bill.due_day ? `due day ${bill.due_day}` : null}
            {bill.due_day && cat ? ' · ' : null}
            {cat ? `${cat.icon} ${cat.name}` : null}
            {!bill.due_day && !cat ? bill.type : null}
          </div>
          {splitChips.length > 0 && (
            <div className={styles.splitChips}>
              {splitChips.map((sc) => sc && (
                <span
                  key={sc.member.id}
                  className={styles.splitChip}
                  style={{ background: sc.member.color }}
                  title={`${sc.member.name}: ${fmt(sc.amount)}`}
                >
                  {sc.member.name.charAt(0)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={styles.cardRight}>
          <span className={styles.cardAmount}>{fmt(effective)}</span>
          {delta !== 0 && (
            <span
              className={styles.delta}
              style={{ color: delta > 0 ? 'var(--danger)' : 'var(--success)' }}
            >
              {delta > 0 ? '▲' : '▼'} {fmt(Math.abs(delta))}
            </span>
          )}
        </div>

        <button
          className={`btn btn--ghost btn--icon ${styles.editBtn}`}
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
export default function BillsTab() {
  const { workMonth, workYear, getBillsForMonth, addBill, updateBill, deleteBill, setBillOverrideAmount } = useFinanceStore();
  const [modal, setModal] = useState<FinBill | 'new' | null>(null);

  const bills  = getBillsForMonth(workMonth, workYear);
  const sorted = [...bills].sort((a, b) => {
    const aPaid = useFinanceStore.getState().getBillStatus(a.id, workMonth, workYear) === 'paid';
    const bPaid = useFinanceStore.getState().getBillStatus(b.id, workMonth, workYear) === 'paid';
    if (aPaid !== bPaid) return aPaid ? 1 : -1;
    return (a.due_day ?? 99) - (b.due_day ?? 99) || a.name.localeCompare(b.name);
  });

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.hint}>swipe right → paid · swipe left → remove from month</span>
        <button
          className="btn btn--primary"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={() => setModal('new')}
        >
          <Plus size={14} /> Add bill
        </button>
      </div>

      <div className={styles.list}>
        {sorted.map((bill) => (
          <BillCard key={bill.id} bill={bill} onEdit={() => setModal(bill)} />
        ))}
        {sorted.length === 0 && (
          <div className={styles.empty}>No bills this month</div>
        )}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <BillForm
              existing={modal === 'new' ? undefined : modal}
              onSave={async (data, amountMode) => {
                if (modal === 'new') {
                  await addBill(data);
                } else {
                  if (amountMode === 'month') {
                    await setBillOverrideAmount(modal.id, workYear, workMonth, data.base_amount);
                    const { base_amount: _ba, ...rest } = data;
                    await updateBill(modal.id, rest);
                  } else {
                    await updateBill(modal.id, data);
                  }
                }
                setModal(null);
              }}
              onDelete={modal !== 'new' ? async () => {
                if (confirm(`Delete "${modal.name}" permanently?`)) {
                  await deleteBill(modal.id);
                  setModal(null);
                }
              } : undefined}
              onClose={() => setModal(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bill form ────────────────────────────────────────────────────────────────
type AmountMode   = 'base' | 'month';
type SplitEq      = 'equal' | 'manual';

function BillForm({
  existing, onSave, onDelete, onClose,
}: {
  existing?: FinBill;
  onSave: (data: Omit<FinBill, 'id' | 'created_at'>, amountMode: AmountMode) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const { categories, accounts, addCategory, workYear, workMonth, getEffectiveAmount } = useFinanceStore();
  const { members } = useMembersStore();

  const initAmt = existing ? String(getEffectiveAmount(existing, workYear, workMonth)) : '';

  // ── Core fields
  const [billType,    setBillType]    = useState<BillType>(existing?.type ?? 'fixed');
  const [name,        setName]        = useState(existing?.name ?? '');
  const [amount,      setAmount]      = useState(initAmt);
  const [amountMode,  setAmountMode]  = useState<AmountMode>('base');
  const [dueDay,      setDueDay]      = useState(String(existing?.due_day ?? ''));
  const [catId,       setCatId]       = useState(existing?.category_id ?? '');
  const [subcatId,    setSubcatId]    = useState(existing?.subcategory_id ?? '');
  const [accId,       setAccId]       = useState(existing?.account_id ?? '');
  const [autoPay,     setAutoPay]     = useState(existing?.auto_pay ?? false);

  // ── Split state
  const [splitsOn,    setSplitsOn]    = useState((existing?.splits?.length ?? 0) > 0);
  const [splitEq,     setSplitEq]     = useState<SplitEq>(() => {
    if (!existing?.splits?.length) return 'equal';
    return existing.splits[0].type === 'equal' ? 'equal' : 'manual';
  });
  // Equal mode: selected member IDs
  const [selMembers,  setSelMembers]  = useState<string[]>(
    existing?.splits?.map((s) => s.person_id) ?? []
  );
  // Manual mode: per-member type ($ or %) and value
  const [manualTypes, setManualTypes] = useState<Record<string, '%' | '$'>>(() => {
    const map: Record<string, '%' | '$'> = {};
    (existing?.splits ?? []).forEach((s) => {
      map[s.person_id] = s.type === 'amount' ? '$' : '%';
    });
    members.forEach((m) => { if (!map[m.id]) map[m.id] = '%'; });
    return map;
  });
  const [manualVals, setManualVals] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    (existing?.splits ?? []).forEach((s) => { map[s.person_id] = String(s.value); });
    return map;
  });

  // ── Quick-add category
  const [showCatForm, setShowCatForm] = useState(false);
  const [newCatName,  setNewCatName]  = useState('');
  const [newCatIcon,  setNewCatIcon]  = useState('📋');
  const [saving,      setSaving]      = useState(false);

  const amt = parseFloat(amount) || 0;

  // Subcategories for selected category
  const selectedCat = categories.find((c) => c.id === catId);
  const subcats     = selectedCat?.subcategories ?? [];

  // Manual split: $ users come first, % users split the remainder
  function manualPreview(pid: string): number {
    const val = parseFloat(manualVals[pid] ?? '0') || 0;
    if (manualTypes[pid] === '$') return val;
    const totalFixed = members.reduce((sum, m) => {
      if (manualTypes[m.id] === '$') return sum + (parseFloat(manualVals[m.id] ?? '0') || 0);
      return sum;
    }, 0);
    const remainder = Math.max(0, amt - totalFixed);
    return remainder * (val / 100);
  }

  function buildSplits(): BillSplit[] {
    if (!splitsOn) return [];
    if (splitEq === 'equal') {
      return selMembers.map((pid) => ({ person_id: pid, type: 'equal', value: 1 }));
    }
    // manual: include members with a non-zero value
    return members
      .filter((m) => parseFloat(manualVals[m.id] ?? '0') > 0)
      .map((m) => ({
        person_id: m.id,
        type:      manualTypes[m.id] === '$' ? ('amount' as const) : ('percent' as const),
        value:     parseFloat(manualVals[m.id] ?? '0') || 0,
      }));
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    await addCategory({ name: newCatName.trim(), icon: newCatIcon, type: 'expense', subcategories: [] });
    setNewCatName('');
    setShowCatForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name:           name.trim(),
      base_amount:    parseFloat(amount) || 0,
      type:           billType,
      category_id:    catId    || null,
      subcategory_id: subcatId || null,
      account_id:     accId    || null,
      due_day:        parseInt(dueDay) || null,
      auto_pay:       autoPay,
      splits:         buildSplits(),
    }, amountMode);
    setSaving(false);
  }

  function toggleMember(id: string) {
    setSelMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.formRoot}>
      <div className="modal-handle" />

      {/* ── Fixed / Variable toggle ── */}
      <div className={styles.typeToggle}>
        {(['fixed', 'variable'] as BillType[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.typeBtn} ${billType === t ? styles.typeBtnActive : ''}`}
            onClick={() => setBillType(t)}
          >
            {t === 'fixed' ? 'Fixed' : 'Variable'}
          </button>
        ))}
      </div>

      {/* ── Name ── */}
      <div className="field">
        <label>Name *</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>

      {/* ── Amount | Due Day ── */}
      <div className={styles.row2}>
        <div className="field">
          <label>Amount *</label>
          <input className="input" type="number" step="0.01" min="0"
            value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="field">
          <label>Due Day</label>
          <input className="input" type="number" min="1" max="31"
            value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="e.g. 15" />
        </div>
      </div>

      {/* Amount mode (editing only) */}
      {existing && (
        <div className={styles.amountModeRow}>
          {(['base', 'month'] as AmountMode[]).map((m) => (
            <label key={m} className={styles.radioLabel}>
              <input type="radio" name="amountMode" checked={amountMode === m} onChange={() => setAmountMode(m)} />
              {m === 'base' ? 'Update base amount' : 'This month only'}
            </label>
          ))}
        </div>
      )}

      {/* ── Category | Subcategory ── */}
      <div className={styles.row2}>
        <div className="field">
          <div className={styles.labelRow}>
            <label>Category</label>
            <button type="button" className={styles.addLink}
              onClick={() => setShowCatForm((v) => !v)}>+ Add</button>
          </div>
          {showCatForm && (
            <div className={styles.quickCatRow}>
              <input style={{ width: 34, textAlign: 'center', fontSize: 18, padding: 2, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}
                value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)} maxLength={2} />
              <input className="input" style={{ flex: 1 }} placeholder="Name"
                value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
              <button type="button" className="btn btn--primary btn--sm" onClick={handleAddCategory}>OK</button>
            </div>
          )}
          <select className="input" value={catId}
            onChange={(e) => { setCatId(e.target.value); setSubcatId(''); }}>
            <option value="">— none —</option>
            {categories.filter((c) => c.type !== 'income').map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Subcategory</label>
          <select className="input" value={subcatId} onChange={(e) => setSubcatId(e.target.value)}
            disabled={subcats.length === 0}>
            <option value="">— none —</option>
            {subcats.map((sc) => (
              <option key={sc.id} value={sc.id}>{sc.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Account ── */}
      <div className="field">
        <label>Account</label>
        <select className="input" value={accId} onChange={(e) => setAccId(e.target.value)}>
          <option value="">— none —</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* ── Auto pay ── */}
      <label className={styles.checkLabel}>
        <input type="checkbox" checked={autoPay} onChange={(e) => setAutoPay(e.target.checked)} />
        Auto pay on due date
      </label>

      {/* ── Split section ── */}
      <div className={styles.splitSection}>
        <label className={styles.checkLabel} style={{ fontWeight: 600 }}>
          <input type="checkbox" checked={splitsOn} onChange={(e) => setSplitsOn(e.target.checked)} />
          Split
        </label>

        {splitsOn && (
          <>
            {/* Equal / Manual toggle */}
            <div className={styles.splitModeToggle}>
              {(['equal', 'manual'] as SplitEq[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`${styles.splitModeBtn} ${splitEq === m ? styles.splitModeBtnActive : ''}`}
                  onClick={() => setSplitEq(m)}
                >
                  {m === 'equal' ? 'Equal' : 'Manual'}
                </button>
              ))}
            </div>

            {/* ── Equal mode: checkboxes ── */}
            {splitEq === 'equal' && (
              <div className={styles.memberList}>
                {members.map((m) => {
                  const sel = selMembers.includes(m.id);
                  const each = selMembers.length > 0 && sel
                    ? fmt(amt / selMembers.length)
                    : null;
                  return (
                    <label key={m.id} className={styles.memberRow}>
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => toggleMember(m.id)}
                      />
                      <span
                        className={styles.memberDot}
                        style={{ background: m.color }}
                      >
                        {m.name.charAt(0)}
                      </span>
                      <span className={styles.memberName}>{m.name}</span>
                      {each && <span className={styles.memberCalc}>{each}</span>}
                    </label>
                  );
                })}
              </div>
            )}

            {/* ── Manual mode: per-member amount + type toggle ── */}
            {splitEq === 'manual' && (
              <div className={styles.memberList}>
                {members.map((m) => {
                  const isFixed   = manualTypes[m.id] === '$';
                  const preview   = manualPreview(m.id);
                  const hasVal    = (parseFloat(manualVals[m.id] ?? '0') || 0) > 0;
                  return (
                    <div key={m.id} className={styles.manualRow}>
                      <span className={styles.memberDot} style={{ background: m.color }}>
                        {m.name.charAt(0)}
                      </span>
                      <span className={styles.memberName}>{m.name}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className={styles.manualInput}
                        placeholder={isFixed ? '0.00' : '0'}
                        value={manualVals[m.id] ?? ''}
                        onChange={(e) =>
                          setManualVals((v) => ({ ...v, [m.id]: e.target.value }))
                        }
                      />
                      {/* % / $ toggle */}
                      <div className={styles.typeToggleSmall}>
                        <button
                          type="button"
                          className={`${styles.typeBtnSmall} ${!isFixed ? styles.typeBtnSmallActive : ''}`}
                          onClick={() => setManualTypes((v) => ({ ...v, [m.id]: '%' }))}
                        >%</button>
                        <button
                          type="button"
                          className={`${styles.typeBtnSmall} ${isFixed ? styles.typeBtnSmallActive : ''}`}
                          onClick={() => setManualTypes((v) => ({ ...v, [m.id]: '$' }))}
                        >$</button>
                      </div>
                      {hasVal && (
                        <span className={styles.memberCalc}>{fmt(preview)}</span>
                      )}
                    </div>
                  );
                })}
                {/* Remainder note when mixing $ and % */}
                {members.some((m) => manualTypes[m.id] === '$' && parseFloat(manualVals[m.id] ?? '0') > 0) &&
                 members.some((m) => manualTypes[m.id] === '%'  && parseFloat(manualVals[m.id] ?? '0') > 0) && (
                  <p className={styles.splitNote}>
                    % members split the remainder after fixed $ amounts are deducted.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Actions ── */}
      <div className={styles.formActions}>
        {onDelete && (
          <button type="button" className="btn btn--danger" onClick={onDelete}>
            Delete
          </button>
        )}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginLeft: 'auto' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}
