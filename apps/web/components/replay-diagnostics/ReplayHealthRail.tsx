'use client';

/**
 * ReplayHealthRail.tsx
 *
 * Compact status rail for embedding in sidebars or panel headers.
 * Shows replay health at a glance.
 *
 * Horizontal: [● CONFIRMED] [Score: 95] [Runs: 12] [Gaps: 0]
 * Vertical:
 *   ●
 *   CONFIRMED
 *   95/100
 *   12 runs
 *   0 gaps
 */

import { type ReplayIntegrityLevel, ReplayIntegrityBadge } from './ReplayIntegrityBadge';

export interface ReplayHealthRailProps {
  integrityLevel: ReplayIntegrityLevel;
  survivabilityScore: number;
  gapCount: number;
  runCount: number;
  orientation?: 'horizontal' | 'vertical';
}

interface RailItem {
  label: string;
  value: string;
}

export function ReplayHealthRail({
  integrityLevel,
  survivabilityScore,
  gapCount,
  runCount,
  orientation = 'horizontal',
}: ReplayHealthRailProps) {
  const items: RailItem[] = [
    { label: 'SCORE', value: `${survivabilityScore}/100` },
    { label: 'RUNS', value: `${runCount}` },
    { label: 'GAPS', value: `${gapCount}` },
  ];

  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col gap-1 items-start">
        {/* Integrity badge (compact dot only) */}
        <ReplayIntegrityBadge level={integrityLevel} compact />
        {/* Level label */}
        <span className="text-[9px] font-mono uppercase text-gray-400 leading-none">
          {integrityLevel.toUpperCase()}
        </span>
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-0">
            <span className="text-[9px] font-mono uppercase text-gray-400 leading-none">
              {item.label}
            </span>
            <span className="font-mono text-xs text-gray-900 leading-tight">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Horizontal
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <ReplayIntegrityBadge level={integrityLevel} />
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-1">
          {i > 0 && <span className="font-mono text-[10px] text-gray-300">·</span>}
          <span className="text-[9px] font-mono uppercase text-gray-400">{item.label}:</span>
          <span className="font-mono text-xs text-gray-900">{item.value}</span>
        </span>
      ))}
    </div>
  );
}
