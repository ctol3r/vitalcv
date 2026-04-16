'use client';

import { useEffect, useState } from 'react';

/**
 * DecisionLogSummary — minimal audit log surface.
 *
 * Single line. Count + most recent decision type. No heavy UI.
 * Fetches /api/decisions/:npi and shows "N decisions logged".
 */

interface CapsuleListResult {
  capsules?: Array<{ id: string; decisionType: string; decisionTimestamp: string }>;
}

interface EnvelopeResponse<T> {
  result: T | null;
  blockers: string[];
  explanation: string;
  timestamp: string;
}

export function DecisionLogSummary({ npi }: { npi: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!/^\d{10}$/.test(npi)) return;
    let cancelled = false;
    fetch(`/api/decisions/${npi}`, { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((envelope: EnvelopeResponse<CapsuleListResult> | null) => {
        if (cancelled) return;
        const capsules = envelope?.result?.capsules;
        setCount(Array.isArray(capsules) ? capsules.length : 0);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [npi]);

  if (count === null || count === 0) return null;

  return (
    <p className="text-[11px] text-[var(--vt-text-muted)] text-center tabular-nums">
      {count} decision{count === 1 ? '' : 's'} logged
    </p>
  );
}
