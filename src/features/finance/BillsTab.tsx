import { useState } from 'react';
import type { FinBill, BillType } from '../../types';
import { useFinanceStore } from '../../store/financeStore';
import { fmt } from '../../lib/utils';

export default function BillsTab() {
  const { bills, workMonth, workYear, addBill, updateBill, deleteBill, setBillStatus, getBillStatus } = useFinanceStore();
  const [modal, setModal] = useState<FinBill | 'new' | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn--primary" onClick={() => setModal('new')}>+ Add bill</button>
      </div>

      {bills.map((bill) => {
        const status = getBillStatus(bill.id, workMonth, workYear);
        const isPaid = status === 'paid';
        return (
          <div key={bill.id} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
            padding: 'var(--sp-3) var(--sp-4)', background: 'var(--bg-2)',
            border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
            opacity: isPaid ? .6 : 1,
          }}>
            <button
              style={{
                width: 22, height: 22, borderRadius: '50%',
                border: `2px solid ${isPaid ? 'var(--success)' : 'var(--border)'}`,
                background: isPaid ? 'var(--success)' : 'transparent',
                color: '#fff', fontSize: 11, cursor: 'pointer',
              }}
              onClick={() => setBillStatus(bill.id, isPaid ? 'pending' : 'paid')}
            >
              {isPaid ? '✓' : ''}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{bill.name}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                {bill.type} · due day {bill.due_day ?? '—'}
              </div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              {fmt(bill.base_amount)}
            </span>
            <button className="btn btn--ghost btn--sm" onClick={() => setModal(bill)}>Edit</button>
            <button
              className="btn btn--ghost btn--sm"
              style={{ color: 'var(--danger)' }}
              onClick={() => { if (confirm(`Delete "${bill.name}"?`)) deleteBill(bill.id); }}
            >✕</button>
          </div>
        );
      })}

      {bills.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', paddingTop: 60, fontSize: 'var(--text-sm)' }}>
          No bills yet.
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <BillForm
              existing={modal === 'new' ? undefined : modal}
              onSave={async (data) => {
                if (modal === 'new') await addBill(data);
                else await updateBill(modal.id, data);
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

function BillForm({
  existing, onSave, onClose,
}: {
  existing?: FinBill;
  onSave: (data: Omit<FinBill, 'id' | 'created_at'>) => Promise<void>;
  onClose: () => void;
}) {
  const { categories, accounts } = useFinanceStore();
  const [name, setName] = useState(existing?.name ?? '');
  const [amount, setAmount] = useState(String(existing?.base_amount ?? ''));
  const [type, setType] = useState<BillType>(existing?.type ?? 'fixed');
  const [dueDay, setDueDay] = useState(String(existing?.due_day ?? ''));
  const [catId, setCatId] = useState(existing?.category_id ?? '');
  const [accId, setAccId] = useState(existing?.account_id ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name, base_amount: parseFloat(amount) || 0,
      type, category_id: catId || null, account_id: accId || null,
      due_day: parseInt(dueDay) || null, auto_pay: false, splits: [],
    });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div className="modal-handle" />
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{existing ? 'Edit Bill' : 'Add Bill'}</h2>
      <div className="field"><label>Name *</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div className="field"><label>Amount *</label>
        <input className="input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
        <div className="field"><label>Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as BillType)}>
            <option value="fixed">Fixed</option>
            <option value="variable">Variable</option>
          </select>
        </div>
        <div className="field"><label>Due day</label>
          <input className="input" type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="e.g. 15" />
        </div>
      </div>
      <div className="field"><label>Category</label>
        <select className="input" value={catId} onChange={(e) => setCatId(e.target.value)}>
          <option value="">— none —</option>
          {categories.filter((c) => c.type !== 'income').map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
      </div>
      <div className="field"><label>Account</label>
        <select className="input" value={accId} onChange={(e) => setAccId(e.target.value)}>
          <option value="">— none —</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}
