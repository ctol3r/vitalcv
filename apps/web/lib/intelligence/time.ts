import { differenceInCalendarDays, format } from 'date-fns';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * 60 * 60 * 1000;

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function toValidDate(input: string | Date | null | undefined): Date | null {
  if (!input) {
    return null;
  }

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function formatRelativeTime(input: string | Date | null | undefined, now: number | Date = Date.now()): string {
  const date = toValidDate(input);
  const referenceDate = typeof now === 'number' ? new Date(now) : now;

  if (!date || Number.isNaN(referenceDate.getTime())) {
    return 'Unknown';
  }

  const diffMs = date.getTime() - referenceDate.getTime();
  const absMs = Math.abs(diffMs);
  const inFuture = diffMs > 0;

  if (absMs < MINUTE_MS) {
    return 'just now';
  }

  if (absMs < HOUR_MS) {
    const minutes = Math.round(absMs / MINUTE_MS);
    return inFuture ? `in ${minutes} min` : `${minutes} min ago`;
  }

  if (absMs < DAY_MS) {
    const hours = Math.round(absMs / HOUR_MS);
    const label = pluralize(hours, 'hour');
    return inFuture ? `in ${label}` : `${label} ago`;
  }

  const calendarDayDelta = differenceInCalendarDays(date, referenceDate);
  if (calendarDayDelta === -1) {
    return 'Yesterday';
  }
  if (calendarDayDelta === 1) {
    return 'Tomorrow';
  }

  if (absMs < 7 * DAY_MS) {
    const days = Math.round(absMs / DAY_MS);
    const label = pluralize(days, 'day');
    return inFuture ? `in ${label}` : `${label} ago`;
  }

  return format(date, date.getFullYear() === referenceDate.getFullYear() ? 'MMM d' : 'MMM d, yyyy');
}

export function formatAbsoluteTime(input: string | Date | null | undefined): string {
  const date = toValidDate(input);
  if (!date) {
    return 'Unknown';
  }

  return format(date, 'MMM d, yyyy, h:mm a');
}

export function safeLocalHref(candidate: string | null | undefined, fallback: string): string {
  if (!candidate || !candidate.startsWith('/')) {
    return fallback;
  }

  return candidate;
}
