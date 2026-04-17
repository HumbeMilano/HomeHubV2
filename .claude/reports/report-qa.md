# HomeHub — Functional QA & Product Review
**Date:** 2026-04-15
**Scope:** Full app trace — navigation, auth, chores, finance, calendar, notes, reminders, members, shopping, error handling.

---

## Executive Summary

- **DevBypass is a production security hole**: the lock screen grants zero-PIN access to any attacker who empties the `household_members` table.
- **The LockScreen is never rendered**: `isLocked` starts `false` and nothing in `App.tsx` conditionally shows `<LockScreen>` — the component exists but is completely dead; the app boots directly to the Dashboard.
- **PINs are stored plain-text client-side**: `PinPad.tsx` does `entered === stored` where `stored` is the raw DB value delivered to the browser.
- **Reminders are an orphaned dead-end feature**: `RemindersPage` is not in `AppPage`, not in `NAV_PAGES`, not in `PageRouter`, and reads from a separate `reminders` DB table with zero cross-display with CalendarPage.
- **Notes have no save feedback and no delete confirmation**: every keystroke fires a fire-and-forget Supabase `update`; failures are silent; the delete X destroys notes instantly with no undo.

---

## Findings

**Q-01 [CRITICAL]** LockScreen never rendered — app boots directly to Dashboard
File: `src/App.tsx` (entire file), `src/store/authStore.ts:22`
User flow: App starts → `isLocked` initializes to `false` → `PageRouter` renders `<Dashboard>`. No conditional rendering of `<LockScreen>` exists.
Expected: `App.tsx` renders `<LockScreen>` when `isLocked === true` or `activeMember === null`.
Actual: `LockScreen` is imported nowhere in `App.tsx`. The lock screen is dead code.

---

**Q-02 [CRITICAL]** DevBypass grants full app access when `household_members` table is empty
File: `src/features/lockscreen/LockScreen.tsx:63–65`
User flow: Attacker truncates `household_members` → refreshes kiosk → taps "Dev" avatar → full app access, no PIN.
Expected: Empty members table shows a setup wizard or remains locked.
Actual: `members.length === 0` renders `<DevBypass>` unconditionally; no `import.meta.env.DEV` guard.

---

**Q-03 [CRITICAL]** PINs compared plain-text client-side; entire `pin` column value sent to browser
File: `src/features/lockscreen/PinPad.tsx:23–29`
User flow: Member selected → 4 digits entered → `entered === stored` comparison in browser.
Expected: Supabase Edge Function receives `(member_id, entered_pin)` and returns `{ok: boolean}` using bcrypt.
Actual: PIN value travels to browser in plaintext and is compared with `===`. Visible in Network tab.

---

**Q-04 [HIGH]** QuickInfo is a hardcoded placeholder — always shows "Today's chores loading…"
File: `src/features/lockscreen/LockScreen.tsx:101–108`
User flow: Lock screen shown → QuickInfo always reads "📅 Today's chores loading…".
Expected: Live count of today's chores + next upcoming reminder.
Actual: Static string with `// TODO in Phase 4` comment.

---

**Q-05 [HIGH]** `reminders` page is completely unreachable from the app
File: `src/types/index.ts:208–214`, `src/App.tsx:18–25`, `src/App.tsx:152–160`
User flow: User wants to view or add reminders.
Expected: "Reminders" nav item → `RemindersPage` loads.
Actual: `'reminders'` is not in `AppPage` union, not in `NAV_PAGES`, not in `PageRouter`.

---

**Q-06 [HIGH]** `reminders` table and `calendar_items` table are isolated — no cross-display
File: `src/store/remindersStore.ts:26`, `src/store/calendarStore.ts:24`
User flow: Create reminder in RemindersPage → not visible in CalendarPage (and vice versa).
Expected: Unified or cross-referenced system.
Actual: Two separate DB tables, two separate stores, zero cross-reference.

---

