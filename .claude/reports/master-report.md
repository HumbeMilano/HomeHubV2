# HomeHub — Master Audit Report
**Date:** 2026-04-15 | **Agents:** Pixel & Polish Inspector (F-xx) · Architecture & Scalability Auditor (A-xx) · Functional QA & Product Reviewer (Q-xx)

---

## Resumen ejecutivo

HomeHub es una aplicación de gestión del hogar con una base visual sólida y varias funciones bien construidas. Sin embargo, la auditoría de tres especialistas reveló problemas que necesitan atención inmediata antes de que la familia use la app con confianza.

Lo más urgente: **la pantalla de bloqueo no funciona**. La app arranca directamente al panel principal sin pedir un PIN a nadie. Además, los PINs de todos los miembros del hogar se guardan y se comparan sin ningún tipo de cifrado — cualquier persona con acceso a las herramientas del navegador puede verlos. Existe también un botón de acceso oculto que aparece si la lista de miembros está vacía, lo que podría dejar entrar a alguien sin contraseña.

En segundo lugar, hay flujos rotos: la página de Recordatorios no aparece en ningún menú de navegación, por lo que nadie puede llegar a ella. Hay detalles del formulario de finanzas donde se pueden guardar facturas con nombre vacío, monto en cero o porcentajes que suman más del 100 %. Las notas se borran con un solo toque sin posibilidad de deshacer, y los errores de guardado pasan en silencio sin avisar al usuario.

Por otro lado, la aplicación tiene muchos aspectos positivos: el diseño visual es atractivo y consistente, las animaciones de navegación están bien pensadas, la sincronización en tiempo real entre tabs funciona (con algunas mejoras pendientes), y el sistema de widgets del panel es flexible y moderno.

Con las correcciones prioritarias aplicadas, HomeHub puede convertirse en una herramienta confiable y segura para toda la familia.

---

## Cross-Cutting Findings

Findings that appear across two or more agent reports, grouped by root issue.

---

### CC-01 — Lock Screen / PIN Security (THREE agents)

**Agents:** A-04, A-05, Q-01, Q-02, Q-03

All three agents independently flagged the same cluster of security failures in the lock screen:

| Sub-issue | Architecture | QA |
|---|---|---|
| LockScreen never rendered — app boots direct to Dashboard | (implied by A-04 context) | Q-01 |
| DevBypass has no `import.meta.env.DEV` guard | A-05 | Q-02 |
| PINs fetched as plaintext and compared client-side | A-04 | Q-03 |

**Root cause:** `authStore.isLocked` initialises to `false`, `App.tsx` never renders `<LockScreen>`, PINs travel over the wire in `select('*')` responses, and `PinPad` does string equality in the browser. DevBypass is unconditional.

**Consolidated fix:** (1) Render `<LockScreen>` in `App.tsx` when `activeMember === null`. (2) Gate `<DevBypass>` behind `import.meta.env.DEV`. (3) Move PIN verification to a Supabase Edge Function using bcrypt; never return the `pin` column to the client.

---

### CC-02 — Notes: silent save failures & no error feedback (TWO agents)

**Agents:** A-07, Q-14, Q-15

- Architecture (A-07): `updateNote` fires a DB `UPDATE` on every keystroke with no debounce; stale closure means broadcast payload may lag DB write.
- QA (Q-14): The `await supabase…update()` result is never checked; errors are swallowed silently.
- QA (Q-15): `notes.find(...)` in the broadcast reads a stale closure, so other tabs receive an outdated note version.

**Root cause:** Single `updateNote` function doing too many things synchronously with no error handling and no debounce.

**Consolidated fix:** Debounce DB writes 400 ms (A-07 rec); add `try/catch` with a per-note save-status indicator (Q-14 rec); broadcast the patch object `{id, patch}` rather than a full stale note (Q-15 rec).

---

### CC-03 — Notes: instant delete with no confirmation (TWO agents)

**Agents:** F-** (Design implied via accessibility F-33 pattern), Q-13

- QA (Q-13): A single tap on X fires `deleteNote` permanently with no undo and no confirmation.
- Design (F-33): Related pattern — icon-only buttons with no `aria-label` throughout (ChoresPage delete button is the exact parallel).

**Root cause:** No confirmation layer or undo mechanism exists for any destructive action.

