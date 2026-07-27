import type { LaneSnapshot } from '@/components/proof/trust-types';
import type { PassportData } from '@/lib/trust/passport-contract';

/**
 * Map passport `sourceCoverage.checks` → `LaneSnapshot[]` for the verifier
 * components.
 *
 * Extracted from `app/verify/[npi]/page.tsx` so the mapping can be pinned by a
 * test that actually runs. It carries the honesty contract for /verify, and
 * the reason it needs one is concrete: the state-board lane used to arrive
 * here as `checked` with a `checkedAt` because a licence ROW existed, even
 * though no board is ever queried. This mapper then aged that timestamp
 * through a freshness window and the page rendered **Stale** — which tells a
 * reader the board was checked and merely went out of date. Never-checked and
 * checked-then-aged are different facts.
 *
 * The upstream fix is in `npiPassportContract.ts` (the lane now reports
 * `gated` with a null `checkedAt` unless a board is genuinely reachable).
 * This mapper's job is to carry that through without inventing freshness.
 */
export function checksToLaneSnapshots(
  checks: PassportData['sourceCoverage']['checks'],
): LaneSnapshot[] {
  return checks.map((c) => {
    const checkedAtMs = c.checkedAt ? new Date(c.checkedAt).getTime() : null;
    const receiptId = c.proof?.receiptIds?.[0] ?? null;

    // Map canonical state → SourceStatus (best-effort)
    const statusMap: Record<string, LaneSnapshot['status']> = {
      checked: 'verified',
      stale: 'stale',
      pending: 'in_progress',
      gated: 'access_required',
      unavailable: 'unavailable',
      accessRequired: 'access_required',
      reviewRequired: 'review_required',
      notDecisionGrade: 'not_checked',
      previewOnly: 'not_checked',
    };

    // The source's own refresh SLA (sourceCatalog.refreshSlaHours), carried on
    // the passport. Without it the strip can only show an absolute timestamp,
    // which reads as "just checked" for a periodic source — the over-claim the
    // freshness line repairs.
    const freshnessWindowMs =
      typeof c.freshnessWindowHours === 'number' && c.freshnessWindowHours > 0
        ? c.freshnessWindowHours * 60 * 60 * 1000
        : undefined;

    const status = statusMap[c.state] ?? 'not_checked';

    return {
      laneId: c.sourceId,
      status,
      checkedAt: isNaN(checkedAtMs as number) ? null : checkedAtMs,
      source: c.sourceUrl ?? undefined,
      receiptId,
      // A lane that was never checked carries no freshness. Handing a window
      // to an unchecked lane is what lets a downstream "age" calculation turn
      // an absence into a staleness claim.
      freshnessWindowMs: status === 'access_required' ? undefined : freshnessWindowMs,
    };
  });
}
