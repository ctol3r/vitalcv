'use client';

import { TrustTierBadge } from '@/components/proof/TrustTierBadge';

const TIER_LEGEND = [
  {
    tier: 'T1' as const,
    color: 'bg-gray-50 border-gray-200',
    description: 'Clinician-provided, not verified',
  },
  {
    tier: 'T2' as const,
    color: 'bg-amber-50 border-amber-200',
    description: 'Derived from verified data',
  },
  {
    tier: 'T3' as const,
    color: 'bg-blue-50 border-blue-200',
    description: 'Checked against authoritative source',
  },
  {
    tier: 'T4' as const,
    color: 'bg-green-50 border-green-200',
    description: 'Cryptographically signed by issuer',
  },
];

const STATE_VOCABULARY = [
  {
    label: 'ANONYMOUS PREVIEW',
    note: 'Exploratory, unowned — no lineage attribution',
    style: 'border-dashed border-gray-300 bg-stone-50 text-gray-500',
  },
  {
    label: 'OWNED SNAPSHOT',
    note: 'Attributed, replay-visible — example lineage',
    style: 'border-gray-300 bg-white text-gray-700',
  },
  {
    label: 'SIGNED ARTIFACT (EXAMPLE)',
    note: 'Cryptographic plane — issuer-signed, T4 capable',
    style: 'border-gray-700 bg-gray-900 text-gray-100',
  },
];

export function TrustRegisterLegend() {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-5">
      {/* Tier legend */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
          Proof Tier Vocabulary
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIER_LEGEND.map(({ tier, description }) => (
            <div key={tier} className="space-y-1">
              <TrustTierBadge tier={tier} />
              <p className="text-xs text-gray-500">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* State vocabulary */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
          State Vocabulary
        </div>
        <div className="space-y-2">
          {STATE_VOCABULARY.map(({ label, note, style }) => (
            <div
              key={label}
              className={`rounded border px-3 py-2 flex items-start gap-3 ${style}`}
            >
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider flex-shrink-0 mt-0.5">
                {label}
              </span>
              <span className="text-xs opacity-70">{note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