**Consolidated fix:** Add undo-toast (5-second window) or a `<ConfirmModal>` before `deleteNote` fires; consider `deleted_at` soft-delete column.

---

### CC-04 — BroadcastChannel listener accumulation (TWO agents)

**Agents:** A-01, Q-15 (stale-closure side-effect is caused by the same leak)

- Architecture (A-01): Listeners registered at module scope; HMR reloads accumulate handlers.
- QA (Q-15): Stale closure on Notes broadcasts is a direct consequence of the same unclean listener pattern.

**Root cause:** `bc.listen()` called at module scope with no cleanup path.

**Consolidated fix:** Move all `bc.listen()` calls inside an `initSync()` guarded by `import.meta.hot?.dispose`. Mount via `useEffect` in App.tsx with a cleanup return.

---

### CC-05 — Database schema missing columns (TWO agents)

**Agents:** A-11 (schema context), Q-17, Q-18

- QA (Q-17): `shopping_lists` has no `is_featured` column in DDL — `setFeatured()` fails on fresh deployment.
- QA (Q-18): `fin_overrides` has no `hidden` column in DDL — `hideFromMonth()` fails silently on fresh deployment.
- Architecture (A-11): General finding that anon key can read/write all tables, compounding the impact if missing columns cause runtime errors.

**Consolidated fix:** Add both columns to the migration script and run `supabase db push`. Verify column list against all store methods before any fresh deployment.

---

### CC-06 — No effective RLS + sensitive data over-fetched (TWO agents)

**Agents:** A-11, A-12, Q-03

- Architecture (A-11): RLS is `using (true) with check (true)` — functionally disabled.
- Architecture (A-12): All queries `select('*')` with no column projection, returning `pin` column on every page load.
- QA (Q-03): Client-side PIN comparison relies on the fact that the full PIN value was returned by the server.

**Root cause:** Defence in depth is absent at every layer: no server-side RLS enforcement, no column exclusion, no server-side auth function.

**Consolidated fix:** (1) Add write-blocking RLS policies for the anon role. (2) Exclude `pin` from all client-facing queries. (3) Move PIN verification server-side (see CC-01).

---

### CC-07 — Navigation gap at 769–1023 px (ONE agent, cross-impact)

**Agents:** F-29

While only the Design agent flagged this explicitly, it affects every page in the app and constitutes a product-level breakage (zero navigation on iPad portrait) that the QA scope would have caught given broader device testing.

**Consolidated fix:** Add a CSS `@media (min-width: 769px) and (max-width: 1023px)` rule that enables the sidebar and hides the dock (Design R-07).

---

### CC-08 — Auto-pay: concurrency race + silent execution (TWO agents)

**Agents:** A-02, Q-07

- Architecture (A-02): Two tabs calling `fetchAll()` simultaneously both try to insert the same `(bill_id, month_key)` override row, hitting a DB unique constraint with no error handling.
- QA (Q-07): Auto-pay fires silently with no toast, no audit log, no ability to reverse.

**Root cause:** Auto-pay side-effect inside `fetchAll()` is not idempotent and has no user-facing feedback.

**Consolidated fix:** Change insert to `upsert({…}, { onConflict: 'bill_id,month_key', ignoreDuplicates: true })` (A-02 rec); add a toast after auto-pay listing which bills were marked paid (Q-07 rec).

---

## Conflict Resolutions

### Conflict 1 — Reminders: fix vs. delete

**Architecture (A-10):** Identifies `useCalendar.ts` and related files as dead code to be deleted; does not comment on RemindersPage status.

**QA (Q-05, Q-06):** RemindersPage is unreachable from navigation. The QA report offers two options: (a) wire RemindersPage into the nav, or (b) delete it and the `reminders` table entirely.

**Resolution:** These are not truly contradictory — the arch agent addressed calendar infrastructure dead code, not the reminders feature. The actual conflict is between "fix the nav wiring" and "delete the feature." **Verdict: Fix the nav wiring (P1).** Reminders is a completed component with its own store and DB table. Deleting a working feature is higher risk and higher effort than adding three lines to `AppPage`, `NAV_PAGES`, and `PageRouter`. Address unification of reminders and calendar items in a subsequent sprint (Q-06 recommendation).

---

### Conflict 2 — DevBypass severity

**Architecture (A-05):** Rates DevBypass as CRITICAL but places it at P0, noting the empty-members condition can occur if the fetch fails silently.

