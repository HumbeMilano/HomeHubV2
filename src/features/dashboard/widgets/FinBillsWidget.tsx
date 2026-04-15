import { useEffect } from 'react';
import { useFinanceStore } from '../../../store/financeStore';
import { fmt } from '../../../lib/utils';
import styles from './FinBillsWidget.module.css';

export default function FinBillsWidget() {
  const {
    fetchAll,
    workMonth, workYear,
    getBillsForMonth, getEffectiveAmount, getBillStatus,
  } = useFinanceStore();

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const bills = getBillsForMonth(workMonth, workYear);

  return (
    <div className={styles.root}>
      <p className={styles.sectionLabel}>TODOS LOS BILLS</p>
      <div className={styles.list}>
        {bills.map(bill => {
          const status  = getBillStatus(bill.id, workMonth, workYear);
          const amount  = getEffectiveAmount(bill, workYear, workMonth);
          const isPaid  = status === 'paid';
          const dotCls  = isPaid
            ? styles.dotPaid
            : status === 'pending'
              ? styles.dotPending
              : styles.dotNone;
          return (
            <div key={bill.id} className={styles.item}>
              <span className={`${styles.dot} ${dotCls}`} />
              <span className={`${styles.name} ${isPaid ? styles.namePaid : ''}`}>
                {bill.name}
              </span>
              <span className={styles.amount}>{fmt(amount)}</span>
            </div>
          );
        })}
        {bills.length === 0 && (
          <p className={styles.empty}>No hay bills este mes</p>
        )}
      </div>
    </div>
  );
}
