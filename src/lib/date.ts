import type { ISODate } from '../data/types';

/** Format a Date as YYYY-MM-DD using *local* time (never UTC, to avoid off-by-one days). */
export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local-time Date at midnight. */
export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole days from `a` to `b` (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  const ms = fromISODate(b).getTime() - fromISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function isWeekend(iso: ISODate): boolean {
  const day = fromISODate(iso).getDay();
  return day === 0 || day === 6;
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISODate(fromISODate(value)) === value;
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface CalendarCell {
  date: ISODate;
  day: number;
  inMonth: boolean;
}

/**
 * Build a 6-row (42-cell) month grid starting on Sunday. Always 6 rows so the
 * calendar does not change height between months.
 */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ date: toISODate(d), day: d.getDate(), inMonth: d.getMonth() === month });
  }
  return cells;
}

const longDate = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const mediumDate = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
const monthYear = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });

export const formatLongDate = (iso: ISODate) => longDate.format(fromISODate(iso));
export const formatMediumDate = (iso: ISODate) => mediumDate.format(fromISODate(iso));
export const formatShortDate = (iso: ISODate) => shortDate.format(fromISODate(iso));
export const formatMonthYear = (year: number, month: number) => monthYear.format(new Date(year, month, 1));
export const formatTime = (epochMs: number) => timeFmt.format(new Date(epochMs));

/** "Due today", "Due in 3 days", "2 days overdue". */
export function relativeDue(dueDate: ISODate, today: ISODate = todayISO()): string {
  const n = diffDays(today, dueDate);
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  if (n > 1) return `Due in ${n} days`;
  if (n === -1) return '1 day overdue';
  return `${-n} days overdue`;
}