**QA (Q-02):** Also CRITICAL, with the additional attack vector of an attacker intentionally truncating `household_members`.

**Resolution:** Both agents agree on CRITICAL. The QA agent's adversarial framing reinforces the arch agent's reliability framing. No conflict in outcome — **P0, fix effort S (one `import.meta.env.DEV` conditional)**. Both findings are merged under CC-01.

---

### Conflict 3 — `select('*')` impact assessment

**Architecture (A-12):** Characterises `select('*')` primarily as a performance and memory issue (unbounded data, no pagination).

**QA (Q-03):** Characterises the same `select('*')` on `household_members` primarily as a security issue (PIN column exposed).

**Resolution:** Both framings are correct and complementary, not contradictory. **The security framing takes precedence** for prioritisation (P0 for PIN column exposure; remaining `select('*')` instances are P2 for performance). The consolidated fix addresses both: exclude `pin` immediately, add column projection and `.limit()` in a follow-up pass.

---

## Priority Action Plan

### P0 — Crítico (fix before next use)

| # | Title | Agents | Key File | Effort |
|---|---|---|---|---|
| 1 | Wire LockScreen into App.tsx — app currently boots with no auth | Q-01 | `src/App.tsx` | XS |
| 2 | Gate DevBypass behind `import.meta.env.DEV` | A-05, Q-02 | `src/features/lockscreen/LockScreen.tsx` | XS |
| 3 | Move PIN verification server-side (Edge Function + bcrypt); exclude `pin` from client queries | A-04, Q-03 | `src/features/lockscreen/PinPad.tsx` | M |
| 4 | Add missing `is_featured` column to `shopping_lists` DDL | Q-17 | DB migration file | XS |
| 5 | Add missing `hidden` column to `fin_overrides` DDL | Q-18 | DB migration file | XS |

---

### P1 — Alta prioridad (fix this sprint)

| # | Title | Agents | Key File | Effort |
|---|---|---|---|---|
| 6 | Fix BroadcastChannel listener leak — move `bc.listen()` inside `useEffect` with cleanup | A-01, Q-15 | `src/store/financeStore.ts` (+ 5 other stores) | M |
| 7 | Fix auto-pay race condition — use `upsert` with `ignoreDuplicates: true` | A-02 | `src/store/financeStore.ts` | S |
| 8 | Add auto-pay toast notification and audit log entry | Q-07 | `src/store/financeStore.ts` | S |
| 9 | Fix navigation gap 769–1023 px (iPad/small laptop dead zone) | F-29 | `src/styles/global.css` | XS |
| 10 | Wire RemindersPage into AppPage union, NAV_PAGES, and PageRouter | Q-05 | `src/App.tsx` + `src/types/index.ts` | XS |
| 11 | Debounce Notes `updateNote` to 400 ms; add `try/catch` with save-status indicator | A-07, Q-14 | `src/features/notes/NotesPage.tsx` | S |
| 12 | Add confirmation / undo-toast before `deleteNote` fires | Q-13 | `src/features/notes/NotesPage.tsx` | S |
| 13 | Bill form: add JS validation for blank name, zero/negative amount, `due_day` range | Q-08, Q-09, Q-12 | `src/features/finance/BillsTab.tsx` | S |
| 14 | Bill form: validate percent splits ≤ 100% and dollar splits ≤ bill total | Q-10, Q-11 | `src/features/finance/BillsTab.tsx` | S |
| 15 | Replace all `window.confirm()` / `window.alert()` with `<ConfirmModal>` and `<Toast>` | Q-21 | New `src/components/ConfirmModal.tsx` | M |
| 16 | Add RLS write-blocking policies for anon role on all tables | A-11 | Supabase dashboard / migration | L |
| 17 | NotesWidget: replace hardcoded `rgba` text colours with `var(--text)` tokens (dark mode invisible) | F-02 | `src/features/dashboard/widgets/NotesWidget.module.css` | XS |
| 18 | Create reusable `<Modal>` with `role="dialog"`, `aria-modal`, focus trap | F-32 | New `src/components/Modal.tsx` | M |

---

### P2 — Backlog (mejoras futuras)

