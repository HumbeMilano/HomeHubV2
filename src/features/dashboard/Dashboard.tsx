import { useEffect, useMemo, useState } from 'react';
import GridLayout, { type LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import {
  Clock, Bell, ShoppingCart, Calendar, FileText, CloudSun,
  LayoutDashboard, List, PieChart, TrendingUp, Users2,
  Plus, Check, Pencil, ArrowUpRight, ChevronUp, ChevronDown, GripVertical,
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
const DEFAULT_WIDGETS: WidgetDef[] = [
  { id: 'clock',      type: 'clock'      },
  { id: 'weather',    type: 'weather'    },
  { id: 'finSummary', type: 'finSummary' },
  { id: 'finBills',   type: 'finBills'   },
  { id: 'calendar',   type: 'calendar'   },
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

  const [desktopEditMode, setDesktopEditMode] = useState(false);
  const [addOpen, setAddOpen]   = useState(false);
  const [widgets, setWidgets]   = useState<WidgetDef[]>(loadWidgets);
  const [layout,  setLayout]    = useState<LayoutItem[]>(loadLayout);
  const [mobileHalfWidgets, setMobileHalfWidgets] = useState<WidgetType[]>(() => {
    try { return JSON.parse(localStorage.getItem(MOBILE_PAIRS_KEY) ?? '["clock","weather"]') as WidgetType[]; }
    catch { return ['clock', 'weather']; }
  });
  const [draggingType,   setDraggingType]   = useState<WidgetType | null>(null);
  const [dropTargetType, setDropTargetType] = useState<WidgetType | null>(null);
  const [containerWidth, setContainerWidth] = useState(() =>
    typeof window !== 'undefined'
      ? Math.max(300, window.innerWidth - 64 - 40)
      : 1200
  );

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

  const activeTypes    = widgets.map((w) => w.type);
  const availableTypes = ALL_WIDGET_TYPES.filter((t) => !activeTypes.includes(t));

  function addWidget(type: WidgetType) {
    setWidgets((ws) => [...ws, { id: type, type }]);
    setLayout((ls) => [...ls, { i: type, x: 0, y: Infinity, w: 3, h: 3, minW: 2, minH: 1 }]);
    setAddOpen(false);
  }

  function removeWidget(id: string) {
    setWidgets((ws) => ws.filter((w) => w.id !== id));
    setLayout((ls) => ls.filter((l) => l.i !== id));
  }

  function toggleMobileWidget(type: WidgetType) {
    if (activeTypes.includes(type)) {
      setWidgets((ws) => ws.filter((w) => w.type !== type));
      setLayout((ls) => ls.filter((l) => l.i !== type));
    } else {
      setWidgets((ws) => [...ws, { id: type, type }]);
      setLayout((ls) => [...ls, { i: type, x: 0, y: Infinity, w: 3, h: 3, minW: 2, minH: 1 }]);
    }
  }

  function moveWidget(type: WidgetType, dir: 'up' | 'down') {
    setWidgets((ws) => {
      const idx = ws.findIndex((w) => w.type === type);
      if (idx === -1) return ws;
      const next = dir === 'up' ? idx - 1 : idx + 1;
      if (next < 0 || next >= ws.length) return ws;
      const arr = [...ws];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }

  function resetLayout() {
    setWidgets(DEFAULT_WIDGETS);
    setLayout(DEFAULT_LAYOUT);
    setMobileHalfWidgets(['clock', 'weather']);
    localStorage.setItem(WIDGETS_KEY,     JSON.stringify(DEFAULT_WIDGETS));
    localStorage.setItem(LAYOUT_KEY,      JSON.stringify(DEFAULT_LAYOUT));
    localStorage.setItem(MOBILE_PAIRS_KEY, JSON.stringify(['clock', 'weather']));
  }

  function togglePair(a: WidgetType, b: WidgetType) {
    setMobileHalfWidgets((prev) => {
      const alreadyPaired = prev.includes(a) && prev.includes(b);
      if (alreadyPaired) return prev.filter((t) => t !== a && t !== b);
      return [...new Set([...prev, a, b])];
    });
    // Ensure a and b are adjacent in the widgets list
    setWidgets((ws) => {
      const idxA = ws.findIndex((w) => w.type === a);
      const idxB = ws.findIndex((w) => w.type === b);
      if (idxA === -1 || idxB === -1) return ws;
      if (Math.abs(idxA - idxB) === 1) return ws;
      const arr = ws.filter((w) => w.type !== b);
      const newIdxA = arr.findIndex((w) => w.type === a);
      arr.splice(newIdxA + 1, 0, ws[idxB]);
      return arr;
    });
  }

  const syncedLayout = layout.filter((l) => widgets.some((w) => w.id === l.i));

  // ── Mobile feed view ──────────────────────────────────────────────────────
  if (isMobile) {
    // Group half-width widgets into rows of 2 (user-configurable pairs)
    const halfSet = new Set(mobileHalfWidgets);
    const mobileRows: Array<WidgetDef | [WidgetDef, WidgetDef]> = [];
    let i = 0;
    while (i < widgets.length) {
      const w = widgets[i];
      if (halfSet.has(w.type)) {
        const next = widgets[i + 1];
        if (next && halfSet.has(next.type)) {
          mobileRows.push([w, next]);
          i += 2;
        } else {
          mobileRows.push(w);
          i += 1;
        }
      } else {
        mobileRows.push(w);
        i += 1;
      }
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

        {/* Widget feed */}
        <div className={styles.mobileFeed}>
          {mobileRows.map((row, idx) => {
            if (Array.isArray(row)) {
              // Half-width pair
              return (
                <div key={idx} className={styles.mobileRow}>
                  {row.map(({ id, type }) => (
                    <div
                      key={id}
                      className={`${styles.mobileCard} ${styles.mobileCardHalf}`}
                    >
                      <WidgetContent type={type} />
                    </div>
                  ))}
                </div>
              );
            }
            // Full-width card
            const { id, type } = row;
            const target = WIDGET_TARGET[type];
            return (
              <div
                key={id}
                className={styles.mobileCard}
              >
                <WidgetContent type={type} />
                {target && (
                  <button
                    className={styles.mobileCardNav}
                    onClick={() => navigate(target)}
                    title="Abrir"
                  >
                    <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom sheet edit mode (triggered from hamburger) */}
        {dashboardEditMode && (
          <div className={styles.editSheetBackdrop} onClick={() => setDashboardEditMode(false)}>
            <div className={styles.editSheet} onClick={(e) => e.stopPropagation()}>
              <div className={styles.editSheetHandle} />
              <div className={styles.editSheetHeader}>
                <span className={styles.editSheetTitle}>Personalizar</span>
                <button
                  className={styles.editSheetDone}
                  onClick={() => setDashboardEditMode(false)}
                >
                  <Check size={16} /> Listo
                </button>
              </div>
              <p className={styles.editSheetHint}>
                Arrastra <GripVertical size={12} /> sobre otro widget activo para ponerlos lado a lado (½). Tócalo de nuevo para separar.
              </p>
              <div className={styles.editSheetList}>
                {ALL_WIDGET_TYPES.map((type) => {
                  const Icon = WIDGET_ICONS[type];
                  const active    = activeTypes.includes(type);
                  const activeIdx = widgets.findIndex((w) => w.type === type);
                  const isFirst   = activeIdx === 0;
                  const isLast    = activeIdx === widgets.length - 1;
                  const isHalf    = mobileHalfWidgets.includes(type);
                  const isDragTarget = dropTargetType === type && draggingType !== type;
                  return (
                    <div
                      key={type}
                      className={[
                        styles.editSheetRow,
                        isDragTarget ? styles.editSheetRowDropTarget : '',
                      ].join(' ')}
                      draggable={active}
                      onDragStart={() => { setDraggingType(type); setDropTargetType(null); }}
                      onDragOver={(e) => { if (active && draggingType && draggingType !== type) { e.preventDefault(); setDropTargetType(type); } }}
                      onDragLeave={() => setDropTargetType(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggingType && draggingType !== type && active && activeTypes.includes(draggingType)) {
                          togglePair(draggingType, type);
                        }
                        setDraggingType(null);
                        setDropTargetType(null);
                      }}
                      onDragEnd={() => { setDraggingType(null); setDropTargetType(null); }}
                    >
                      {/* Drag handle + reorder arrows */}
                      <div className={styles.editSheetArrows}>
                        <GripVertical size={14} className={styles.dragHandle} style={{ opacity: active ? 0.5 : 0.2, cursor: active ? 'grab' : 'default' }} />
                        <button
                          className={styles.arrowBtn}
                          onClick={() => moveWidget(type, 'up')}
                          disabled={!active || isFirst}
                          aria-label="Mover arriba"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          className={styles.arrowBtn}
                          onClick={() => moveWidget(type, 'down')}
                          disabled={!active || isLast}
                          aria-label="Mover abajo"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <button
                        className={styles.editSheetRowContent}
                        onClick={() => toggleMobileWidget(type)}
                      >
                        <div className={styles.editSheetRowLeft}>
                          <Icon size={18} />
                          <span>{WIDGET_LABELS[type]}</span>
                          {isHalf && active && (
                            <span className={styles.halfChip}>½</span>
                          )}
                        </div>
                        <div className={`${styles.toggle} ${active ? styles.toggleOn : ''}`}>
                          <div className={styles.toggleThumb} />
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                className={styles.editSheetReset}
                onClick={() => { resetLayout(); }}
              >
                Restablecer por defecto
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Desktop view mode ─────────────────────────────────────────────────────
  if (!desktopEditMode) {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <span className={styles.greeting}>
            {activeMember ? greeting(activeMember.name) : 'HomeHub'}
          </span>
          <button
            className={styles.editToggle}
            onClick={() => setDesktopEditMode(true)}
            title="Customize dashboard"
          >
            <Pencil size={14} /> Edit
          </button>
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
                <div key={id} className={styles.gridCell}>
                  <div className={styles.widgetInner}>
                    <WidgetContent type={type} />
                  </div>
                  {target && (
                    <button
                      className={styles.openBtn}
                      onClick={() => navigate(target)}
                      title="Open"
                    >
                      <ArrowUpRight size={14} />
                    </button>
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
            onClick={() => { setDesktopEditMode(false); setAddOpen(false); }}
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
