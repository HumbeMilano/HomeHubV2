# HomeHub — Pixel & Polish Audit Report
**Date:** 2026-04-15 | **Scope:** Design-system compliance, accessibility, responsive breakpoints, animation completeness

---

## Executive Summary

- **Twenty-two hardcoded colour/size violations** exist across widget and page CSS modules, dominated by raw `px` font sizes (10px–15px) that fall entirely outside the 8-stop token scale.
- **The sticky-note `rgba(0,0,0,…)` text colours are intentional** (notes sit on opaque pastel backgrounds) but `NotesWidget.module.css` adds extra raw-px values and a bare `border-radius: 3px` that `NotesPage.module.css` avoids.
- **CalendarWidget duplicates the global modal system** with its own `.modalBackdrop`/`.modalSheet` at a different opacity (0.45 vs global 0.55) despite already using `createPortal`; the global `.popup-backdrop` + `.popup-card` classes would eliminate the divergence.
- **A 255 px viewport gap (769px–1023px) has zero responsive rules** — the sidebar is off, the dock is off, leaving navigation completely absent on iPad-class viewports.
- **Multiple accessibility failures** span interactive `<span>` cells, `<div onClick>` rows, missing `role="dialog"`/`aria-modal` on every modal, no focus traps, and missing `aria-label` on icon-only action buttons.

---

## Findings

### Section 1 — Hardcoded Colour Values

**F-01 [MEDIUM]** Hardcoded `rgba(0,0,0,…)` text on sticky notes — NotesPage
File: `src/features/notes/NotesPage.module.css:67,84,95,102`
Found: `.noteGrip { color: rgba(0,0,0,.3) }` / `.noteDelete { color: rgba(0,0,0,.35) }` / `.noteText { color: rgba(0,0,0,.78) }`
Expected: Intentional — notes always render on `note.color` (opaque pastel). Black text is correct.
Impact: Not theme-breaking; companion px violation tracked separately.

**F-02 [CRITICAL]** `NotesWidget.module.css` — `rgba(0,0,0,…)` text on elements that also sit on `--bg-3` board background
File: `src/features/dashboard/widgets/NotesWidget.module.css:54,63,70,71,82,87`
Found: `.grip { color: rgba(0,0,0,.3) }`, `.del { color: rgba(0,0,0,.35) }`, `.text { color: rgba(0,0,0,.88) }`
Expected: Use `var(--text-3)`, `var(--text-2)`, `var(--text)` for theme-aware colours.
Impact: In dark mode, grip and delete icons on a zero-offset note are invisible against the `--bg-3` board background.

**F-03 [HIGH]** Dashboard `.openBtn` uses hardcoded overlay colours
File: `src/features/dashboard/Dashboard.module.css:111,117`
Found: `background: rgba(0,0,0,0.20)` / `color: rgba(255,255,255,0.75)`
Expected: Promote to a `--scrim-photo` token.
Impact: Undocumented and not token-driven; diverges silently if palette changes.

**F-04 [HIGH]** PinPad card uses hardcoded background colours instead of tokens
File: `src/features/lockscreen/PinPad.module.css:20,23,35,36`
Found: `.card { background: rgba(44,44,46,0.88); border: 0.5px solid rgba(84,84,88,0.5) }`
Expected: `background: var(--bg-3)` / `border: 0.5px solid var(--border)`
Impact: PinPad card will not update if the dark palette changes.

**F-05 [LOW]** PinPad key light-mode `#FFFFFF` background bypasses token
File: `src/features/lockscreen/PinPad.module.css:120`
Found: `background: #FFFFFF` | Expected: `var(--bg-2)`
Impact: Silent divergence if light palette updates.

**F-06 [MEDIUM]** `global.css` nav-item hover/active states use hardcoded `rgba` instead of a token
File: `src/styles/global.css:130,135,139,144`
Found: `rgba(255,255,255,.08)` / `rgba(0,0,0,.06)` for sidebar hover and active states.
Expected: A `--bg-hover` token (dark `rgba(255,255,255,0.08)` / light `rgba(0,0,0,0.06)`)
Impact: Sidebar hover colours will not respond to future token-level changes.

