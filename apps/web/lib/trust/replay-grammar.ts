/**
 * Canonical replay grammar — binding reading order.
 *
 * From `Trust Primitives.html` (canon spec VC-PRIM-v1):
 *
 *     OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID
 *
 * Every institutional trust surface composes these six primitives in this
 * order. Surfaces compose; they never invent. This module encodes the
 * contract at the type level so a missing or reordered slot fails the
 * type-check.
 */

export const LINEAGE_SLOT_ORDER = [
  'object',
  'ownership',
  'checkedAt',
  'channel',
  'replay',
  'runId',
] as const;

export type LineageSlotKey = (typeof LINEAGE_SLOT_ORDER)[number];

export type LineageTrustState = 'preview' | 'snapshot' | 'signed';

export interface LineageSlot {
  readonly key: LineageSlotKey;
  readonly label: string;
  readonly value: string;
  readonly subLabel?: string;
  readonly degraded?: boolean;
}

export type LineageSlots = readonly [
  LineageSlot & { key: 'object' },
  LineageSlot & { key: 'ownership' },
  LineageSlot & { key: 'checkedAt' },
  LineageSlot & { key: 'channel' },
  LineageSlot & { key: 'replay' },
  LineageSlot & { key: 'runId' },
];

export interface LineageSlotInput {
  object: Omit<LineageSlot, 'key'>;
  ownership: Omit<LineageSlot, 'key'>;
  checkedAt: Omit<LineageSlot, 'key'>;
  channel: Omit<LineageSlot, 'key'>;
  replay: Omit<LineageSlot, 'key'>;
  runId: Omit<LineageSlot, 'key'>;
}

/**
 * Compose a canonical six-slot lineage. The return tuple is always in
 * binding reading order. Construction is total over LineageSlotInput —
 * a caller that omits a slot fails to compile.
 */
export function composeLineage(input: LineageSlotInput): LineageSlots {
  return [
    { key: 'object', ...input.object },
    { key: 'ownership', ...input.ownership },
    { key: 'checkedAt', ...input.checkedAt },
    { key: 'channel', ...input.channel },
    { key: 'replay', ...input.replay },
    { key: 'runId', ...input.runId },
  ] as const;
}

/**
 * Human-readable caption for the canonical reading-order rail.
 * Rendered by LineageHeader above the six cells.
 */
export const READING_ORDER_CAPTION =
  'object → ownership → checked_at → channel → replay → run_id';
