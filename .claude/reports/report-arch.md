# HomeHub — Architecture & Scalability Audit
**Date:** 2026-04-15
**Scope:** State management, real-time sync, TypeScript type safety, performance

---

## Executive Summary

- **BroadcastChannel listeners are registered at module scope with no cleanup.** Every Vite HMR reload accumulates a new listener; after 10 reloads each broadcast fires 10+ handlers simultaneously — for `financeStore` this means 10 concurrent `fetchAll()` calls with 10 concurrent auto-pay side-effects.
- **The auto-pay side-effect inside `fetchAll()` is not idempotent across tabs.** Two Finance tabs open simultaneously both see `overrides = []`, both decide `getBillStatus = null`, and both call `setBillStatus()`, racing to insert the same `(bill_id, month_key)` row and hitting the DB unique constraint with an unhandled error.
- **Every `as unknown as T` cast at broadcast boundaries trusts unvalidated wire data.** A malformed broadcast silently corrupts in-memory state with zero runtime guards anywhere in the codebase.
- **`fin_overrides` derived helpers perform O(n×m) array iterations with no memoisation.** With 20 bills and 480 overrides, a single BillsTab render cycle performs ~57,600 array iterations.
- **PIN authentication is plaintext client-side comparison.** The lock screen fetches members with `select('*')` (including `pin` column), and `PinPad` does `entered === stored` in JavaScript.

---

## Findings

**A-01 [CRITICAL]** BroadcastChannel listeners leak on every HMR reload
Files: `src/store/calendarStore.ts:61`, `src/store/choresStore.ts:124`, `src/store/remindersStore.ts:74`, `src/store/shoppingStore.ts:133`, `src/store/membersStore.ts:97`, `src/store/financeStore.ts:371`
Root cause: Each store calls `bc.listen(handler)` at module scope. Vite HMR re-evaluates the module on every save, creating a new `bc` object and registering a fresh listener. The previous instance is never `.close()`-d.
Impact: After 10 HMR reloads, each broadcast fires 10+ handlers simultaneously — 10 concurrent DB fetches and 10 auto-pay loops per cross-tab event.

---

**A-02 [CRITICAL]** Auto-pay side-effect inside `fetchAll()` is not concurrency-safe
Files: `src/store/financeStore.ts:103–114`, `src/store/financeStore.ts:144–163`
Root cause: Two tabs calling `fetchAll()` simultaneously both receive the same DB snapshot (no existing override rows), both evaluate `!getBillStatus(...)` as `true`, and both call `setBillStatus('paid')` → both issue `supabase.from('fin_overrides').insert(row)` → second insert hits the `unique(bill_id, month_key)` constraint. No `try/catch` wraps the auto-pay loop.
Impact: Unhandled constraint violation in one tab, inconsistent UI state between tabs.

---

**A-03 [HIGH]** `as unknown as T` casts at broadcast boundaries — no runtime validation
Files: `src/store/calendarStore.ts:64,69,72`, `src/store/choresStore.ts:127,131,134`, `src/store/remindersStore.ts:77,82,85`, `src/store/shoppingStore.ts:136,139,142,146,149,152`, `src/store/membersStore.ts:101,105,108`
Root cause: All stores use `createBroadcastChannel<unknown>('...')`. Listeners cast via `msg.payload as unknown as ConcreteType` with no shape check.
Impact: A malformed payload missing `id` silently corrupts state. Zero validation in all five affected stores.

---

**A-04 [CRITICAL]** PIN stored and compared as plaintext client-side
Files: `src/features/lockscreen/LockScreen.tsx:19`, `src/features/lockscreen/PinPad.tsx:22–25`, `.claude/docs/database_schema.md`
Root cause: `LockScreen` fetches all members with `select('*')`. `PinPad` compares `digits.join('') === member.pin` in the browser. The PIN is visible in the Network tab response and any Zustand DevTools snapshot.
Impact: All household PINs are simultaneously exposed in one network response. No hashing, no server-side comparison, no rate-limiting.

---

