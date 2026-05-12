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

const PLACEHOLDER = '─ ─ ─';

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
  // Determine wrapper classes based on state + flags
  const wrapperClass = (() => {
    if (noAdverseFindings) {
      return 'trust-register-success rounded-md border border-green-300 bg-green-50 p-3';
    }
    if (adverse) {
      return 'rounded-md border border-red-300 bg-red-50 p-3';
    }
    if (state === 'anonymous') {
      return 'trust-register-dashed rounded-md bg-stone-50 p-3';
    }
    if (state === 'signed') {
      return 'trust-register-cryptoplane rounded-md border border-gray-700 bg-gray-900 p-3';
    }
    // owned
    return 'rounded-md border border-gray-200 bg-white p-3';
  })();

  const labelClass = (() => {
    if (state === 'signed' && !noAdverseFindings && !adverse) {
      return 'text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5';
    }
    return 'text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-0.5';
  })();

  const valueClass = (() => {
    if (state === 'signed' && !noAdverseFindings && !adverse) {
      return 'text-xs text-gray-100';
    }
    if (noAdverseFindings) {
      return 'text-xs text-green-800';
    }
    if (adverse) {
      return 'text-xs text-red-800';
    }
    return 'text-xs text-gray-800';
  })();

  const monoClass = 'trust-register-mono ' + valueClass;

  const slots = [
    {
      label: 'OBJECT',
      value: noAdverseFindings ? '✓ No Adverse Findings' : object,
      mono: false,
    },
    {
      label: 'OWNERSHIP',
      value: ownership ?? PLACEHOLDER,
      mono: true,
    },
    {
      label: 'CHECKED_AT',
      value: checkedAt ?? PLACEHOLDER,
      mono: true,
    },
    {
      label: 'CHANNEL',
      value: channel,
      mono: false,
    },
    {
      label: 'REPLAY',
      value: replay ?? PLACEHOLDER,
      mono: true,
    },
    {
      label: 'RUN_ID',
      value: runId,
      mono: true,
    },
  ];

  return (
    <div className={wrapperClass}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        {slots.map(({ label, value, mono }) => (
          <div key={label} className="min-w-0">
            <div className={labelClass}>{label}</div>
            <div className={mono ? monoClass : valueClass + ' break-all'}>{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <TrustTierBadge tier={tier} />
      </div>
    </div>
  );
}
