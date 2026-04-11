import { useState } from 'react';
import type { FinBudget } from '../../types';
import { useFinanceStore } from '../../store/financeStore';
import { fmt, clamp } from '../../lib/utils';

const COLORS = ['#818cf8','#34d399','#fb923c','#f472b6','#4ade80','#facc15','#60a5fa','#f87171','#a78bfa','#2dd4bf'];
const ICONS = ['🏠','🍔','🚗','🎬','💊','🛒','✈️','📚','💡','👕','🐾','💪'];

export default function BudgetsTab() {
  const { budgets, workMonth, workYear, addBudget, updateBudget, deleteBudget, getBudgetSpent } = useFinanceStore();
  const [modal, setModal] = useState<FinBudget | 'new' | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn--primary" onClick={() => setModal('new')}>+ Add budget</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--sp-4)' }}>
        {budgets.map((budget) => {
          const spent = getBudgetSpent(budget, workMonth, workYear);
          const pct = clamp(budget.limit_amount > 0 ? (spent / budget.limit_amount) * 100 : 0, 0, 100);
          const overBudget = spent > budget.limit_amount;
          const barColor = overBudget ? 'var(--danger)' : pct >= 80 ? 'var(--warning)' : 'var(--success)';

          return (
            <div
              key={budget.id}
              className="card card--interactive"
              style={{ borderTop: `3px solid ${budget.color}` }}
              onClick={() => setModal(budget)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                <span style={{ fontSize: 24 }}>{budget.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{budget.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                  {fmt(spent)} / {fmt(budget.limit_amount)}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: barColor, fontWeight: 600 }}>
                  {Math.round(pct)}%
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 300ms' }} />
              </div>
            </div>
          );
        })}
      </div>

      {budgets.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', paddingTop: 60, fontSize: 'var(--text-sm)' }}>
          No budgets yet.
        </div>
      )}

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
              onDelete={modal !== 'new' ? async () => { await deleteBudget(modal.id); setModal(null); } : undefined}
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
  const [name, setName] = useState(existing?.name ?? '');
  const [limit, setLimit] = useState(String(existing?.limit_amount ?? ''));
  const [color, setColor] = useState(existing?.color ?? COLORS[0]);
  const [icon, setIcon] = useState(existing?.icon ?? ICONS[0]);
  const [catId, setCatId] = useState(existing?.category_id ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ name, limit_amount: parseFloat(limit) || 0, color, icon, category_id: catId || null });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div className="modal-handle" />
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{existing ? 'Edit Budget' : 'Add Budget'}</h2>
      <div className="field"><label>Name *</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div className="field"><label>Monthly limit *</label>
        <input className="input" type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} required />
      </div>
      <div className="field"><label>Category</label>
        <select className="input" value={catId} onChange={(e) => setCatId(e.target.value)}>
          <option value="">— none —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>
      <div className="field"><label>Icon</label>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {ICONS.map((ic) => (
            <button key={ic} type="button"
              style={{ fontSize: 20, padding: '4px 8px', borderRadius: 'var(--r-sm)', border: ic === icon ? '2px solid var(--accent)' : '2px solid var(--border)', background: 'var(--bg-3)', cursor: 'pointer' }}
              onClick={() => setIcon(ic)}
            >{ic}</button>
          ))}
        </div>
      </div>
      <div className="field"><label>Color</label>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {COLORS.map((c) => (
            <button key={c} type="button"
              style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: c === color ? '3px solid var(--text)' : '2px solid transparent', cursor: 'pointer' }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'space-between' }}>
        {onDelete && <button type="button" className="btn btn--danger btn--sm" onClick={onDelete}>Delete</button>}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginLeft: 'auto' }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </form>
  );
}