**Q-07 [HIGH]** Auto-pay fires silently with no notification or audit trail
File: `src/store/financeStore.ts:103–114`
User flow: User opens Finance after bill due date → bills are silently marked paid.
Expected: Toast listing which bills were auto-paid; ability to review or reverse.
Actual: No toast, no log, no confirmation.

---

**Q-08 [HIGH]** Bill name: whitespace-only names pass `required` validation and save as empty string
File: `src/features/finance/BillsTab.tsx:361`, `:319–321`
User flow: Type `"   "` in Name field → HTML `required` passes → bill saved with `name: ""`.
Expected: JS guard: `if (!name.trim()) { setError('Name required'); return; }`
Actual: Bill with empty name is saved to the database.

---

**Q-09 [HIGH]** Bill amount: `parseFloat('') || 0` saves $0.00 silently; negative values accepted
File: `src/features/finance/BillsTab.tsx:277`, `:323`
User flow (A): Clear amount field → `NaN || 0 = 0` → bill saved with `base_amount: 0`.
User flow (B): Type `-50` → stored as -50 despite `min="0"` on input.
Expected: JS validation blocking save if amount <= 0.
Actual: No JS validation. $0 and negative bills are saved.

---

**Q-10 [HIGH]** Manual percent splits: no validation that percentages sum to ≤ 100%
File: `src/features/finance/BillsTab.tsx:295–308`
User flow: Set Member A = 80%, Member B = 80% → save → splits stored with 160% total.
Expected: Validate `pctSum <= 100` before saving.
Actual: No validation. Overage silently stored.

---

**Q-11 [MEDIUM]** Manual dollar splits: no validation that sum does not exceed bill total
File: `src/features/finance/BillsTab.tsx:295–308`
User flow: Bill = $100, Member A = $70, Member B = $70 → percent members silently receive $0.
Expected: Block or warn when dollar splits sum > bill total.
Actual: No validation.

---

**Q-12 [MEDIUM]** `due_day`: negative values (-5) stored in DB; produce bills on wrong calendar month
File: `src/features/finance/BillsTab.tsx:327`, `:373–376`
User flow: Type `-5` → `parseInt('-5') = -5` → `new Date(year, month-1, -5)` resolves to prior month.
Expected: JS validation: if `day < 1 || day > 31` reject.
Actual: HTML min/max not enforced in JS.

---

**Q-13 [HIGH]** Notes: delete fires instantly with no confirmation and no undo
File: `src/features/notes/NotesPage.tsx:71–74`, `:197–200`
User flow: Accidental tap on X → `deleteNote(id)` fires → note removed permanently.
Expected: Confirmation dialog or 5-second undo toast.
Actual: Single tap destroys the note. No `confirm()`, no undo, no soft-delete.

---

**Q-14 [HIGH]** Notes: save failures are completely silent; no "Saving" / "Saved" / "Failed" indicator
File: `src/features/notes/NotesPage.tsx:63–69`
User flow: User types → `updateNote` → if offline, error returned but never surfaced.
Expected: Per-note save status indicator; try/catch surfacing errors to UI.
Actual: The `await supabase...update()` result is completely ignored.

---

**Q-15 [MEDIUM]** Notes: `updateNote` broadcasts stale pre-patch note data to other tabs
File: `src/features/notes/NotesPage.tsx:67–68`
User flow: Fast consecutive edits → second `updateNote` reads stale `notes` closure → broadcasts old version.
Expected: Broadcast the patch directly, not the full note from a stale closure.
Actual: `const note = notes.find(...)` captures stale state.

---

**Q-16 [HIGH]** Calendar bill items: edit/delete silently hidden with no explanation or Finance deep-link
File: `src/features/dashboard/widgets/CalendarWidget.tsx:255–276`, `src/features/calendar/EventDetail.tsx:103–121`
User flow: Tap bill item on calendar → detail view → edit/delete absent with no explanation.
Expected: Message "Manage this bill in Finance" with a tappable nav link.
Actual: Buttons silently hidden in both widget and full CalendarPage. No escape hatch.