---

### Section 2 — Raw px Font Sizes Outside Token Scale

**F-07 [HIGH]** `global.css` — `.nav-item__label` is `font-size: 10px`
File: `src/styles/global.css:148`
Found: `10px` | Expected: New `--text-3xs: 10px` token.

**F-08 [HIGH]** `CalendarWidget.module.css` — multiple raw px font sizes
File: `src/features/dashboard/widgets/CalendarWidget.module.css:49,59,75,105,115,118,234`
Found: `11px` (day name) / `13px` (day number) / `10px` (chip, chipMore, itemTime) / `14px` (popupTab)
Expected: `var(--text-xs)` for 14px; new `--text-3xs` for 10px; no token for 11px or 13px.

**F-09 [HIGH]** `NotesWidget.module.css` — raw px font sizes
File: `src/features/dashboard/widgets/NotesWidget.module.css:55,61,82`
Found: `11px` (grip) / `10px` (del) / `15px` (note text)
Expected: `var(--text-xs)` for 15px; new `--text-3xs` for 10-11px.

**F-10 [HIGH]** `FinChartWidget.module.css` — raw px in container queries
File: `src/features/dashboard/widgets/FinChartWidget.module.css:72,139`
Found: `10px` / `13px` / `11px`

**F-11 [HIGH]** `FinPersonsWidget.module.css` — raw px in compact container queries
File: `src/features/dashboard/widgets/FinPersonsWidget.module.css:140,141,142`
Found: `13px` / `12px` / `10px`

**F-12 [HIGH]** `FinIncomeWidget.module.css` — `13px` in compact
File: `src/features/dashboard/widgets/FinIncomeWidget.module.css:114`

**F-13 [HIGH]** `FinSummaryWidget.module.css` — `13px` in compact
File: `src/features/dashboard/widgets/FinSummaryWidget.module.css:82`

**F-14 [HIGH]** `BillsTab.module.css` — four raw px values
File: `src/features/finance/BillsTab.module.css:17,133,148,174`
Found: `12px` (hint, delta, splitNote) / `11px` (autoBadge) / `10px` (splitChip)

**F-15 [HIGH]** `IncomeTab.module.css` — `13px` / `12px`
File: `src/features/finance/IncomeTab.module.css:93,97,100`

**F-16 [HIGH]** `ReportTab.module.css` — `13px` / `12px`
File: `src/features/finance/ReportTab.module.css:153,227`

**F-17 [HIGH]** `FinancePage.module.css` — `12px` mobile tab override
File: `src/features/finance/FinancePage.module.css:139`

**F-18 [HIGH]** `ClockWidget.module.css` — `11px` in narrow container query
File: `src/features/dashboard/widgets/ClockWidget.module.css:48`

**F-19 [HIGH]** `AccountsTab.module.css` — `13px`
File: `src/features/finance/AccountsTab.module.css:84`

---

### Section 3 — Raw px Border-Radius

**F-20 [HIGH]** `NotesWidget.module.css` `.del` uses `border-radius: 3px`
File: `src/features/dashboard/widgets/NotesWidget.module.css:66`
Found: `border-radius: 3px` | Expected: `var(--r-xs)` (new 4px token)
Impact: Inconsistent vs full NotesPage which correctly uses `var(--r-sm)`.

**F-21 [MEDIUM]** `CalendarWidget.module.css` — `border-radius: 4px` on chips, `50%` on day numbers
File: `src/features/dashboard/widgets/CalendarWidget.module.css:107,84`
Found: `border-radius: 4px` / `border-radius: 50%` | Expected: `var(--r-xs)` / `var(--r-full)`

**F-22 [MEDIUM]** `CalendarPage.module.css` — `border-radius: 3px` on eventBar
File: `src/features/calendar/CalendarPage.module.css:122,95`
Found: `3px` / `50%` | Expected: `var(--r-xs)` / `var(--r-full)`

