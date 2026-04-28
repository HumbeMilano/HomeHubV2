import { useEffect, useMemo, useRef, useState } from 'react';
import GridLayout, { type LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import {
  Clock, Bell, ShoppingCart, Calendar, FileText, CloudSun,
  LayoutDashboard, List, PieChart, TrendingUp, Users2,
  Plus, Check, ChevronRight, X, Columns2, GripHorizontal, RotateCcw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import type { AppPage } from '../../types';
import WidgetWrapper from './widgets/WidgetWrapper';
import ClockWidget from './widgets/ClockWidget';
import RemindersWidget from './widgets/RemindersWidget';
import ShoppingWidget from './widgets/ShoppingWidget';
import FinSummaryWidget from './widgets/FinSummaryWidget';
import FinBillsWidget from './widgets/FinBillsWidget';
import FinChartWidget from './widgets/FinChartWidget';
import FinIncomeWidget from './widgets/FinIncomeWidget';
import FinPersonsWidget from './widgets/FinPersonsWidget';
import CalendarWidget from './widgets/CalendarWidget';
import NotesWidget from './widgets/NotesWidget';
import WeatherWidget from './widgets/WeatherWidget';
import styles from './Dashboard.module.css';

// ── Types ──────────────────────────────────────────────────────────────────
type WidgetType =
  | 'clock' | 'reminders' | 'shopping' | 'calendar' | 'notes' | 'weather'
  | 'finSummary' | 'finBills' | 'finChart' | 'finIncome' | 'finPersons';

interface WidgetDef { id: string; type: WidgetType; }

const WIDGET_LABELS: Record<WidgetType, string> = {
  clock:      'Reloj',
  reminders:  'Recordatorios',
  shopping:   'Compras',
  calendar:   'Calendario',
  notes:      'Notas',
  weather:    'Clima',
  finSummary: 'Finanzas',
  finBills:   'Facturas',
  finChart:   'Gastos',
  finIncome:  'Ingresos',
  finPersons: 'Por persona',
};

const WIDGET_ICONS: Record<WidgetType, LucideIcon> = {
  clock:      Clock,
  reminders:  Bell,
  shopping:   ShoppingCart,
  calendar:   Calendar,
  notes:      FileText,
  weather:    CloudSun,
  finSummary: LayoutDashboard,
  finBills:   List,
  finChart:   PieChart,
  finIncome:  TrendingUp,
  finPersons: Users2,
};

// Navigation targets per widget
const WIDGET_TARGET: Partial<Record<WidgetType, AppPage>> = {
  calendar:   'calendar',
  shopping:   'shopping',
  finSummary: 'finance',
  finBills:   'finance',
  finChart:   'finance',
  finIncome:  'finance',
  finPersons: 'finance',
  reminders:  'reminders',
  notes:      'notes',
};

// Persistence key for user-configured half-width pairs
const MOBILE_PAIRS_KEY = 'homehub-dash-mobile-pairs';

// ── Default layout (5 core widgets) ───────────────────────────────────────
// Calendar first so it lands in the initial fold of the mobile feed (~375px viewport).
// Existing users keep their localStorage-saved order; only fresh installs and
// "Restablecer por defecto" pick this up. Desktop still positions widgets via
// DEFAULT_LAYOUT (x/y coords), which is unaffected by array order.
const DEFAULT_WIDGETS: WidgetDef[] = [
  { id: 'calendar',   type: 'calendar'   },
  { id: 'clock',      type: 'clock'      },
  { id: 'weather',    type: 'weather'    },
  { id: 'finSummary', type: 'finSummary' },
  { id: 'finBills',   type: 'finBills'   },
  { id: 'shopping',   type: 'shopping'   },
];

const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'clock',      x: 0,  y: 0,  w: 2, h: 2, minW: 2, minH: 1 },
  { i: 'weather',    x: 2,  y: 0,  w: 3, h: 2, minW: 2, minH: 1 },
  { i: 'finSummary', x: 5,  y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
  { i: 'finBills',   x: 0,  y: 2,  w: 5, h: 4, minW: 2, minH: 3 },
  { i: 'calendar',   x: 5,  y: 2,  w: 7, h: 5, minW: 4, minH: 4 },
  { i: 'shopping',   x: 0,  y: 6,  w: 5, h: 5, minW: 2, minH: 2 },
];

// ── Persistence ────────────────────────────────────────────────────────────
const LAYOUT_KEY  = 'homehub-dash-layout';
const WIDGETS_KEY = 'homehub-dash-widgets';

function loadLayout(): LayoutItem[] {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '') as LayoutItem[];
    return Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_LAYOUT;
  } catch { return DEFAULT_LAYOUT; }
}