---

**Q-17 [HIGH]** `shopping_lists` table in DB schema is missing `is_featured` column
File: `.claude/docs/database_schema.md`, `src/store/shoppingStore.ts:109–126`
User flow: Fresh deployment → `setFeatured()` updates non-existent column → Supabase error → feature never works.
Expected: DDL includes `is_featured boolean not null default false`.
Actual: Column absent from migration script.

---

**Q-18 [HIGH]** `fin_overrides` table in DB schema is missing `hidden` column
File: `.claude/docs/database_schema.md`, `src/store/financeStore.ts:169–184`
User flow: Fresh deployment → `hideFromMonth()` updates non-existent column → swipe-left silently fails.
Expected: DDL includes `hidden boolean not null default false`.
Actual: Column absent from migration script.

---

**Q-19 [HIGH]** Member delete: no warning about cascading chore history deletion or orphaned JSONB bill splits
File: `src/features/members/MembersPage.tsx:31–33`
User flow: Delete member → generic `confirm()` → chore_assignments + chore_completions CASCADE deleted. `fin_bills.splits` JSONB entries not cleaned up.
Expected: Confirmation listing chore history loss and JSONB split orphans.
Actual: Only generic one-liner. JSONB split orphans cause `BillCard` to silently skip the deleted member.

---

**Q-20 [MEDIUM]** Chores: all recurrences appear every day regardless of weekly/monthly schedule
File: `src/features/chores/ChoresPage.tsx:37–44`
User flow: Weekly chore completed Monday → appears again in "To Do" on Tuesday.
Expected: Weekly chore only appears on its scheduled weekday.
Actual: `isDoneToday` checks only today's completions. No recurrence scheduling logic.

---

**Q-21 [MEDIUM]** All pages use native `confirm()` and `alert()` — inappropriate for kiosk
Files: ChoresPage.tsx:74–75, BillsTab.tsx:204, MembersPage.tsx:32, ShoppingCard.tsx:22, CalendarPage.tsx:228, RemindersPage.tsx:92, CalendarWidget.tsx:158 (8+ usages)
User flow: Any delete or error action → native browser modal blocks UI thread.
Expected: Custom in-app `<ConfirmModal>` and `<Toast>` with large touch targets.
Actual: `confirm()` / `alert()` used throughout.

---

**Q-22 [LOW]** Finance, Shopping, and Calendar pages do not render loading states
Files: FinancePage.tsx, ShoppingPage.tsx, CalendarPage.tsx
User flow: Open page on slow network → empty state shows for seconds.
Expected: Loading spinner or skeleton while `loading === true` from store.
Actual: `loading` tracked in all stores but never consumed by page components.

---

**Q-23 [LOW]** `setFeatured(null)` uses fragile `.neq('id', '')` trick
File: `src/store/shoppingStore.ts:113–124`
User flow: Un-feature a list → `.neq('id', '')` — relies on UUIDs never being empty strings.
Expected: `.not('id', 'is', null)` or a server RPC.
Actual: Works but semantically fragile.

---

## Recommendations

