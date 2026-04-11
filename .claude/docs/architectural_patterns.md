# Architectural Patterns

## Feature Folder Convention

Each module lives in `src/features/<name>/` and is self-contained:
```
features/calendar/
  CalendarPage.tsx     ← top-level page component
  CalendarPage.module.css
  MonthView.tsx
  WeekView.tsx
  EventChip.tsx
  useCalendar.ts       ← data-fetching hook
```
Shared UI primitives go in `src/components/`. If a component is only used by one feature, keep it in that feature's folder.

## Zustand Store Pattern

Each domain has its own Zustand store in `src/store/`:
- Stores own **optimistic mutations**: update local state immediately, write to Supabase, revert on error.
- Stores also wire up **BroadcastChannel listeners** at module load time (outside the `create()` call) so all tabs share the same in-memory state.

```ts
// Pattern: optimistic update → Supabase write → revert on error
addChore: async (data) => {
  const newRow = { ...data, id: uid() };
  set((s) => ({ chores: [...s.chores, newRow] }));         // optimistic
  const { error } = await supabase.from('chores').insert(newRow);
  if (error) { await get().fetchAll(); throw error; }       // revert
  bc.post('INSERT', newRow);                                // broadcast to other tabs
}
```

## Real-time Sync: Two-Layer Architecture

**Layer 1 — BroadcastChannel** (`src/lib/broadcast.ts`):
- After every write, the writing tab posts a message to `homehub:<table>` channel.
- Other tabs in the same browser receive it instantly (no server round-trip).
- Listener is registered when the store module is first imported.

**Layer 2 — Supabase Realtime** (`src/lib/realtime.ts`):
- Each page subscribes to `postgres_changes` for its table via `subscribeToTable()`.
- Fires when changes arrive from *other* devices (phone, another browser).
- Subscription is cleaned up on component unmount via the returned teardown function.

```
Same browser: Writer → BroadcastChannel → Other tabs (instant)
Other devices: Writer → Supabase DB → Realtime WS → Other devices
```

## Calendar Weekly View — Click-Time Capture

`src/features/calendar/WeekView.tsx:handleCellClick` captures the precise time:
1. Each hour-row cell is `CELL_HEIGHT` px tall.
2. On click: `relativeY = e.clientY - cell.getBoundingClientRect().top`
3. Minutes = `Math.round((relativeY / CELL_HEIGHT * 60) / 15) * 15` (15-min snap)
4. Result passed as `defaultStartTime` to `ChoreForm` / event form.

This prevents the bug where a new event defaults to midnight instead of the clicked time.

## CSS Module + Token Pattern

- `src/styles/tokens.css` defines all CSS custom properties (colours, spacing, radii, z-index, typography).
- Components use `.module.css` files for scoped styles.
- Tokens are referenced inside module files as `var(--accent)`, `var(--sp-4)`, etc.
- `kiosk.css` adds `@media (min-width: 1024px)` overrides for tablet landscape layout.
- No inline style objects for layout — use class names. Inline styles only for dynamic values (e.g. `background: member.color`).

## Auth / Lock Screen Pattern

- `useAuthStore` (`src/store/authStore.ts`) holds `activeMember` and `isLocked`.
- `App.tsx` gate: `if (isLocked) return <LockScreen />`
- `LockScreen` shows member avatars → tap → `PinPad` → on correct PIN → `authStore.unlock(member)`.
- PIN is stored as a plain field on `household_members` during development. For production, hash via a Supabase Edge Function.

## Finance Store Helpers

`src/store/financeStore.ts` exposes derived getters (not stored state):
- `getBillsForMonth(m, y)` — returns all bills (overrides applied per-month)
- `getIncomeForMonth(m, y)` — filters by `date` field
- `getMonthBalance(m, y)` — income − bills
- `getBillStatus(billId, m, y)` — reads `fin_overrides` for the month key