**F-23 [MEDIUM]** `ShoppingWidget.module.css` checkbox `border-radius: 3px`
File: `src/features/dashboard/widgets/ShoppingWidget.module.css:76`
Found: `border-radius: 3px` | Expected: `var(--r-xs)`

**F-24 [LOW]** `BillsTab.module.css` — `border-radius: 50%` bypasses `var(--r-full)`
File: `src/features/finance/BillsTab.module.css:81,146,347`

---

### Section 4 — Raw Transition Timing

**F-25 [MEDIUM]** `BillsTab.module.css` swipe background uses `100ms` with no easing
File: `src/features/finance/BillsTab.module.css:42,51`
Found: `transition: background 100ms` | Expected: `transition: background var(--transition)`

**F-26 [MEDIUM]** `PinPad.module.css` overlay entrance uses `220ms ease`
File: `src/features/lockscreen/PinPad.module.css:11`
Found: `animation: fade-in 220ms ease` | Expected: `var(--transition-slow)` (280ms cubic-bezier)

**F-27 [LOW]** Progress bar fill transitions use `0.4s ease` or `500ms` instead of a token
Files: `FinPersonsWidget.module.css:100,105`, `FinIncomeWidget.module.css:82`, `BudgetsTab.module.css:99`, `FinancePage.module.css:83`
Found: `0.4s ease` / `500ms cubic-bezier(0.4,0,0.2,1)` | Expected: `var(--transition-bar)` (new 400ms token)

---

### Section 5 — Modal Backdrop Duplication

**F-28 [HIGH]** `CalendarWidget.module.css` defines its own modal system instead of reusing global classes
File: `src/features/dashboard/widgets/CalendarWidget.module.css:121-143` vs `src/styles/global.css:337-364`
Found: Widget `.modalBackdrop` uses `rgba(0,0,0,0.45)` / `blur(4px)` vs global `.popup-backdrop` `rgba(0,0,0,.55)` / `blur(3px)` — functionally identical intent but different values.
Impact: CalendarWidget popup has lighter, blurrier backdrop than all other modals.

---

### Section 6 — Responsive Breakpoint Gap

**F-29 [CRITICAL]** Navigation disappears on 769px–1023px viewports
Files: `src/styles/global.css:465`, `src/styles/kiosk.css:7`
Found: `max-width: 768px` → dock shows; `min-width: 1024px` → sidebar shows; 769–1023px → neither.
Impact: App is completely non-navigable on iPad portrait, small laptops, and large landscape phones.

---

### Section 7 — Accessibility

**F-30 [HIGH]** CalendarWidget day cells are interactive `<span>` elements — not keyboard accessible
File: `src/features/dashboard/widgets/CalendarWidget.tsx:118-125`

**F-31 [HIGH]** RemindersPage rows are `<div onClick>` — not keyboard accessible
File: `src/features/reminders/RemindersPage.tsx:57-61`

**F-32 [HIGH]** No `role="dialog"` / `aria-modal` / focus trap on any modal in the app
Files: `CalendarWidget.tsx:149`, `ChoresPage.tsx:96-101`, `RemindersPage.tsx:86-101`

**F-33 [HIGH]** ChoresPage delete button has no accessible label
File: `src/features/chores/ChoresPage.tsx:157-159`
Found: `<button>✕</button>` — Unicode character only, no `aria-label`.

**F-34 [MEDIUM]** CalendarWidget add-event button uses `title` without `aria-label`
File: `src/features/dashboard/widgets/CalendarWidget.tsx:201-205`

**F-35 [LOW]** App.tsx sidebar nav buttons use `title` only — missing `aria-current`
File: `src/App.tsx:104-108`

**F-36 [LOW]** NotesPage drag handles have no keyboard repositioning mechanism
File: `src/features/notes/NotesPage.tsx:183-211`

---

### Section 8 — Animation Completeness

