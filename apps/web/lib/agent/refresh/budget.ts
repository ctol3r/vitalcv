/**
 * A2.4 — per-source budget for scheduled refreshes.
 *
 * `SOURCE_REGISTRY` carries no rate-limit field at all (only `cadence` and
 * `freshnessTtl`), so the budget cannot come from there. Rather than add a
 * fourth limiter, this wraps the one the codebase already has:
 * `ConnectorQuotaManager` — a per-connector token budget with a rolling
 * window, `blockedUntil` honouring of `Retry-After`, and near-limit
 * reporting.
 *
 * ## Reservation, not consumption
 *
 * A2.4 is still shadow: nothing calls a source. So this module RESERVES
 * budget against a manager instance owned by the planner and reports what a
 * live tick would have spent. The reservation is real — it is the same
 * accounting a live tick would do — but the money is play money until A2.5
 * wires execution, at which point the same call sites consume the shared
 * manager instead.
 *
 * When the budget is exhausted the planner **defers**. It does not queue: a
 * queue that grows faster than the window drains is how a polite scheduler
 * turns into a thundering herd the moment the window resets.
 */
import {
  ConnectorQuotaManager,
  type ConnectorQuotaSnapshot,
} from '../../../../../core/connectors/quotaManager';

/**
 * Deliberately below the connector default of 60/60s. A scheduled sweep is
 * background work competing with clinician-initiated reads for the same
 * upstream quota, and background work should lose that competition.
 */
export const SCHEDULED_REFRESH_POLICY = { limit: 20, windowMs: 60_000, alertThreshold: 0.2 };

export type BudgetDecision =
  | { allowed: true; snapshot: ConnectorQuotaSnapshot }
  | { allowed: false; reason: 'budget_exhausted' | 'rate_limited'; retryAfterMs: number | null };

export interface RefreshBudget {
  /** Try to reserve one unit against a source. Never throws. */
  reserve(sourceId: string, at: string): BudgetDecision;
  /** What each source has spent this window, for the tick's report. */
  spend(): Record<string, { used: number; remaining: number; nearLimit: boolean }>;
}

export function createRefreshBudget(policy = SCHEDULED_REFRESH_POLICY): RefreshBudget {
  const manager = new ConnectorQuotaManager();
  const touched = new Set<string>();

  return {
    reserve(sourceId, at) {
      touched.add(sourceId);
      try {
        const snapshot = manager.consume({
          connector: `agent_refresh:${sourceId}`,
          cost: 1,
          policy,
          recordedAt: at,
        });
        return { allowed: true, snapshot };
      } catch (error) {
        // The manager throws ConnectorQuotaExceededError both when OUR window
        // is spent and when the SOURCE told us to back off, and it populates
        // retryAfterMs either way — so that field cannot tell them apart.
        // `rateLimitHits` can: only recordRateLimit/recordHeaders increment
        // it, and those only fire on an upstream Retry-After. The difference
        // matters to an operator: one means we are being polite, the other
        // means the source is pushing back.
        const detail = error as {
          retryAfterMs?: number | null;
          snapshot?: ConnectorQuotaSnapshot;
        };
        const rateLimited = (detail.snapshot?.rateLimitHits ?? 0) > 0;
        return {
          allowed: false,
          reason: rateLimited ? 'rate_limited' : 'budget_exhausted',
          retryAfterMs: detail.retryAfterMs ?? null,
        };
      }
    },

    spend() {
      const out: Record<string, { used: number; remaining: number; nearLimit: boolean }> = {};
      for (const sourceId of [...touched].sort()) {
        try {
          const snapshot = manager.getSnapshot(`agent_refresh:${sourceId}`);
          out[sourceId] = {
            used: snapshot.used,
            remaining: snapshot.remaining,
            nearLimit: snapshot.nearLimit,
          };
        } catch {
          // A source we cannot report on is omitted rather than reported as
          // zero — an absent number is honest, a zero is a claim.
        }
      }
      return out;
    },
  };
}
