import { useEffect, useState } from 'react';
import GridLayout, { type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resize-detector';
import WidgetWrapper from './widgets/WidgetWrapper';
import ClockWidget from './widgets/ClockWidget';
import RemindersWidget from './widgets/RemindersWidget';
import ShoppingWidget from './widgets/ShoppingWidget';
import FinanceWidget from './widgets/FinanceWidget';
import CalendarWidget from './widgets/CalendarWidget';
import NotesWidget from './widgets/NotesWidget';
import WeatherWidget from './widgets/WeatherWidget';
import styles from './Dashboard.module.css';

// ── Types ──────────────────────────────────────────────────────────────────
type WidgetType = 'clock' | 'reminders' | 'shopping' | 'finance' | 'calendar' | 'notes' | 'weather';

interface WidgetDef { id: string; type: WidgetType; }

const WIDGET_LABELS: Record<WidgetType, string> = {
  clock:     'Clock',
  reminders: 'Reminders',
  shopping:  'Shopping',
  finance:   'Finance',
  calendar:  'Calendar',
  notes:     'Notes',
  weather:   'Weather',
};

const WIDGET_ICONS: Record<WidgetType, string> = {
  clock: '🕐', reminders: '🔔', shopping: '🛒',
  finance: '💰', calendar: '📅', notes: '📝', weather: '🌤',
};

// ── Default layout ─────────────────────────────────────────────────────────
const DEFAULT_LAYOUT: Layout[] = [
  { i: 'clock',     x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'reminders', x: 3, y: 0, w: 5, h: 4, minW: 3, minH: 3 },
  { i: 'shopping',  x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
  { i: 'finance',   x: 0, y: 2, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'calendar',  x: 0, y: 4, w: 5, h: 5, minW: 4, minH: 4 },
  { i: 'notes',     x: 5, y: 4, w: 4, h: 5, minW: 3, minH: 3 },
  { i: 'weather',   x: 9, y: 4, w: 3, h: 5, minW: 2, minH: 3 },
];

const DEFAULT_WIDGETS: WidgetDef[] = DEFAULT_LAYOUT.map((l) => ({ id: l.i, type: l.i as WidgetType }));

// ── Persistence ────────────────────────────────────────────────────────────
const LAYOUT_KEY  = 'homehub-dash-layout';
const WIDGETS_KEY = 'homehub-dash-widgets';

function loadLayout(): Layout[] {
  try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '') as Layout[]; } catch { return DEFAULT_LAYOUT; }
}

function loadWidgets(): WidgetDef[] {
  try { return JSON.parse(localStorage.getItem(WIDGETS_KEY) ?? '') as WidgetDef[]; } catch { return DEFAULT_WIDGETS; }
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [widgets, setWidgets] = useState<WidgetDef[]>(loadWidgets);
  const [layout,  setLayout]  = useState<Layout[]>(loadLayout);
  const [editMode, setEditMode] = useState(false);
  const [addOpen,  setAddOpen]  = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);

  // Measure container width for the grid
  useEffect(() => {
    const el = document.querySelector('.page-area') as HTMLElement | null;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(w - 48); // subtract page-area padding
    });
    obs.observe(el);
    setContainerWidth(el.clientWidth - 48);
    return () => obs.disconnect();
  }, []);

  // Persist
  useEffect(() => { localStorage.setItem(LAYOUT_KEY,  JSON.stringify(layout));  }, [layout]);
  useEffect(() => { localStorage.setItem(WIDGETS_KEY, JSON.stringify(widgets)); }, [widgets]);

  const activeTypes = widgets.map((w) => w.type);
  const availableTypes = (Object.keys(WIDGET_LABELS) as WidgetType[]).filter((t) => !activeTypes.includes(t));

  function addWidget(type: WidgetType) {
    const id = type;
    setWidgets((ws) => [...ws, { id, type }]);
    setLayout((ls) => [...ls, { i: id, x: 0, y: Infinity, w: 4, h: 3, minW: 2, minH: 2 }]);
    setAddOpen(false);
  }

  function removeWidget(id: string) {
    setWidgets((ws) => ws.filter((w) => w.id !== id));
    setLayout((ls) => ls.filter((l) => l.i !== id));
  }

  function resetLayout() {
    setWidgets(DEFAULT_WIDGETS);
    setLayout(DEFAULT_LAYOUT);
  }

  return (
    <div className={styles.root}>
      {/* Header bar */}
      <div className={styles.header}>
        <span className={styles.title}>Dashboard</span>
        <div className={styles.actions}>
          {editMode && (
            <>
              <div className={styles.addWrap}>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setAddOpen((v) => !v)}
                  disabled={availableTypes.length === 0}
                >
                  + Add widget
                </button>
                {addOpen && availableTypes.length > 0 && (
                  <ul className={styles.addDropdown}>
                    {availableTypes.map((t) => (
                      <li key={t}>
                        <button onClick={() => addWidget(t)}>
                          {WIDGET_ICONS[t]} {WIDGET_LABELS[t]}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button className="btn btn--ghost btn--sm" onClick={resetLayout}>Reset</button>
            </>
          )}
          <button
            className={`btn btn--sm ${editMode ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => { setEditMode((v) => !v); setAddOpen(false); }}
          >
            {editMode ? '✅ Done' : '✏️ Edit'}
          </button>
        </div>
      </div>

      {/* Grid */}
      <GridLayout
        layout={layout}
        cols={12}
        rowHeight={80}
        width={containerWidth}
        isDraggable={editMode}
        isResizable={editMode}
        draggableHandle=".drag-handle"
        onLayoutChange={(l) => setLayout(l)}
        margin={[12, 12]}
        containerPadding={[0, 0]}
      >
        {widgets.map((w) => (
          <div key={w.id}>
            <WidgetWrapper
              label={WIDGET_LABELS[w.type]}
              editMode={editMode}
              onRemove={() => removeWidget(w.id)}
            >
              <WidgetContent type={w.type} />
            </WidgetWrapper>
          </div>
        ))}
      </GridLayout>
    </div>
  );
}

function WidgetContent({ type }: { type: WidgetType }) {
  switch (type) {
    case 'clock':     return <ClockWidget />;
    case 'reminders': return <RemindersWidget />;
    case 'shopping':  return <ShoppingWidget />;
    case 'finance':   return <FinanceWidget />;
    case 'calendar':  return <CalendarWidget />;
    case 'notes':     return <NotesWidget />;
    case 'weather':   return <WeatherWidget />;
  }
}