| Ref | Recommendation |
|-----|----------------|
| Q-01 | Add `if (!activeMember) return <LockScreen />` as the first render in `App.tsx`. |
| Q-02 | Gate `<DevBypass>` behind `import.meta.env.DEV`. |
| Q-03 | Move PIN verification to a Supabase Edge Function using bcrypt. Rotate all plain-text PINs. |
| Q-04 | Implement `QuickInfo` or replace with static placeholder until implemented. |
| Q-05 | Add `'reminders'` to `AppPage`, add nav icon, add to `PageRouter`. Or delete `RemindersPage` and `reminders` table. |
| Q-06 | Decide on one canonical reminders system — rewrite `RemindersPage` to query `calendar_items where type='reminder'` or add sync bridge. |
| Q-07 | After auto-pay in `fetchAll`, show a toast listing auto-paid bills. Write audit log entry per bill. |
| Q-08 | Add `if (!name.trim()) { setError('Name is required'); return; }` in `handleSubmit`. |
| Q-09 | Add `if (amt <= 0) { setError('Amount must be greater than zero'); return; }`. |
| Q-10 | After `buildSplits()`, validate `pctSum <= 100` and block save with error message. |
| Q-11 | Validate `dollarSum <= amt` and block save with error message. |
| Q-12 | Add `if (day < 1 || day > 31)` guard in `handleSubmit`. |
| Q-13 | Add undo toast or confirmation before `deleteNote` fires. Consider `deleted_at` soft-delete. |
| Q-14 | Add try/catch to `updateNote`. Track `savingNoteId` state and show per-note save status. |
| Q-15 | Change `bc.post('UPDATE', { ...note, ...patch })` to `bc.post('UPDATE', { id, patch })`. |
| Q-16 | In `EventDetailBody` when `isBill`, render: `<button onClick={() => navigate('finance')}>Manage in Finance →</button>`. |
| Q-17 | Add `is_featured boolean not null default false` to `shopping_lists` DDL and run migration. |
| Q-18 | Add `hidden boolean not null default false` to `fin_overrides` DDL and run migration. |
| Q-19 | Expand member delete confirmation with cascade impact. Run cleanup query for JSONB split orphans. |
| Q-20 | Implement recurrence-aware scheduling: compute `next_due_date` per chore and only surface when due. |
| Q-21 | Replace all `window.confirm()` and `window.alert()` with a shared `<ConfirmModal>` and `<Toast>`. |
| Q-22 | Read `loading` from store in page components and render `<LoadingSkeleton>` while loading. |
| Q-23 | Replace `.neq('id', '')` with `.not('id', 'is', null)`. |

---

## User Flow Matrix

| Flow | Trigger | Expected | Actual | Severity |
|---|---|---|---|---|
| App boot | Page load | LockScreen shown | Dashboard shown directly | CRITICAL |
| No members in DB | members table empty | Setup wizard or locked | DevBypass grants full access | CRITICAL |
| Member PIN entry | 4 digits entered | Server bcrypt verify | Client-side plain-text compare | CRITICAL |
| Navigate to Reminders | Any nav path | RemindersPage loads | Page unreachable | HIGH |
| Create reminder (RemindersPage) | Add reminder | Appears on CalendarPage | No cross-display | HIGH |
| Finance open after bill due date | Auto-pay enabled | Bills marked paid + notification | Marked paid silently | HIGH |
| Save bill with spaces-only name | Form submit | Validation error | Bill saved with `name: ""` | HIGH |
| Save bill with blank amount | Clear amount | Validation error | Bill saved with `base_amount: 0` | HIGH |
| Manual percent splits > 100% | Two members each 80% | Validation error | Splits saved inflated | HIGH |
| Delete note | Tap X on card | Confirmation / undo | Instant permanent delete | HIGH |
| Type in note (offline) | Network disconnected | Save failure shown | Silent failure | HIGH |
| View bill on calendar | Tap bill chip | "Go to Finance" button | Buttons silently hidden | HIGH |
| `is_featured` column missing | Fresh deployment | Featured list works | Column error; silent fallback | HIGH |
| `hidden` column missing | Fresh deployment | Hide-from-month works | Column error; swipe silently fails | HIGH |
| Delete member | Tap delete | Impact warning + JSONB cleanup | Generic confirm; splits orphaned | MEDIUM |
| Weekly chore day-after | Next day loads | Chore not shown (not due) | Re-appears in "To Do" | MEDIUM |
| Finance/Shopping/Calendar load | Page mount | Loading spinner | Empty state = no data | MEDIUM |
| Any delete action | Tap delete | Custom confirmation | Native confirm() blocks kiosk | MEDIUM |
| QuickInfo on lock screen | Lock screen shown | Live chores + reminder | Hardcoded placeholder | HIGH |
