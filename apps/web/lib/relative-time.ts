/**
 * formatRelativeTime — human-readable "X minutes ago" / "just now" strings.
 * Lightweight, no external deps. Caps at weeks.
 */

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return '';

  const deltaMs = now.getTime() - parsed;
  const deltaSec = Math.round(deltaMs / 1000);
  const absSec = Math.abs(deltaSec);

  if (absSec < 30) return 'just now';

  const future = deltaSec < 0;
  const pluralize = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

  let phrase: string;
  if (absSec < 3600) {
    const mins = Math.round(absSec / 60);
    phrase = pluralize(mins, 'minute');
  } else if (absSec < 86400) {
    const hours = Math.round(absSec / 3600);
    phrase = pluralize(hours, 'hour');
  } else if (absSec < 604800) {
    const days = Math.round(absSec / 86400);
    phrase = pluralize(days, 'day');
  } else {
    const weeks = Math.round(absSec / 604800);
    phrase = pluralize(weeks, 'week');
  }

  return future ? `in ${phrase}` : `${phrase} ago`;
}
