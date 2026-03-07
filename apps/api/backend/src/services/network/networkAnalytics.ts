/**
 * networkAnalytics.ts — Wave 140: Network Telemetry Intelligence
 *
 * Focused network-layer analytics for the trust graph:
 *   - getVerificationRate()         — credential verification volume + success rate
 *   - getRevocationRate()           — revocation ratio with trend delta
 *   - getIssuerActivity()           — per-issuer verification/revocation breakdown
 *   - getDecisionCapsuleRate()      — decision capsule generation velocity
 *   - getNetworkTelemetrySummary()  — unified dashboard payload
 *
 * Returns time-bucketed arrays for sparkline chart rendering.
 * Uses the in-memory audit ledger, revocation registry, and credential wallet.
 */

import { log } from '../../obs/logger';
import { listAllCredentials } from '../credentials/credentialWallet';
import { listRevocations } from '../revocation/revocationRegistry';
import { listIssuers } from '../registry/trustRegistry';
import { exportSinceTime } from '../audit/auditLedger';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TimeBucket {
  /** YYYY-MM-DD date string */
  date: string;
  value: number;
}

export interface VerificationRateResult {
  totalVerifications: number;
  successfulVerifications: number;
  /** 0–100 */
  successRate: number;
  dailyBuckets: TimeBucket[];
  windowDays: number;
  computedAt: string;
}

export interface RevocationRateResult {
  totalCredentials: number;
  totalRevoked: number;
  /** 0.0–100.0 */
  revocationRate: number;
  dailyBuckets: TimeBucket[];
  /** +/- delta vs prior half-window */
  trendDelta: number;
  computedAt: string;
}

export interface IssuerActivityResult {
  issuerId: string;
  issuerName: string;
  credentialsIssued: number;
  activeCredentials: number;
  revokedCredentials: number;
  /** 0–100 activity health */
  activityScore: number;
}

export interface IssuerActivitySummary {
  issuers: IssuerActivityResult[];
  totalActive: number;
  topIssuerId: string | null;
  computedAt: string;
}

export interface DecisionCapsuleRateResult {
  totalCapsules: number;
  dailyBuckets: TimeBucket[];
  avgPerDay: number;
  computedAt: string;
}

