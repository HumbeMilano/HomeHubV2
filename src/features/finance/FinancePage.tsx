import { useEffect, useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFinanceStore } from '../../store/financeStore';
import { useMembersStore } from '../../store/membersStore';
import { fmt } from '../../lib/utils';
import BillsTab        from './BillsTab';
import IncomeTab       from './IncomeTab';
import AccountsTab     from './AccountsTab';
import BudgetsTab      from './BudgetsTab';
import ReportTab       from './ReportTab';
import FinanceDashboard from './FinanceDashboard';
import styles from './FinancePage.module.css';

type FinTab = 'dashboard' | 'bills' | 'income' | 'accounts' | 'budgets' | 'report';

const TABS: { id: FinTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'bills',     label: 'Bills' },
  { id: 'income',    label: 'Income' },
  { id: 'accounts',  label: 'Accounts' },
  { id: 'budgets',   label: 'Budgets' },
  { id: 'report',    label: 'Report' },
];

export default function FinancePage() {
  const {
    fetchAll, workMonth, workYear, setWorkMonth,
    getBillsForMonth, getIncomeForMonth, getEffectiveAmount, getPaidCount,
  } = useFinanceStore();
  const { fetchAll: fetchMembers } = useMembersStore();
  const [tab, setTab] = useState<FinTab>('dashboard');

  useEffect(() => {
    fetchAll();
    fetchMembers();
  }, [fetchAll, fetchMembers]);

  const monthBills  = getBillsForMonth(workMonth, workYear);
  const monthIncome = getIncomeForMonth(workMonth, workYear);
  const totalIncome = monthIncome.reduce((s, i) => s + i.amount, 0);
  const totalBills  = monthBills.reduce((s, b) => s + getEffectiveAmount(b, workYear, workMonth), 0);
  const balance     = totalIncome - totalBills;
  const paidCount   = getPaidCount(workMonth, workYear);
  const totalCount  = monthBills.length;
  const paidPct     = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

  function navigate(dir: -1 | 1) {
    const d    = new Date(workYear, workMonth - 1, 1);
    const next = dir === 1 ? addMonths(d, 1) : subMonths(d, 1);
    setWorkMonth(next.getMonth() + 1, next.getFullYear());
  }

  return (
    <div className={styles.root}>
      {/* Month navigator */}
      <div className={styles.monthNav}>
        <button className="btn btn--ghost btn--icon" onClick={() => navigate(-1)}>
          <ChevronLeft size={18} />
        </button>
        <h2 className={styles.monthTitle}>
          {format(new Date(workYear, workMonth - 1, 1), 'MMMM yyyy')}
        </h2>
        <button className="btn btn--ghost btn--icon" onClick={() => navigate(1)}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Summary cards */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Income</span>
          <span className={styles.summaryValue} style={{ color: 'var(--success)' }}>
            {fmt(totalIncome)}
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Expenses</span>
          <span className={styles.summaryValue} style={{ color: 'var(--danger)' }}>
            {fmt(totalBills)}
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Balance</span>
          <span className={styles.summaryValue} style={{ color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {fmt(balance)}
          </span>
        </div>
      </div>

      {/* Bills progress bar */}
      {totalCount > 0 && (
        <div className={styles.progressRow}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${paidPct}%`,
                background: paidPct === 100 ? 'var(--success)' : 'var(--accent)',
              }}
            />
          </div>
          <span className={styles.progressLabel}>
            {paidCount}/{totalCount} paid
          </span>
        </div>
      )}

      {/* iOS segmented control tabs */}
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={styles.content}>
        {tab === 'dashboard' && <FinanceDashboard />}
        {tab === 'bills'     && <BillsTab />}
        {tab === 'income'    && <IncomeTab />}
        {tab === 'accounts'  && <AccountsTab />}
        {tab === 'budgets'   && <BudgetsTab />}
        {tab === 'report'    && <ReportTab />}
      </div>
    </div>
  );
}
