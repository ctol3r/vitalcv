'use client';

/**
 * EvidenceTimeline.tsx
 *
 * Vertical ledger of evidence events, most recent first.
 * Legal-grade density — Bloomberg terminal aesthetic.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceEvent {
  eventId: string;
  ts: string;                // ISO "YYYY-MM-DD HH:mm:ss UTC"
  laneId: string;            // "nppes_identity" etc
  source: string;            // "CMS NPPES Registry"
  status: string;            // "verified" | "unavailable" | "stale" etc
  tier: 'T1' | 'T2' | 'T3' | 'T4';
  actor: string | null;
  receiptId: string | null;
  note: string | null;
}

export interface EvidenceTimelineProps {
  events: EvidenceEvent[];
  highlightEventId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(s: string): string {
  return s.toUpperCase().replace(/_/g, ' ');
}

function statusCls(s: string): string {
  switch (s) {
    case 'verified':         return 'text-green-700';
    case 'unavailable':      return 'text-gray-400';
    case 'stale':            return 'text-amber-600';
    case 'not_checked':      return 'text-gray-400';
    case 'adverse':          return 'text-red-600';
    default:                 return 'text-gray-600';
  }
}

function gapLabel(a: EvidenceEvent, b: EvidenceEvent): string | null {
  try {
    const diffMs = new Date(b.ts).getTime() - new Date(a.ts).getTime();
    if (diffMs < 0) return null;
    const days = Math.floor(diffMs / 86_400_000);
    if (days < 2) return null;
    return `── gap: ${days} day${days !== 1 ? 's' : ''} ──`;
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EvidenceTimeline({ events, highlightEventId }: EvidenceTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="border border-gray-200 bg-white">
        <div className="vcv-anchor-band">
          <span className="vcv-label">Evidence Timeline</span>
        </div>
        <div className="px-4 py-3 text-xs text-gray-400 italic">No evidence events recorded.</div>
      </div>
    );
  }

  // Sort: most recent first
  const sorted = [...events].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
  );

  return (
    <div className="border border-gray-200 bg-white">
      <div className="vcv-anchor-band">
        <span className="vcv-label">Evidence Timeline</span>
      </div>

      <div>
        {sorted.map((evt, idx) => {
          const isHighlighted = evt.eventId === highlightEventId;
          const prev = sorted[idx - 1];
          const gap = prev ? gapLabel(evt, prev) : null;

          return (
            <div key={evt.eventId}>
              {/* Gap banner */}
              {gap && (
                <div className="px-4 py-1 text-[10px] font-mono text-gray-300 border-b border-gray-100">
                  {gap}
                </div>
              )}

              {/* Event row */}
              <div
                className={[
                  'px-4 py-2 border-b border-gray-100 last:border-b-0',
                  isHighlighted ? 'border-l-2 border-l-blue-500 pl-3' : '',
                ].join(' ')}
              >
                {/* Primary line */}
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-mono text-xs text-gray-500 shrink-0">{evt.ts}</span>
                  <span className="font-mono text-xs text-gray-900">{evt.laneId}</span>
                  <span className="font-mono text-[10px] border border-gray-300 px-1 text-gray-500">
                    {evt.tier}
                  </span>
                  <span className={`font-mono text-xs font-semibold ${statusCls(evt.status)}`}>
                    {statusLabel(evt.status)}
                  </span>
                </div>

                {/* Source + actor line */}
                <div className="mt-0.5 text-[10px] text-gray-400 flex flex-wrap gap-2">
                  <span>Source: {evt.source}</span>
                  <span>·</span>
                  <span>Actor: {evt.actor ?? '—'}</span>
                  {evt.receiptId && (
                    <>
                      <span>·</span>
                      <span className="font-mono">Receipt: {evt.receiptId}</span>
                    </>
                  )}
                </div>

                {/* Note */}
                {evt.note && (
                  <div className="mt-0.5 text-xs text-gray-600 italic">{evt.note}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
