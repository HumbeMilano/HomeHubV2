import { useEffect, useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { useFinanceStore } from '../../store/financeStore';
import { fmt } from '../../lib/utils';
import BillsTab from './BillsTab';
import IncomeTab from './IncomeTab';
import BudgetsTab from './BudgetsTab';
import SpendingTab from './SpendingTab';
import styles from './FinancePage.module.css';

type FinTab = 'bills' | 'income' | 'budgets' | 'spending';

export default function FinancePage() {
  const { fetchAll, workMonth, workYear, setWorkMonth, getMonthBalance, getBillsForMonth, getIncomeForMonth } = useFinanceStore();
  const [tab, setTab] = useState<FinTab>('bills');

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const balance = getMonthBalance(workMonth, workYear);
  const totalIncome = getIncomeForMonth(workMonth, workYear).reduce((s, i) => s + i.amount, 0);
  const totalBills = getBillsForMonth(workMonth, workYear).reduce((s, b) => s + b.base_amount, 0);

  function navigate(dir: -1 | 1) {
    const d = new Date(workYear, workMonth - 1, 1);
    const next = dir === 1 ? addMonths(d, 1) : subMonths(d, 1);
    setWorkMonth(next.getMonth() + 1, next.getFullYear());
  }

  const TABS: { id: FinTab; label: string }[] = [
    { id: 'bills', label: 'Bills' },
    { id: 'income', label: 'Income' },
    { id: 'budgets', label: 'Budgets' },
    { id: 'spending', label: 'Spending' },
  ];

  return (
    <div className={styles.root}>
      {/* Month navigator */}
      <div className={styles.monthNav}>
        <button className="btn btn--ghost btn--icon" onClick={() => navigate(-1)}>‹</button>
        <h2 className={styles.monthTitle}>
          {format(new Date(workYear, workMonth - 1, 1), 'MMMM yyyy')}
        </h2>
        <button className="btn btn--ghost btn--icon" onClick={() => navigate(1)}>›</button>
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
          <span className={styles.summaryLabel}>Bills</span>
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

      {/* Tabs */}
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
        {tab === 'bills'    && <BillsTab />}
        {tab === 'income'   && <IncomeTab />}
        {tab === 'budgets'  && <BudgetsTab />}
        {tab === 'spending' && <SpendingTab />}
      </div>
    </div>
  );
}
