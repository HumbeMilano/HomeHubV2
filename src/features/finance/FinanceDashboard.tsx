import FinSummaryWidget  from '../dashboard/widgets/FinSummaryWidget';
import FinChartWidget    from '../dashboard/widgets/FinChartWidget';
import FinBillsWidget    from '../dashboard/widgets/FinBillsWidget';
import FinIncomeWidget   from '../dashboard/widgets/FinIncomeWidget';
import FinPersonsWidget  from '../dashboard/widgets/FinPersonsWidget';
import styles from './FinanceDashboard.module.css';

export default function FinanceDashboard() {
  return (
    <div className={styles.grid}>
      <div className={`${styles.card} ${styles.summary}`}>
        <FinSummaryWidget />
      </div>
      <div className={`${styles.card} ${styles.chart}`}>
        <FinChartWidget />
      </div>
      <div className={`${styles.card} ${styles.bills}`}>
        <FinBillsWidget />
      </div>
      <div className={`${styles.card} ${styles.income}`}>
        <FinIncomeWidget />
      </div>
      <div className={`${styles.card} ${styles.persons}`}>
        <FinPersonsWidget />
      </div>
    </div>
  );
}