function loadWidgets(): WidgetDef[] {
  try {
    const saved = JSON.parse(localStorage.getItem(WIDGETS_KEY) ?? '') as WidgetDef[];
    return Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_WIDGETS;
  } catch { return DEFAULT_WIDGETS; }
}

// ── Greeting ───────────────────────────────────────────────────────────────
function greeting(name: string) {
  const h = new Date().getHours();
  const time = h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
  return `${time}, ${name}`;
}

const GRID_PADDING = [0, 0] as [number, number];
const ALL_WIDGET_TYPES = Object.keys(WIDGET_LABELS) as WidgetType[];

// ── Component ──────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { activeMember } = useAuthStore();
  const { navigate, dashboardEditMode, setDashboardEditMode } = useAppStore();

  const [addOpen, setAddOpen]   = useState(false);
  const [widgets, setWidgets]   = useState<WidgetDef[]>(loadWidgets);
  const [layout,  setLayout]    = useState<LayoutItem[]>(loadLayout);
  const [mobileHalfWidgets, setMobileHalfWidgets] = useState<WidgetType[]>(() => {
    try { return JSON.parse(localStorage.getItem(MOBILE_PAIRS_KEY) ?? '["clock","weather"]') as WidgetType[]; }
    catch { return ['clock', 'weather']; }
  });
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(() =>
    typeof window !== 'undefined'
      ? Math.max(300, window.innerWidth - 64 - 40)
      : 1200
  );

  // ── Pointer-event drag state for mobile reorder ───────────────────────────
  // dragRowIdx triggers a re-render at drag start (so we can apply the
  // .draggingRow class). All per-frame motion is direct DOM via refs to keep
  // 60fps on phones. The ref carries the imperative state — measurements
  // captured at drag start, the press timer, the rAF id, the live target idx.
  const [dragRowIdx, setDragRowIdx] = useState<number | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    rowIdx: number;
    pointerId: number;
    target: HTMLElement;
    startY: number;
    currentY: number;
    pressTimer: number | null;
    rafId: number | null;
    started: boolean;
    cardEls: HTMLElement[];
    cardOffsets: number[];
    cardHeights: number[];
    draggedHeight: number;
    rowGap: number;
    targetIdx: number;
  } | null>(null);

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 600
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 599px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const gridConfig = useMemo(() => {
    if (containerWidth < 600) {
      return { cols: 2, rowHeight: 120, margin: [4, 4] as [number, number] };
    }
    if (containerWidth < 900) {
      return { cols: 4, rowHeight: 100, margin: [10, 10] as [number, number] };
    }
    return { cols: 12, rowHeight: 80, margin: [10, 10] as [number, number] };
  }, [containerWidth]);

  useEffect(() => {
    const el = document.querySelector('.page-area') as HTMLElement | null;
    if (!el) return;
    let rafId = 0;
    const obs = new ResizeObserver((entries) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const w = entries[0]?.contentRect.width;
        if (w) setContainerWidth(w - 40);
      });
    });
    obs.observe(el);
    setContainerWidth(el.clientWidth - 40);
    return () => { cancelAnimationFrame(rafId); obs.disconnect(); };
  }, []);

  useEffect(() => { localStorage.setItem(WIDGETS_KEY,    JSON.stringify(widgets));          }, [widgets]);
  useEffect(() => { localStorage.setItem(LAYOUT_KEY,     JSON.stringify(layout));            }, [layout]);
  useEffect(() => { localStorage.setItem(MOBILE_PAIRS_KEY, JSON.stringify(mobileHalfWidgets)); }, [mobileHalfWidgets]);

  // Reset edit mode when leaving dashboard so it doesn't auto-resume on return.
  useEffect(() => () => setDashboardEditMode(false), [setDashboardEditMode]);

  const activeTypes    = widgets.map((w) => w.type);
  const availableTypes = ALL_WIDGET_TYPES.filter((t) => !activeTypes.includes(t));

  function addWidget(type: WidgetType) {
    setWidgets((ws) => [...ws, { id: type, type }]);
    setLayout((ls) => [...ls, { i: type, x: 0, y: Infinity, w: 3, h: 3, minW: 2, minH: 1 }]);
    setAddOpen(false);
  }

  function removeWidget(id: string) {
    const removed = widgets.find((w) => w.id === id);
    setWidgets((ws) => ws.filter((w) => w.id !== id));
    setLayout((ls) => ls.filter((l) => l.i !== id));
    // If the removed widget was paired, drop the orphaned partner from the
    // half-pair set too — otherwise it lingers as a "marked half" with no
    // partner, which is harmless but messy.
    if (removed && mobileHalfWidgets.includes(removed.type)) {
      const idx = widgets.findIndex((w) => w.id === id);
      const prev = widgets[idx - 1];
      const next = widgets[idx + 1];
      const partner =
        (prev && mobileHalfWidgets.includes(prev.type)) ? prev.type :
        (next && mobileHalfWidgets.includes(next.type)) ? next.type :
        null;
      setMobileHalfWidgets((arr) => arr.filter((t) => t !== removed.type && t !== partner));
    }
  }

  // Whole-card tap → widget's full page. Skip if click landed on an interactive
  // descendant (button, input, role="button" span/li/div) so toggles, deletes,
  // day cells, etc. keep working without manual stopPropagation everywhere.
  const INTERACTIVE_INSIDE_CARD = 'button, a, input, textarea, select, [role="button"]';
  function handleCardClick(e: React.MouseEvent, target: AppPage) {
    if (dashboardEditMode) return;
    const interactive = (e.target as HTMLElement).closest(INTERACTIVE_INSIDE_CARD);
    // closest() walks up including the element itself. The card has role="button",
    // so without this guard every card click matches the selector and short-circuits.
    // Skip navigation only when the matching ancestor is INSIDE the card, not when
    // it IS the card (e.currentTarget).
    if (interactive && interactive !== e.currentTarget) return;
    navigate(target);
  }
  function handleCardKeyDown(e: React.KeyboardEvent, target: AppPage) {
    if (dashboardEditMode) return;
    if (e.target !== e.currentTarget) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    navigate(target);
  }

  function resetLayout() {
    setWidgets(DEFAULT_WIDGETS);
    setLayout(DEFAULT_LAYOUT);
    setMobileHalfWidgets(['clock', 'weather']);
    localStorage.setItem(WIDGETS_KEY,     JSON.stringify(DEFAULT_WIDGETS));
    localStorage.setItem(LAYOUT_KEY,      JSON.stringify(DEFAULT_LAYOUT));
    localStorage.setItem(MOBILE_PAIRS_KEY, JSON.stringify(['clock', 'weather']));
  }

  // Per-card pair toggle (replaces the bottom-sheet drag-onto-neighbor
  // affordance). On a full-width card: pairs with the next neighbor in the
  // widgets array (no-op if no next or next is already paired). On a paired
  // card: unpairs both halves of the pair.
  function toggleHalfFor(type: WidgetType) {
    const idx = widgets.findIndex((w) => w.type === type);
    if (idx === -1) return;
    if (mobileHalfWidgets.includes(type)) {
      const prev = widgets[idx - 1];
      const next = widgets[idx + 1];
      const partner =
        (prev && mobileHalfWidgets.includes(prev.type)) ? prev.type :
        (next && mobileHalfWidgets.includes(next.type)) ? next.type :
        null;
      setMobileHalfWidgets((arr) => arr.filter((t) => t !== type && t !== partner));
    } else {
      const next = widgets[idx + 1];
      if (!next) return;
      if (mobileHalfWidgets.includes(next.type)) return;
      setMobileHalfWidgets((arr) => [...arr, type, next.type]);
    }
  }

  // ── Mobile reorder: Pointer Events drag (no HTML5 drag, no library) ──────
  // Press-and-hold ~300ms to start drag; cancel if pointer moves >8px during
  // the wait (treat as scroll). Once drag starts, setPointerCapture routes
  // all subsequent events to our handler so the page won't scroll under us.
  // Live motion is direct DOM via refs (transform translateY); React state
  // updates only at start and end. No DOM order mutation during drag — we
  // shift sibling rows visually with transforms and commit the array swap on
  // pointerup.
  function cancelDrag(commit: boolean) {
    const ds = dragRef.current;
    if (!ds) return;
    if (ds.pressTimer !== null) window.clearTimeout(ds.pressTimer);
    if (ds.rafId !== null) cancelAnimationFrame(ds.rafId);

    if (ds.started) {
      try { ds.target.releasePointerCapture(ds.pointerId); } catch { /* already released */ }
      // Reset every card's inline styles
      for (const el of ds.cardEls) {
        el.style.transition = '';
        el.style.transform = '';
        el.style.zIndex = '';
        el.style.boxShadow = '';
        el.style.opacity = '';
      }
      if (commit && ds.targetIdx !== ds.rowIdx) {
        commitRowReorder(ds.rowIdx, ds.targetIdx);
      }
      setDragRowIdx(null);
    }
    dragRef.current = null;
  }

  function commitRowReorder(fromRowIdx: number, toRowIdx: number) {
    // Re-derive the row grouping from the latest widgets state, move the row,
    // then flatten back. Reads mobileHalfWidgets from closure — safe because
    // half-pair state can't change mid-drag (no UI to do so during a drag).
    setWidgets((ws) => {
      const halfSet = new Set(mobileHalfWidgets);
      const rows: WidgetDef[][] = [];
      let i = 0;
      while (i < ws.length) {
        const w = ws[i];
        if (halfSet.has(w.type)) {
          const next = ws[i + 1];
          if (next && halfSet.has(next.type)) { rows.push([w, next]); i += 2; continue; }
        }
        rows.push([w]); i += 1;
      }
      if (fromRowIdx < 0 || fromRowIdx >= rows.length) return ws;
      const clamped = Math.max(0, Math.min(rows.length - 1, toRowIdx));
      const [moved] = rows.splice(fromRowIdx, 1);
      rows.splice(clamped, 0, moved);
      return rows.flat();
    });
  }

  function handleRowPointerDown(e: React.PointerEvent<HTMLElement>, rowIdx: number) {
    if (!dashboardEditMode) return;
    // Don't start drag if the press landed on a chrome button. Pointer events
    // bubble to the row, so without this guard tapping × or the pair toggle
    // would race the press timer.
    const tEl = e.target as HTMLElement;
    if (tEl.closest('button, a, input, [role="button"]')) return;

    // Block the browser's default down-stroke behavior (mousedown selection
    // start, focus that triggers caret placement). CSS user-select: none
    // covers most cases but Safari still emits a selectstart on the
    // pointerdown sibling event without this.
    e.preventDefault();

    const target = e.currentTarget;
    const ds: NonNullable<typeof dragRef.current> = {
      rowIdx,
      pointerId: e.pointerId,
      target,
      startY: e.clientY,
      currentY: e.clientY,
      pressTimer: null,
      rafId: null,
      started: false,
      cardEls: [],
      cardOffsets: [],
      cardHeights: [],
      draggedHeight: 0,
      rowGap: 12, // matches `.mobileFeed { gap: 12px }`
      targetIdx: rowIdx,
    };
    dragRef.current = ds;

    ds.pressTimer = window.setTimeout(() => {
      const cur = dragRef.current;
      if (!cur || cur !== ds) return;
      ds.pressTimer = null;
      // If the user's already moved past the cancel threshold by now,
      // pointermove already cleared dragRef. We only get here if movement <8px.
      const feed = feedRef.current;
      if (!feed) { dragRef.current = null; return; }

      try { target.setPointerCapture(ds.pointerId); } catch { /* no-op */ }

      const els = Array.from(feed.children).filter(
        (n): n is HTMLElement => n instanceof HTMLElement,
      );
      ds.cardEls = els;
      ds.cardHeights = els.map((el) => el.getBoundingClientRect().height);
      ds.cardOffsets = els.map((el) => el.offsetTop);
      ds.draggedHeight = ds.cardHeights[rowIdx];
      ds.started = true;

      // Visual lift on dragged row. Don't transition transform — we update
      // it imperatively on every rAF.
      target.style.transition = 'box-shadow 120ms ease, opacity 120ms ease';
      target.style.zIndex = '10';
      target.style.boxShadow = '0 12px 32px rgba(0,0,0,0.35)';
      target.style.opacity = '0.95';
      target.style.transform = 'scale(1.02)';

      setDragRowIdx(rowIdx);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(10); } catch { /* haptic optional */ }
      }
    }, 300);
  }

  function handleRowPointerMove(e: React.PointerEvent<HTMLElement>) {
    const ds = dragRef.current;
    if (!ds) return;
    ds.currentY = e.clientY;

    if (!ds.started) {
      // Pre-drag scroll-cancel: if the user moves before press-and-hold
      // completes, treat as scroll and abandon the drag.
      if (Math.abs(ds.currentY - ds.startY) > 8) {
        if (ds.pressTimer !== null) window.clearTimeout(ds.pressTimer);
        dragRef.current = null;
      }
      return;
    }

    // Drag started — prevent any residual scroll/select behavior.
    e.preventDefault();
    if (ds.rafId !== null) return;
    ds.rafId = requestAnimationFrame(() => {
      ds.rafId = null;
      const cur = dragRef.current;
      if (!cur || !cur.started) return;

      const deltaY = cur.currentY - cur.startY;
      const draggedEl = cur.cardEls[cur.rowIdx];
      draggedEl.style.transform = `translateY(${deltaY}px) scale(1.02)`;

      // Find new target index by comparing dragged center against each
      // sibling's original center. Walk above for upward drag, below for
      // downward; clamp the result to a single contiguous shift band.
      const draggedCenter = cur.cardOffsets[cur.rowIdx] + cur.draggedHeight / 2 + deltaY;
      let targetIdx = cur.rowIdx;
      for (let i = 0; i < cur.cardOffsets.length; i++) {
        if (i === cur.rowIdx) continue;
        const otherCenter = cur.cardOffsets[i] + cur.cardHeights[i] / 2;
        if (i < cur.rowIdx && draggedCenter < otherCenter) {
          if (i < targetIdx) targetIdx = i;
        } else if (i > cur.rowIdx && draggedCenter > otherCenter) {
          if (i > targetIdx) targetIdx = i;
        }
      }

      if (targetIdx !== cur.targetIdx) {
        cur.targetIdx = targetIdx;
        const shift = cur.draggedHeight + cur.rowGap;
        for (let i = 0; i < cur.cardEls.length; i++) {
          if (i === cur.rowIdx) continue;
          const el = cur.cardEls[i];
          el.style.transition = 'transform 180ms ease';
          let dy = 0;
          if (cur.rowIdx < cur.targetIdx && i > cur.rowIdx && i <= cur.targetIdx) {
            dy = -shift;
          } else if (cur.rowIdx > cur.targetIdx && i < cur.rowIdx && i >= cur.targetIdx) {
            dy = shift;
          }
          el.style.transform = dy !== 0 ? `translateY(${dy}px)` : '';
        }
      }
    });
  }

  function handleRowPointerEnd() { cancelDrag(true); }
  function handleRowPointerCancel() { cancelDrag(false); }

  // Cleanup if user exits edit mode mid-drag (toggling Done while pressing).
  useEffect(() => {
    if (!dashboardEditMode && dragRef.current) cancelDrag(false);
  }, [dashboardEditMode]);

  // Belt-and-suspenders selectstart suppression. CSS user-select: none and
  // pointerdown preventDefault together cover most cases, but Safari/Chrome
  // can still fire `selectstart` once on long-press from the native gesture
  // recognizer. React doesn't expose onSelectStart as a synthetic event so
  // we attach a real DOM listener while edit mode is active and remove it on
  // cleanup. Scoped to the feed so we don't block selection elsewhere.
  useEffect(() => {
    if (!dashboardEditMode) return;
    const feed = feedRef.current;
    if (!feed) return;
    const block = (e: Event) => e.preventDefault();
    feed.addEventListener('selectstart', block);
    return () => feed.removeEventListener('selectstart', block);
  }, [dashboardEditMode]);

  const syncedLayout = layout.filter((l) => widgets.some((w) => w.id === l.i));

  // ── Mobile feed view ──────────────────────────────────────────────────────
  if (isMobile) {
    // Group half-width widgets into rows of 2 (user-configurable pairs).
    // Always returns a row as an array (length 1 or 2) — easier to attach a
    // single set of pointer handlers per row regardless of width.
    const halfSet = new Set(mobileHalfWidgets);
    const mobileRows: WidgetDef[][] = [];
    let i = 0;
    while (i < widgets.length) {
      const w = widgets[i];
      if (halfSet.has(w.type)) {
        const next = widgets[i + 1];
        if (next && halfSet.has(next.type)) { mobileRows.push([w, next]); i += 2; continue; }
      }
      mobileRows.push([w]); i += 1;
    }

    return (
      <div className={styles.mobileRoot}>
        {/* Greeting */}
        <div className={styles.mobileGreeting}>
          <span className={styles.mobileGreetingText}>
            {activeMember ? `Hola, ${activeMember.name.split(' ')[0]} 👋` : 'HomeHub'}
          </span>
          <span className={styles.mobileDate}>
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        </div>

        {/* Widget feed — every row is a draggable container in edit mode */}
        <div className={styles.mobileFeed} ref={feedRef}>
          {mobileRows.map((row, rowIdx) => {
            const isPair = row.length === 2;
            const rowKey = row.map((w) => w.id).join('-');
            const isDragging = dragRowIdx === rowIdx;

            const rowProps = dashboardEditMode ? {
              onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => handleRowPointerDown(e, rowIdx),
              onPointerMove: handleRowPointerMove,
              onPointerUp: handleRowPointerEnd,
              onPointerCancel: handleRowPointerCancel,
              // If the browser revokes capture mid-drag (system gesture, alert,
              // tab switch), treat it like a cancel — release dragRef and reset
              // visual state without committing a reorder.
              onLostPointerCapture: handleRowPointerCancel,
              // Suppress the long-press / right-click context menu that would
              // otherwise pop during the 300ms wait (Android Chrome) or on
              // mouse-emulation right-click (DevTools).
              onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
              style: { touchAction: 'pan-y' as const },
            } : {};

            const cards = row.map(({ id, type }) => {
              const tgt = WIDGET_TARGET[type];
              const isHalf = mobileHalfWidgets.includes(type);
              const tappable = !dashboardEditMode && tgt;
              const cardCls = [
                styles.mobileCard,
                isPair ? styles.mobileCardHalf : '',
                tappable ? styles.mobileCardTappable : '',
                dashboardEditMode ? styles.mobileCardEditing : '',
              ].filter(Boolean).join(' ');

              return (
                <div
                  key={id}
                  className={cardCls}
                  {...(tappable ? {
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': `Abrir ${WIDGET_LABELS[type]}`,
                    onClick: (e: React.MouseEvent) => handleCardClick(e, tgt),
                    onKeyDown: (e: React.KeyboardEvent) => handleCardKeyDown(e, tgt),
                  } : {})}
                >
                  <WidgetContent type={type} />
                  {tappable && (
                    <ChevronRight size={14} aria-hidden="true" className={styles.cardCaret} />
                  )}
                  {dashboardEditMode && (
                    <div className={styles.editChrome} aria-hidden={!dashboardEditMode}>
                      <span className={styles.editChromeGrip} aria-hidden="true">
                        <GripHorizontal size={14} />
                      </span>
                      <button
                        type="button"
                        className={`${styles.editChromeBtn} ${isHalf ? styles.editChromeBtnActive : ''}`}
                        onClick={() => toggleHalfFor(type)}
                        aria-label={isHalf ? 'Convertir a ancho completo' : 'Combinar con el siguiente widget'}
                        aria-pressed={isHalf}
                      >
                        <Columns2 size={14} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.editChromeBtn} ${styles.editChromeBtnDanger}`}
                        onClick={() => removeWidget(id)}
                        aria-label="Quitar widget"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            });

            // Wrap (always) in a row container so the pointer handlers and
            // drag classes attach to a stable element regardless of pair/full.
            const rowCls = [
              styles.feedRow,
              isPair ? styles.feedRowPair : '',
              isDragging ? styles.feedRowDragging : '',
            ].filter(Boolean).join(' ');

            return (
              <div key={rowKey} className={rowCls} {...rowProps}>
                {cards}
              </div>
            );
          })}

          {/* Edit footer: Add widget + Reset, sits at the bottom of the feed
              so it scrolls with content. The "Done" button is fixed-position
              below this and is the only way to exit edit mode. */}
          {dashboardEditMode && (
            <div className={styles.editFooter}>
              <button
                type="button"
                className={styles.editAddBtn}
                onClick={() => setMobileAddOpen((o) => !o)}
                disabled={availableTypes.length === 0}
                aria-expanded={mobileAddOpen}
              >
                <Plus size={16} /> Agregar widget
                {availableTypes.length > 0 && (
                  <span className={styles.editAddCount}>{availableTypes.length}</span>
                )}
              </button>
              {mobileAddOpen && availableTypes.length > 0 && (
                <div className={styles.editAddList}>
                  {availableTypes.map((t) => {
                    const Icon = WIDGET_ICONS[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        className={styles.editAddChip}
                        onClick={() => { addWidget(t); setMobileAddOpen(false); }}
                      >
                        <Icon size={14} /> {WIDGET_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                className={styles.editResetBtn}
                onClick={() => { resetLayout(); setMobileAddOpen(false); }}
              >
                <RotateCcw size={14} /> Restablecer por defecto
              </button>
            </div>
          )}
        </div>

        {/* Floating Done button — fixed above the page-area scroll, visible
            during edit mode. The single way to exit edit mode (matching
            desktop's "Done" button in edit-mode actions). */}
        {dashboardEditMode && (
          <button
            type="button"
            className={styles.floatingDoneBtn}
            onClick={() => { setDashboardEditMode(false); setMobileAddOpen(false); }}
            aria-label="Salir del modo edición"
          >
            <Check size={16} /> Listo
          </button>
        )}
      </div>
    );
  }

  // ── Desktop view mode ─────────────────────────────────────────────────────
  if (!dashboardEditMode) {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <span className={styles.greeting}>
            {activeMember ? greeting(activeMember.name) : 'HomeHub'}
          </span>
        </div>

        <div className={styles.gridWrap}>
          <GridLayout
            layout={syncedLayout}
            width={containerWidth}
            gridConfig={{ cols: gridConfig.cols, rowHeight: gridConfig.rowHeight, margin: gridConfig.margin, containerPadding: GRID_PADDING }}
            dragConfig={{ enabled: false }}
            resizeConfig={{ enabled: false }}
          >
            {widgets.map(({ id, type }) => {
              const target = WIDGET_TARGET[type];
              return (
                <div
                  key={id}
                  className={`${styles.gridCell} ${target ? styles.gridCellTappable : ''}`}
                  {...(target ? {
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': `Abrir ${WIDGET_LABELS[type]}`,
                    onClick: (e) => handleCardClick(e, target),
                    onKeyDown: (e) => handleCardKeyDown(e, target),
                  } : {})}
                >
                  <div className={styles.widgetInner}>
                    <WidgetContent type={type} />
                  </div>
                  {target && (
                    <ChevronRight
                      size={14}
                      aria-hidden="true"
                      className={styles.cardCaret}
                    />
                  )}
                </div>
              );
            })}
          </GridLayout>
        </div>
      </div>
    );
  }

  // ── Desktop edit mode ─────────────────────────────────────────────────────
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.greeting}>
          {activeMember ? greeting(activeMember.name) : 'HomeHub'}
        </span>
        <div className={styles.actions}>
          <div className={styles.addWrap}>
            <button
              className="btn btn--ghost btn--sm"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => setAddOpen((v) => !v)}
              disabled={availableTypes.length === 0}
            >
              <Plus size={14} /> Add widget
            </button>
            {addOpen && availableTypes.length > 0 && (
              <ul className={styles.addDropdown}>
                {availableTypes.map((t) => {
                  const Icon = WIDGET_ICONS[t];
                  return (
                    <li key={t}>
                      <button onClick={() => addWidget(t)}>
                        <Icon size={14} /> {WIDGET_LABELS[t]}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <button className="btn btn--ghost btn--sm" onClick={resetLayout}>Reset</button>
          <button
            className="btn btn--primary btn--sm"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => { setDashboardEditMode(false); setAddOpen(false); }}
          >
            <Check size={14} /> Done
          </button>
        </div>
      </div>

      <div className={`${styles.gridWrap} ${styles.editing}`}>
        <GridLayout
          layout={syncedLayout}
          width={containerWidth}
          gridConfig={{ cols: gridConfig.cols, rowHeight: gridConfig.rowHeight, margin: gridConfig.margin, containerPadding: GRID_PADDING }}
          dragConfig={{ enabled: true, handle: '.drag-handle' }}
          resizeConfig={{ enabled: true }}
          onLayoutChange={(l) => setLayout([...l])}
        >
          {widgets.map((w) => (
            <div key={w.id}>
              <WidgetWrapper
                label={WIDGET_LABELS[w.type]}
                editMode={true}
                onRemove={() => removeWidget(w.id)}
              >
                <WidgetContent type={w.type} />
              </WidgetWrapper>
            </div>
          ))}
        </GridLayout>
      </div>
    </div>
  );
}

function WidgetContent({ type }: { type: WidgetType }) {
  switch (type) {
    case 'clock':      return <ClockWidget />;
    case 'reminders':  return <RemindersWidget />;
    case 'shopping':   return <ShoppingWidget />;
    case 'calendar':   return <CalendarWidget />;
    case 'notes':      return <NotesWidget />;
    case 'weather':    return <WeatherWidget />;
    case 'finSummary': return <FinSummaryWidget />;
    case 'finBills':   return <FinBillsWidget />;
    case 'finChart':   return <FinChartWidget />;
    case 'finIncome':  return <FinIncomeWidget />;
    case 'finPersons': return <FinPersonsWidget />;
  }
}
