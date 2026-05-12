'use client';

/**
 * EvidenceConflictViewer.tsx
 *
 * Displays evidence conflicts — detection, resolution strategy, and status.
 */

import type { EvidenceEvent } from './EvidenceTimeline';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceConflict {
  conflictId: string;
  laneId: string;
  description: string;
  conflictingEvents: EvidenceEvent[];
  resolution: 'first_write_wins' | 'latest_wins' | 'manual_review' | 'unresolved';
  resolvedAt: string | null;
}

export interface EvidenceConflictViewerProps {
  conflicts: EvidenceConflict[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolutionLabel(r: EvidenceConflict['resolution']): string {
  switch (r) {
    case 'first_write_wins': return 'first_write_wins';
    case 'latest_wins':      return 'latest_wins';
    case 'manual_review':    return 'manual_review';
    case 'unresolved':       return 'UNRESOLVED';
    default:                 return r;
  }
}

function resolutionStatusLabel(r: EvidenceConflict['resolution'], resolvedAt: string | null): string {
  if (r === 'unresolved' || !resolvedAt) return 'OPEN';
  return 'RESOLVED';
}

function statusCls(r: EvidenceConflict['resolution'], resolvedAt: string | null): string {
  if (r === 'unresolved' || !resolvedAt) return 'text-red-600';
  return 'text-green-700';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EvidenceConflictViewer({ conflicts }: EvidenceConflictViewerProps) {
  return (
    <div className="border border-gray-200 bg-white">
      <div className="vcv-anchor-band">
        <span className="vcv-label">Evidence Conflicts</span>
      </div>

      {conflicts.length === 0 ? (
        <div className="px-4 py-3 text-xs text-gray-400 italic">
          No evidence conflicts detected.
        </div>
      ) : (
        <>
          {/* Column headers */}
          <div className="grid grid-cols-[120px_1fr_140px_80px] gap-3 px-4 py-1.5 bg-gray-50 border-b border-gray-100">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">Conflict ID</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">Lane</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">Resolution</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">Status</span>
          </div>

          {conflicts.map((conflict) => {
            const statusLabel = resolutionStatusLabel(conflict.resolution, conflict.resolvedAt);
            const cls = statusCls(conflict.resolution, conflict.resolvedAt);

            return (
              <div key={conflict.conflictId} className="border-b border-gray-100 last:border-b-0">
                {/* Summary row */}
                <div className="grid grid-cols-[120px_1fr_140px_80px] gap-3 px-4 min-h-[32px] items-center">
                  <span className="font-mono text-xs text-gray-900">{conflict.conflictId}</span>
                  <span className="font-mono text-xs text-gray-600">{conflict.laneId}</span>
                  <span className="font-mono text-xs text-gray-600">{resolutionLabel(conflict.resolution)}</span>
                  <span className={`font-mono text-xs font-semibold ${cls}`}>{statusLabel}</span>
                </div>

                {/* Detail block */}
                <div className="px-4 pb-2 space-y-1">
                  <div className="text-xs text-gray-600">
                    Description: {conflict.description}
                  </div>
                  {conflict.conflictingEvents.length > 0 && (
                    <div className="text-xs text-gray-500 flex flex-wrap gap-1">
                      <span>Conflicting events:</span>
                      {conflict.conflictingEvents.map((e) => (
                        <span
                          key={e.eventId}
                          className="font-mono text-[10px] border border-gray-200 px-1 text-gray-700"
                        >
                          {e.eventId}
                        </span>
                      ))}
                    </div>
                  )}
                  {conflict.resolvedAt && (
                    <div className="font-mono text-[10px] text-gray-400">
                      Resolved at: {conflict.resolvedAt}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
