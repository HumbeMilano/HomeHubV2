-- ============================================================
-- Sprint: Sidebar + Settings + Lock Screen  (2026-04-17)
-- Run in Supabase SQL Editor if any column is missing
-- All statements are idempotent (IF NOT EXISTS)
-- ============================================================

-- 1. notes.on_lock_screen — pin notes to lock screen panel
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS on_lock_screen boolean NOT NULL DEFAULT false;

-- 2. shopping_lists.is_featured — highlight a shopping list
ALTER TABLE shopping_lists
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- 3. fin_overrides.hidden — hide a finance override row
ALTER TABLE fin_overrides
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

-- 4. photos table — lock screen background photos
CREATE TABLE IF NOT EXISTS photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url          text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by  uuid REFERENCES household_members(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 5. RLS on photos — anon can read, any authenticated request can insert/delete
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photos_select" ON photos;
CREATE POLICY "photos_select" ON photos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "photos_insert" ON photos;
CREATE POLICY "photos_insert" ON photos
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "photos_delete" ON photos;
CREATE POLICY "photos_delete" ON photos
  FOR DELETE USING (true);

-- NOTE: The 'photos' Storage bucket must be created via the Supabase Dashboard
-- or by invoking the setup-migration edge function.
-- Storage > New bucket > Name: "photos" > Public: ON