export interface NetworkTelemetrySummary {
  verificationRate: VerificationRateResult;
  revocationRate: RevocationRateResult;
  issuerActivity: IssuerActivitySummary;
  decisionCapsuleRate: DecisionCapsuleRateResult;
  computedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fillBuckets(timestamps: string[], windowDays: number): TimeBucket[] {
  const cutoff = daysAgo(windowDays).getTime();
  const counts: Record<string, number> = {};

  for (const ts of timestamps) {
    if (new Date(ts).getTime() >= cutoff) {
      const key = ts.slice(0, 10);
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  const buckets: TimeBucket[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({ date: key, value: counts[key] ?? 0 });
  }
  return buckets;
}

// ── getVerificationRate ────────────────────────────────────────────────────────

export async function getVerificationRate(windowDays = 30): Promise<VerificationRateResult> {
  try {
    const since = daysAgo(windowDays).toISOString();
    const events = exportSinceTime(since, 5000);

    const verifyEvents = events.filter((e) =>
      e.category.includes('VERIFICATION') || e.category.includes('PRESENTATION'),
    );
    const successEvents = events.filter(
      (e) =>
        (e.category.includes('VERIFICATION') || e.category.includes('PRESENTATION')) &&
        e.severity === 'INFO',
    );

    const total = verifyEvents.length;
    const successful = successEvents.length;

    return {
      totalVerifications: total,
      successfulVerifications: successful,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      dailyBuckets: fillBuckets(verifyEvents.map((e) => e.time), windowDays),
      windowDays,
      computedAt: new Date().toISOString(),
    };
  } catch (err) {
    log('error', 'networkAnalytics.getVerificationRate', { error: String(err) });
    return {
      totalVerifications: 0,
      successfulVerifications: 0,
      successRate: 0,
      dailyBuckets: fillBuckets([], windowDays),
      windowDays,
      computedAt: new Date().toISOString(),
    };
  }
}

// ── getRevocationRate ──────────────────────────────────────────────────────────

export async function getRevocationRate(windowDays = 30): Promise<RevocationRateResult> {
  try {
    const allCredentials = listAllCredentials();
    const allRevocations = listRevocations();

    const total = allCredentials.length;
    const revoked = allRevocations.length;
    const rate = total > 0 ? Math.round((revoked / total) * 1000) / 10 : 0;

    const cutoff = daysAgo(windowDays).getTime();
    const halfCutoff = daysAgo(Math.floor(windowDays / 2)).getTime();

    const recentRevocations = allRevocations.filter(
      (r) => new Date(r.revokedAt).getTime() >= cutoff,
    );

    const recentHalf = recentRevocations.filter(
      (r) => new Date(r.revokedAt).getTime() >= halfCutoff,
    ).length;
    const priorHalf = recentRevocations.filter(
      (r) => new Date(r.revokedAt).getTime() < halfCutoff,
    ).length;

    return {
      totalCredentials: total,
      totalRevoked: revoked,
      revocationRate: rate,
      dailyBuckets: fillBuckets(recentRevocations.map((r) => r.revokedAt), windowDays),
      trendDelta: recentHalf - priorHalf,
      computedAt: new Date().toISOString(),
    };
  } catch (err) {
    log('error', 'networkAnalytics.getRevocationRate', { error: String(err) });
    return {
      totalCredentials: 0,
      totalRevoked: 0,
      revocationRate: 0,
      dailyBuckets: fillBuckets([], windowDays),
      trendDelta: 0,
      computedAt: new Date().toISOString(),
    };
  }
}

// ── getIssuerActivity ──────────────────────────────────────────────────────────

export async function getIssuerActivity(): Promise<IssuerActivitySummary> {
  try {
    const issuers = listIssuers();
    const allCredentials = listAllCredentials();

    const results: IssuerActivityResult[] = issuers.map((issuer) => {
      const issued = allCredentials.filter((c) => c.issuer === issuer.issuerId);
      const active = issued.filter((c) => c.status === 'ACTIVE').length;
      const revokedCount = issued.filter((c) => c.status === 'REVOKED').length;

      // Activity health: issuance volume + low revocation rate → higher score
      const activityScore =
        issued.length === 0
          ? 50
          : Math.min(
              100,
              Math.max(
                0,
                50 +
                  (active / Math.max(1, issued.length)) * 30 -
                  (revokedCount / Math.max(1, issued.length)) * 20 +
                  Math.min(20, issued.length / 5),
              ),
            );

      return {
        issuerId: issuer.issuerId,
        issuerName: issuer.issuerName,
        credentialsIssued: issued.length,
        activeCredentials: active,
        revokedCredentials: revokedCount,
        activityScore: Math.round(activityScore),
      };
    });

    results.sort((a, b) => b.credentialsIssued - a.credentialsIssued);

    return {
      issuers: results,
      totalActive: results.reduce((s, i) => s + i.activeCredentials, 0),
      topIssuerId: results[0]?.issuerId ?? null,
      computedAt: new Date().toISOString(),
    };
  } catch (err) {
    log('error', 'networkAnalytics.getIssuerActivity', { error: String(err) });
    return { issuers: [], totalActive: 0, topIssuerId: null, computedAt: new Date().toISOString() };
  }
}

// ── getDecisionCapsuleRate ─────────────────────────────────────────────────────

export async function getDecisionCapsuleRate(windowDays = 30): Promise<DecisionCapsuleRateResult> {
  try {
    const since = daysAgo(windowDays).toISOString();
    const events = exportSinceTime(since, 5000);
    const capsuleEvents = events.filter((e) => e.category.includes('DECISION'));

    const total = capsuleEvents.length;

    return {
      totalCapsules: total,
      dailyBuckets: fillBuckets(capsuleEvents.map((e) => e.time), windowDays),
      avgPerDay: total > 0 ? Math.round((total / windowDays) * 10) / 10 : 0,
      computedAt: new Date().toISOString(),
    };
  } catch (err) {
    log('error', 'networkAnalytics.getDecisionCapsuleRate', { error: String(err) });
    return {
      totalCapsules: 0,
      dailyBuckets: fillBuckets([], windowDays),
      avgPerDay: 0,
      computedAt: new Date().toISOString(),
    };
  }
}

// ── getNetworkTelemetrySummary ─────────────────────────────────────────────────

export async function getNetworkTelemetrySummary(
  windowDays = 30,
): Promise<NetworkTelemetrySummary> {
  const [verificationRate, revocationRate, issuerActivity, decisionCapsuleRate] =
    await Promise.all([
      getVerificationRate(windowDays),
      getRevocationRate(windowDays),
      getIssuerActivity(),
      getDecisionCapsuleRate(windowDays),
    ]);

  return {
    verificationRate,
    revocationRate,
    issuerActivity,
    decisionCapsuleRate,
    computedAt: new Date().toISOString(),
  };
}
