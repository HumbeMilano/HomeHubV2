import { useEffect, useState } from 'react';
import GridLayout, { type LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import {
  Clock, Bell, ShoppingCart, Calendar, FileText, CloudSun,
  LayoutDashboard, List, PieChart, TrendingUp, Users2,
  Plus, Check, Pencil, ArrowUpRight,
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
  clock:      'Clock',
  reminders:  'Reminders',
  shopping:   'Shopping',
  calendar:   'Calendar',
  notes:      'Notes',
  weather:    'Weather',
  finSummary: 'Finance',
  finBills:   'Bills',
  finChart:   'Spending',
  finIncome:  'Income',
  finPersons: 'Per Person',
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
  reminders:  'calendar',
  notes:      'notes',
};

// ── Default layout (5 core widgets) ───────────────────────────────────────
const DEFAULT_WIDGETS: WidgetDef[] = [
  { id: 'clock',      type: 'clock'      },
  { id: 'weather',    type: 'weather'    },
  { id: 'finSummary', type: 'finSummary' },
  { id: 'calendar',   type: 'calendar'   },
  { id: 'shopping',   type: 'shopping'   },
];

const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'clock',      x: 0,  y: 0,  w: 2, h: 2, minW: 2, minH: 1 },
  { i: 'weather',    x: 2,  y: 0,  w: 3, h: 2, minW: 2, minH: 1 },
  { i: 'finSummary', x: 5,  y: 0,  w: 4, h: 2, minW: 2, minH: 2 },
  { i: 'calendar',   x: 0,  y: 2,  w: 7, h: 5, minW: 4, minH: 4 },
  { i: 'shopping',   x: 7,  y: 2,  w: 5, h: 5, minW: 2, minH: 2 },
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
  const time = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return `${time}, ${name}`;
}

const GRID_COLS       = 12;
const GRID_ROW_HEIGHT = 80;
const GRID_MARGIN     = [10, 10] as [number, number];
const GRID_PADDING    = [0,  0]  as [number, number];

// ── Component ──────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { activeMember } = useAuthStore();
  const { navigate } = useAppStore();

  const [editMode, setEditMode]   = useState(false);
  const [addOpen,  setAddOpen]    = useState(false);
  const [widgets,  setWidgets]    = useState<WidgetDef[]>(loadWidgets);
  const [layout,   setLayout]     = useState<LayoutItem[]>(loadLayout);
  const [containerWidth, setContainerWidth] = useState(1200);

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

  // Persist whenever widgets or layout change
  useEffect(() => { localStorage.setItem(WIDGETS_KEY, JSON.stringify(widgets)); }, [widgets]);
  useEffect(() => { localStorage.setItem(LAYOUT_KEY,  JSON.stringify(layout));  }, [layout]);

  const activeTypes    = widgets.map((w) => w.type);
  const availableTypes = (Object.keys(WIDGET_LABELS) as WidgetType[]).filter((t) => !activeTypes.includes(t));

  function addWidget(type: WidgetType) {
    setWidgets((ws) => [...ws, { id: type, type }]);
    setLayout((ls) => [...ls, { i: type, x: 0, y: Infinity, w: 3, h: 3, minW: 2, minH: 1 }]);
    setAddOpen(false);
  }

  function removeWidget(id: string) {
    setWidgets((ws) => ws.filter((w) => w.id !== id));
    setLayout((ls) => ls.filter((l) => l.i !== id));
  }

  function resetLayout() {
    setWidgets(DEFAULT_WIDGETS);
    setLayout(DEFAULT_LAYOUT);
    localStorage.setItem(WIDGETS_KEY, JSON.stringify(DEFAULT_WIDGETS));
    localStorage.setItem(LAYOUT_KEY,  JSON.stringify(DEFAULT_LAYOUT));
  }

  function handleDone() {
    setEditMode(false);
    setAddOpen(false);
  }

  // Sync layout items: remove stale entries, keep positions for current widgets
  const syncedLayout = layout.filter((l) => widgets.some((w) => w.id === l.i));

  // ── View mode (static grid — same layout as edit, no drag/resize) ────────
  if (!editMode) {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <span className={styles.greeting}>
            {activeMember ? greeting(activeMember.name) : 'HomeHub'}
          </span>
          <button
            className={styles.editToggle}
            onClick={() => setEditMode(true)}
            title="Customize dashboard"
          >
            <Pencil size={14} /> Edit
          </button>
        </div>

        <div className={styles.gridWrap}>
          <GridLayout
            layout={syncedLayout}
            width={containerWidth}
            gridConfig={{ cols: GRID_COLS, rowHeight: GRID_ROW_HEIGHT, margin: GRID_MARGIN, containerPadding: GRID_PADDING }}
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

  // ── Edit mode (draggable / resizable grid) ──────────────────────────────
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
            onClick={handleDone}
          >
            <Check size={14} /> Done
          </button>
        </div>
      </div>

      <div className={styles.gridWrap}>
        <GridLayout
          layout={syncedLayout}
          width={containerWidth}
          gridConfig={{ cols: GRID_COLS, rowHeight: GRID_ROW_HEIGHT, margin: GRID_MARGIN, containerPadding: GRID_PADDING }}
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
