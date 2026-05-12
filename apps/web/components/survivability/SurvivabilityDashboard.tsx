'use client';

/**
 * SurvivabilityDashboard.tsx
 *
 * 5-column score grid: REPLAY · SIGNER · VERIFIER · RUNTIME · DEPLOYMENT · OVERALL
 * Bloomberg terminal energy. No decorative UI.
 */

export interface SurvivabilityDashboardProps {
  replayScore: number;       // 0-100
  signerScore: number;       // 0-100 (100 if key active, 0 if no key)
  verifierScore: number;     // 0-100 (100 if all endpoints operational)
  runtimeScore: number;      // 0-100 (doctrine convergence %)
  deploymentScore: number;   // 0-100 (convergence points % converged)
  overallScore: number;      // weighted average
}

function scoreColor(s: number): string {
  if (s >= 80) return 'text-green-600';
  if (s >= 60) return 'text-amber-500';
  return 'text-red-600';
}

function barColor(s: number): string {
  if (s >= 80) return 'bg-green-500';
  if (s >= 60) return 'bg-amber-400';
  return 'bg-red-500';
}

interface ScoreColProps {
  label: string;
  score: number;
  overall?: boolean;
}

function ScoreCol({ label, score, overall = false }: ScoreColProps) {
  const scoreCls = overall
    ? `font-mono text-base font-bold tabular-nums ${scoreColor(score)}`
    : `font-mono text-sm font-semibold tabular-nums ${scoreColor(score)}`;

  return (
    <div
      className={
        overall
          ? 'text-center border border-gray-200 bg-gray-50 px-2 py-3'
          : 'text-center px-2 py-3'
      }
    >
      {/* Column label */}
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-1">
        {label}
      </div>
      {/* Score */}
      <div className={scoreCls}>
        {score}<span className="text-gray-400 font-normal text-xs">/100</span>
      </div>
      {/* Inline bar */}
      <div className="mt-1.5 w-[60px] h-[3px] bg-gray-100 mx-auto overflow-hidden">
        <div
          className={`h-full ${barColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function SurvivabilityDashboard({
  replayScore,
  signerScore,
  verifierScore,
  runtimeScore,
  deploymentScore,
  overallScore,
}: SurvivabilityDashboardProps) {
  return (
    <div className="border border-gray-200 bg-white">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          Survivability Dashboard
        </span>
      </div>

      {/* Score grid */}
      <div className="grid grid-cols-6 divide-x divide-gray-100">
        <ScoreCol label="Replay"      score={replayScore} />
        <ScoreCol label="Signer"      score={signerScore} />
        <ScoreCol label="Verifier"    score={verifierScore} />
        <ScoreCol label="Runtime"     score={runtimeScore} />
        <ScoreCol label="Deployment"  score={deploymentScore} />
        <ScoreCol label="Overall"     score={overallScore} overall />
      </div>
    </div>
  );
}
