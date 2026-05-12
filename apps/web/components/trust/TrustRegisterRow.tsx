'use client';

import { TrustTierBadge, type TrustTier } from '@/components/proof/TrustTierBadge';

export interface TrustRegisterRowProps {
  // The 6 slots (fixed order: OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID)
  object: string;
  ownership: string | null;
  checkedAt: string | null;
  channel: string;
  replay: string | null;
  runId: string;

  // State type affects visual treatment
  state: 'anonymous' | 'owned' | 'signed';

  // Trust tier badge
  tier: TrustTier;

  // Whether this is an adverse finding
  adverse?: boolean;

  // "No adverse findings" explicit success flag
  noAdverseFindings?: boolean;
}

const NullSlot = () => (
  <span className="font-mono text-gray-300 select-none">─ ─ ─</span>
);

export function TrustRegisterRow({
  object,
  ownership,
  checkedAt,
  channel,
  replay,
  runId,
  state,
  tier,
  adverse = false,
  noAdverseFindings = false,
}: TrustRegisterRowProps) {
  const wrapperClass = (() => {
    if (noAdverseFindings) {
      return 'border border-green-400 bg-green-50 p-3 min-h-[40px]';
    }
    if (adverse) {
      return 'border border-red-300 bg-red-50 p-3 min-h-[40px]';
    }
    if (state === 'anonymous') {
      return 'bg-stone-50 border border-dashed border-gray-200 p-3 min-h-[40px]';
    }
    if (state === 'signed') {
      return 'bg-gray-900 border border-gray-700 p-3 min-h-[40px]';
    }
    // owned
    return 'bg-white border border-gray-200 p-3 min-h-[40px]';
  })();

  // Bloomberg header label style — uniform across all states
  const labelClass =
    'text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-0.5';

  const baseValueClass = (() => {
    if (state === 'signed' && !noAdverseFindings && !adverse) return 'text-gray-100';
    if (noAdverseFindings) return 'text-green-800';
    if (adverse) return 'text-red-800';
    return 'text-gray-800';
  })();

  const textClass = `text-sm ${baseValueClass}`;
  const monoClass = `text-sm font-mono ${baseValueClass}`;

  const slots = [
    {
      label: 'OBJECT',
      value: noAdverseFindings ? '✓ No Adverse Findings' : object,
      mono: false,
      nullable: false,
    },
    { label: 'OWNERSHIP', value: ownership, mono: true, nullable: true },
    { label: 'CHECKED_AT', value: checkedAt, mono: true, nullable: true },
    { label: 'CHANNEL', value: channel, mono: false, nullable: false },
    { label: 'REPLAY', value: replay, mono: true, nullable: true },
    { label: 'RUN_ID', value: runId, mono: true, nullable: false },
  ];

  return (
    <div className={wrapperClass}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {slots.map(({ label, value, mono, nullable }) => (
          <div key={label} className="min-w-0">
            <div className={labelClass}>{label}</div>
            <div className={`${mono ? monoClass : textClass} break-all`}>
              {nullable && (value === null || value === undefined) ? (
                <NullSlot />
              ) : (
                value
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <TrustTierBadge tier={tier} />
      </div>
    </div>
  );
}
