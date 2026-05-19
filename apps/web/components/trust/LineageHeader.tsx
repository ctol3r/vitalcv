/**
 * VitalCV · Trust Surfaces · LineageHeader v1
 *
 * Renders the six lineage cells in the binding canonical reading
 * order:
 *
 *   Object → Ownership → checked_at → Channel → Replay → run_id
 *
 * The renderer iterates `lineageCells()` from lib/trust/format so the
 * order is asserted by a single source of truth. Each rendered cell
 * carries `data-cell={id}` so trust-lineage-order.test.tsx can
 * inspect the DOM order directly.
 */

import * as React from 'react';

import type { Lineage } from '@/lib/trust/types';
import { lineageCells } from '@/lib/trust/format';
import { OwnershipBadge, Mono } from './primitives';

export interface LineageHeaderProps {
  lineage: Lineage;
  /** Optional verdict bar slot (rendered to the right). */
  verdict?: React.ReactNode;
}

export function LineageHeader({ lineage, verdict }: LineageHeaderProps) {
  const cells = lineageCells(lineage);
  return (
    <div
      className="t-lineage"
      data-testid="trust-lineage-header"
      data-state={lineage.state}
    >
      <div className="t-lineage-in">
        {cells.map((cell) => (
          <div
            key={cell.id}
            className="t-lineage-cell"
            data-cell={cell.id}
            data-testid={`trust-lineage-cell-${cell.id}`}
          >
            <div className="t-lineage-k mono">{cell.label}</div>
            <div className="t-lineage-v">
              {cell.id === 'ownership' ? (
                <OwnershipBadge state={lineage.ownership} />
              ) : (
                <Mono>{cell.value}</Mono>
              )}
              {cell.subValue && (
                <span className="t-lineage-sub mono">{cell.subValue}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {verdict && <div className="t-lineage-verdict">{verdict}</div>}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────
 * VerdictBar — short stripe to the right of the lineage cells.
 * Used by /verify and /receipt to surface the receipt status without
 * making any live verification claim.
 *
 * The brief replaces "Verifiable" with safer copy. This component
 * accepts a free-text status string so the caller can choose the
 * safe wording from:
 *   - "Replay-ready"
 *   - "Signed fixture"
 *   - "Source-backed preview"
 *   - "Receipt-shaped artifact"
 * No bare "Verified".
 * ─────────────────────────────────────────────────────────────────── */
export interface VerdictBarProps {
  status: string;
  /** Optional sub-line — short. */
  sub?: string;
  /** Tone signal: "ok" / "warn" / "critical" / "neutral". */
  tone?: 'ok' | 'warn' | 'critical' | 'neutral';
}

const FORBIDDEN_VERDICT = /^['"`]?Verified['"`]?$/;

export function VerdictBar({ status, sub, tone = 'neutral' }: VerdictBarProps) {
  if (FORBIDDEN_VERDICT.test(status.trim())) {
    // The CSS still renders, but we surface an obvious typo / contract
    // violation so a tester sees it immediately. Components must
    // pass one of the safe verdict strings instead.
    return (
      <span
        className="t-verdict"
        data-tone="critical"
        data-testid="trust-verdict-bar"
      >
        <span className="t-verdict-status">verdict missing</span>
        <span className="t-verdict-sub">
          replace bare &quot;Verified&quot; with a compound verdict
        </span>
      </span>
    );
  }
  return (
    <span
      className="t-verdict"
      data-tone={tone}
      data-testid="trust-verdict-bar"
    >
      <span className="t-verdict-status">{status}</span>
      {sub && <span className="t-verdict-sub">{sub}</span>}
    </span>
  );
}