**F-37 [MEDIUM]** `PageTransition.tsx` implements enter animation only — exit animation is dead code
File: `src/components/PageTransition.tsx:13-27`
Found: `page-exit`/`page-exit-active` defined in `global.css` but never applied.

**F-38 [MEDIUM]** No staggered list-entry animation in ChoresPage, ShoppingPage, or RemindersPage
Files: CSS modules for those features — no `@keyframes` or `animation` definitions.

**F-39 [LOW]** ShoppingPage has no item appear/disappear animation when items are added or checked

---

## Recommendations

**R-01** (F-02): Replace hardcoded dark rgba in NotesWidget board-level elements with `var(--text-3)` / `var(--text-2)`.

**R-02** (F-04, F-05, F-06): Replace PinPad hardcoded colours with `var(--bg-3)` / `var(--border)`. Add `--bg-hover` token to tokens.css.

**R-03** (F-07–F-19): Add `--text-2xs: 12px` and `--text-3xs: 10px` tokens. Sweep all 20+ raw px font-size values.

**R-04** (F-20–F-24): Add `--r-xs: 4px` token. Replace `border-radius: 3px`/`4px` with `var(--r-xs)` and `50%` with `var(--r-full)`.

**R-05** (F-25–F-27): Standardise transitions to `var(--transition)`. Add `--transition-bar: 400ms cubic-bezier(0.4,0,0.2,1)` token for progress bars.

**R-06** (F-28): Remove `.modalBackdrop`/`.modalSheet` from CalendarWidget.module.css. Use global `.popup-backdrop` / `.popup-card` classes instead.

**R-07** (F-29 — CRITICAL): Add mid-range breakpoint:
```css
@media (min-width: 769px) and (max-width: 1023px) {
  .sidebar { display: flex; }
  .main-content { margin-left: var(--sidebar-width); }
  .bottom-dock { display: none; }
}
```

**R-08** (F-30, F-31): Convert calendar day cells and reminder rows to `<button>` elements.

**R-09** (F-32): Create a reusable `<Modal>` wrapper with `role="dialog"`, `aria-modal="true"`, focus trap on mount, and focus restore on unmount.

**R-10** (F-33–F-35): Add explicit `aria-label` to all icon-only buttons. Add `aria-current="page"` to active nav item.

**R-11** (F-37): Wire up exit animation in PageTransition using `react-transition-group <CSSTransition>` — CSS is already defined in global.css.

**R-12** (F-38): Add `@keyframes item-in` stagger to ChoresPage, RemindersPage, ShoppingPage.

---

## Token Gap Appendix

| Token Name | Suggested Value | Rationale | Files Affected |
|---|---|---|---|
| `--text-3xs` | `10px` | Micro labels: event chips, dock nav label | CalendarWidget, NotesWidget, RemindersWidget, global.css |
| `--text-2xs` | `12px` | Small badges, compact-mode labels, meta text | CalendarWidget, FinChartWidget, FinPersonsWidget, BillsTab, IncomeTab, ReportTab, FinancePage, AccountsTab, ClockWidget |
| `--r-xs` | `4px` | Sub-`--r-sm` radius for checkboxes, event chips | NotesWidget, CalendarWidget, CalendarPage, ShoppingWidget, BillsTab |
| `--bg-hover` | dark `rgba(255,255,255,0.08)` / light `rgba(0,0,0,0.06)` | Semantic hover overlay for glass surfaces | global.css |
| `--scrim-photo` | `rgba(0,0,0,0.55)` | Named value for photo overlay scrims | LockScreen.module.css, Dashboard.module.css |
| `--transition-bar` | `400ms cubic-bezier(0.4,0,0.2,1)` | Intentionally slower data-bar animations | FinPersonsWidget, FinIncomeWidget, FinSummaryWidget, BudgetsTab, FinancePage |

---

**Summary:** 39 findings — 2 CRITICAL · 13 HIGH · 11 MEDIUM · 4 LOW
