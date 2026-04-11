# HomeHub

Household management app: chores, calendar, shopping, reminders, finance, notes, and member management. Built for kiosk-mode tablet (landscape) and mobile (portrait).

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite 5 |
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
| `src/store/` | Zustand stores: `authStore`, `appStore`, `choresStore`, `financeStore` |
| `src/features/<name>/` | Each module owns its page, CSS module, and hooks |
| `src/styles/` | `tokens.css` (CSS vars), `global.css`, `kiosk.css` |
| `src/components/` | Shared UI primitives (Modal, Button, etc.) |

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

## Additional Documentation

| File | When to check |
|---|---|
| `.claude/docs/architectural_patterns.md` | State management, real-time sync, optimistic updates, feature folder conventions |
| `.claude/docs/database_schema.md` | Full Supabase table definitions and migration SQL |
