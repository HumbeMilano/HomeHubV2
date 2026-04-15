import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { FinBudget } from '../../types';
import { useFinanceStore } from '../../store/financeStore';
import { fmt, clamp } from '../../lib/utils';
import styles from './BudgetsTab.module.css';

const COLORS = ['#818cf8','#34d399','#fb923c','#f472b6','#4ade80','#facc15','#60a5fa','#f87171','#a78bfa','#2dd4bf'];
const ICONS  = ['🏠','🍔','🚗','🎬','💊','🛒','✈️','📚','💡','👕','🐾','💪','🎵','🏋️'];

export default function BudgetsTab() {
  const { budgets, workMonth, workYear, addBudget, updateBudget, deleteBudget, getBudgetSpent } = useFinanceStore();
  const [modal, setModal] = useState<FinBudget | 'new' | null>(null);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button
          className="btn btn--primary"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={() => setModal('new')}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      <div className={styles.grid}>
        {budgets.map((budget) => {
          const spent     = getBudgetSpent(budget, workMonth, workYear);
          const pct       = clamp(budget.limit_amount > 0 ? (spent / budget.limit_amount) * 100 : 0, 0, 100);
          const over      = spent > budget.limit_amount && budget.limit_amount > 0;
          const barColor  = over ? 'var(--danger)' : pct >= 75 ? 'var(--warning)' : 'var(--success)';

          return (
            <div
              key={budget.id}
              className={styles.card}
              style={{ borderTop: `3px solid ${budget.color}` }}
              onClick={() => setModal(budget)}
            >
              <div className={styles.cardTop}>
                <span className={styles.icon}>{budget.icon}</span>
                <span className={styles.name}>{budget.name}</span>
                {over && <span className={styles.overBadge}>⚠️ Over budget</span>}
              </div>
              <div className={styles.amounts}>
                <span className={styles.spent}>{fmt(spent)}</span>
                <span className={styles.limit}>/ {fmt(budget.limit_amount)}</span>
                <span className={styles.pct} style={{ color: barColor }}>{Math.round(pct)}%</span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{ width: `${pct}%`, background: barColor }}
                />
              </div>
            </div>
          );
        })}
        {budgets.length === 0 && (
          <div className={styles.empty}>No budgets configured</div>
        )}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <BudgetForm
              existing={modal === 'new' ? undefined : modal}
              onSave={async (data) => {
                if (modal === 'new') await addBudget(data);
                else await updateBudget(modal.id, data);
                setModal(null);
              }}
              onDelete={modal !== 'new' ? async () => {
                if (confirm(`Delete "${modal.name}"?`)) {
                  await deleteBudget(modal.id);
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

function BudgetForm({
  existing, onSave, onDelete, onClose,
}: {
  existing?: FinBudget;
  onSave: (data: Omit<FinBudget, 'id' | 'created_at'>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const { categories } = useFinanceStore();
  const [name,   setName]   = useState(existing?.name ?? '');
  const [limit,  setLimit]  = useState(String(existing?.limit_amount ?? ''));
  const [color,  setColor]  = useState(existing?.color ?? COLORS[0]);
  const [icon,   setIcon]   = useState(existing?.icon ?? ICONS[0]);
  const [catId,  setCatId]  = useState(existing?.category_id ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ name: name.trim(), limit_amount: parseFloat(limit) || 0, color, icon, category_id: catId || null });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div className="modal-handle" />
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
        {existing ? 'Edit Budget' : 'Add Budget'}
      </h2>

      <div className="field">
        <label>Name *</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>

      <div className="field">
        <label>Monthly limit *</label>
        <input className="input" type="number" step="0.01" min="0" value={limit}
          onChange={(e) => setLimit(e.target.value)} required />
      </div>

      <div className="field">
        <label>Category (used to calculate actual spending)</label>
        <select className="input" value={catId} onChange={(e) => setCatId(e.target.value)}>
          <option value="">— none —</option>
          {categories.filter((c) => c.type !== 'income').map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Icon</label>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {ICONS.map((ic) => (
            <button key={ic} type="button"
              style={{ fontSize: 20, padding: '4px 8px', borderRadius: 'var(--r-sm)', border: ic === icon ? '2px solid var(--accent)' : '2px solid transparent', background: 'var(--bg-3)', cursor: 'pointer' }}
              onClick={() => setIcon(ic)}
            >{ic}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Color</label>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {COLORS.map((c) => (
            <button key={c} type="button"
              style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: c === color ? '3px solid var(--text)' : '2px solid transparent', cursor: 'pointer', transition: 'transform 200ms' }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--sp-2)' }}>
        {onDelete && (
          <button type="button" className="btn btn--danger" onClick={onDelete}>Delete</button>
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
