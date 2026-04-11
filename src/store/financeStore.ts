import { create } from 'zustand';
import type {
  FinBill, FinIncome, FinBudget, FinAccount, FinCategory, FinOverride, BillStatus,
} from '../types';
import { supabase } from '../lib/supabase';
import { uid, monthKey } from '../lib/utils';

interface FinanceState {
  bills: FinBill[];
  income: FinIncome[];
  budgets: FinBudget[];
  accounts: FinAccount[];
  categories: FinCategory[];
  overrides: FinOverride[];
  workMonth: number;  // 1–12
  workYear: number;
  loading: boolean;

  fetchAll: () => Promise<void>;
  setWorkMonth: (month: number, year: number) => void;

  // Bills
  addBill: (data: Omit<FinBill, 'id' | 'created_at'>) => Promise<void>;
  updateBill: (id: string, patch: Partial<FinBill>) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  setBillStatus: (billId: string, status: BillStatus) => Promise<void>;

  // Income
  addIncome: (data: Omit<FinIncome, 'id' | 'created_at'>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;

  // Budgets
  addBudget: (data: Omit<FinBudget, 'id' | 'created_at'>) => Promise<void>;
  updateBudget: (id: string, patch: Partial<FinBudget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;

  // Accounts
  addAccount: (data: Omit<FinAccount, 'id'>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  // Categories
  addCategory: (data: Omit<FinCategory, 'id'>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Derived helpers
  getBillsForMonth: (month: number, year: number) => FinBill[];
  getIncomeForMonth: (month: number, year: number) => FinIncome[];
  getMonthBalance: (month: number, year: number) => number;
  getBudgetSpent: (budget: FinBudget, month: number, year: number) => number;
  getBillStatus: (billId: string, month: number, year: number) => BillStatus | null;
}

const now = new Date();

export const useFinanceStore = create<FinanceState>((set, get) => ({
  bills: [], income: [], budgets: [], accounts: [], categories: [], overrides: [],
  workMonth: now.getMonth() + 1,
  workYear: now.getFullYear(),
  loading: false,

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
      bills:      (b.data ?? []) as FinBill[],
      income:     (i.data ?? []) as FinIncome[],
      budgets:    (bu.data ?? []) as FinBudget[],
      accounts:   (a.data ?? []) as FinAccount[],
      categories: (c.data ?? []) as FinCategory[],
      overrides:  (o.data ?? []) as FinOverride[],
      loading: false,
    });
  },

  setWorkMonth: (month, year) => set({ workMonth: month, workYear: year }),

  // ── Bills ────────────────────────────────────────────────────────────────
  addBill: async (data) => {
    const bill: FinBill = { ...data, id: uid(), created_at: new Date().toISOString() };
    set((s) => ({ bills: [...s.bills, bill] }));
    const { error } = await supabase.from('fin_bills').insert(bill);
    if (error) { await get().fetchAll(); throw error; }
  },

  updateBill: async (id, patch) => {
    set((s) => ({ bills: s.bills.map((b) => b.id === id ? { ...b, ...patch } : b) }));
    await supabase.from('fin_bills').update(patch).eq('id', id);
  },

  deleteBill: async (id) => {
    set((s) => ({
      bills: s.bills.filter((b) => b.id !== id),
      overrides: s.overrides.filter((o) => o.bill_id !== id),
    }));
    await supabase.from('fin_overrides').delete().eq('bill_id', id);
    await supabase.from('fin_bills').delete().eq('id', id);
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
      const row: FinOverride = { id: uid(), bill_id: billId, month_key: mk, amount: null, splits: null, status };
      set((s) => ({ overrides: [...s.overrides, row] }));
      await supabase.from('fin_overrides').insert(row);
    }
  },

  // ── Income ────────────────────────────────────────────────────────────────
  addIncome: async (data) => {
    const row: FinIncome = { ...data, id: uid(), created_at: new Date().toISOString() };
    set((s) => ({ income: [row, ...s.income] }));
    await supabase.from('fin_income').insert(row);
  },

  deleteIncome: async (id) => {
    set((s) => ({ income: s.income.filter((i) => i.id !== id) }));
    await supabase.from('fin_income').delete().eq('id', id);
  },

  // ── Budgets ───────────────────────────────────────────────────────────────
  addBudget: async (data) => {
    const row: FinBudget = { ...data, id: uid(), created_at: new Date().toISOString() };
    set((s) => ({ budgets: [...s.budgets, row] }));
    await supabase.from('fin_budgets').insert(row);
  },

  updateBudget: async (id, patch) => {
    set((s) => ({ budgets: s.budgets.map((b) => b.id === id ? { ...b, ...patch } : b) }));
    await supabase.from('fin_budgets').update(patch).eq('id', id);
  },

  deleteBudget: async (id) => {
    set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) }));
    await supabase.from('fin_budgets').delete().eq('id', id);
  },

  // ── Accounts ──────────────────────────────────────────────────────────────
  addAccount: async (data) => {
    const row: FinAccount = { ...data, id: uid() };
    set((s) => ({ accounts: [...s.accounts, row] }));
    await supabase.from('fin_accounts').insert(row);
  },

  deleteAccount: async (id) => {
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
    await supabase.from('fin_accounts').delete().eq('id', id);
  },

  // ── Categories ────────────────────────────────────────────────────────────
  addCategory: async (data) => {
    const row: FinCategory = { ...data, id: uid() };
    set((s) => ({ categories: [...s.categories, row] }));
    await supabase.from('fin_categories').insert(row);
  },

  deleteCategory: async (id) => {
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
    await supabase.from('fin_categories').delete().eq('id', id);
  },

  // ── Derived helpers ───────────────────────────────────────────────────────
  getBillsForMonth: (_month, _year) => {
    return get().bills; // All bills are recurring; overrides handle per-month status
  },

  getIncomeForMonth: (month, year) => {
    return get().income.filter((i) => {
      const d = new Date(i.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });
  },

  getMonthBalance: (month, year) => {
    const bills = get().getBillsForMonth(month, year);
    const income = get().getIncomeForMonth(month, year);
    const totalIncome = income.reduce((s, i) => s + i.amount, 0);
    const totalBills = bills.reduce((s, b) => s + b.base_amount, 0);
    return totalIncome - totalBills;
  },

  getBudgetSpent: (_budget, month, year) => {
    return get().income
      .filter((i) => {
        const d = new Date(i.date);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      })
      .reduce((sum, i) => sum + i.amount, 0); // placeholder — proper category filter in full impl
  },

  getBillStatus: (billId, month, year) => {
    const mk = monthKey(year, month);
    return get().overrides.find((o) => o.bill_id === billId && o.month_key === mk)?.status ?? null;
  },
}));
