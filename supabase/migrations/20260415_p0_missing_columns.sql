-- P0-4: Add is_featured column to shopping_lists
-- Required by shoppingStore.setFeatured()
alter table shopping_lists
  add column if not exists is_featured boolean not null default false;

-- P0-5: Add hidden column to fin_overrides
-- Required by financeStore.hideFromMonth()
alter table fin_overrides
  add column if not exists hidden boolean not null default false;