**A-05 [CRITICAL]** `DevBypass` has no production build guard
Files: `src/features/lockscreen/LockScreen.tsx:110–124`
Root cause: `DevBypass` renders when `members.length === 0`. No `import.meta.env.DEV` check protects it. This condition occurs if all members are deleted, if the initial DB fetch fails silently, or during a migration.
Impact: A household tablet shows an unauthenticated bypass button whenever the DB is unreachable or empty.

---

**A-06 [HIGH]** `fin_overrides` O(n×m) iterations — no memoisation anywhere
Files: `src/store/financeStore.ts:295–349`
Root cause: `getEffectiveAmount`, `getBillsForMonth`, `getBillStatus`, `getBudgetSpent`, `getPaidCount` all iterate `overrides` linearly on every call. Zustand caches no derived state.
Impact: With 20 bills and 480 overrides, a single BillsTab render performs ~57,600 array iterations:
- `getBillsForMonth`: 20 × 480 = 9,600
- `getEffectiveAmount` (×2 per bill, current + prev month): 20 × 2 × 2 × 480 = 38,400
- `getBillStatus` inside `getPaidCount`: 20 × 480 = 9,600

---

**A-07 [HIGH]** Notes `updateNote` fires a Supabase `UPDATE` on every textarea `onChange` keystroke
Files: `src/features/notes/NotesPage.tsx:63–69`, `src/features/notes/NotesPage.tsx:207`
Root cause: NoteCard textarea `onChange` calls `updateNote` synchronously on every keystroke with no debounce. Additionally, `bc.post('UPDATE', ...)` on line 68 reads `notes.find(n => n.id === id)` from a stale closure, so the broadcast payload may lag the DB write.
Impact: 50 characters typed = 50 Supabase `UPDATE` round-trips. Under high latency, out-of-order responses can silently lose characters.

---

**A-08 [HIGH]** `subscribeToTable` uses a static channel name — concurrent subscriptions to the same table conflict
Files: `src/lib/realtime.ts:23`, `src/features/shopping/ShoppingPage.tsx:23,38`, `src/features/calendar/CalendarPage.tsx:126`
Root cause: Every call to `subscribeToTable({ table: 'X' })` registers a channel named `realtime:X`. If two components subscribe to the same table, the Supabase client has two channel objects with the same name. When one unmounts and removes the channel, it may silently terminate the other component's subscription.
Impact: Cross-device realtime sync may silently stop after navigation or component remount.

---

**A-09 [MEDIUM]** Dashboard `ResizeObserver` calls `setContainerWidth` on every pixel during resize — no debounce
Files: `src/features/dashboard/Dashboard.tsx:133–143`
Root cause: No `requestAnimationFrame` wrapper and no minimum-delta check. During a window resize drag, fires 60+ times/second.
Impact: Hundreds of Dashboard re-render cycles per second during a drag, degrading frame rate.

---

**A-10 [MEDIUM]** `CalendarEvent` type and `useCalendar.ts` are orphaned dead code; `billsToItems` is copy-pasted
Files: `src/types/index.ts:196–205`, `src/features/calendar/useCalendar.ts`, `src/features/calendar/CalendarPage.tsx:41–68`, `src/features/dashboard/widgets/CalendarWidget.tsx:16–44`
Root cause: `CalendarPage` was rebuilt around `calendar_items` table. The older architecture (`useCalendar.ts`, `EventChip`, `MonthView`, `WeekView`) remains but is not reachable. `billsToItems` + `BILL_COLOR` + `hexToRgb` are byte-for-byte identical in two files.
Impact: Dead code creates confusion; duplication means any label change requires two edits.

---

**A-11 [MEDIUM]** No effective RLS — anon key grants unrestricted read/write access to all tables
Files: `.claude/docs/database_schema.md:202–207`
Root cause: RLS on `household_members` uses `using (true) with check (true)` — functionally disabled. `VITE_SUPABASE_ANON_KEY` is embedded in the compiled JS bundle.
Impact: Anyone who extracts the anon key can query, insert, update, or delete any row in any table, including reading all PINs and overwriting financial records.

---

