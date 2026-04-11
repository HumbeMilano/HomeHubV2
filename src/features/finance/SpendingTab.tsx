import { useFinanceStore } from '../../store/financeStore';
import { fmt } from '../../lib/utils';

export default function SpendingTab() {
  const { workMonth, workYear, getMonthBalance, getBillsForMonth, getIncomeForMonth, categories } = useFinanceStore();
  const monthBills = getBillsForMonth(workMonth, workYear);
  const monthIncome = getIncomeForMonth(workMonth, workYear);
  const balance = getMonthBalance(workMonth, workYear);

  // Group bills by category
  const byCategory = monthBills.reduce<Record<string, { name: string; icon: string; total: number }>>((acc, bill) => {
    const cat = categories.find((c) => c.id === bill.category_id);
    const key = cat?.id ?? 'uncategorized';
    if (!acc[key]) {
      acc[key] = { name: cat?.name ?? 'Uncategorized', icon: cat?.icon ?? '📋', total: 0 };
    }
    acc[key].total += bill.base_amount;
    return acc;
  }, {});

  const totalBills = monthBills.reduce((s, b) => s + b.base_amount, 0);
  const totalIncome = monthIncome.reduce((s, i) => s + i.amount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* Balance overview */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 'var(--sp-5)' }}>
        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--sp-4)', color: 'var(--text-2)' }}>MONTH OVERVIEW</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {[
            { label: 'Total Income', value: totalIncome, color: 'var(--success)', sign: '+' },
            { label: 'Total Bills', value: totalBills, color: 'var(--danger)', sign: '-' },
            { label: 'Net Balance', value: balance, color: balance >= 0 ? 'var(--success)' : 'var(--danger)', sign: '' },
          ].map((row) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--sp-2)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>{row.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: row.color }}>
                {row.sign}{fmt(Math.abs(row.value))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Spending by category */}
      {Object.keys(byCategory).length > 0 && (
        <div>
          <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--sp-3)', color: 'var(--text-2)' }}>SPENDING BY CATEGORY</h3>
          {Object.values(byCategory).sort((a, b) => b.total - a.total).map((cat) => {
            const pct = totalBills > 0 ? (cat.total / totalBills) * 100 : 0;
            return (
              <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                <span style={{ fontSize: 20 }}>{cat.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 'var(--text-sm)' }}>{cat.name}</span>
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>
                      {fmt(cat.total)} ({Math.round(pct)}%)
                    </span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
