import { useEffect } from 'react';
import type { FinIncome, Member } from '../../../types';
import { useFinanceStore } from '../../../store/financeStore';
import { useMembersStore } from '../../../store/membersStore';
import { fmt } from '../../../lib/utils';
import styles from './FinPersonsWidget.module.css';

function buildPersonIncomeMap(
  income: FinIncome[],
  members: Member[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of income) {
    if (!item.is_shared && item.person_id) {
      map[item.person_id] = (map[item.person_id] ?? 0) + item.amount;
    } else if (item.is_shared) {
      const recipients = item.shared_people.length > 0
        ? item.shared_people
        : members.map(m => m.id);
      if (recipients.length === 0) continue;
      const share = item.amount / recipients.length;
      for (const id of recipients) {
        map[id] = (map[id] ?? 0) + share;
      }
    }
  }
  return map;
}

export default function FinPersonsWidget() {
  const {
    fetchAll,
    workMonth, workYear,
    getBillsForMonth, getEffectiveAmount, getBillStatus,
    getIncomeForMonth, getPersonBillShare,
  } = useFinanceStore();
  const { members, fetchAll: fetchMembers } = useMembersStore();

  useEffect(() => { fetchAll(); fetchMembers(); }, [fetchAll, fetchMembers]);

  const bills     = getBillsForMonth(workMonth, workYear);
  const income    = getIncomeForMonth(workMonth, workYear);
  const incomeMap = buildPersonIncomeMap(income, members);

  const personData = members.map(member => {
    const memberIncome = incomeMap[member.id] ?? 0;
    let paid    = 0;
    let pending = 0;

    for (const bill of bills) {
      if (!bill.splits || bill.splits.length === 0) continue; // no splits → not assigned to individuals
      const effectiveAmt = getEffectiveAmount(bill, workYear, workMonth);
      const share  = getPersonBillShare(bill, member.id, effectiveAmt);
      if (share === 0) continue;
      const status = getBillStatus(bill.id, workMonth, workYear);
      if (status === 'paid') paid += share;
      else pending += share;
    }

    const total   = paid + pending;
    const balance = memberIncome - total;
    const paidPct = total > 0 ? (paid / total) * 100 : 0;

    return { member, memberIncome, paid, pending, balance, paidPct };
  });

  if (members.length === 0) {
    return (
      <div className={styles.root}>
        <p className={styles.sectionLabel}>POR PERSONA</p>
        <p className={styles.empty}>Sin miembros</p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <p className={styles.sectionLabel}>POR PERSONA</p>
      <div className={styles.cards}>
        {personData.map(({ member, memberIncome, paid, pending, balance, paidPct }) => (
          <div key={member.id} className={styles.card}>
            <div className={styles.cardTop}>
              <div className={styles.avatar} style={{ background: member.color }}>
                {member.name.slice(0, 2).toUpperCase()}
              </div>
              <span className={styles.memberName}>{member.name}</span>
              <div className={styles.balanceBlock}>
                <span className={styles.balanceLabel}>balance</span>
                <span className={balance >= 0 ? styles.balancePos : styles.balanceNeg}>
                  {fmt(balance)}
                </span>
              </div>
            </div>

            <div className={styles.barTrack}>
              <div className={styles.barPaid}    style={{ width: `${paidPct}%` }} />
              <div className={styles.barPending} style={{ width: `${100 - paidPct}%` }} />
            </div>

            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>PAGADO</span>
                <span className={styles.statPaid}>{fmt(paid)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>PENDIENTE</span>
                <span className={styles.statPending}>{fmt(pending)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>INGRESOS</span>
                <span className={styles.statIncome}>{fmt(memberIncome)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
