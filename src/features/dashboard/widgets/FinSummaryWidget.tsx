import { useEffect } from 'react';
import { useFinanceStore } from '../../../store/financeStore';
import { fmt } from '../../../lib/utils';
import styles from './FinSummaryWidget.module.css';

export default function FinSummaryWidget() {
  const {
    fetchAll,
    workMonth, workYear,
    getBillsForMonth, getIncomeForMonth, getEffectiveAmount, getBillStatus,
  } = useFinanceStore();

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const bills  = getBillsForMonth(workMonth, workYear);
  const income = getIncomeForMonth(workMonth, workYear);

  const totalIncome   = income.reduce((s, i) => s + i.amount, 0);
  const totalSpending = bills.reduce((s, b) => s + getEffectiveAmount(b, workYear, workMonth), 0);
  const balance       = totalIncome - totalSpending;

  const paidAmount = bills
    .filter(b => getBillStatus(b.id, workMonth, workYear) === 'paid')
    .reduce((s, b) => s + getEffectiveAmount(b, workYear, workMonth), 0);
  const paidPct = totalSpending > 0 ? (paidAmount / totalSpending) * 100 : 0;

  return (
    <div className={styles.root}>
      <p className={styles.sectionLabel}>RESUMEN DEL MES</p>

      <div className={styles.row}>
        <span className={styles.label}>Spending</span>
        <span className={styles.danger}>{fmt(totalSpending)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Ingresos</span>
        <span className={styles.success}>{fmt(totalIncome)}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Balance</span>
        <span className={balance >= 0 ? styles.success : styles.danger}>{fmt(balance)}</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.progressHeader}>
        <span className={styles.progressLabel}>Pagado {Math.round(paidPct)}%</span>
        <span className={styles.progressAmt}>{fmt(paidAmount)} / {fmt(totalSpending)}</span>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressPaid}    style={{ width: `${paidPct}%` }} />
        <div className={styles.progressPending} style={{ width: `${100 - paidPct}%` }} />
      </div>
      <div className={styles.legend}>
        <span className={styles.legendPaid}>● Pagado</span>
        <span className={styles.legendPending}>● Pendiente</span>
      </div>
    </div>
  );
}
