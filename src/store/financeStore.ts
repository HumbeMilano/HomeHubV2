import { create } from 'zustand';
import { subMonths } from 'date-fns';
import type {
  FinBill, FinIncome, FinBudget, FinAccount, FinCategory, FinOverride, BillStatus,
} from '../types';
import { supabase } from '../lib/supabase';
import { createBroadcastChannel } from '../lib/broadcast';
import { uid, monthKey } from '../lib/utils';

const bc = createBroadcastChannel<unknown>('finance');

interface FinanceState {
  bills:      FinBill[];
  income:     FinIncome[];
  budgets:    FinBudget[];
  accounts:   FinAccount[];
  categories: FinCategory[];
  overrides:  FinOverride[];
  workMonth:  number;   // 1–12
  workYear:   number;
  loading:    boolean;

  fetchAll:       () => Promise<void>;
  setWorkMonth:   (month: number, year: number) => void;

  // Bills
  addBill:               (data: Omit<FinBill, 'id' | 'created_at'>) => Promise<void>;
  updateBill:            (id: string, patch: Partial<FinBill>) => Promise<void>;
  deleteBill:            (id: string) => Promise<void>;
  setBillStatus:         (billId: string, status: BillStatus) => Promise<void>;
  hideFromMonth:         (billId: string, year: number, month: number) => Promise<void>;
  setBillOverrideAmount: (billId: string, year: number, month: number, amount: number) => Promise<void>;

