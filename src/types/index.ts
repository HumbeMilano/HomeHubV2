// ── Members ────────────────────────────────────────────────────────────────
export interface Member {
  id: string;
  name: string;
  color: string;
  avatar_url: string | null;
  pin?: string | null;
  supabase_user_id: string | null;
  created_at: string;
}

// ── Photos (lock screen slideshow) ─────────────────────────────────────────
export interface Photo {
  id: string;
  url: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
}

// ── Calendar items (events + reminders, unified) ───────────────────────────
export type RepeatRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ReminderCategory = 'personal' | 'to_do' | 'bill' | 'appointment' | 'other';

export interface CalendarItem {
  id: string;
  type: 'event' | 'reminder';
  title: string;
  color: string;
  all_day: boolean;
  start_at: string;           // ISO datetime
  end_at: string | null;      // ISO datetime — null for all-day or no end
  repeat: RepeatRule;
  notes: string | null;
  reminder_category: ReminderCategory | null;  // only meaningful when type='reminder'
  member_id: string | null;
  created_at: string;
}

// ── Legacy types kept for backwards compat (Shopping widget etc) ────────────
export interface Reminder {
  id: string;
  title: string;
  body: string | null;
  due_at: string;
  end_at: string | null;
  is_all_day: boolean;
  is_recurring: boolean;
  recurrence_rule: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  notes: string | null;
  member_id: string | null;
  created_at: string;
}

// ── Shopping ───────────────────────────────────────────────────────────────
export interface ShoppingList {
  id: string;
  name: string;
  store_category: string | null;
  color: string;
  is_featured: boolean;   // only one list can be featured at a time; shown on dashboard
  created_by: string | null;
  created_at: string;
}

export interface ShoppingItem {
  id: string;
  list_id: string;
  name: string;
  category: string | null;
  quantity: string | null;
  checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  created_at: string;
}

// ── Notes ──────────────────────────────────────────────────────────────────
export interface Note {
  id: string;
  content: string;
  color: string;
  author_id: string | null;
  is_shared: boolean;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
}

// ── Finance ────────────────────────────────────────────────────────────────
export type BillType = 'fixed' | 'variable';
export type AccountType = 'checking' | 'savings' | 'credit' | 'cash';
export type CategoryType = 'expense' | 'income' | 'both';
export type BillStatus = 'paid' | 'pending';

export interface FinCategory {
  id: string;
  name: string;
  icon: string;
  type: CategoryType;
  subcategories: { id: string; name: string }[];
}

export interface FinAccount {
  id: string;
  name: string;
  type: AccountType;
  owner_id: string | null;
  balance: number;
}

export interface BillSplit {
  person_id: string;
  type: 'equal' | 'percent' | 'amount';
  value: number;
}

export interface FinBill {
  id: string;
  name: string;
  base_amount: number;
  type: BillType;
  category_id: string | null;
  account_id: string | null;
  due_day: number | null;
  auto_pay: boolean;
  splits: BillSplit[];
  created_at: string;
}

export interface FinIncome {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  is_shared: boolean;
  person_id: string | null;
  shared_people: string[];
  account_id: string | null;
  created_at: string;
}

export interface FinBudget {
  id: string;
  name: string;
  limit_amount: number;
  category_id: string | null;
  color: string;
  icon: string;
  created_at: string;
}

export interface FinOverride {
  id: string;
  bill_id: string;
  month_key: string;      // YYYY-MM
  amount: number | null;
  splits: BillSplit[] | null;
  status: BillStatus | null;
}

// ── UI / App state ─────────────────────────────────────────────────────────
export type AppPage =
  | 'dashboard'
  | 'calendar'
  | 'shopping'
  | 'finance'
  | 'notes'
  | 'members';

export type Theme = 'dark' | 'light';
