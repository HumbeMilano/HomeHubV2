# HomeHub

Household management app: calendar, shopping, finance, notes, and member management. Built for kiosk-mode tablet (landscape) and mobile (portrait).

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + Vite 5 |
| Language | TypeScript |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| State | Zustand |
| Styling | CSS Modules + CSS custom properties |
| Real-time | Supabase Realtime (cross-device) + BroadcastChannel (same-browser tabs) |
| Date utils | date-fns |

## Key Directories

| Path | Purpose |
|---|---|
| `src/lib/` | Infrastructure: `supabase.ts`, `realtime.ts`, `broadcast.ts`, `utils.ts` |
| `src/types/index.ts` | All shared TypeScript interfaces |
| `src/store/` | Zustand stores: `authStore`, `appStore`, `calendarStore`, `financeStore`, etc. |
| `src/features/<name>/` | Each module owns its page, CSS module, and hooks |
| `src/styles/` | `tokens.css` (design tokens), `global.css` (base styles + components) |
| `src/components/` | Shared UI primitives |

## Entry Points

- `src/main.tsx` — React root, imports global CSS, sets initial theme
- `src/App.tsx` — App shell, lock-screen gate, sidebar/bottom-nav, `PageRouter`
- `src/features/lockscreen/LockScreen.tsx` — Full-screen lock with photo slideshow + PIN pad

## Build Commands

```bash
npm run dev      # Vite dev server with HMR
npm run build    # Production build → dist/
npm run preview  # Serve dist/ locally
npx tsc --noEmit # Type-check only (no build)
```

## Environment Variables

Copy `.env.example` → `.env` and fill in Supabase credentials:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Git Workflow

Before starting work on any new page or feature, always create a dedicated branch:
```bash
git checkout -b feature/<page-name>
```
Example: `git checkout -b feature/members`, `git checkout -b feature/calendar`.

---

## Design System — iOS HIG

The app follows Apple's Human Interface Guidelines. All tokens live in `src/styles/tokens.css`.

### Typography
- **Font stack**: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`
- No Google Fonts import — uses the system SF Pro font on Apple devices, fallback on others.
- Font sizes map to iOS text styles: caption2 (11px) → footnote (13px) → subhead (15px) → body (17px) → title3 (20px) → title2 (22px) → title1 (28px) → largeTitle (40px)
- Clock widget uses `font-weight: 300` with `letter-spacing: -2px` (iOS lock screen style)

### Color Palette

| Token | Dark | Light | Usage |
|---|---|---|---|
| `--bg` | `#000000` | `#F2F2F7` | OLED black / grouped background |
| `--bg-2` | `#1C1C1E` | `#FFFFFF` | Cards, panels |
| `--bg-3` | `#2C2C2E` | `#F2F2F7` | Inputs, secondary fills |
| `--bg-4` | `#3A3A3C` | `#E5E5EA` | Elevated surfaces |
| `--bg-glass` | `rgba(28,28,30,0.82)` | `rgba(242,242,247,0.82)` | Frosted-glass nav bars |
| `--border` | `rgba(84,84,88,0.65)` | `rgba(60,60,67,0.29)` | iOS separator (translucent hairline) |
| `--text` | `#FFFFFF` | `#000000` | Primary label |
| `--text-2` | `rgba(235,235,245,0.60)` | `rgba(60,60,67,0.60)` | Secondary label |
| `--text-3` | `rgba(235,235,245,0.30)` | `rgba(60,60,67,0.30)` | Tertiary label |
| `--accent` | `#0A84FF` | `#007AFF` | iOS system blue |
| `--success` | `#30D158` | `#34C759` | iOS system green |
| `--warning` | `#FF9F0A` | `#FF9500` | iOS system orange |
| `--danger` | `#FF453A` | `#FF3B30` | iOS system red |

### Border Radius

| Token | Value | Usage |
|---|---|---|
| `--r-sm` | `10px` | Tags, chips, small elements |
| `--r-md` | `13px` | Inputs, buttons (ghost), small cards |
| `--r-lg` | `16px` | Cards, panels, list containers |
| `--r-xl` | `22px` | Sheets, modals, pin card |
| `--r-full` | `9999px` | Pills, toggles, primary buttons, avatars |

### Separators & Borders
- Use `0.5px solid var(--border)` for hairline separators (list rows, dividers)
- Cards have **no border** — use `box-shadow: var(--shadow-sm)` and background contrast instead
- Focus ring: `box-shadow: 0 0 0 3px var(--accent-dim)` on inputs

### Frosted Glass
Apply to navigation surfaces (topbar, bottom-nav, sidebar, popup overlays):
```css
background: var(--bg-glass);
backdrop-filter: blur(24px) saturate(180%);
-webkit-backdrop-filter: blur(24px) saturate(180%);
```

### Buttons
| Class | Shape | Use |
|---|---|---|
| `.btn--primary` | `border-radius: var(--r-full)` pill | Primary CTA |
| `.btn--ghost` | `border-radius: var(--r-md)` rounded rect | Secondary actions |
| `.btn--icon` | `border-radius: var(--r-md)` | Icon-only toolbar buttons |
| `.btn--danger` | pill | Destructive action |

Primary buttons use `opacity: 0.88` on hover instead of a darker bg (iOS style).
All buttons scale `transform: scale(0.97)` on `:active`.

### Segmented Control (iOS tabs)
```css
.tabs {
  display: flex;
  background: var(--bg-3);
  border-radius: var(--r-full);
  padding: 3px;
}
.tab { border-radius: var(--r-full); }
.tabActive { background: var(--bg-2); box-shadow: var(--shadow-sm); }
```

### PIN Pad Keys
Full-pill shape (`border-radius: var(--r-full)`), translucent fill (`rgba(120,120,128,0.22)`), `transform: scale(0.93)` on active. Matches iOS lock screen numpad.

### Transitions
| Token | Value | Use |
|---|---|---|
| `--transition` | `180ms cubic-bezier(0.4,0,0.2,1)` | Standard UI state changes |
| `--transition-slow` | `350ms cubic-bezier(0.4,0,0.2,1)` | Sheet/sidebar slide-in |
| `--transition-spring` | `420ms cubic-bezier(0.34,1.56,0.64,1)` | Bounce: swatches, checkboxes, tabs |

### Checkboxes
Shopping list uses **circular** checkboxes (`border-radius: 50%`) — matches iOS Reminders app.

---

## Additional Documentation

| File | When to check |
|---|---|
| `.claude/docs/architectural_patterns.md` | State management, real-time sync, optimistic updates, feature folder conventions |
| `.claude/docs/database_schema.md` | Full Supabase table definitions and migration SQL |

## Rules
read files first. Write complete solution. test once. No over-engineering.
