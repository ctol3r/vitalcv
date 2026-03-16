import { differenceInCalendarDays, format, formatDistanceStrict } from 'date-fns';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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

  if (absMs < MINUTE_MS) {
    return 'just now';
  }

  const calendarDayDelta = differenceInCalendarDays(date, referenceDate);
  if (calendarDayDelta === -1 && absMs >= DAY_MS) {
    return 'Yesterday';
  }
  if (calendarDayDelta === 1 && absMs >= DAY_MS) {
    return 'Tomorrow';
  }

  return formatDistanceStrict(date, referenceDate, {
    addSuffix: true,
    roundingMethod: 'round',
  });
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
