import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useFinanceStore } from '../../../store/financeStore';
import { useMembersStore } from '../../../store/membersStore';
import type { FinBill, Member, FinCategory } from '../../../types';
import { fmt } from '../../../lib/utils';
import styles from './FinChartWidget.module.css';

const COLORS = ['#0A84FF', '#30D158', '#FF9F0A', '#FF453A', '#BF5AF2', '#64D2FF', '#FF375F', '#FFD60A'];

type View = 'category' | 'person';

interface ChartEntry { name: string; value: number; }

function buildCategoryData(
  bills: FinBill[],
  categories: FinCategory[],
  year: number,
  month: number,
  getEff: (b: FinBill, y: number, m: number) => number,
): ChartEntry[] {
  const map: Record<string, ChartEntry> = {};
  for (const bill of bills) {
    const cat = categories.find(c => c.id === bill.category_id);
    const key = cat?.name ?? 'Other';
    if (!map[key]) map[key] = { name: key, value: 0 };
    map[key].value += getEff(bill, year, month);
  }
  return Object.values(map).sort((a, b) => b.value - a.value);
}

function buildPersonData(
  bills: FinBill[],
  members: Member[],
  year: number,
  month: number,
  getEff: (b: FinBill, y: number, m: number) => number,
  getShare: (bill: FinBill, personId: string, effectiveAmt: number) => number,
): ChartEntry[] {
  const map: Record<string, ChartEntry> = {};
  for (const mem of members) map[mem.id] = { name: mem.name, value: 0 };

  for (const bill of bills) {
    if (!bill.splits || bill.splits.length === 0) continue; // unassigned bills skipped
    const amt = getEff(bill, year, month);
    for (const mem of members) {
      const share = getShare(bill, mem.id, amt);
      if (share > 0) map[mem.id].value += share;
    }
  }

  return Object.values(map)
    .filter(e => e.value > 0)
    .sort((a, b) => b.value - a.value);
}

export default function FinChartWidget() {
  const {
    fetchAll,
    workMonth, workYear,
    getBillsForMonth, getEffectiveAmount, getPersonBillShare, categories,
  } = useFinanceStore();
  const { members, fetchAll: fetchMembers } = useMembersStore();
  const [view, setView] = useState<View>('category');

  useEffect(() => { fetchAll(); fetchMembers(); }, [fetchAll, fetchMembers]);

  const bills = getBillsForMonth(workMonth, workYear);
  const total = bills.reduce((s, b) => s + getEffectiveAmount(b, workYear, workMonth), 0);

  const data = view === 'category'
    ? buildCategoryData(bills, categories, workYear, workMonth, getEffectiveAmount)
    : buildPersonData(bills, members, workYear, workMonth, getEffectiveAmount, getPersonBillShare);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.sectionLabel}>SPENDING</span>
        <div className={styles.toggle}>
          <button
            className={`${styles.toggleBtn} ${view === 'category' ? styles.active : ''}`}
            onClick={() => setView('category')}
          >Categoría</button>
          <button
            className={`${styles.toggleBtn} ${view === 'person' ? styles.active : ''}`}
            onClick={() => setView('person')}
          >Persona</button>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.donutWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                dataKey="value"
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--bg-2)', border: 'none', borderRadius: 8, fontSize: 13 }}
                formatter={(v) => [fmt(v as number), '']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.center}>
            <span className={styles.centerLabel}>TOTAL</span>
            <span className={styles.centerAmt}>{fmt(total)}</span>
          </div>
        </div>

        <div className={styles.legend}>
          {data.map((d, i) => (
            <div key={d.name} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: COLORS[i % COLORS.length] }} />
              <span className={styles.legendName}>{d.name}</span>
              <span className={styles.legendPct}>{fmt(d.value)}</span>
            </div>
          ))}
          {data.length === 0 && <p className={styles.empty}>Sin datos</p>}
        </div>
      </div>
    </div>
  );
}
