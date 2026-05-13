'use client';

import type React from 'react';

/**
 * ReplaySurvivabilityPanel.tsx
 *
 * Focused panel: invariants that make replay survive restarts.
 * Score bar. Evidence count. Bloomberg density.
 */

export interface ReplaySurvivabilityPanelProps {
  dedupeKeyActive: boolean;
  actorAttributionActive: boolean;
  postgresConnected: boolean;
  lastRestartSafe: boolean;
  survivabilityScore: number;
  evidenceCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusDot(active: boolean): React.ReactNode {
  return (
    <span className={`text-[10px] font-mono ${active ? 'text-green-600' : 'text-red-600'}`}>
      ● {active ? 'ACTIVE' : 'INACTIVE'}
    </span>
  );
}

function confirmedDot(confirmed: boolean): React.ReactNode {
  return (
    <span className={`text-[10px] font-mono ${confirmed ? 'text-green-600' : 'text-amber-500'}`}>
      ● {confirmed ? 'CONFIRMED' : 'UNCONFIRMED'}
    </span>
  );
}

function scoreColor(s: number): string {
  if (s >= 80) return 'bg-green-500';
  if (s >= 60) return 'bg-amber-400';
  return 'bg-red-500';
}

function scoreTextColor(s: number): string {
  if (s >= 80) return 'text-green-600';
  if (s >= 60) return 'text-amber-500';
  return 'text-red-600';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReplaySurvivabilityPanel({
  dedupeKeyActive,
  actorAttributionActive,
  postgresConnected,
  lastRestartSafe,
  survivabilityScore,
  evidenceCount,
}: ReplaySurvivabilityPanelProps) {
  const barWidth = Math.max(0, Math.min(100, survivabilityScore));

  const rows: Array<{
    invariant: string;
    mechanism: string;
    status: React.ReactNode;
  }> = [
    {
      invariant: 'First write wins',
      mechanism: 'Prisma upsert dedupe',
      status: statusDot(dedupeKeyActive),
    },
    {
      invariant: 'actor_id persists',
      mechanism: 'metadata.actor_id',
      status: statusDot(actorAttributionActive),
    },
    {
      invariant: 'Postgres connected',
      mechanism: 'DATABASE_URL set',
      status: statusDot(postgresConnected),
    },
    {
      invariant: 'Restart safe',
      mechanism: 'dedupeKey enforced',
      status: confirmedDot(lastRestartSafe),
    },
  ];

  return (
    <div className="font-sans">
      {/* Header */}
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-2">
        Replay Survivability
      </div>

      <div className="border border-gray-200">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_160px_120px] border-b border-gray-200 bg-gray-50">
          <div className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-400">
            Invariant
          </div>
          <div className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-400 border-l border-gray-100">
            Mechanism
          </div>
          <div className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-400 border-l border-gray-100">
            Status
          </div>
        </div>

        {/* Rows */}
        {rows.map((row, i) => (
          <div
            key={i}
            className={`grid grid-cols-[1fr_160px_120px] min-h-[32px] items-center ${
              i < rows.length - 1 ? 'border-b border-gray-100' : ''
            }`}
          >
            <div className="px-2 py-1.5 text-xs text-gray-700">{row.invariant}</div>
            <div className="px-2 py-1.5 text-xs text-gray-500 border-l border-gray-100 font-mono">
              {row.mechanism}
            </div>
            <div className="px-2 py-1.5 border-l border-gray-100">{row.status}</div>
          </div>
        ))}

        {/* Score section */}
        <div className="border-t border-gray-200 px-2 py-2 space-y-1.5">
          {/* Score row */}
          <div className="flex flex-row items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 w-[160px] shrink-0">
              Survivability Score
            </span>
            <span className={`font-mono text-xs font-bold ${scoreTextColor(survivabilityScore)}`}>
              {survivabilityScore} / 100
            </span>
            {/* 100px bar */}
            <div className="w-[100px] h-2 bg-gray-100 border border-gray-200 shrink-0">
              <div
                className={`h-full ${scoreColor(survivabilityScore)}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>

          {/* Evidence count */}
          <div className="flex flex-row items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 w-[160px] shrink-0">
              Evidence Count
            </span>
            <span className="font-mono text-xs text-gray-900">
              {evidenceCount.toLocaleString()} attributed writes
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
