'use client';

import { Card } from '@/components/ui/card';
import { TrustStatusBadge, type TrustBadgeStatus } from '@/components/ui/trust-status-badge';
import type { IngestStreamState } from '@/hooks/useIngestStream';
import {
  resolveBlockerOwnership,
  resolveStateBoardOwnership,
} from '@/lib/trust/action-owner';

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

const FALLBACK_SOURCES: IngestStreamState['sources'] = {
  nppes: 'pending',
  oig: 'pending',
  pecos: 'pending',
};

const FALLBACK_STANDING: IngestStreamState['standing'] = {
  exclusionChecked: false,
  enrollmentChecked: false,
};

export function deriveBlockers(state: IngestStreamState): string[] {
  const blockers: string[] = [];
  const sources = state?.sources ?? FALLBACK_SOURCES;
  const standing = state?.standing ?? FALLBACK_STANDING;
  const blockerCount = state?.readiness?.blockerCount ?? 0;

  if (sources.oig === 'error') blockers.push('Exclusion check failed');
  if (standing.exclusionClear === false) blockers.push('On OIG exclusion list');
  if (sources.pecos !== 'done') blockers.push('Medicare enrollment unresolved');
  if (standing.enrollmentStatus && standing.enrollmentStatus !== 'enrolled') {
    blockers.push('Not enrolled in Medicare');
  }
  if (blockerCount > 0 && blockers.length === 0) {
    blockers.push(`${blockerCount} unresolved readiness items`);
  }
  return blockers;
}

// Progress copy shown in the CTA during the authoritative re-check.
// The line must name the specific workflow the click kicked off so the
// user feels "I started something real" — not a generic "re-checking."
export function blockerToProgressLabel(blocker: string): string {
  switch (blocker) {
    case 'Medicare enrollment unresolved':
    case 'Not enrolled in Medicare':
      return 'Submitting PECOS enrollment…';
    case 'On OIG exclusion list':
    case 'Exclusion check failed':
      return 'Running OIG verification…';
    default:
      return 'Verification in progress…';
  }
}

// Completion copy for the transient "✔ done" banner. Consumed by the
// /passport completion banner. Blockers that are actually celebrated on
// completion have named workflows (PECOS enrollment / OIG check);
// other blockers fall back to a plain "<plain label> — complete" line.
// Reads through the ownership contract's plainLabel so the banner never
// drifts from the canonical blocker title.
export function blockerToCompletionLabel(blocker: string): string {
  switch (blocker) {
    case 'Medicare enrollment unresolved':
    case 'Not enrolled in Medicare':
      return 'PECOS enrollment complete';
    case 'On OIG exclusion list':
    case 'Exclusion check failed':
      return 'OIG check complete';
    default:
      return `${resolveBlockerOwnership(blocker).plainLabel} — complete`;
  }
}

// Typical resolution windows in days, mirroring autopilotEngine on the API.
// Kept in sync so client-side estimates match what Omega would return once
// the passport surface consumes generateAutopilot directly.
const BLOCKER_DAYS: Record<string, number> = {
  'On OIG exclusion list': 30,
  'Exclusion check failed': 3,
  'Medicare enrollment unresolved': 14,
  'Not enrolled in Medicare': 14,
};
const DEFAULT_BLOCKER_DAYS = 14;

export function deriveAutopilotDays(
  state: IngestStreamState,
  hideBlocker?: string | null,
): number | null {
  const all = deriveBlockers(state);
  const blockers = hideBlocker ? all.filter((b) => b !== hideBlocker) : all;
  if (blockers.length === 0) return 0;
  const windows = blockers.map((b) => BLOCKER_DAYS[b] ?? DEFAULT_BLOCKER_DAYS);
  return Math.max(...windows);
}

// Human-readable outcome label. Never a score — the user should read the
// line once and know where they stand. Thresholds are intentionally coarse
// so small state changes don't flicker the label between tiers.
export function deriveAutopilotOutcome(
  state: IngestStreamState,
  hideBlocker?: string | null,
): string {
  const all = deriveBlockers(state);
  const blockers = hideBlocker ? all.filter((b) => b !== hideBlocker) : all;
  const days = deriveAutopilotDays(state, hideBlocker);
  const readinessStatus = state?.readiness?.status ?? null;
  const exclusionClear = state?.standing?.exclusionClear;

  if (exclusionClear === false) return 'Likely rejected';
  if (blockers.length === 0 && readinessStatus === 'READY') return 'Likely accepted';
  if (days !== null && days <= 7 && blockers.length <= 1) return 'Likely accepted';
  if (days !== null && days <= 21) return 'Close to ready';
  if (blockers.length > 0) return 'Needs work';
  return 'Gathering signal';
}

// Autopilot steps read from the actor-ownership contract so each line
// names the owner, not a bare imperative. "Verify state board" is
// replaced by the institution-owned prefix ("Your employer or institution
// covers state-board verification for now") so the clinician does not
// read an INSTITUTION-owned lane as their own task.
export function deriveAutopilotSteps(
  state: IngestStreamState,
  hideBlocker?: string | null,
): string[] {
  const all = deriveBlockers(state);
  const visible = hideBlocker ? all.filter((b) => b !== hideBlocker) : all;

  const ownedSteps = visible.map((blocker) => resolveBlockerOwnership(blocker).ownerPrefix);

  // State board access is INSTITUTION-owned per the Source Coverage
  // Matrix. Once the run has completed, render the institution-owned
  // line so the clinician knows the lane is not on them.
  const licenseComplete = Boolean(state?.completedAt || state?.readyAt || state?.isUsable);
  if (licenseComplete) {
    ownedSteps.push(resolveStateBoardOwnership().ownerPrefix);
  }

  return Array.from(new Set(ownedSteps));
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
  const readinessStatus = state?.readiness?.status;
  const exclusionClear = state?.standing?.exclusionClear;

  if (blockers.length === 0 && readinessStatus === 'READY') {
    return { status: 'verified', label: 'Start-ready', blockers, estimatedDays };
  }
  if (exclusionClear === false) {
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
