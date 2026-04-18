import { useEffect, useState, type ReactNode } from 'react';
import { format, differenceInCalendarWeeks, parseISO } from 'date-fns';
import { CheckSquare, StickyNote } from 'lucide-react';
import type { CalendarItem, Chore, ChoreCompletion, Member, Note } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import PhotoSlideshow from './PhotoSlideshow';
import styles from './LockScreen.module.css';

const PIN_LENGTH = 4;

export default function LockScreen() {
  const { unlock } = useAuthStore();
  const photoSlideInterval = useAppStore((s) => s.photoSlideInterval);

  const [now, setNow] = useState(new Date());
  const [digits, setDigits] = useState<string[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorKey, setErrorKey] = useState(0);   // increments each error → forces shake replay
  const [showPin, setShowPin] = useState(false);  // PIN overlay hidden by default
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    supabase
      .from('household_members')
      .select('id, name, color, avatar_url, supabase_user_id, created_at')
      .order('name')
      .then(({ data }) => { if (data) setMembers(data as Member[]); });
  }, []);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (digits.length !== PIN_LENGTH || verifying || members.length === 0) return;

    const pin = digits.join('');
    setVerifying(true);

    Promise.all(
      members.map((m) =>
        supabase.functions
          .invoke('verify-pin', { body: { member_id: m.id, pin } })
          .then(({ data }) => ({ member: m, match: data?.match === true }))
          .catch(() => ({ member: m, match: false }))
      )
    ).then((results) => {
      setVerifying(false);
      const matched = results.find((r) => r.match);
      if (matched) {
        unlock(matched.member);
      } else {
        setError(true);
        setErrorMsg('Incorrect PIN');
        setErrorKey((k) => k + 1);  // force shake animation replay
        setTimeout(() => {
          setDigits([]);
          setError(false);
          setErrorMsg('');
          setShowPin(false);  // auto-close overlay after error clears
        }, 900);
      }
    });
  }, [digits, verifying, members, unlock]);

  function press(key: string) {
    if (digits.length < PIN_LENGTH && !verifying && !error) {
      setDigits((d) => [...d, key]);
    }
  }

  function backspace() {
    if (!verifying) setDigits((d) => d.slice(0, -1));
  }

  function handleRootClick() {
    if (!showPin) setShowPin(true);
  }

  return (
    <div className={styles.root} onClick={handleRootClick}>
      <PhotoSlideshow interval={photoSlideInterval} />

      <div className={styles.layout}>

        {/* ── Left: clock + events ─────────────────────── */}
        <div className={styles.leftCol}>

          <div className={styles.clock}>
            <span className={styles.time}>
              {format(now, 'h:mm')}
              <span className={styles.ampm}>{format(now, 'a')}</span>
            </span>
            <span className={styles.date}>{format(now, 'EEEE, MMMM d')}</span>
          </div>

          <UpcomingEvents />
        </div>

        {/* ── Right: sticky notes panel (desktop only) ─────── */}
        <div className={styles.notesDesktop}>
          <LockNotes />
        </div>
      </div>

      {/* ── Bottom notes bar (mobile only) ───────────────────── */}
      <div className={styles.notesBottom}>
        <LockNotes />
      </div>

      {/* ── Unlock hint (visible when PIN is hidden) ──────────── */}
      {!showPin && (
        <p className={styles.unlockHint}>Tap to unlock</p>
      )}

      {/* ── PIN overlay (centered, appears on tap) ────────────── */}
      {showPin && (
        <div
          className={styles.pinOverlay}
          onClick={() => { if (!verifying) setShowPin(false); }}
        >
          <div className={styles.pinBox} onClick={(e) => e.stopPropagation()}>
            <p className={styles.pinPrompt}>
              {verifying ? 'Verifying…' : error ? errorMsg : 'Enter PIN'}
            </p>

            <div
              key={errorKey}
              className={`${styles.dots} ${error ? styles.dotsShake : ''}`}
            >
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <span
                  key={i}
                  className={`${styles.dot} ${error ? styles.dotError : i < digits.length ? styles.dotFilled : ''}`}
                />
              ))}
            </div>

            <div className={styles.numpad}>
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => (
                <button
                  key={i}
                  className={`${styles.numkey} ${key === '' ? styles.numkeyEmpty : ''}`}
                  disabled={key === '' || verifying}
                  onClick={() => key === '⌫' ? backspace() : key !== '' && press(key)}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {import.meta.env.DEV && <DevBypass members={members} onUnlock={unlock} />}
    </div>
  );
}

