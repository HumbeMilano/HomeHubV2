import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';

/** Generate a random UUID (crypto.randomUUID when available, fallback otherwise) */
export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Format a number as currency */
export function fmt(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

/** Return YYYY-MM key for a given month/year */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Format an ISO date string to a readable date */
export function fmtDate(iso: string, fmt_str = 'MMM d, yyyy'): string {
  return format(parseISO(iso), fmt_str);
}

/** Format an ISO datetime to a readable time */
export function fmtTime(iso: string): string {
  return format(parseISO(iso), 'h:mm a');
}

/** Get all 7 days of the week containing the given date */
export function getWeekDays(date: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(date, { weekStartsOn: 0 }),
    end: endOfWeek(date, { weekStartsOn: 0 }),
  });
}

/** Clamp a number between min and max */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/** Convert a hex color to rgba */
export function hexToRgba(hex: string, alpha = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
