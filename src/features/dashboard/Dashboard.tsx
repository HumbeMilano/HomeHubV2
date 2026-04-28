import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import GridLayout, { type LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import {
  Clock, Bell, ShoppingCart, Calendar, FileText, CloudSun,
  LayoutDashboard, List, PieChart, TrendingUp, Users2,
  Plus, Check, ChevronRight, X, Columns2, RotateCcw,
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

  // ── Mobile reorder: tap-to-select + tap-empty-slot model ──────────────────
  // No gesture recognition (Issue J replaced the press-and-hold drag from
  // Issues C/D). Tap a widget to select it; tap a different widget to swap
  // (if widths match) or reselect; tap an emphasized empty slot to move the
  // selected widget to the end of the layout. shakeWidgetId triggers a brief
  // animation when the user attempts a width-incompatible swap.
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [shakeWidgetId, setShakeWidgetId] = useState<string | null>(null);

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

  // ── Mobile edit-mode handlers (tap-to-select + tap-empty-slot) ────────────
  function handleEditCardClick(widgetId: string) {
    // Tap a card while in edit mode. Three cases:
    // 1. No selection → select this widget.
    // 2. Tap the same widget → deselect.
    // 3. Tap a different widget → swap if widths match; otherwise shake the
    //    target and keep selection (so the user understands what went wrong).
    if (!selectedWidgetId) { setSelectedWidgetId(widgetId); return; }
    if (selectedWidgetId === widgetId) { setSelectedWidgetId(null); return; }
    const sel = widgets.find((w) => w.id === selectedWidgetId);
    const tgt = widgets.find((w) => w.id === widgetId);
    if (!sel || !tgt) { setSelectedWidgetId(widgetId); return; }
    const selIsHalf = mobileHalfWidgets.includes(sel.type);
    const tgtIsHalf = mobileHalfWidgets.includes(tgt.type);
    if (selIsHalf !== tgtIsHalf) {
      // Width mismatch — reject the swap with a shake on the target.
      setShakeWidgetId(widgetId);
      window.setTimeout(() => setShakeWidgetId(null), 350);
      return;
    }
    // Compatible — swap their array positions; halfSet membership unchanged.
    setWidgets((ws) => {
      const idxA = ws.findIndex((w) => w.id === selectedWidgetId);
      const idxB = ws.findIndex((w) => w.id === widgetId);
      if (idxA === -1 || idxB === -1) return ws;
      const arr = [...ws];
      [arr[idxA], arr[idxB]] = [arr[idxB], arr[idxA]];
      return arr;
    });
    setSelectedWidgetId(null);
  }

  function handleEmptySlotClick() {
    // Empty slots only act when a widget is selected. Move the selected
    // widget to the end of the array; following render slots it after every
    // other widget (the appended empty slots are always at the end).
    if (!selectedWidgetId) return;
    setWidgets((ws) => {
      const sel = ws.find((w) => w.id === selectedWidgetId);
      if (!sel) return ws;
      const remaining = ws.filter((w) => w.id !== selectedWidgetId);
      return [...remaining, sel];
    });
    setSelectedWidgetId(null);
  }

  // Clear selection whenever the user exits edit mode so it doesn't persist
  // into a re-entry of edit mode with a stale widget id (which might have
  // been removed in the meantime).
  useEffect(() => {
    if (!dashboardEditMode && selectedWidgetId !== null) setSelectedWidgetId(null);
  }, [dashboardEditMode, selectedWidgetId]);

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

        {/* Widget feed — in edit mode, each card is tap-to-select. */}
        <div className={styles.mobileFeed}>
          {mobileRows.map((row) => {
            const isPair = row.length === 2;
            const rowKey = row.map((w) => w.id).join('-');

            const cards = row.map(({ id, type }) => {
              const tgt = WIDGET_TARGET[type];
              const isHalf = mobileHalfWidgets.includes(type);
              const tappable = !dashboardEditMode && tgt;
              const isSelected = selectedWidgetId === id;
              const isShaking = shakeWidgetId === id;
              const cardCls = [
                styles.mobileCard,
                isPair ? styles.mobileCardHalf : '',
                tappable ? styles.mobileCardTappable : '',
                dashboardEditMode ? styles.mobileCardEditing : '',
                isSelected ? styles.mobileCardSelected : '',
                isShaking ? styles.mobileCardShake : '',
              ].filter(Boolean).join(' ');

              const editProps = dashboardEditMode ? {
                role: 'button' as const,
                tabIndex: 0,
                'aria-pressed': isSelected,
                'aria-label': isSelected
                  ? `Deseleccionar ${WIDGET_LABELS[type]}`
                  : `Seleccionar ${WIDGET_LABELS[type]} para mover`,
                onClick: () => handleEditCardClick(id),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  handleEditCardClick(id);
                },
              } : tappable ? {
                role: 'button' as const,
                tabIndex: 0,
                'aria-label': `Abrir ${WIDGET_LABELS[type]}`,
                onClick: (e: React.MouseEvent) => handleCardClick(e, tgt),
                onKeyDown: (e: React.KeyboardEvent) => handleCardKeyDown(e, tgt),
              } : {};

              return (
                <div
                  key={id}
                  className={cardCls}
                  {...editProps}
                >
                  <WidgetContent type={type} />
                  {tappable && (
                    <ChevronRight size={14} aria-hidden="true" className={styles.cardCaret} />
                  )}
                  {dashboardEditMode && (
                    <div className={styles.editChrome} aria-hidden={!dashboardEditMode}>
                      <button
                        type="button"
                        className={`${styles.editChromeBtn} ${isHalf ? styles.editChromeBtnActive : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleHalfFor(type); }}
                        aria-label={isHalf ? 'Convertir a ancho completo' : 'Combinar con el siguiente widget'}
                        aria-pressed={isHalf}
                      >
                        <Columns2 size={14} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.editChromeBtn} ${styles.editChromeBtnDanger}`}
                        onClick={(e) => { e.stopPropagation(); removeWidget(id); }}
                        aria-label="Quitar widget"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            });

            const rowCls = [
              styles.feedRow,
              isPair ? styles.feedRowPair : '',
            ].filter(Boolean).join(' ');

            return (
              <div key={rowKey} className={rowCls}>
                {cards}
              </div>
            );
          })}

          {/* Empty placeholder row in edit mode — appended after every active
              widget so the user always has somewhere to move things. Two
              half-cells side by side; full-width widgets need both empty
              cells in the same row, so placing one happens via the same row
              regardless of which cell is tapped. */}
          {dashboardEditMode && (() => {
            const selWidget = selectedWidgetId ? widgets.find((w) => w.id === selectedWidgetId) : null;
            const slotIsValid = selWidget !== null;  // any empty slot accepts any selected widget
            const slotCls = (extra = '') => [
              styles.mobileSlotEmpty,
              selWidget ? (slotIsValid ? styles.mobileSlotValid : styles.mobileSlotInvalid) : '',
              extra,
            ].filter(Boolean).join(' ');
            return (
              <div className={`${styles.feedRow} ${styles.feedRowPair}`}>
                <button
                  type="button"
                  className={slotCls(styles.mobileCardHalf)}
                  onClick={handleEmptySlotClick}
                  disabled={!slotIsValid}
                  aria-label="Mover el widget seleccionado aquí"
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={slotCls(styles.mobileCardHalf)}
                  onClick={handleEmptySlotClick}
                  disabled={!slotIsValid}
                  aria-label="Mover el widget seleccionado aquí"
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
              </div>
            );
          })()}

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

        {/* Floating Done button — portaled to document.body so position: fixed
            falls through to viewport-relative. PageTransition.tsx applies
            `transform: translateX(0)` to its wrapper after mount, which
            establishes a containing block for fixed-positioned descendants
            (per CSS spec: any non-none transform creates one). Without the
            portal the button positions relative to PageTransition's div and
            scrolls with .page-area's content. Same pattern the old
            Personalizar bottom sheet used. */}
        {dashboardEditMode && createPortal(
          <button
            type="button"
            className={styles.floatingDoneBtn}
            onClick={() => { setDashboardEditMode(false); setMobileAddOpen(false); }}
            aria-label="Salir del modo edición"
          >
            <Check size={16} /> Listo
          </button>,
          document.body,
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
