'use client';

import { Card } from '@/components/ui/card';
import { TrustStatusBadge, type TrustBadgeStatus } from '@/components/ui/trust-status-badge';
import type { IngestStreamState } from '@/hooks/useIngestStream';

/**
 * StartabilityCard — passport surface, flat + token-driven.
 *
 * Derives start-ready state from readiness + source signals.
 * Shows: status badge, blockers list, estimated days to start-ready.
 *
 * Display order on passport: Readiness → Acceptance → Startability.
 */

interface Startability {
  status: TrustBadgeStatus;
  label: 'Start-ready' | 'Needs work' | 'Blocked';
  blockers: string[];
  estimatedDays: number | null;
}

export function deriveBlockers(state: IngestStreamState): string[] {
  const blockers: string[] = [];
  if (state.sources.oig === 'error') blockers.push('Exclusion check failed');
  if (state.standing.exclusionClear === false) blockers.push('On OIG exclusion list');
  if (state.sources.pecos !== 'done') blockers.push('Medicare enrollment unresolved');
  if (state.standing.enrollmentStatus && state.standing.enrollmentStatus !== 'enrolled') {
    blockers.push('Not enrolled in Medicare');
  }
  if ((state.readiness.blockerCount ?? 0) > 0 && blockers.length === 0) {
    blockers.push(`${state.readiness.blockerCount} unresolved readiness items`);
  }
  return blockers;
}

/**
 * TODO: Business logic — estimate days from blockers to start-ready.
 *
 * Context: each blocker has a typical resolution window. State board access
 * typically takes 7–21 days, OIG disputes take 30+, PECOS re-enrollment ~14.
 * Multiple parallel blockers usually aggregate to the longest, not the sum.
 *
 * Constraints:
 *   - Return null if start-ready now (no blockers)
 *   - Return a single integer (days)
 *   - Keep it simple — no complex date math
 *
 * Suggested approach: map known blocker strings to day counts, return the max.
 */
function estimateDaysToStartReady(blockers: string[]): number | null {
  if (blockers.length === 0) return null;
  // TODO: implement blocker → days mapping
  return 14;
}

function deriveStartability(state: IngestStreamState, hideBlocker?: string | null): Startability {
  const allBlockers = deriveBlockers(state);
  const blockers = hideBlocker ? allBlockers.filter((b) => b !== hideBlocker) : allBlockers;
  const estimatedDays = estimateDaysToStartReady(blockers);

  if (blockers.length === 0 && state.readiness.status === 'READY') {
    return { status: 'verified', label: 'Start-ready', blockers, estimatedDays };
  }
  if (state.standing.exclusionClear === false) {
    return { status: 'blocked', label: 'Blocked', blockers, estimatedDays };
  }
  return { status: 'pending', label: 'Needs work', blockers, estimatedDays };
}

export function StartabilityCard({
  state,
  hideBlocker,
}: {
  state: IngestStreamState;
  /** Optimistically hide a blocker the user is currently resolving */
  hideBlocker?: string | null;
}) {
  const { status, label, blockers, estimatedDays } = deriveStartability(state, hideBlocker);

  return (
    <Card className="animate-trust-panel-enter gap-0 rounded-xl border border-[var(--vt-border)] px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground/60 text-xs uppercase tracking-widest">
          Startability
        </span>
        <TrustStatusBadge status={status} label={label} size="sm" />
      </div>

      {blockers.length > 0 && (
        <ul className="mt-2 space-y-1">
          {blockers.map((b) => (
            <li
              key={b}
              className="text-foreground/70 text-sm border-b border-[var(--vt-border)] py-1 last:border-0"
            >
              {b}
            </li>
          ))}
        </ul>
      )}

      {estimatedDays !== null && (
        <p className="text-muted-foreground/50 text-xs mt-2">
          Estimated {estimatedDays} day{estimatedDays === 1 ? '' : 's'} to start-ready
        </p>
      )}
    </Card>
  );
}