/* ── Upcoming events ─────────────────────────────────────────────────────── */
function UpcomingEvents() {
  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [completions, setCompletions] = useState<ChoreCompletion[]>([]);

  useEffect(() => {
    const nowIso = new Date().toISOString();
    const today  = format(new Date(), 'yyyy-MM-dd');

    supabase
      .from('calendar_items')
      .select('id, type, title, color, all_day, start_at, end_at, repeat, notes, reminder_category, member_id, created_at')
      .gte('start_at', nowIso)
      .order('start_at')
      .limit(5)
      .then(({ data }) => setEvents((data ?? []) as CalendarItem[]));

    supabase
      .from('chores')
      .select('id, title, recurrence_rule, created_at, description, category, created_by')
      .then(({ data }) => setChores((data ?? []) as Chore[]));

    supabase
      .from('chore_completions')
      .select('chore_id, scheduled_date, completed_at, id, completed_by')
      .eq('scheduled_date', today)
      .then(({ data }) => setCompletions((data ?? []) as ChoreCompletion[]));
  }, []);

  const now   = new Date();
  const today = format(now, 'yyyy-MM-dd');

  function isScheduledToday(chore: Chore): boolean {
    const rule   = chore.recurrence_rule;
    if (rule === 'none' || rule === 'daily') return true;
    const origin = new Date(chore.created_at);
    if (rule === 'weekly')   return now.getDay() === origin.getDay();
    if (rule === 'biweekly') {
      const wksDiff = differenceInCalendarWeeks(now, origin, { weekStartsOn: 0 });
      return now.getDay() === origin.getDay() && wksDiff % 2 === 0;
    }
    if (rule === 'monthly')  return now.getDate() === origin.getDate();
    return true;
  }

  const isDoneToday = (id: string) =>
    completions.some((c) => c.chore_id === id && c.scheduled_date === today && !!c.completed_at);

  const pendingChores = chores.filter((c) => isScheduledToday(c) && !isDoneToday(c.id));

  const rows: ReactNode[] = [];

  events.forEach((item) => {
    let label = '';
    try {
      label = format(parseISO(item.start_at), item.all_day ? 'MMM d' : 'h:mm a');
    } catch { label = ''; }
    rows.push(
      <div key={item.id} className={styles.eventRow}>
        <span className={styles.eventDot} style={{ background: item.color ?? 'rgba(255,255,255,.5)' }} />
        <span className={styles.eventTime}>{label}</span>
        <span className={styles.eventTitle}>{item.title}</span>
      </div>
    );
  });

  if (pendingChores.length > 0) {
    rows.push(
      <div key="chores" className={styles.eventRow}>
        <CheckSquare size={12} style={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
        <span className={styles.eventTime}>Today</span>
        <span className={styles.eventTitle}>
          {pendingChores.length} chore{pendingChores.length !== 1 ? 's' : ''} pending
        </span>
      </div>
    );
  }

  if (rows.length === 0) return null;

  return <div className={styles.eventsPanel}>{rows}</div>;
}

/* ── Lock screen sticky notes ────────────────────────────────────────────── */
function LockNotes() {
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    supabase
      .from('notes')
      .select('id, content, color, on_lock_screen, updated_at')
      .eq('on_lock_screen', true)
      .order('updated_at', { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (!error && data) setNotes(data as Note[]);
      });
  }, []);

  if (notes.length === 0) return null;

  return (
    <div className={styles.notesPanel}>
      <div className={styles.notesPanelHeader}>
        <StickyNote size={13} />
        Notes
      </div>
      <div className={styles.notesList}>
        {notes.map((note) => (
          <div key={note.id} className={styles.noteCard} style={{ background: note.color }}>
            <p className={styles.noteContent}>{note.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Dev bypass ──────────────────────────────────────────────────────────── */
function DevBypass({ members, onUnlock }: { members: Member[]; onUnlock: (m: Member) => void }) {
  const dev: Member = { id: 'dev', name: 'Dev', color: '#5b5bf6', avatar_url: null, supabase_user_id: null, created_at: '' };
  const targets = members.length > 0 ? members : [dev];

  return (
    <div style={{ position: 'absolute', bottom: 12, left: 16, display: 'flex', gap: 8 }}>
      {targets.map((m) => (
        <button
          key={m.id}
          onClick={(e) => { e.stopPropagation(); onUnlock(m); }}
          style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
        >
          [{m.name.split(' ')[0]}]
        </button>
      ))}
    </div>
  );
}
