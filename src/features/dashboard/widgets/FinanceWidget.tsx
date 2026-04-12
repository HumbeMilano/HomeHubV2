import { useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { useFinanceStore } from '../../../store/financeStore';
import { fmt } from '../../../lib/utils';
import styles from './FinanceWidget.module.css';

export default function FinanceWidget() {
  const { fetchAll, getIncomeForMonth, getBillsForMonth } = useFinanceStore();

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const now   = new Date();
  const m     = now.getMonth() + 1;
  const y     = now.getFullYear();
  const bills  = getBillsForMonth(m, y);
  const income = getIncomeForMonth(m, y);

  const totalIncome   = income.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = bills.reduce((s, b) => s + b.base_amount, 0);
  const balance       = totalIncome - totalExpenses;

  return (
    <div className={styles.root}>
      <h3 className={styles.title}><Wallet size={14} /> Finance</h3>
      <div className={styles.row}>
        <span className={styles.label}>Income</span>
        <span className={styles.income}>{fmt(totalIncome)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Expenses</span>
        <span className={styles.expense}>{fmt(totalExpenses)}</span>
      </div>
      <div className={styles.divider} />
      <div className={styles.row}>
        <span className={styles.label}>Balance</span>
        <span className={balance >= 0 ? styles.income : styles.expense}>
          {fmt(balance)}
        </span>
      </div>
    </div>
  );
}
