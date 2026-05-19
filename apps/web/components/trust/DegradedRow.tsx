/**
 * VitalCV · Trust Surfaces · DegradedRow v1
 *
 * Renders a non-decision-grade lane row. Doctrine:
 *
 *   - Dashed border, NEVER opacity-based disabled styling.
 *   - The row exposes data-degraded={reason} so tests can assert the
 *     dashed-not-opacity contract directly.
 *   - The hint is operator-action copy ("Refresh source probe …",
 *     "Route to operator review …"). Never blame the clinician.
 *   - Gated / accessRequired / unavailable lanes MUST NOT look
 *     positive — the CSS class is amber-warn for gated/accessRequired,
 *     amber-warn for stale/reviewRequired, critical for unavailable.
 */

import * as React from 'react';

import type { DegradedReason, DegradedRowEntry } from '@/lib/trust/types';

const REASON_LABEL: Record<DegradedReason, string> = {
  stale: 'STALE',
  access_required: 'ACCESS REQUIRED',
  review_required: 'REVIEW REQUIRED',
  unavailable: 'UNAVAILABLE',
  gated: 'GATED',
};

export interface DegradedRowProps {
  entry: DegradedRowEntry;
}

export function DegradedRow({ entry }: DegradedRowProps) {
  return (
    <li
      className="t-degraded-row"
      data-testid="trust-degraded-row"
      data-degraded={entry.reason}
      // Defensive: any inline opacity here would violate the canon.
      // Browsers ignore explicit opacity:1 styling — but writing it
      // out makes the intent unmistakable.
      style={{ opacity: 1 }}
    >
      <div className="t-degraded-l">
        <span
          className="t-degraded-badge mono"
          data-tone={entry.reason === 'unavailable' ? 'critical' : 'warn'}
        >
          {REASON_LABEL[entry.reason]}
        </span>
        <span className="t-degraded-lane">{entry.laneLabel}</span>
      </div>
      <p className="t-degraded-hint">→ {entry.hint}</p>
    </li>
  );
}
