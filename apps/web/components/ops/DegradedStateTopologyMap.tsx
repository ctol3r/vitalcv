'use client';

/**
 * DegradedStateTopologyMap.tsx
 *
 * Topology map of degraded state distribution.
 * Proportional width bars (CSS, no chart library).
 * D row (no_adverse_findings) uses green bar — success signal.
 */

export interface DegradedStateTopologyMapProps {
  distribution: {
    source_unreachable: number;
    infrastructure_outage: number;
    issuer_unavailable: number;
    stale_data: number;
    no_adverse_findings: number;
    anonymous_preview: number;
  };
}

interface TopologyRow {
  id: string;
  key: keyof DegradedStateTopologyMapProps['distribution'];
  letter: string;
  label: string;
  isSuccess?: boolean;
}

const ROWS: TopologyRow[] = [
  { id: 'a', key: 'source_unreachable',  letter: 'A', label: 'Source Unreachable' },
  { id: 'b', key: 'anonymous_preview',   letter: 'B', label: 'Anonymous Preview' },
  { id: 'c', key: 'infrastructure_outage', letter: 'C', label: 'Infra Outage' },
  { id: 'd', key: 'no_adverse_findings', letter: 'D', label: 'No Adverse Findings', isSuccess: true },
  { id: 'e', key: 'issuer_unavailable',  letter: 'E', label: 'Issuer Unavail.' },
  { id: 'f', key: 'stale_data',          letter: 'F', label: 'Stale Data' },
];

export function DegradedStateTopologyMap({ distribution }: DegradedStateTopologyMapProps) {
  // compute max for proportional bar
  const values = ROWS.map((r) => distribution[r.key]);
  const max = Math.max(...values, 1);

  return (
    <div className="border border-gray-200 bg-white overflow-hidden rounded">
      {/* Header */}
      <div className="vcv-anchor-band">
        <span className="vcv-label">Degraded State Topology</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[16px_1fr_24px_120px] gap-3 items-center px-3 py-1.5 bg-gray-50 border-b border-gray-100">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">#</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">State</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 text-right">N</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">Dist.</span>
      </div>

      {/* Rows */}
      <div>
        {ROWS.map((row) => {
          const count = distribution[row.key];
          const pct = max > 0 ? Math.round((count / max) * 100) : 0;

          return (
            <div
              key={row.id}
              className="grid grid-cols-[16px_1fr_24px_120px] gap-3 items-center px-3 min-h-[32px] border-b border-gray-100 last:border-b-0"
            >
              {/* Letter */}
              <span className="text-[10px] font-mono text-gray-400">{row.letter}</span>

              {/* Label */}
              <span className={`text-[10px] font-mono ${row.isSuccess ? 'text-green-700' : 'text-gray-600'}`}>
                {row.label}
              </span>

              {/* Count */}
              <span className="text-xs font-mono text-gray-700 text-right tabular-nums">
                {count}
              </span>

              {/* Proportional bar */}
              <div className="w-[120px] h-[3px] bg-gray-100 overflow-hidden">
                {count > 0 && (
                  <div
                    className={`h-full ${row.isSuccess ? 'bg-green-400' : 'bg-gray-300'}`}
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
