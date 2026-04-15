import { useEffect } from 'react';
import type { FinIncome, Member } from '../../../types';
import { useFinanceStore } from '../../../store/financeStore';
import { useMembersStore } from '../../../store/membersStore';
import { fmt } from '../../../lib/utils';
import styles from './FinIncomeWidget.module.css';

/**
 * Returns a map of memberId → income amount for the given income list.
 *
 * Rules:
 *  - Personal (is_shared=false) with person_id   → full amount to that person
 *  - Shared   (is_shared=true)  with shared_people → split equally among listed people
 *  - Shared   (is_shared=true)  with no shared_people → split equally among ALL members
 *  - Personal (is_shared=false) with no person_id  → "household" (shown as its own row)
 */
function buildPersonIncomeMap(
  income: FinIncome[],
  members: Member[],
): Record<string, number> {
  const map: Record<string, number> = {};

  for (const item of income) {
    if (!item.is_shared && item.person_id) {
      // Personal income for a specific member
      map[item.person_id] = (map[item.person_id] ?? 0) + item.amount;
    } else if (item.is_shared) {
      // Shared income — split among listed people or all members
      const recipients = item.shared_people.length > 0
        ? item.shared_people
        : members.map(m => m.id);
      if (recipients.length === 0) continue;
      const share = item.amount / recipients.length;
      for (const id of recipients) {
        map[id] = (map[id] ?? 0) + share;
      }
    }
    // Personal with no person_id = household-level, not per-person → skip here
  }

  return map;
}

export default function FinIncomeWidget() {
  const { fetchAll, workMonth, workYear, getIncomeForMonth } = useFinanceStore();
  const { members, fetchAll: fetchMembers } = useMembersStore();

  useEffect(() => { fetchAll(); fetchMembers(); }, [fetchAll, fetchMembers]);

  const income = getIncomeForMonth(workMonth, workYear);
  const total  = income.reduce((s, i) => s + i.amount, 0);

  const perPerson = buildPersonIncomeMap(income, members);

  // Build rows ordered by member list order, skip members with 0
  const rows = members
    .map(m => ({ member: m, amount: perPerson[m.id] ?? 0 }))
    .filter(r => r.amount > 0);

  // Household income (no person_id, not shared)
  const householdAmt = income
    .filter(i => !i.is_shared && !i.person_id)
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div className={styles.root}>
      <p className={styles.sectionLabel}>INGRESOS</p>

      <div className={styles.list}>
        {rows.map(({ member, amount }) => (
          <div key={member.id} className={styles.item}>
            <div className={styles.avatar} style={{ background: member.color }}>
              {member.name.slice(0, 2).toUpperCase()}
            </div>
            <div className={styles.info}>
              <div className={styles.row}>
                <span className={styles.name}>{member.name}</span>
                <span className={styles.amount}>{fmt(amount)}</span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{
                    width: total > 0 ? `${(amount / total) * 100}%` : '0%',
                    background: member.color,
                  }}
                />
              </div>
            </div>
          </div>
        ))}

        {householdAmt > 0 && (
          <div className={styles.item}>
            <div className={styles.avatar} style={{ background: 'var(--bg-4)' }}>HH</div>
            <div className={styles.info}>
              <div className={styles.row}>
                <span className={styles.name}>Household</span>
                <span className={styles.amount}>{fmt(householdAmt)}</span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{
                    width: total > 0 ? `${(householdAmt / total) * 100}%` : '0%',
                    background: 'var(--text-3)',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {rows.length === 0 && householdAmt === 0 && (
          <p className={styles.empty}>Sin ingresos este mes</p>
        )}
      </div>

      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>Total</span>
        <span className={styles.totalAmt}>{fmt(total)}</span>
      </div>
    </div>
  );
}
