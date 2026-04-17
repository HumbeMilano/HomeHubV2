import { useState } from 'react';
import { CreditCard, PiggyBank, Banknote, Plus, Pencil, Trash2 } from 'lucide-react';
import type { FinAccount, AccountType } from '../../types';
import { useFinanceStore } from '../../store/financeStore';
import { useMembersStore } from '../../store/membersStore';
import { fmt } from '../../lib/utils';
import ConfirmModal from '../../components/ConfirmModal';
import styles from './AccountsTab.module.css';

const ACCOUNT_ICONS: Record<AccountType, React.ReactNode> = {
  checking: <CreditCard size={20} />,
  savings:  <PiggyBank  size={20} />,
  credit:   <CreditCard size={20} />,
  cash:     <Banknote   size={20} />,
};

const ACCOUNT_LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings:  'Savings',
  credit:   'Credit',
  cash:     'Cash',
};

const ACCOUNT_COLORS: Record<AccountType, string> = {
  checking: '#60a5fa',
  savings:  '#34d399',
  credit:   '#f472b6',
  cash:     '#facc15',
};

export default function AccountsTab() {
  const { accounts, addAccount, updateAccount, deleteAccount } = useFinanceStore();
  const [modal,         setModal]         = useState<FinAccount | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FinAccount | null>(null);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <div className={styles.totalLabel}>Total Balance</div>
          <div
            className={styles.totalValue}
            style={{ color: totalBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}
          >
            {fmt(totalBalance)}
          </div>
        </div>
        <button
          className="btn btn--primary"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={() => setModal('new')}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      <div className={styles.grid}>
        {accounts.map((acc) => <AccountCard key={acc.id} acc={acc} onEdit={() => setModal(acc)} />)}
        {accounts.length === 0 && (
          <div className={styles.empty}>No accounts yet</div>
        )}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <AccountForm
              existing={modal === 'new' ? undefined : modal}
              onSave={async (data) => {
                if (modal === 'new') await addAccount(data);
                else await updateAccount(modal.id, data);
                setModal(null);
              }}
              onDelete={modal !== 'new' ? () => setConfirmDelete(modal) : undefined}
              onClose={() => setModal(null)}
            />
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmDelete !== null}
        message={`Delete "${confirmDelete?.name}"?`}
        danger
        onConfirm={async () => {
          if (confirmDelete) {
            await deleteAccount(confirmDelete.id);
            setConfirmDelete(null);
            setModal(null);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

function AccountCard({ acc, onEdit }: { acc: FinAccount; onEdit: () => void }) {
  const { members } = useMembersStore();
  const owner = members.find((m) => m.id === acc.owner_id);
  const color = ACCOUNT_COLORS[acc.type];

  return (
    <div className={styles.card} style={{ borderTop: `3px solid ${color}` }}>
      <div className={styles.cardTop}>
        <div className={styles.cardIcon} style={{ color }}>
          {ACCOUNT_ICONS[acc.type]}
        </div>
        <div className={styles.cardInfo}>
          <div className={styles.cardName}>{acc.name}</div>
          <div className={styles.cardType}>{ACCOUNT_LABELS[acc.type]}</div>
          {owner && (
            <div className={styles.cardOwner}>
              <span
                className={styles.ownerDot}
                style={{ background: owner.color }}
              />
              {owner.name}
            </div>
          )}
        </div>
        <button
          className="btn btn--ghost btn--icon"
          style={{ width: 30, height: 30, alignSelf: 'flex-start' }}
          onClick={onEdit}
        >
          <Pencil size={14} />
        </button>
      </div>
      <div
        className={styles.balance}
        style={{ color: acc.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}
      >
        {fmt(acc.balance)}
      </div>
    </div>
  );
}

function AccountForm({
  existing, onSave, onDelete, onClose,
}: {
  existing?: FinAccount;
  onSave: (data: Omit<FinAccount, 'id'>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const { members } = useMembersStore();
  const [name,    setName]    = useState(existing?.name ?? '');
  const [type,    setType]    = useState<AccountType>(existing?.type ?? 'checking');
  const [balance, setBalance] = useState(String(existing?.balance ?? '0'));
  const [ownerId, setOwnerId] = useState(existing?.owner_id ?? '');
  const [saving,  setSaving]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name:     name.trim(),
      type,
      balance:  parseFloat(balance) || 0,
      owner_id: ownerId || null,
    });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div className="modal-handle" />
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
        {existing ? 'Edit Account' : 'Add Account'}
      </h2>

      <div className="field">
        <label>Name *</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
        <div className="field">
          <label>Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {(Object.keys(ACCOUNT_LABELS) as AccountType[]).map((t) => (
              <option key={t} value={t}>{ACCOUNT_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Balance</label>
          <input className="input" type="number" step="0.01" value={balance}
            onChange={(e) => setBalance(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Owner (optional)</label>
        <select className="input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          <option value="">— shared —</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--sp-2)' }}>
        {onDelete && (
          <button type="button" className="btn btn--danger" onClick={onDelete}>
            <Trash2 size={14} style={{ marginRight: 4 }} /> Delete
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
