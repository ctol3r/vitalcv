'use client';

/**
 * ChronologyContinuityRail.tsx
 *
 * Doctrine-annotated version of ChronologyRail.
 * Shows WHY each node is what it is — RC-1, RC-2, etc.
 * Bloomberg terminal density. No rounded containers.
 */

export interface AnnotatedNode {
  nodeId: string;
  ts: string;
  label: string;
  status: string;
  tier: 'T1' | 'T2' | 'T3' | 'T4';
  priorNodeId: string | null;
  doctrineNote: string;
  contractClause: string;
}

export interface ChronologyContinuityRailProps {
  nodes: AnnotatedNode[];
  showAnnotations?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusDot(status: string): string {
  switch (status) {
    case 'verified':     return 'text-green-600';
    case 'stale':        return 'text-amber-500';
    case 'unavailable':  return 'text-gray-300';
    case 'adverse':      return 'text-red-600';
    default:             return 'text-gray-300';
  }
}

function statusLabel(s: string): string {
  return s.toUpperCase().replace(/_/g, ' ');
}

function nodeIsActive(status: string): boolean {
  return status === 'verified';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChronologyContinuityRail({
  nodes,
  showAnnotations = true,
}: ChronologyContinuityRailProps) {
  return (
    <div className="font-sans">
      {/* Header */}
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-2">
        Chronology Continuity Rail
      </div>

      <div className="border border-gray-200">
        {nodes.map((node, i) => {
          const isLast = i === nodes.length - 1;
          const active = nodeIsActive(node.status);

          return (
            <div key={node.nodeId} className={`${!isLast ? 'border-b border-gray-100' : ''}`}>
              {/* Main node row */}
              <div className="flex flex-row min-h-[32px] items-start px-3 py-1.5 gap-3">
                {/* Rail + dot */}
                <div className="flex flex-col items-center pt-0.5 shrink-0">
                  {/* Dot */}
                  <div
                    className={`w-2 h-2 rounded-full border ${
                      active
                        ? 'bg-green-500 border-green-500'
                        : 'bg-gray-200 border-gray-300'
                    }`}
                  />
                  {/* Rail line */}
                  {!isLast && (
                    <div
                      className={`w-px flex-1 mt-1 ${
                        node.priorNodeId ? 'bg-gray-200' : 'bg-dashed bg-gray-100'
                      }`}
                      style={{ minHeight: showAnnotations ? '48px' : '20px' }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Timestamp + label + tier + status */}
                  <div className="flex flex-row items-baseline gap-2 flex-wrap">
                    <span className="font-mono text-xs text-gray-500 shrink-0">{node.ts}</span>
                    <span className="text-xs text-gray-700 font-semibold uppercase tracking-wide shrink-0">
                      {node.label}
                    </span>
                    <span className="text-[9px] font-mono border border-gray-200 px-1 py-px text-gray-400 shrink-0">
                      {node.tier}
                    </span>
                    <span className={`text-[10px] font-mono ${statusDot(node.status)} shrink-0`}>
                      {statusLabel(node.status)}
                    </span>
                  </div>

                  {/* Prior chain link */}
                  {node.priorNodeId && (
                    <div className="font-mono text-[9px] text-gray-300 mt-0.5">
                      ↳ prior: {node.priorNodeId}
                    </div>
                  )}

                  {/* Doctrine annotations */}
                  {showAnnotations && (
                    <div className="mt-1 space-y-0.5">
                      <div className="text-[9px] font-mono text-gray-300">
                        <span className="text-gray-400">{node.contractClause}:</span>{' '}
                        {node.doctrineNote}
                      </div>
                    </div>
                  )}

                  {/* Node ID */}
                  <div className="font-mono text-[9px] text-gray-300 mt-0.5">{node.nodeId}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