| # | Title | Agents | Key File | Effort |
|---|---|---|---|---|
| 19 | Memoize `fin_overrides` derived helpers — replace O(n×m) loops with Map lookups | A-06 | `src/store/financeStore.ts` | M |
| 20 | Add broadcast payload shape guards before every `as unknown as T` cast | A-03 | All store files | M |
| 21 | Fix duplicate realtime channel names — append UUID suffix per `subscribeToTable` call | A-08 | `src/lib/realtime.ts` | S |
| 22 | Throttle Dashboard ResizeObserver with `requestAnimationFrame` | A-09 | `src/features/dashboard/Dashboard.tsx` | S |
| 23 | Delete orphaned dead code: `useCalendar.ts`, `EventChip`, `MonthView`, `WeekView`; extract shared `billsToItems` | A-10 | `src/features/calendar/useCalendar.ts` | S |
| 24 | Add column projection (exclude `pin`) and `.limit(500)` to all `fetchAll()` queries | A-12 | All store `fetchAll()` implementations | M |
| 25 | Verify `activeMember` from localStorage against DB on app init | A-13 | `src/store/authStore.ts` | S |
| 26 | Add `--text-2xs: 12px` and `--text-3xs: 10px` tokens; sweep all raw `px` font-size values | F-07–F-19 | `src/styles/tokens.css` | M |
| 27 | Add `--r-xs: 4px` token; replace `border-radius: 3px/4px` and `50%` with token variables | F-20–F-24 | `src/styles/tokens.css` | S |
| 28 | Add `--bg-hover`, `--scrim-photo`, `--transition-bar` tokens; update consuming files | F-03, F-06, F-25–F-27 | `src/styles/tokens.css` | S |
| 29 | Remove CalendarWidget's duplicate modal backdrop; use global `.popup-backdrop` | F-28 | `src/features/dashboard/widgets/CalendarWidget.module.css` | XS |
| 30 | Convert CalendarWidget day cells and RemindersPage rows from `<span>`/`<div>` to `<button>` | F-30, F-31 | `CalendarWidget.tsx` + `RemindersPage.tsx` | S |
| 31 | Add `aria-label` to all icon-only buttons; add `aria-current="page"` to active nav item | F-33–F-35 | `ChoresPage.tsx`, `App.tsx` | S |
| 32 | Replace hardcoded PinPad colours with `var(--bg-3)` / `var(--border)` tokens | F-04, F-05 | `src/features/lockscreen/PinPad.module.css` | XS |
| 33 | Wire up exit animation in `PageTransition.tsx` | F-37 | `src/components/PageTransition.tsx` | S |
| 34 | Add staggered list-entry animation to ChoresPage, RemindersPage, ShoppingPage | F-38 | Feature CSS modules | S |
| 35 | Implement recurrence-aware scheduling for chores (weekly/monthly only appears when due) | Q-20 | `src/features/chores/ChoresPage.tsx` | M |
| 36 | Unify Reminders and CalendarPage data — query `calendar_items where type='reminder'` | Q-06 | `src/store/remindersStore.ts` | M |
| 37 | Add loading skeletons to Finance, Shopping, and Calendar pages | Q-22 | `FinancePage.tsx`, `ShoppingPage.tsx`, `CalendarPage.tsx` | S |
| 38 | Add calendar bill item "Manage in Finance →" deep-link in EventDetail | Q-16 | `src/features/calendar/EventDetail.tsx` | XS |
| 39 | Expand member-delete confirmation to list cascade and JSONB split orphan impact | Q-19 | `src/features/members/MembersPage.tsx` | S |
| 40 | Replace `setFeatured(null)` `.neq('id','')` trick with `.not('id','is',null)` | Q-23 | `src/store/shoppingStore.ts` | XS |
| 41 | Implement `QuickInfo` on lock screen with live chore count + next reminder | Q-04 | `src/features/lockscreen/LockScreen.tsx` | M |

---

## What Is Working Well

- **Real-time cross-tab sync architecture is well-conceived.** Every feature store has a BroadcastChannel layer and Supabase Realtime subscription — the plumbing is in place; the issues are around cleanup and validation, not the fundamental design.
- **Widget system is modern and flexible.** The dashboard uses `ResizeObserver` with container queries to adapt widget layouts at component level — a genuinely scalable approach that many production apps lack.
- **Design token system is structurally sound.** A `tokens.css` file exists and is partially adopted. The violations found are gaps in coverage, not an absence of system — the remediation path is straightforward additions of ~6 new tokens.
- **Finance feature is the most complete module.** Bills, budgets, income tracking, split logic, per-bill overrides, and a reporting tab are all present and wired to the database. The issues found are validation gaps and UX polish, not architectural holes.
- **Page transition animations are defined and partially wired.** `PageTransition.tsx` with `global.css` `@keyframes` represents real polish investment; the enter animation already works, and the exit animation only needs to be connected — not rebuilt.

