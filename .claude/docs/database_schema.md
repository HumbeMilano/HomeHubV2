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
  end_at          timestamptz,
  is_all_day      boolean not null default false,
  is_recurring    boolean not null default false,
  recurrence_rule recurrence_rule not null default 'weekly',
  notes           text,
  member_id       uuid references household_members(id) on delete set null,
  created_at      timestamptz default now()
);

-- ── Shopping ────────────────────────────────────────────────────────────────
create table shopping_lists (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  store_category text,
  color          text not null default '#fb923c',
  is_featured    boolean not null default false,
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
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  base_amount     numeric not null default 0,
  type            bill_type not null default 'fixed',
  category_id     uuid references fin_categories(id) on delete set null,
  subcategory_id  uuid references fin_categories(id) on delete set null,
  account_id      uuid references fin_accounts(id) on delete set null,
  due_day         int,
  auto_pay        boolean not null default false,
  splits          jsonb not null default '[]',
  created_at      timestamptz default now()
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
  hidden      boolean not null default false,
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

-- ── Row Level Security (RLS) — see Migration 002 below ─────────────────────
alter table household_members enable row level security;
create policy "allow all" on household_members using (true) with check (true);
```

---

## Migration 002 — RLS en todas las tablas + columnas faltantes

Ejecutar en **Supabase → SQL Editor** después de Migration 001 (schema inicial).

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 002: RLS completo + columnas faltantes
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Columnas faltantes ─────────────────────────────────────────────────────

-- fin_bills: subcategory_id (referenciado desde la UI pero no estaba en DDL)
alter table fin_bills
  add column if not exists subcategory_id uuid
    references fin_categories(id) on delete set null;

-- reminders: campos usados por ReminderForm que no estaban en DDL
alter table reminders
  add column if not exists end_at     timestamptz,
  add column if not exists is_all_day boolean not null default false,
  add column if not exists notes      text;

-- ── 2. Realtime — chore_assignments faltaba ──────────────────────────────────
alter publication supabase_realtime add table chore_assignments;

-- ── 3. Habilitar RLS en todas las tablas ─────────────────────────────────────
alter table household_members  enable row level security;
alter table photos             enable row level security;
alter table chores             enable row level security;
alter table chore_assignments  enable row level security;
alter table chore_completions  enable row level security;
alter table calendar_events    enable row level security;
alter table reminders          enable row level security;
alter table shopping_lists     enable row level security;
alter table shopping_items     enable row level security;
alter table notes              enable row level security;
alter table fin_categories     enable row level security;
alter table fin_accounts       enable row level security;
alter table fin_bills          enable row level security;
alter table fin_income         enable row level security;
alter table fin_budgets        enable row level security;
alter table fin_overrides      enable row level security;

-- ── 4. Eliminar policy permisiva anterior en household_members ────────────────
drop policy if exists "allow all" on household_members;

-- ── 5. Políticas por tabla ────────────────────────────────────────────────────
-- Patrón: SELECT separado de ALL-writes para poder restringir escrituras
-- fácilmente en el futuro sin tocar las lecturas.
--
-- TODO (post auth-migration): reemplazar `using (true)` en políticas write
-- por `using (auth.role() = 'authenticated')` una vez que los miembros
-- del hogar usen Supabase Auth sessions.

-- household_members
create policy "household read members"  on household_members for select using (true);
create policy "household write members" on household_members for all    using (true) with check (true);

-- photos
create policy "household read photos"   on photos for select using (true);
create policy "household write photos"  on photos for all    using (true) with check (true);

-- chores
create policy "household read chores"       on chores            for select using (true);
create policy "household write chores"      on chores            for all    using (true) with check (true);
create policy "household read assignments"  on chore_assignments for select using (true);
create policy "household write assignments" on chore_assignments for all    using (true) with check (true);
create policy "household read completions"  on chore_completions for select using (true);
create policy "household write completions" on chore_completions for all    using (true) with check (true);

-- calendar
create policy "household read calendar"  on calendar_events for select using (true);
create policy "household write calendar" on calendar_events for all    using (true) with check (true);

-- reminders
create policy "household read reminders"  on reminders for select using (true);
create policy "household write reminders" on reminders for all    using (true) with check (true);

-- shopping
create policy "household read lists"  on shopping_lists for select using (true);
create policy "household write lists" on shopping_lists for all    using (true) with check (true);
create policy "household read items"  on shopping_items for select using (true);
create policy "household write items" on shopping_items for all    using (true) with check (true);

-- notes
create policy "household read notes"  on notes for select using (true);
create policy "household write notes" on notes for all    using (true) with check (true);

-- finance
create policy "household read categories"  on fin_categories for select using (true);
create policy "household write categories" on fin_categories for all    using (true) with check (true);
create policy "household read accounts"    on fin_accounts   for select using (true);
create policy "household write accounts"   on fin_accounts   for all    using (true) with check (true);
create policy "household read bills"       on fin_bills      for select using (true);
create policy "household write bills"      on fin_bills      for all    using (true) with check (true);
create policy "household read income"      on fin_income     for select using (true);
create policy "household write income"     on fin_income     for all    using (true) with check (true);
create policy "household read budgets"     on fin_budgets    for select using (true);
create policy "household write budgets"    on fin_budgets    for all    using (true) with check (true);
create policy "household read overrides"   on fin_overrides  for select using (true);
create policy "household write overrides"  on fin_overrides  for all    using (true) with check (true);
```

> **Por qué `using (true)` en writes:** la app usa la anon key directamente (no hay Supabase Auth sessions todavía). Separar SELECT de ALL-writes permite cambiar sólo la política de escritura a `auth.role() = 'authenticated'` cuando se implemente login con Supabase Auth — sin tocar nada más.

## Key Design Decisions

- `fin_overrides` uses a `unique(bill_id, month_key)` constraint — use upsert when setting bill status.
- `splits` columns are `jsonb` arrays of `{ person_id, type, value }` objects.
- `chore_completions.scheduled_date` is a `date` (not timestamptz) — always compare as `YYYY-MM-DD` string.
- `notes.position_x/y` are pixel coordinates relative to the board container.
- Photos are stored in Supabase Storage (`photos` bucket), with signed URLs in the `photos.url` column.
