import { useState } from 'react';
import { format } from 'date-fns';
import type { FinIncome } from '../../types';
import { useFinanceStore } from '../../store/financeStore';
import { fmt } from '../../lib/utils';

export default function IncomeTab() {
  const { workMonth, workYear, addIncome, deleteIncome, getIncomeForMonth } = useFinanceStore();
  const [modal, setModal] = useState(false);
  const monthIncome = getIncomeForMonth(workMonth, workYear);
  const total = monthIncome.reduce((s, i) => s + i.amount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
          Total: <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>{fmt(total)}</strong>
        </span>
        <button className="btn btn--primary" onClick={() => setModal(true)}>+ Add income</button>
      </div>

      {monthIncome.map((i) => (
        <div key={i.id} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
          padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg-2)',
          border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{i.description}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
              {format(new Date(i.date), 'MMM d')} · {i.type}
              {i.is_shared && ' · shared'}
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--success)' }}>
            +{fmt(i.amount)}
          </span>
          <button
            className="btn btn--ghost btn--sm"
            style={{ color: 'var(--danger)' }}
            onClick={() => deleteIncome(i.id)}
          >✕</button>
        </div>
      ))}

      {monthIncome.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', paddingTop: 60, fontSize: 'var(--text-sm)' }}>
          No income recorded this month.
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <IncomeForm
              workMonth={workMonth}
              workYear={workYear}
              onSave={async (data) => { await addIncome(data); setModal(false); }}
              onClose={() => setModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function IncomeForm({
  workMonth, workYear, onSave, onClose,
}: {
  workMonth: number;
  workYear: number;
  onSave: (data: Omit<FinIncome, 'id' | 'created_at'>) => Promise<void>;
  onClose: () => void;
}) {
  const defaultDate = format(new Date(workYear, workMonth - 1, 15), 'yyyy-MM-dd');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [type, setType] = useState('salary');
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      description, amount: parseFloat(amount) || 0,
      date: new Date(date).toISOString(), type, is_shared: isShared,
      person_id: null, shared_people: [], account_id: null,
    });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div className="modal-handle" />
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Add Income</h2>
      <div className="field"><label>Description *</label>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} required autoFocus />
      </div>
      <div className="field"><label>Amount *</label>
        <input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </div>
      <div className="field"><label>Date</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field"><label>Type</label>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {['salary','freelance','bonus','investment','other'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <label style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', cursor: 'pointer' }}>
        <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
        <span style={{ fontSize: 'var(--text-sm)' }}>Shared income (split equally)</span>
      </label>
      <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Add'}</button>
      </div>
    </form>
  );
}
