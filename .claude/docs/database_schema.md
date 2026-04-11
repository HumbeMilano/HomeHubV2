# Supabase Database Schema

## Migration SQL

Run in Supabase SQL Editor to create all tables.

```sql
-- ── Members ────────────────────────────────────────────────────────────────
create table household_members (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  color         text not null default '#5b5bf6',
  avatar_url    text,
  pin           text,                  -- store hashed in production
  supabase_user_id uuid,
  created_at    timestamptz default now()
);

-- ── Photos (lock screen slideshow) ─────────────────────────────────────────
create table photos (
  id            uuid primary key default gen_random_uuid(),
  url           text not null,
  storage_path  text not null,
  uploaded_by   uuid references household_members(id) on delete set null,
  created_at    timestamptz default now()
);

-- ── Chores ─────────────────────────────────────────────────────────────────
create type recurrence_rule as enum ('none','daily','weekly','biweekly','monthly');

create table chores (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  category         text,
  recurrence_rule  recurrence_rule not null default 'weekly',
  rotation_enabled boolean not null default true,
  created_by       uuid references household_members(id) on delete set null,
  created_at       timestamptz default now()
);

create table chore_assignments (
  id             uuid primary key default gen_random_uuid(),
  chore_id       uuid references chores(id) on delete cascade,
  member_id      uuid references household_members(id) on delete cascade,
  rotation_order int not null default 0
);

create table chore_completions (
  id             uuid primary key default gen_random_uuid(),
  chore_id       uuid references chores(id) on delete cascade,
  completed_by   uuid not null references household_members(id) on delete cascade,
  scheduled_date date not null,
  completed_at   timestamptz
);

-- ── Calendar Events ─────────────────────────────────────────────────────────
create type calendar_event_type as enum ('chore','reminder','bill');

create table calendar_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  start_time  timestamptz not null,
  end_time    timestamptz,
  type        calendar_event_type not null,
  linked_id   uuid,
  member_id   uuid references household_members(id) on delete set null,
  created_at  timestamptz default now()
);

-- ── Reminders ───────────────────────────────────────────────────────────────
create table reminders (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text,
  due_at          timestamptz not null,
  is_recurring    boolean not null default false,
  recurrence_rule recurrence_rule not null default 'weekly',
  member_id       uuid references household_members(id) on delete set null,
  created_at      timestamptz default now()
);

-- ── Shopping ────────────────────────────────────────────────────────────────
create table shopping_lists (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  store_category text,
  color          text not null default '#fb923c',
  created_by     uuid references household_members(id) on delete set null,
  created_at     timestamptz default now()
);

create table shopping_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references shopping_lists(id) on delete cascade,
  name        text not null,
  category    text,
  quantity    text,
  checked     boolean not null default false,
  checked_by  uuid references household_members(id) on delete set null,
  checked_at  timestamptz,
  created_at  timestamptz default now()
);

-- ── Notes ───────────────────────────────────────────────────────────────────
create table notes (
  id          uuid primary key default gen_random_uuid(),
  content     text not null default '',
  color       text not null default '#facc15',
  author_id   uuid references household_members(id) on delete set null,
  is_shared   boolean not null default true,
  position_x  int not null default 20,
  position_y  int not null default 20,
  width       int not null default 200,
  height      int not null default 160,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── Finance ─────────────────────────────────────────────────────────────────
create type category_type as enum ('expense','income','both');
create type account_type as enum ('checking','savings','credit','cash');
create type bill_type as enum ('fixed','variable');
create type bill_status as enum ('paid','pending');

create table fin_categories (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  icon           text not null default '📋',
  type           category_type not null default 'expense',
  subcategories  jsonb not null default '[]'
);

create table fin_accounts (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  type      account_type not null default 'checking',
  owner_id  uuid references household_members(id) on delete set null,
  balance   numeric not null default 0
);

create table fin_bills (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  base_amount  numeric not null default 0,
  type         bill_type not null default 'fixed',
  category_id  uuid references fin_categories(id) on delete set null,
  account_id   uuid references fin_accounts(id) on delete set null,
  due_day      int,
  auto_pay     boolean not null default false,
  splits       jsonb not null default '[]',
  created_at   timestamptz default now()
);

create table fin_income (
  id            uuid primary key default gen_random_uuid(),
  description   text not null,
  amount        numeric not null default 0,
  date          timestamptz not null,
  type          text not null default 'salary',
  is_shared     boolean not null default false,
  person_id     uuid references household_members(id) on delete set null,
  shared_people jsonb not null default '[]',
  account_id    uuid references fin_accounts(id) on delete set null,
  created_at    timestamptz default now()
);

create table fin_budgets (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  limit_amount  numeric not null default 0,
  category_id   uuid references fin_categories(id) on delete set null,
  color         text not null default '#818cf8',
  icon          text not null default '💰',
  created_at    timestamptz default now()
);

create table fin_overrides (
  id          uuid primary key default gen_random_uuid(),
  bill_id     uuid not null references fin_bills(id) on delete cascade,
  month_key   text not null,   -- 'YYYY-MM'
  amount      numeric,
  splits      jsonb,
  status      bill_status,
  unique(bill_id, month_key)
);

-- ── Enable Realtime on all tables ────────────────────────────────────────────
alter publication supabase_realtime add table household_members;
alter publication supabase_realtime add table chores;
alter publication supabase_realtime add table chore_completions;
alter publication supabase_realtime add table calendar_events;
alter publication supabase_realtime add table reminders;
alter publication supabase_realtime add table shopping_lists;
alter publication supabase_realtime add table shopping_items;
alter publication supabase_realtime add table notes;
alter publication supabase_realtime add table fin_bills;
alter publication supabase_realtime add table fin_income;
alter publication supabase_realtime add table fin_budgets;
alter publication supabase_realtime add table fin_overrides;

-- ── Row Level Security (RLS) — enable but allow all for now ─────────────────
-- In production: scope to household via Supabase Auth claims
alter table household_members enable row level security;
create policy "allow all" on household_members using (true) with check (true);
-- Repeat for each table as needed
```

## Key Design Decisions

- `fin_overrides` uses a `unique(bill_id, month_key)` constraint — use upsert when setting bill status.
- `splits` columns are `jsonb` arrays of `{ person_id, type, value }` objects.
- `chore_completions.scheduled_date` is a `date` (not timestamptz) — always compare as `YYYY-MM-DD` string.
- `notes.position_x/y` are pixel coordinates relative to the board container.
- Photos are stored in Supabase Storage (`photos` bucket), with signed URLs in the `photos.url` column.