  // Income
  addIncome:    (data: Omit<FinIncome, 'id' | 'created_at'>) => Promise<void>;
  updateIncome: (id: string, patch: Partial<FinIncome>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;

  // Budgets
  addBudget:    (data: Omit<FinBudget, 'id' | 'created_at'>) => Promise<void>;
  updateBudget: (id: string, patch: Partial<FinBudget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;

  // Accounts
  addAccount:    (data: Omit<FinAccount, 'id'>) => Promise<void>;
  updateAccount: (id: string, patch: Partial<FinAccount>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  // Categories
  addCategory:    (data: Omit<FinCategory, 'id'>) => Promise<void>;
  updateCategory: (id: string, patch: Partial<FinCategory>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Derived helpers
  getEffectiveAmount:  (bill: FinBill, year: number, month: number) => number;
  getBillsForMonth:    (month: number, year: number) => FinBill[];
  getIncomeForMonth:   (month: number, year: number) => FinIncome[];
  getMonthBalance:     (month: number, year: number) => number;
  getBudgetSpent:      (budget: FinBudget, month: number, year: number) => number;
  getBillStatus:       (billId: string, month: number, year: number) => BillStatus | null;
  getPaidCount:        (month: number, year: number) => number;
  /**
   * Returns the correct share of a bill for a specific person.
   *
   * Split math rules (mirrors BillsTab's manualPreview):
   *  - amount  → exact dollar value stored
   *  - percent → % applied to (effectiveAmt − sum of all amount splits)
   *  - equal   → (effectiveAmt − sum of all amount splits) / number of equal entries
   *
   * Returns 0 if the person has no split on this bill.
   */
  getPersonBillShare: (bill: FinBill, personId: string, effectiveAmt: number) => number;
}

const now = new Date();

export const useFinanceStore = create<FinanceState>((set, get) => ({
  bills: [], income: [], budgets: [], accounts: [], categories: [], overrides: [],
  workMonth: now.getMonth() + 1,
  workYear:  now.getFullYear(),
  loading:   false,

  // ── Fetch ─────────────────────────────────────────────────────────────────
  fetchAll: async () => {
    set({ loading: true });
    const [b, i, bu, a, c, o] = await Promise.all([
      supabase.from('fin_bills').select('*').order('name'),
      supabase.from('fin_income').select('*').order('date', { ascending: false }),
      supabase.from('fin_budgets').select('*').order('name'),
      supabase.from('fin_accounts').select('*').order('name'),
      supabase.from('fin_categories').select('*').order('name'),
      supabase.from('fin_overrides').select('*'),
    ]);
    set({
      bills:      (b.data  ?? []) as FinBill[],
      income:     (i.data  ?? []) as FinIncome[],
      budgets:    (bu.data ?? []) as FinBudget[],
      accounts:   (a.data  ?? []) as FinAccount[],
      categories: (c.data  ?? []) as FinCategory[],
      overrides:  ((o.data ?? []) as FinOverride[]).map(r => ({ ...r, hidden: r.hidden ?? false })),
      loading:    false,
    });
    // Auto-pay: mark bills paid if auto_pay=true and due_day <= today (current month only)
    const today = new Date();
    const { workMonth, workYear } = get();
    if (workMonth === today.getMonth() + 1 && workYear === today.getFullYear()) {
      get().getBillsForMonth(workMonth, workYear).forEach((bill) => {
        if (bill.auto_pay && bill.due_day && today.getDate() >= bill.due_day) {
          if (!get().getBillStatus(bill.id, workMonth, workYear)) {
            get().setBillStatus(bill.id, 'paid');
          }
        }
      });
    }
  },

  setWorkMonth: (month, year) => set({ workMonth: month, workYear: year }),

  // ── Bills ─────────────────────────────────────────────────────────────────
  addBill: async (data) => {
    const bill: FinBill = { ...data, id: uid(), created_at: new Date().toISOString() };
    set((s) => ({ bills: [...s.bills, bill] }));
    const { error } = await supabase.from('fin_bills').insert(bill);
    if (error) { await get().fetchAll(); throw error; }
    bc.post('INSERT_BILL', bill);
  },

  updateBill: async (id, patch) => {
    set((s) => ({ bills: s.bills.map((b) => b.id === id ? { ...b, ...patch } : b) }));
    await supabase.from('fin_bills').update(patch).eq('id', id);
    bc.post('UPDATE_BILL', { id, patch });
  },

  deleteBill: async (id) => {
    set((s) => ({
      bills:     s.bills.filter((b) => b.id !== id),
      overrides: s.overrides.filter((o) => o.bill_id !== id),
    }));
    await supabase.from('fin_overrides').delete().eq('bill_id', id);
    await supabase.from('fin_bills').delete().eq('id', id);
    bc.post('DELETE_BILL', { id });
  },

  setBillStatus: async (billId, status) => {
    const { workMonth, workYear } = get();
    const mk = monthKey(workYear, workMonth);
    const existing = get().overrides.find((o) => o.bill_id === billId && o.month_key === mk);
    if (existing) {
      set((s) => ({
        overrides: s.overrides.map((o) =>
          o.id === existing.id ? { ...o, status } : o
        ),
      }));
      await supabase.from('fin_overrides').update({ status }).eq('id', existing.id);
    } else {
      const row: FinOverride = {
        id: uid(), bill_id: billId, month_key: mk,
        amount: null, splits: null, status, hidden: false,
      };
      set((s) => ({ overrides: [...s.overrides, row] }));
      await supabase.from('fin_overrides').insert(row);
    }
    bc.post('SET_BILL_STATUS', { billId, status, monthKey: mk });
  },

  hideFromMonth: async (billId, year, month) => {
    const mk = monthKey(year, month);
    const existing = get().overrides.find((o) => o.bill_id === billId && o.month_key === mk);
    if (existing) {
      set((s) => ({
        overrides: s.overrides.map((o) =>
          o.id === existing.id ? { ...o, hidden: true } : o
        ),
      }));
      await supabase.from('fin_overrides').update({ hidden: true }).eq('id', existing.id);
    } else {
      const row: FinOverride = {
        id: uid(), bill_id: billId, month_key: mk,
        amount: null, splits: null, status: null, hidden: true,
      };
      set((s) => ({ overrides: [...s.overrides, row] }));
      await supabase.from('fin_overrides').insert(row);
    }
    bc.post('HIDE_BILL', { billId, monthKey: mk });
  },

  setBillOverrideAmount: async (billId, year, month, amount) => {
    const mk = monthKey(year, month);
    const existing = get().overrides.find((o) => o.bill_id === billId && o.month_key === mk);
    if (existing) {
      set((s) => ({
        overrides: s.overrides.map((o) =>
          o.id === existing.id ? { ...o, amount } : o
        ),
      }));
      await supabase.from('fin_overrides').update({ amount }).eq('id', existing.id);
    } else {
      const row: FinOverride = {
        id: uid(), bill_id: billId, month_key: mk,
        amount, splits: null, status: null, hidden: false,
      };
      set((s) => ({ overrides: [...s.overrides, row] }));
      await supabase.from('fin_overrides').insert(row);
    }
    bc.post('SET_BILL_AMOUNT', { billId, monthKey: mk, amount });
  },

  // ── Income ────────────────────────────────────────────────────────────────
  addIncome: async (data) => {
    const row: FinIncome = { ...data, id: uid(), created_at: new Date().toISOString() };
    set((s) => ({ income: [row, ...s.income] }));
    const { error } = await supabase.from('fin_income').insert(row);
    if (error) { await get().fetchAll(); throw error; }
    bc.post('INSERT_INCOME', row);
  },

  updateIncome: async (id, patch) => {
    set((s) => ({ income: s.income.map((i) => i.id === id ? { ...i, ...patch } : i) }));
    await supabase.from('fin_income').update(patch).eq('id', id);
    bc.post('UPDATE_INCOME', { id, patch });
  },

  deleteIncome: async (id) => {
    set((s) => ({ income: s.income.filter((i) => i.id !== id) }));
    await supabase.from('fin_income').delete().eq('id', id);
    bc.post('DELETE_INCOME', { id });
  },

  // ── Budgets ───────────────────────────────────────────────────────────────
  addBudget: async (data) => {
    const row: FinBudget = { ...data, id: uid(), created_at: new Date().toISOString() };
    set((s) => ({ budgets: [...s.budgets, row] }));
    const { error } = await supabase.from('fin_budgets').insert(row);
    if (error) { await get().fetchAll(); throw error; }
    bc.post('INSERT_BUDGET', row);
  },

  updateBudget: async (id, patch) => {
    set((s) => ({ budgets: s.budgets.map((b) => b.id === id ? { ...b, ...patch } : b) }));
    await supabase.from('fin_budgets').update(patch).eq('id', id);
    bc.post('UPDATE_BUDGET', { id, patch });
  },

  deleteBudget: async (id) => {
    set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) }));
    await supabase.from('fin_budgets').delete().eq('id', id);
    bc.post('DELETE_BUDGET', { id });
  },

  // ── Accounts ──────────────────────────────────────────────────────────────
  addAccount: async (data) => {
    const row: FinAccount = { ...data, id: uid() };
    set((s) => ({ accounts: [...s.accounts, row] }));
    const { error } = await supabase.from('fin_accounts').insert(row);
    if (error) { await get().fetchAll(); throw error; }
    bc.post('INSERT_ACCOUNT', row);
  },

  updateAccount: async (id, patch) => {
    set((s) => ({ accounts: s.accounts.map((a) => a.id === id ? { ...a, ...patch } : a) }));
    await supabase.from('fin_accounts').update(patch).eq('id', id);
    bc.post('UPDATE_ACCOUNT', { id, patch });
  },

  deleteAccount: async (id) => {
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
    await supabase.from('fin_accounts').delete().eq('id', id);
    bc.post('DELETE_ACCOUNT', { id });
  },

  // ── Categories ────────────────────────────────────────────────────────────
  addCategory: async (data) => {
    const row: FinCategory = { ...data, id: uid() };
    set((s) => ({ categories: [...s.categories, row] }));
    const { error } = await supabase.from('fin_categories').insert(row);
    if (error) { await get().fetchAll(); throw error; }
    bc.post('INSERT_CATEGORY', row);
  },

  updateCategory: async (id, patch) => {
    set((s) => ({ categories: s.categories.map((c) => c.id === id ? { ...c, ...patch } : c) }));
    await supabase.from('fin_categories').update(patch).eq('id', id);
    bc.post('UPDATE_CATEGORY', { id, patch });
  },

  deleteCategory: async (id) => {
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
    await supabase.from('fin_categories').delete().eq('id', id);
    bc.post('DELETE_CATEGORY', { id });
  },

  // ── Derived helpers ───────────────────────────────────────────────────────

  /** Effective amount for a bill in a given month: current override → prev month override → base_amount */
  getEffectiveAmount: (bill, year, month) => {
    const { overrides } = get();
    const mk = monthKey(year, month);
    const cur = overrides.find((o) => o.bill_id === bill.id && o.month_key === mk);
    if (cur?.amount != null) return cur.amount;
    // Previous month carry-forward
    const prevDate = subMonths(new Date(year, month - 1, 1), 1);
    const prevMk = monthKey(prevDate.getFullYear(), prevDate.getMonth() + 1);
    const prev = overrides.find((o) => o.bill_id === bill.id && o.month_key === prevMk);
    if (prev?.amount != null) return prev.amount;
    return bill.base_amount;
  },

  /** All bills visible for the month (filters bills hidden for this month) */
  getBillsForMonth: (month, year) => {
    const mk = monthKey(year, month);
    return get().bills.filter((bill) => {
      const ov = get().overrides.find((o) => o.bill_id === bill.id && o.month_key === mk);
      return !ov?.hidden;
    });
  },

  getIncomeForMonth: (month, year) => {
    return get().income.filter((i) => {
      const d = new Date(i.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });
  },

  getMonthBalance: (month, year) => {
    const bills  = get().getBillsForMonth(month, year);
    const income = get().getIncomeForMonth(month, year);
    const totalIncome = income.reduce((s, i) => s + i.amount, 0);
    const totalBills  = bills.reduce((s, b) => s + get().getEffectiveAmount(b, year, month), 0);
    return totalIncome - totalBills;
  },

  /** Sum of effective amounts for bills in a budget's category for the month */
  getBudgetSpent: (budget, month, year) => {
    if (!budget.category_id) return 0;
    return get()
      .getBillsForMonth(month, year)
      .filter((b) => b.category_id === budget.category_id)
      .reduce((sum, b) => sum + get().getEffectiveAmount(b, year, month), 0);
  },

  getBillStatus: (billId, month, year) => {
    const mk = monthKey(year, month);
    return get().overrides.find((o) => o.bill_id === billId && o.month_key === mk)?.status ?? null;
  },

  getPaidCount: (month, year) => {
    return get()
      .getBillsForMonth(month, year)
      .filter((b) => get().getBillStatus(b.id, month, year) === 'paid').length;
  },

  getPersonBillShare: (bill, personId, effectiveAmt) => {
    const sp = bill.splits.find(s => s.person_id === personId);
    if (!sp) return 0;

    // Fixed-amount splits are deducted first; percent/equal apply to the remainder
    const totalFixed = bill.splits
      .filter(s => s.type === 'amount')
      .reduce((sum, s) => sum + s.value, 0);
    const remainder = Math.max(0, effectiveAmt - totalFixed);

    if (sp.type === 'amount')  return sp.value;
    if (sp.type === 'percent') return remainder * sp.value / 100;
    // equal
    const equalCount = bill.splits.filter(s => s.type === 'equal').length;
    return equalCount > 0 ? remainder / equalCount : 0;
  },
}));

// ── Cross-tab sync via BroadcastChannel ──────────────────────────────────────
bc.listen(() => {
  useFinanceStore.getState().fetchAll();
});