---

## Full Finding Index

| ID | Agent | Title | Severity | Priority |
|---|---|---|---|---|
| Q-01 | QA | LockScreen never rendered — app boots to Dashboard | CRITICAL | P0 |
| A-05 | Arch | DevBypass has no production build guard | CRITICAL | P0 |
| Q-02 | QA | DevBypass grants full access when members table is empty | CRITICAL | P0 |
| A-04 | Arch | PIN stored and compared as plaintext client-side | CRITICAL | P0 |
| Q-03 | QA | PINs compared plain-text; full `pin` column sent to browser | CRITICAL | P0 |
| Q-17 | QA | `shopping_lists` missing `is_featured` column in DDL | HIGH | P0 |
| Q-18 | QA | `fin_overrides` missing `hidden` column in DDL | HIGH | P0 |
| A-01 | Arch | BroadcastChannel listeners leak on every HMR reload | CRITICAL | P1 |
| A-02 | Arch | Auto-pay side-effect inside `fetchAll()` is not concurrency-safe | CRITICAL | P1 |
| Q-07 | QA | Auto-pay fires silently — no notification or audit trail | HIGH | P1 |
| F-29 | Design | Navigation disappears on 769–1023 px viewports | CRITICAL | P1 |
| Q-05 | QA | Reminders page is completely unreachable from navigation | HIGH | P1 |
| A-07 | Arch | Notes `updateNote` fires DB UPDATE on every keystroke (no debounce) | HIGH | P1 |
| Q-14 | QA | Notes save failures are completely silent | HIGH | P1 |
| Q-13 | QA | Notes delete fires instantly with no confirmation or undo | HIGH | P1 |
| Q-08 | QA | Bill name: whitespace-only names pass validation, saved as empty | HIGH | P1 |
| Q-09 | QA | Bill amount: `parseFloat('')\|\|0` saves $0; negatives accepted | HIGH | P1 |
| Q-10 | QA | Manual percent splits: no validation that sum ≤ 100% | HIGH | P1 |
| Q-11 | QA | Manual dollar splits: no validation that sum ≤ bill total | MEDIUM | P1 |
| Q-12 | QA | `due_day`: negative values stored, produce bills in prior month | MEDIUM | P1 |
| Q-21 | QA | All pages use native `confirm()`/`alert()` — inappropriate for kiosk | MEDIUM | P1 |
| A-11 | Arch | No effective RLS — anon key grants unrestricted read/write | MEDIUM | P1 |
| F-02 | Design | NotesWidget hardcoded rgba text — invisible in dark mode | CRITICAL | P1 |
| F-32 | Design | No `role="dialog"` / `aria-modal` / focus trap on any modal | HIGH | P1 |
| A-03 | Arch | `as unknown as T` casts at broadcast boundaries — no runtime validation | HIGH | P2 |
| A-06 | Arch | `fin_overrides` O(n×m) iterations — no memoisation | HIGH | P2 |
| A-08 | Arch | `subscribeToTable` duplicate channel names — subscriptions conflict | HIGH | P2 |
| A-09 | Arch | ResizeObserver fires 60+/sec during resize — no debounce | MEDIUM | P2 |
| A-10 | Arch | Dead code (useCalendar, EventChip, MonthView, WeekView) + `billsToItems` duplication | MEDIUM | P2 |
| A-12 | Arch | All queries `select('*')` — no column projection, no pagination, no cancellation | MEDIUM | P2 |
| A-13 | Arch | Active member in localStorage can be forged — no server-side verification | MEDIUM | P2 |
| F-03 | Design | Dashboard `.openBtn` uses hardcoded overlay colours | HIGH | P2 |
| F-04 | Design | PinPad card uses hardcoded background colours instead of tokens | HIGH | P2 |
| F-05 | Design | PinPad key light-mode `#FFFFFF` bypasses token | LOW | P2 |
| F-06 | Design | `global.css` nav hover/active states use hardcoded `rgba` | MEDIUM | P2 |
| F-07 | Design | `global.css` `.nav-item__label` is raw `10px` font-size | HIGH | P2 |
| F-08 | Design | CalendarWidget — multiple raw px font sizes | HIGH | P2 |
| F-09 | Design | NotesWidget — raw px font sizes | HIGH | P2 |
| F-10 | Design | FinChartWidget — raw px in container queries | HIGH | P2 |
| F-11 | Design | FinPersonsWidget — raw px in compact container queries | HIGH | P2 |
| F-12 | Design | FinIncomeWidget — `13px` in compact | HIGH | P2 |
| F-13 | Design | FinSummaryWidget — `13px` in compact | HIGH | P2 |
| F-14 | Design | BillsTab — four raw px values | HIGH | P2 |
| F-15 | Design | IncomeTab — `13px` / `12px` | HIGH | P2 |
| F-16 | Design | ReportTab — `13px` / `12px` | HIGH | P2 |
| F-17 | Design | FinancePage — `12px` mobile tab override | HIGH | P2 |
| F-18 | Design | ClockWidget — `11px` in narrow container query | HIGH | P2 |
| F-19 | Design | AccountsTab — `13px` | HIGH | P2 |
| F-20 | Design | NotesWidget `.del` uses raw `border-radius: 3px` | HIGH | P2 |
| F-21 | Design | CalendarWidget — raw `border-radius: 4px` and `50%` on chips | MEDIUM | P2 |
| F-22 | Design | CalendarPage — raw `border-radius: 3px` on eventBar | MEDIUM | P2 |
| F-23 | Design | ShoppingWidget checkbox `border-radius: 3px` | MEDIUM | P2 |
| F-24 | Design | BillsTab — `border-radius: 50%` bypasses `var(--r-full)` | LOW | P2 |
| F-25 | Design | BillsTab swipe background uses raw `100ms` transition | MEDIUM | P2 |
| F-26 | Design | PinPad overlay uses raw `220ms ease` instead of token | MEDIUM | P2 |
| F-27 | Design | Progress bar fills use raw `0.4s`/`500ms` instead of token | LOW | P2 |
| F-28 | Design | CalendarWidget duplicates global modal system with different values | HIGH | P2 |
| F-30 | Design | CalendarWidget day cells are interactive `<span>` — not keyboard accessible | HIGH | P2 |
| F-31 | Design | RemindersPage rows are `<div onClick>` — not keyboard accessible | HIGH | P2 |
| F-33 | Design | ChoresPage delete button has no `aria-label` | HIGH | P2 |
| F-34 | Design | CalendarWidget add-event button uses `title` without `aria-label` | MEDIUM | P2 |
| F-35 | Design | App.tsx sidebar nav buttons missing `aria-current` | LOW | P2 |
| F-36 | Design | NotesPage drag handles have no keyboard repositioning | LOW | P2 |
| F-37 | Design | `PageTransition.tsx` exit animation is dead code | MEDIUM | P2 |
| F-38 | Design | No staggered list-entry animation in Chores/Shopping/Reminders | MEDIUM | P2 |
| F-39 | Design | ShoppingPage has no item appear/disappear animation | LOW | P2 |
| Q-04 | QA | QuickInfo always shows hardcoded "Today's chores loading…" placeholder | HIGH | P2 |
| Q-06 | QA | `reminders` table and `calendar_items` are isolated — no cross-display | HIGH | P2 |
| Q-15 | QA | Notes `updateNote` broadcasts stale pre-patch note data to other tabs | MEDIUM | P2 |
| Q-16 | QA | Calendar bill items: edit/delete hidden with no Finance deep-link | HIGH | P2 |
| Q-19 | QA | Member delete: no warning about cascading chore history or orphaned JSONB splits | MEDIUM | P2 |
| Q-20 | QA | Chores: all recurrences appear every day regardless of schedule | MEDIUM | P2 |
| Q-22 | QA | Finance, Shopping, Calendar pages do not render loading states | LOW | P2 |
| Q-23 | QA | `setFeatured(null)` uses fragile `.neq('id','')` trick | LOW | P2 |
| F-01 | Design | Hardcoded `rgba(0,0,0,…)` text on sticky notes — intentional (pastel bg) | LOW | — |

---

*Total findings consolidated: 71 (2 marked intentional/non-issue after reconciliation)*
*P0: 7 · P1: 17 · P2: 46*
