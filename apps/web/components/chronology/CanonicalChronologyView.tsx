/**
 * CanonicalChronologyView
 *
 * Enforces the canonical reading order for all chronology displays:
 *   OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID
 *
 * Never reorder the slots.
 */

import React from 'react';

export interface CanonicalChronologyProps {
  object: string;
  ownership: string | null;
  checkedAt: string | null;
  channel: string;
  replay: string | null;   // prior run_id (with "run:" prefix)
  runId: string;           // current run_id (with "run:" prefix)
  tier: 'T1' | 'T2' | 'T3' | 'T4';
  /** @default 'masthead' */
  variant?: 'masthead' | 'row' | 'compact';
}

// ─── Slot Labels (canonical order, never change) ──────────────────────────────

const SLOT_LABELS = ['OBJECT', 'OWNERSHIP', 'CHECKED_AT', 'CHANNEL', 'REPLAY', 'RUN_ID'] as const;

type SlotLabel = typeof SLOT_LABELS[number];

function resolveSlots(props: CanonicalChronologyProps): Record<SlotLabel, string> {
  return {
    OBJECT:     props.object,
    OWNERSHIP:  props.ownership ?? '—',
    CHECKED_AT: props.checkedAt ?? '—',
    CHANNEL:    props.channel,
    REPLAY:     props.replay ?? '—',
    RUN_ID:     props.runId,
  };
}

// ─── Tier Badge ───────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  T1: 'bg-gray-200 text-gray-700',
  T2: 'bg-yellow-100 text-yellow-800',
  T3: 'bg-blue-100 text-blue-800',
  T4: 'bg-green-100 text-green-800',
};

function TierBadge({ tier, dark = false }: { tier: string; dark?: boolean }) {
  const baseClass = dark
    ? 'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-white/10 text-white'
    : `px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${TIER_COLORS[tier] ?? 'bg-gray-100 text-gray-600'}`;
  return <span className={baseClass}>{tier}</span>;
}

// ─── Masthead Variant ─────────────────────────────────────────────────────────

function MastheadVariant({ props }: { props: CanonicalChronologyProps }) {
  const slots = resolveSlots(props);

  return (
    <div className="w-full bg-gray-900 text-white px-4 py-3 overflow-x-auto">
      <div className="grid grid-cols-6 gap-2 min-w-[720px]">
        {SLOT_LABELS.map((label) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-[9px] font-mono font-semibold uppercase tracking-widest text-gray-400">
              {label}
            </span>
            <span className="text-[11px] font-mono text-white truncate" title={slots[label]}>
              {slots[label]}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-end">
        <TierBadge tier={props.tier} dark />
      </div>
    </div>
  );
}

// ─── Row Variant ──────────────────────────────────────────────────────────────

function RowVariant({ props }: { props: CanonicalChronologyProps }) {
  const slots = resolveSlots(props);

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded text-[11px] font-mono">
      <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-900 font-semibold">
        {slots.OBJECT}
      </span>
      <span className="text-gray-500">{slots.OWNERSHIP}</span>
      <span className="text-gray-500">{slots.CHECKED_AT}</span>
      <span className="text-gray-500">{slots.CHANNEL}</span>
      {props.replay && (
        <span className="text-gray-400">
          ↳&nbsp;{slots.REPLAY}
        </span>
      )}
      <span className="text-gray-900 font-semibold">{slots.RUN_ID}</span>
      <TierBadge tier={props.tier} />
    </div>
  );
}

// ─── Compact Variant ──────────────────────────────────────────────────────────

function CompactVariant({ props }: { props: CanonicalChronologyProps }) {
  const slots = resolveSlots(props);

  const parts = [
    slots.OBJECT,
    slots.OWNERSHIP,
    slots.CHECKED_AT,
    slots.CHANNEL,
    slots.RUN_ID,
  ].filter((v) => v && v !== '—');

  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-600">
      <span>{parts.join(' · ')}</span>
      <TierBadge tier={props.tier} />
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function CanonicalChronologyView(props: CanonicalChronologyProps) {
  const variant = props.variant ?? 'masthead';

  if (variant === 'masthead') return <MastheadVariant props={props} />;
  if (variant === 'row') return <RowVariant props={props} />;
  return <CompactVariant props={props} />;
}

export default CanonicalChronologyView;
