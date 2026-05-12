'use client';

import { TrustTierBadge, type TrustTier } from '@/components/proof/TrustTierBadge';

export interface TrustRegisterRowProps {
  // The 6 slots (fixed order: OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID)
  object: string;
  ownership: string | null;
  // ownership type: 'actor' = Clerk userId, 'system' = infra, null = unbound
  ownershipType?: 'actor' | 'system' | null;
  checkedAt: string | null;
  channel: string;
  replay: string | null;
  runId: string;

  // Lineage key: {laneId}:{providerId}
  lineageKey?: string | null;

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
  <span className="font-mono text-gray-200 select-none tracking-[0.15em]">─ ─ ─</span>
);

export function TrustRegisterRow({
  object,
  ownership,
  ownershipType = null,
  checkedAt,
  channel,
  replay,
  runId,
  lineageKey,
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

  // Ownership color based on hierarchy level
  const ownershipClass = (() => {
    if (!ownership) return 'font-mono text-xs text-gray-300 italic';
    if (ownershipType === 'actor') return 'font-mono text-xs text-gray-900';
    if (ownershipType === 'system') return 'font-mono text-xs text-gray-500';
    return 'font-mono text-xs text-gray-500';
  })();

  return (
    <div className={wrapperClass}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">

        {/* OBJECT — prose label */}
        <div className="min-w-0">
          <div className={labelClass}>OBJECT</div>
          <div className="text-xs text-gray-900 break-all">
            {noAdverseFindings ? '✓ No Adverse Findings' : object}
          </div>
          {lineageKey && (
            <details className="inline mt-0.5">
              <summary className="text-[9px] font-mono text-gray-300 cursor-pointer hover:text-gray-500 list-none">key</summary>
              <code className="text-[9px] font-mono bg-gray-50 px-1 text-gray-500">{lineageKey}</code>
            </details>
          )}
        </div>

        {/* OWNERSHIP — machine truth, 3-level hierarchy */}
        <div className="min-w-0">
          <div className={labelClass}>OWNERSHIP</div>
          <div className={`${ownershipClass} break-all`}>
            {ownership ?? <NullSlot />}
          </div>
        </div>

        {/* CHECKED_AT — machine truth, tabular-nums */}
        <div className="min-w-0">
          <div className={labelClass}>CHECKED_AT</div>
          <div className="font-mono text-xs text-gray-500 tabular-nums break-all">
            {checkedAt ?? <NullSlot />}
          </div>
        </div>

        {/* CHANNEL — prose (source name) */}
        <div className="min-w-0">
          <div className={labelClass}>CHANNEL</div>
          <div className="text-xs text-gray-600 break-all">
            {channel}
          </div>
        </div>

        {/* REPLAY — machine truth if present */}
        <div className="min-w-0">
          <div className={labelClass}>REPLAY</div>
          <div className="font-mono text-xs text-gray-400 break-all">
            {replay ?? <NullSlot />}
          </div>
        </div>

        {/* RUN_ID — machine truth, run: prefix */}
        <div className="min-w-0">
          <div className={labelClass}>RUN_ID</div>
          <div className="font-mono text-xs text-gray-900 tabular-nums break-all">
            {runId ? (
              <span className="font-mono text-xs text-gray-900 tabular-nums">
                run:{runId.startsWith('run:') ? runId.slice(4) : runId}
              </span>
            ) : (
              <NullSlot />
            )}
          </div>
        </div>

      </div>
      <div className="mt-2">
        <TrustTierBadge tier={tier} />
      </div>
    </div>
  );
}
