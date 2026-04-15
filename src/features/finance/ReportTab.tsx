import { useState, useMemo } from 'react';
import { format, subMonths, parseISO } from 'date-fns';
import { Download, ChevronDown, ChevronUp } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useFinanceStore } from '../../store/financeStore';
import { useMembersStore } from '../../store/membersStore';
import { fmt, monthKey } from '../../lib/utils';
import styles from './ReportTab.module.css';

type Range  = 'current' | 'prev' | '3m' | '6m';
type Mode   = 'category' | 'person' | 'account';

const RANGE_LABELS: Record<Range,  string> = {
  current: 'Current month',
  prev:    'Previous month',
  '3m':    'Last 3 months',
  '6m':    'Last 6 months',
};
const MODE_LABELS: Record<Mode, string> = {
  category: 'By category',
  person:   'By person',
  account:  'By account',
};

const CHART_COLORS = [
  '#818cf8','#34d399','#fb923c','#f472b6','#4ade80',
  '#facc15','#60a5fa','#f87171','#a78bfa','#2dd4bf',
];

export default function ReportTab() {
  const {
    workMonth, workYear,
    bills, income, overrides, accounts, categories,
    getEffectiveAmount, getBillStatus, getPersonBillShare,
  } = useFinanceStore();
  const { members } = useMembersStore();

  const [range,    setRange]    = useState<Range>('current');
  const [mode,     setMode]     = useState<Mode>('category');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Build list of months in range
  const months = useMemo(() => {
    const ref = new Date(workYear, workMonth - 1, 1);
    const count = range === 'current' ? 1 : range === 'prev' ? 1 : range === '3m' ? 3 : 6;
    const offset = range === 'prev' ? 1 : 0;
    return Array.from({ length: count }, (_, i) => {
      const d = subMonths(ref, offset + (count - 1 - i));
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  }, [range, workMonth, workYear]);

  // Bills in range (with effective amounts)
  const rangeMonthKeys = useMemo(
    () => new Set(months.map((m) => monthKey(m.year, m.month))),
    [months]
  );

  const rangeBills = useMemo(() => {
    return bills.flatMap((bill) =>
      months
        .filter((m) => {
          // check not hidden
          const mk = monthKey(m.year, m.month);
          const ov = overrides.find((o) => o.bill_id === bill.id && o.month_key === mk);
          return !ov?.hidden;
        })
        .map((m) => ({
          bill,
          month: m,
          mk: monthKey(m.year, m.month),
          amount: getEffectiveAmount(bill, m.year, m.month),
          status: getBillStatus(bill.id, m.month, m.year),
        }))
    );
  }, [bills, months, overrides, getEffectiveAmount, getBillStatus]);

  const rangeIncome = useMemo(() => {
    return income.filter((i) => {
      const d = parseISO(i.date);
      return rangeMonthKeys.has(monthKey(d.getFullYear(), d.getMonth() + 1));
    });
  }, [income, rangeMonthKeys]);

  const totalBills  = rangeBills.reduce((s, rb) => s + rb.amount, 0);
  const totalIncome = rangeIncome.reduce((s, i) => s + i.amount, 0);
  const balance     = totalIncome - totalBills;
  const paidCount   = rangeBills.filter((rb) => rb.status === 'paid').length;
  const paidPct     = rangeBills.length > 0 ? Math.round((paidCount / rangeBills.length) * 100) : 0;

  // Build pie chart data
  const pieData = useMemo(() => {
    if (mode === 'category') {
      const map = new Map<string, number>();
      rangeBills.forEach((rb) => {
        const key = rb.bill.category_id
          ? (categories.find((c) => c.id === rb.bill.category_id)?.name ?? 'Uncategorized')
          : 'Uncategorized';
        map.set(key, (map.get(key) ?? 0) + rb.amount);
      });
      return Array.from(map.entries()).map(([name, value], i) => ({
        name, value, color: CHART_COLORS[i % CHART_COLORS.length],
      }));
    }
    if (mode === 'person') {
      const map = new Map<string, number>();
      rangeBills.forEach((rb) => {
        if (!rb.bill.splits || rb.bill.splits.length === 0) {
          map.set('Sin asignar', (map.get('Sin asignar') ?? 0) + rb.amount);
          return;
        }
        members.forEach((member) => {
          const share = getPersonBillShare(rb.bill, member.id, rb.amount);
          if (share > 0) map.set(member.name, (map.get(member.name) ?? 0) + share);
        });
      });
      return Array.from(map.entries()).map(([name, value], i) => ({
        name, value, color: members.find((m) => m.name === name)?.color ?? CHART_COLORS[i % CHART_COLORS.length],
      }));
    }
    // account
    const map = new Map<string, number>();
    rangeBills.forEach((rb) => {
      const acc = accounts.find((a) => a.id === rb.bill.account_id);
      const key = acc?.name ?? 'No account';
      map.set(key, (map.get(key) ?? 0) + rb.amount);
    });
    return Array.from(map.entries()).map(([name, value], i) => ({
      name, value, color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [mode, rangeBills, categories, members, accounts]);

  // Per-person summary
  const personSummary = useMemo(() => {
    return members.map((member) => {
      const memberIncome = rangeIncome
        .filter((i) => i.person_id === member.id || i.shared_people.includes(member.id))
        .reduce((s, i) => {
          if (i.person_id === member.id && !i.is_shared) return s + i.amount;
          if (i.is_shared && i.shared_people.includes(member.id)) {
            return s + i.amount / (i.shared_people.length || 1);
          }
          return s;
        }, 0);

      let memberBills   = 0;
      let memberPaid    = 0;
      let memberPending = 0;
      rangeBills.forEach((rb) => {
        if (!rb.bill.splits || rb.bill.splits.length === 0) return;
        const share = getPersonBillShare(rb.bill, member.id, rb.amount);
        if (share === 0) return;
        memberBills += share;
        if (rb.status === 'paid') memberPaid += share;
        else memberPending += share;
      });

      return { member, income: memberIncome, bills: memberBills, paid: memberPaid, pending: memberPending };
    }).filter((p) => p.income > 0 || p.bills > 0);
  }, [members, rangeIncome, rangeBills]);

  // CSV export
  function exportCSV() {
    const header = ['Type', 'Description', 'Amount', 'Month', 'Category', 'Status', 'Person/Account'];
    const billRows = rangeBills.map((rb) => [
      'Bill',
      rb.bill.name,
      rb.amount.toFixed(2),
      format(new Date(rb.month.year, rb.month.month - 1, 1), 'MMM yyyy'),
      categories.find((c) => c.id === rb.bill.category_id)?.name ?? '—',
      rb.status === 'paid' ? 'Paid' : 'Pending',
      accounts.find((a) => a.id === rb.bill.account_id)?.name ?? '—',
    ]);
    const incomeRows = rangeIncome.map((i) => [
      'Income',
      i.description,
      i.amount.toFixed(2),
      format(parseISO(i.date), 'MMM yyyy'),
      '—',
      '—',
      members.find((m) => m.id === i.person_id)?.name ?? (i.is_shared ? 'Shared' : '—'),
    ]);
    const rows = [header, ...billRows, ...incomeRows];
    const csv  = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const bom  = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `finances-${range}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.root}>
      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
            <button
              key={r}
              className={`${styles.chip} ${range === r ? styles.chipActive : ''}`}
              onClick={() => setRange(r)}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        <div className={styles.controlGroup}>
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <button
              key={m}
              className={`${styles.chip} ${mode === m ? styles.chipActive : ''}`}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <button className="btn btn--ghost" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={exportCSV}>
          <Download size={14} /> CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Total Expenses</div>
          <div className={styles.summaryValue} style={{ color: 'var(--danger)' }}>{fmt(totalBills)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Income</div>
          <div className={styles.summaryValue} style={{ color: 'var(--success)' }}>{fmt(totalIncome)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Balance</div>
          <div className={styles.summaryValue} style={{ color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(balance)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>% Paid</div>
          <div className={styles.summaryValue} style={{ color: 'var(--accent)' }}>{paidPct}%</div>
        </div>
      </div>

      {/* Donut chart */}
      {pieData.length > 0 && (
        <div className={styles.chartCard}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%" cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => [fmt(v as number), '']}
                contentStyle={{
                  background: 'var(--bg-2)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  fontSize: 13,
                  color: 'var(--text)',
                }}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-person cards (mode = person) */}
      {mode === 'person' && personSummary.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Breakdown by Person</div>
          <div className={styles.personGrid}>
            {personSummary.map(({ member, income: inc, paid, pending }) => {
              const isExp = expanded === member.id;
              return (
                <div key={member.id} className={styles.personCard}>
                  <button
                    className={styles.personHeader}
                    onClick={() => setExpanded(isExp ? null : member.id)}
                  >
                    <span
                      className={styles.personAvatar}
                      style={{ background: member.color }}
                    >
                      {member.name.charAt(0)}
                    </span>
                    <span className={styles.personName}>{member.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                      Balance: <strong style={{ color: (inc - paid - pending) >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(inc - paid - pending)}</strong>
                    </span>
                    {isExp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {isExp && (
                    <div className={styles.personDetail}>
                      <div className={styles.personDetailRow}>
                        <span>Income</span>
                        <span style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>{fmt(inc)}</span>
                      </div>
                      <div className={styles.personDetailRow}>
                        <span>Paid bills</span>
                        <span style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>{fmt(paid)}</span>
                      </div>
                      <div className={styles.personDetailRow}>
                        <span>Pending bills</span>
                        <span style={{ color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>{fmt(pending)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bills list */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Bills ({rangeBills.length})</div>
        <div className={styles.itemList}>
          {rangeBills.map((rb, i) => {
            const cat = categories.find((c) => c.id === rb.bill.category_id);
            return (
              <div key={`${rb.bill.id}-${rb.mk}-${i}`} className={styles.itemRow}>
                <span
                  className={styles.statusDot}
                  style={{ background: rb.status === 'paid' ? 'var(--success)' : 'var(--border)' }}
                />
                <span className={styles.itemName}>{rb.bill.name}</span>
                {months.length > 1 && (
                  <span className={styles.itemMonth}>
                    {format(new Date(rb.month.year, rb.month.month - 1, 1), 'MMM')}
                  </span>
                )}
                {cat && <span className={styles.itemCat}>{cat.icon} {cat.name}</span>}
                <span className={styles.itemAmt}>{fmt(rb.amount)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Income list */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Income ({rangeIncome.length})</div>
        <div className={styles.itemList}>
          {rangeIncome.map((inc) => {
            const person = members.find((m) => m.id === inc.person_id);
            return (
              <div key={inc.id} className={styles.itemRow}>
                <span className={styles.statusDot} style={{ background: 'var(--success)' }} />
                <span className={styles.itemName}>{inc.description}</span>
                <span className={styles.itemMonth}>{format(parseISO(inc.date), 'MMM d')}</span>
                {person && <span className={styles.itemCat} style={{ color: person.color }}>{person.name}</span>}
                <span className={styles.itemAmt} style={{ color: 'var(--success)' }}>+{fmt(inc.amount)}</span>
              </div>
            );
          })}
          {rangeIncome.length === 0 && (
            <div className={styles.emptyList}>No income in this period</div>
          )}
        </div>
      </div>
    </div>
  );
}
