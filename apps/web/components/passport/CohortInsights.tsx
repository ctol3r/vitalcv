'use client';

import { useEffect, useState } from 'react';

/**
 * CohortInsights — supportive historical context. Never authoritative.
 *
 * Rules:
 *   - Must always include "Based on N similar cases" (no overclaim)
 *   - Must NOT override the primary readiness / acceptance / startability state
 *   - Must feel supportive — muted colors, small type, plain language
 *
 * Hidden entirely if cohort size is too small to be meaningful.
 */

const MIN_COHORT_SIZE = 10;

interface CohortInsightsResult {
  cohortSize: number;
  acceptRate: number | null;
  avgStartDays: number | null;
}

interface EnvelopeResponse<T> {
  result: T | null;
  blockers: string[];
  explanation: string;
  timestamp: string;
}

export function CohortInsights() {
  const [data, setData] = useState<CohortInsightsResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/passport/cohort-insights', { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((envelope: EnvelopeResponse<CohortInsightsResult> | null) => {
        if (cancelled) return;
        setData(envelope?.result ?? null);
      })
      .catch(() => {
        // graceful: hide if fetch fails
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;
  if (data.cohortSize < MIN_COHORT_SIZE) return null;
  if (data.acceptRate === null && data.avgStartDays === null) return null;

  const acceptPct = data.acceptRate !== null ? Math.round(data.acceptRate * 100) : null;

  return (
    <div
      data-slot="cohort-insights"
      className="
        rounded-xl border border-[var(--vt-border)]
        bg-transparent
        px-4 py-3
      "
      aria-label="Historical context"
    >
      <p className="text-[11px] text-[var(--vt-text-muted)]">
        Based on {data.cohortSize.toLocaleString()} similar cases:
      </p>
      <ul className="mt-1 space-y-0.5">
        {acceptPct !== null && (
          <li className="text-sm text-[var(--vt-text-secondary)]">
            <span className="tabular-nums">{acceptPct}%</span> accepted
          </li>
        )}
        {data.avgStartDays !== null && (
          <li className="text-sm text-[var(--vt-text-secondary)]">
            Avg start: <span className="tabular-nums">{data.avgStartDays}</span> day
            {data.avgStartDays === 1 ? '' : 's'}
          </li>
        )}
      </ul>
      <p className="mt-1 text-[10px] text-[var(--vt-text-muted)]">
        Historical average. Your outcome may differ.
      </p>
    </div>
  );
}
