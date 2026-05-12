'use client';

/**
 * DegradedStateLineageView.tsx
 *
 * Lineage of degraded state transitions — who owns each degradation.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DegradedTransition {
  ts: string;
  fromState: string;
  toState: string;
  laneId: string;
  ownership: 'infrastructure' | 'issuer' | 'clinician' | 'system';
  explanation: string;
}

export interface DegradedStateLineageViewProps {
  transitions: DegradedTransition[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ownershipCls(o: DegradedTransition['ownership']): string {
  switch (o) {
    case 'infrastructure': return 'text-amber-600';
    case 'issuer':         return 'text-red-600';
    case 'clinician':      return 'text-blue-600';
    case 'system':         return 'text-gray-500';
    default:               return 'text-gray-500';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DegradedStateLineageView({ transitions }: DegradedStateLineageViewProps) {
  return (
    <div className="border border-gray-200 bg-white">
      <div className="vcv-anchor-band">
        <span className="vcv-label">Degraded State Lineage</span>
      </div>

      {transitions.length === 0 ? (
        <div className="px-4 py-3 text-xs text-gray-400 italic">
          No degraded transitions recorded.
        </div>
      ) : (
        <div>
          {transitions.map((t, idx) => (
            <div
              key={idx}
              className="px-4 py-2 border-b border-gray-100 last:border-b-0"
            >
              {/* Header row */}
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-mono text-xs text-gray-500 shrink-0">{t.ts}</span>
                <span className="font-mono text-xs text-gray-900">{t.laneId}</span>
                <span
                  className={`text-[9px] font-mono uppercase font-semibold ${ownershipCls(t.ownership)}`}
                >
                  {t.ownership.toUpperCase()}
                </span>
              </div>

              {/* State transition */}
              <div className="mt-0.5 font-mono text-xs text-gray-600">
                {t.fromState}{' '}
                <span className="text-gray-400">→</span>{' '}
                {t.toState}
              </div>

              {/* Explanation */}
              <div className="mt-0.5 text-xs text-gray-600">&ldquo;{t.explanation}&rdquo;</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
