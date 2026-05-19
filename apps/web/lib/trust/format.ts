/**
 * VitalCV · Trust Surfaces · Format helpers v1
 *
 * Pure formatting helpers used by every trust-surface component. No
 * I/O, no fetch, no source coupling. The helpers are deterministic
 * given their inputs — important for SSR consistency and snapshot
 * tests.
 */

import type {
  Lineage,
  LineageCellId,
  OwnershipState,
  ReplayState,
} from './types';

/**
 * Humanise a checked-at timestamp into a "X ago" string suitable for
 * the lineage header.
 *
 * Returned shape:
 *   - checkedAtIso  → an explicit ISO timestamp string (untouched if
 *                     already ISO, normalised through `toISOString()`
 *                     otherwise).
 *   - checkedAgo    → "just now" / "X minutes ago" / "X hours ago" /
 *                     "X days ago" — the renderer never needs to do
 *                     time math itself.
 *
 * Designed to be pure: callers pass an explicit `now` so SSR tests
 * are deterministic.
 */
export function lineageWhen(
  isoOrDate: string | Date,
  now: Date = new Date(),
): { checkedAtIso: string; checkedAgo: string } {
  const checkedAt =
    isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  const checkedAtIso = checkedAt.toISOString();

  const deltaMs = Math.max(0, now.getTime() - checkedAt.getTime());
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 30) return { checkedAtIso, checkedAgo: 'just now' };
  if (seconds < 90) return { checkedAtIso, checkedAgo: '1 minute ago' };

  const minutes = Math.floor(seconds / 60);
  if (minutes < 90) return { checkedAtIso, checkedAgo: `${minutes} minutes ago` };

  const hours = Math.floor(minutes / 60);
  if (hours < 36) return { checkedAtIso, checkedAgo: `${hours} hours ago` };

  const days = Math.floor(hours / 24);
  return { checkedAtIso, checkedAgo: `${days} days ago` };
}

/** Human label for an ownership state, suitable for rendering. */
export function ownershipLabel(state: OwnershipState): string {
  switch (state) {
    case 'subject':
      return 'subject';
    case 'delegated':
      return 'delegated';
    case 'unbound':
      return 'unbound';
  }
}

/** Long-form explanation for the ownership state. */
export function ownershipDescription(state: OwnershipState): string {
  switch (state) {
    case 'subject':
      return 'The asserting party is the subject of this record.';
    case 'delegated':
      return 'An operator is reading on behalf of the subject under a documented delegation.';
    case 'unbound':
      return 'No subject binding has been established yet.';
  }
}

/** Human label for a replay state. */
export function replayLabel(state: ReplayState): string {
  switch (state) {
    case 'anchored':
      return 'anchored';
    case 'pending':
      return 'pending';
    case 'unanchored':
      return 'unanchored';
    case 'mismatched':
      return 'mismatched';
  }
}

/**
 * Extract the binding lineage cells in the canonical reading order.
 * Renderers loop over this array; never iterate Object.keys(lineage).
 *
 * Each cell is { id, label, value } so the renderer can pin
 * `data-cell={cell.id}` for the lineage-order test.
 */
export interface LineageCell {
  id: LineageCellId;
  label: string;
  value: string;
  subValue?: string;
}

export function lineageCells(lineage: Lineage): readonly LineageCell[] {
  return [
    {
      id: 'object',
      label: 'Object',
      value: lineage.object,
      subValue: lineage.objectSub,
    },
    {
      id: 'ownership',
      label: 'Ownership',
      value: ownershipLabel(lineage.ownership),
    },
    {
      id: 'checkedAt',
      label: 'checked_at',
      value: lineage.checkedAgo,
      subValue: lineage.checkedAtIso,
    },
    {
      id: 'channel',
      label: 'Channel',
      value: lineage.channel,
    },
    {
      id: 'replay',
      label: 'Replay',
      value: replayLabel(lineage.replay),
    },
    {
      id: 'runId',
      label: 'run_id',
      value: lineage.runId,
    },
  ] as const;
}

/**
 * Truncate a long identifier for monospace display, keeping the head
 * and tail visible (e.g. "abc12345…f9d3"). Pure; never throws.
 */
export function truncateId(id: string, headLen = 8, tailLen = 4): string {
  if (id.length <= headLen + tailLen + 1) return id;
  return `${id.slice(0, headLen)}…${id.slice(-tailLen)}`;
}