**A-12 [MEDIUM]** All queries use `select('*')` with no pagination or cancellation
Files: All store `fetchAll()` implementations, `src/features/notes/NotesPage.tsx:23`, `src/features/lockscreen/LockScreen.tsx:19`
Root cause: No column projection, no `.limit()`, no `AbortController`. `select('*')` on `household_members` returns the `pin` column on every page load.
Impact: Sensitive data over-fetched. Memory footprint grows unbounded. React "update on unmounted component" warnings.

---

**A-13 [MEDIUM]** Active member stored in `localStorage` can be forged — no server-side verification
Files: `src/store/authStore.ts:4–7,25–27,34–36`
Root cause: `authStore` serialises the full `Member` object to localStorage. On load, it is deserialised and used directly without querying the DB. Any user can overwrite this key in DevTools.
Impact: Note authorship, chore completions, and income records can be forged without re-entering a PIN.

---

## Recommendations

**A-01** — Move `bc.listen()` calls inside an `initSync()` function guarded by `import.meta.hot.dispose`. Mount via `useEffect` in App.tsx with cleanup.

**A-02** — Use `upsert` with `ignoreDuplicates: true` for auto-pay:
```typescript
await supabase.from('fin_overrides')
  .upsert({ bill_id, month_key, status: 'paid' },
           { onConflict: 'bill_id,month_key', ignoreDuplicates: true });
```

**A-03** — Add minimal runtime shape guard before every cast:
```typescript
function hasId(x: unknown): x is { id: string } {
  return typeof x === 'object' && x !== null && typeof (x as any).id === 'string';
}
if (!hasId(msg.payload)) return;
```

**A-04** — Exclude `pin` from client queries. Move PIN comparison to a Supabase Edge Function using bcrypt.

**A-05** — Wrap `DevBypass` in `import.meta.env.DEV` check.

**A-06** — Index `fin_overrides` by `${bill_id}:${month_key}` in a `Map` at fetch time. Reduces ~57,600 iterations to ~60 map lookups per render.

**A-07** — Debounce DB writes 400ms. Fix stale closure: read state functionally inside `setNotes` when broadcasting.

**A-08** — Use unique channel names per `subscribeToTable` call: append `crypto.randomUUID()` suffix.

**A-09** — Wrap ResizeObserver callback with `requestAnimationFrame` to throttle to one update per frame.

**A-10** — Delete `useCalendar.ts`, `EventChip.tsx`, `MonthView.tsx`, `WeekView.tsx`, `CalendarEvent` type. Extract `billsToItems` to `src/lib/calendarUtils.ts`.

**A-11** — Add write-blocking RLS policies for the anon role on all tables.

**A-12** — Add column projection excluding `pin`. Add `.limit(500)` safety ceiling. Add `AbortController` to page-level fetch effects.

**A-13** — On app init, verify stored `activeMember.id` against DB before trusting it.

---

## Risk Matrix

| ID | Category | Severity | Fix Effort | Priority |
|---|---|---|---|---|
| A-04 | Security — PIN plaintext | CRITICAL | M | P0 |
| A-05 | Security — DevBypass in prod | CRITICAL | S | P0 |
| A-01 | Reliability — BC listener leak | CRITICAL | M | P1 |
| A-02 | Data integrity — auto-pay race | CRITICAL | M | P1 |
| A-03 | Type safety — unvalidated casts | HIGH | M | P1 |
| A-06 | Performance — O(n×m) overrides | HIGH | M | P2 |
| A-07 | Reliability — unbounded DB writes | HIGH | S | P2 |
| A-08 | Reliability — duplicate RT channels | HIGH | S | P2 |
| A-11 | Security — no effective RLS | MEDIUM | L | P2 |
| A-09 | Performance — ResizeObserver thrash | MEDIUM | S | P2 |
| A-12 | Reliability — no query cancellation | MEDIUM | M | P3 |
| A-13 | Security — forged member localStorage | MEDIUM | M | P3 |
| A-10 | Code quality — dead code + duplication | MEDIUM | S | P3 |

**Fix Effort:** S = Small (<2h) | M = Medium (2–8h) | L = Large (>8h)
