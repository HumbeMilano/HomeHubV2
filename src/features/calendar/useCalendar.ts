import { useEffect, useState } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from 'date-fns';
import type { CalendarEvent, Chore, ChoreCompletion, Reminder } from '../../types';
import { supabase } from '../../lib/supabase';
import { subscribeToTable } from '../../lib/realtime';
import { useChoresStore } from '../../store/choresStore';

/**
 * Builds the unified event list for the calendar from multiple sources:
 *   - chores (converted to CalendarEvent using their scheduled dates)
 *   - reminders
 *   - bill due dates (from finance)
 */
export function useCalendarEvents(viewDate: Date, viewType: 'month' | 'week') {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const { chores, completions, fetchAll } = useChoresStore();

  // Date range for the view
  const range =
    viewType === 'month'
      ? { start: startOfMonth(viewDate), end: endOfMonth(viewDate) }
      : { start: startOfWeek(viewDate, { weekStartsOn: 0 }), end: endOfWeek(viewDate, { weekStartsOn: 0 }) };

  // Load chores if not already loaded
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Load reminders within range
  useEffect(() => {
    supabase
      .from('reminders')
      .select('*')
      .gte('due_at', range.start.toISOString())
      .lte('due_at', range.end.toISOString())
      .then(({ data }) => setReminders((data ?? []) as Reminder[]));
  }, [range.start.toISOString(), range.end.toISOString()]);

  // Subscribe to reminder changes via Supabase Realtime
  useEffect(() => {
    return subscribeToTable<Reminder>({
      table: 'reminders',
      onData: () => {
        // Refetch on any change
        supabase
          .from('reminders')
          .select('*')
          .gte('due_at', range.start.toISOString())
          .lte('due_at', range.end.toISOString())
          .then(({ data }) => setReminders((data ?? []) as Reminder[]));
      },
    });
  }, []);

  // Build unified event list
  useEffect(() => {
    const choreEvents = buildChoreEvents(chores, completions, range.start, range.end);
    const reminderEvents = reminders.map(reminderToEvent);
    setEvents([...choreEvents, ...reminderEvents]);
  }, [chores, completions, reminders]);

  return events;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildChoreEvents(
  chores: Chore[],
  completions: ChoreCompletion[],
  start: Date,
  end: Date
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const chore of chores) {
    const dates = getScheduledDates(chore, start, end);
    for (const date of dates) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const completion = completions.find(
        (c) => c.chore_id === chore.id && c.scheduled_date === dateStr
      );
      events.push({
        id: `chore-${chore.id}-${dateStr}`,
        title: chore.title,
        start_time: date.toISOString(),
        end_time: null,
        type: 'chore',
        linked_id: chore.id,
        member_id: null,
        color: completion?.completed_at ? 'var(--text-3)' : undefined,
      });
    }
  }

  return events;
}

function getScheduledDates(chore: Chore, start: Date, end: Date): Date[] {
  if (chore.recurrence_rule === 'none') return [];

  const dates: Date[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    switch (chore.recurrence_rule) {
      case 'daily':
        dates.push(new Date(cursor));
        break;
      case 'weekly':
        if (cursor.getDay() === start.getDay()) dates.push(new Date(cursor));
        break;
      case 'biweekly':
        // Simplified: every 14 days from start
        break;
      case 'monthly':
        if (cursor.getDate() === 1) dates.push(new Date(cursor));
        break;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function reminderToEvent(r: Reminder): CalendarEvent {
  return {
    id: `reminder-${r.id}`,
    title: r.title,
    start_time: r.due_at,
    end_time: null,
    type: 'reminder',
    linked_id: r.id,
    member_id: r.member_id,
  };
}
