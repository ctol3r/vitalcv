/**
 * medicarePostureNormalizer.ts — Medicare Participation Posture
 *
 * Normalizes three CMS sources into a single Medicare participation posture:
 *   1. PECOS Public Provider Enrollment   → base enrollment state
 *   2. CMS Opt-Out Affidavits             → affirmative opt-out signal
 *   3. CMS Order and Referring            → eligible-to-order/refer flag
 *
 * The normalized posture is used by readiness and employer packet surfaces.
 * Raw per-source claims are preserved; this is a view/interpretation layer only.
 *
 * Conflict resolution:
 *   PECOS enrolled + Opt-Out present   → conflict → review_required (do not auto-resolve)
 *   PECOS not_found + Order/Referring  → suspicious (enrolled in O&R but not in PECOS?) → review_required
 *   PECOS enrolled + no Order/Referring → enrolled but eligibility unknown → stale or partial
 *   Opt-out only (no PECOS)            → opted_out, confident
 *   No sources checked                 → unknown
 */

import type { EnrollmentValue, NormalizedClaim } from './evidenceModel';

// ── Types ─────────────────────────────────────────────────────────────────────

export const MEDICARE_POSTURE_STATUSES = [
  /** PECOS enrollment confirmed, no opt-out, eligible to order/refer. */
  'enrolled_and_eligible',
  /** PECOS enrollment confirmed, no opt-out, but order/refer not checked or not found. */
  'enrolled_eligibility_unknown',
  /** Provider affirmatively opted out of Medicare (CMS Opt-Out Affidavits). */
  'opted_out',
  /** Not found in PECOS, not opted out, not in Order/Referring. */
  'not_found',
  /** Sources conflict — human review required. */
  'conflict_review_required',
  /** Data is present but stale (past freshness window). */
  'stale',
  /** No Medicare sources have been checked yet. */
  'unknown',
] as const;

export type MedicarePostureStatus = (typeof MEDICARE_POSTURE_STATUSES)[number];

export interface MedicarePosture {
  /** Normalized participation status for display and readiness gates. */
  status: MedicarePostureStatus;
  /** Whether this posture is decision-grade (all contributing sources are current and non-stale). */
  decisionGrade: boolean;
  /** Whether human review is required before using this posture in a decision. */
  reviewRequired: boolean;
  /**
   * Whether the clinician is eligible to order and refer Medicare services.
   * null = not checked or not determinable from available sources.
   */
  eligibleToOrderRefer: boolean | null;
  /** Whether the clinician has affirmatively opted out of Medicare. */
  optedOut: boolean;
  /** Sources that contributed to this posture, with their freshness state. */
  sources: MedicarePostureSource[];
  /** Human-readable label for employer-facing packet/review surfaces. */
  label: string;
  /** Explanation for the posture — useful for review UI and audit trail. */
  explanation: string;
  /** ISO 8601 timestamp of the most recent source check. */
  mostRecentCheckAt: string | null;
}

export interface MedicarePostureSource {
  sourceId: 'PECOS_PUBLIC' | 'CMS_OPT_OUT' | 'CMS_ORDER_REFERRING';
  claimState: EnrollmentValue['claimState'] | 'NOT_CHECKED';
  observedAt: string | null;
  dataVersion: string | null;
  stale: boolean;
}

// ── Freshness helpers ─────────────────────────────────────────────────────────

/** PECOS quarterly = 90 days; Opt-Out and Order/Referring monthly = 31 days. */
const FRESHNESS_WINDOWS: Record<string, number> = {
  PECOS_PUBLIC: 90 * 24,          // 2160 hours
  CMS_OPT_OUT: 31 * 24,           // 744 hours
  CMS_ORDER_REFERRING: 31 * 24,   // 744 hours
};

function isStale(observedAt: string | null | undefined, sourceId: string): boolean {
  if (!observedAt) return true;
  const windowHours = FRESHNESS_WINDOWS[sourceId] ?? 720;
  const ageMs = Date.now() - Date.parse(observedAt);
  return ageMs > windowHours * 3600 * 1000;
}

// ── Extraction helpers ────────────────────────────────────────────────────────

function extractEnrollmentClaim(
  claims: NormalizedClaim[],
  sourceId: 'PECOS_PUBLIC' | 'CMS_OPT_OUT' | 'CMS_ORDER_REFERRING',
): { value: EnrollmentValue; observedAt: string | null } | null {
  const matching = claims
    .filter(c =>
      c.claimType === 'ENROLLMENT_STATUS'
      && c.sourceId === sourceId
      && c.status !== 'SUPERSEDED'
    )
    .sort((a, b) => {
      // Most recently observed first
      const aTs = a.observedAt ? Date.parse(a.observedAt) : 0;
      const bTs = b.observedAt ? Date.parse(b.observedAt) : 0;
      return bTs - aTs;
    });

  if (matching.length === 0) return null;
  const claim = matching[0];
  return {
    value: claim.value as EnrollmentValue,
    observedAt: claim.observedAt,
  };
}

function extractOrderReferClaim(
  claims: NormalizedClaim[],
): { eligible: boolean; observedAt: string | null } | null {
  // ORDER_REFERRAL claims from CMS_ORDER_REFERRING or PECOS_PUBLIC
  const matching = claims.filter(
    c => c.claimType === 'ORDER_REFERRAL' && c.status !== 'SUPERSEDED',
  ).sort((a, b) => {
    const aTs = a.observedAt ? Date.parse(a.observedAt) : 0;
    const bTs = b.observedAt ? Date.parse(b.observedAt) : 0;
    return bTs - aTs;
  });

  if (matching.length === 0) {
    // Fall back to PECOS enrollment claim's eligibleToOrderRefer field
    const pecos = claims.find(
      c => c.claimType === 'ENROLLMENT_STATUS' && c.sourceId === 'PECOS_PUBLIC',
    );
    if (pecos) {
      const val = pecos.value as EnrollmentValue;
      if (val.eligibleToOrderRefer !== null && val.eligibleToOrderRefer !== undefined) {
        return { eligible: val.eligibleToOrderRefer, observedAt: pecos.observedAt };
      }
    }
    return null;
  }

  // ORDER_REFERRAL claim: value is EnrollmentValue or a generic boolean wrapper
  const claim = matching[0];
  const val = claim.value as EnrollmentValue;
  const eligible = val.eligibleToOrderRefer ?? null;
  if (eligible === null) return null;
  return { eligible, observedAt: claim.observedAt };
}

// ── Label helpers ─────────────────────────────────────────────────────────────

function statusLabel(status: MedicarePostureStatus): string {
  switch (status) {
    case 'enrolled_and_eligible':
      return 'Enrolled in Medicare — eligible to order and refer';
    case 'enrolled_eligibility_unknown':
      return 'Enrolled in Medicare — order/refer eligibility not confirmed';
    case 'opted_out':
      return 'Opted out of Medicare — cannot bill Medicare for covered services';
    case 'not_found':
      return 'Not found in Medicare enrollment records';
    case 'conflict_review_required':
      return 'Medicare participation status — conflicting signals, review required';
    case 'stale':
      return 'Medicare enrollment data is stale — re-check required';
    case 'unknown':
      return 'Medicare enrollment not yet checked';
  }
}

// ── Main normalizer ───────────────────────────────────────────────────────────

/**
 * Normalize all Medicare-related claims into a single participation posture.
 *
 * @param claims  All NormalizedClaims for this clinician (any type — this
 *                function filters internally).
 * @param nowIso  Current time for freshness evaluation (default: now).
 */
export function normalizeMedicarePosture(
  claims: NormalizedClaim[],
  nowIso: string = new Date().toISOString(),
): MedicarePosture {
  const pecos = extractEnrollmentClaim(claims, 'PECOS_PUBLIC');
  const optOut = extractEnrollmentClaim(claims, 'CMS_OPT_OUT');
  const orderRef = extractOrderReferClaim(claims);

  const pecosStale = isStale(pecos?.observedAt, 'PECOS_PUBLIC');
  const optOutStale = optOut ? isStale(optOut.observedAt, 'CMS_OPT_OUT') : false;

  const pecosState = pecos?.value.claimState ?? 'UNCHECKED';
  const optedOut =
    optOut !== null
    && optOut.value.claimState === 'OPTED_OUT'
    && !optOutStale;

  const sources: MedicarePostureSource[] = [];

  if (pecos) {
    sources.push({
      sourceId: 'PECOS_PUBLIC',
      claimState: pecosState,
      observedAt: pecos.observedAt ?? null,
      dataVersion: pecos.value.dataVersion ?? null,
      stale: pecosStale,
    });
  }
  if (optOut) {
    sources.push({
      sourceId: 'CMS_OPT_OUT',
      claimState: optOut.value.claimState,
      observedAt: optOut.observedAt ?? null,
      dataVersion: optOut.value.dataVersion ?? null,
      stale: optOutStale,
    });
  }

  const mostRecentCheckAt = sources
    .map(s => s.observedAt)
    .filter((t): t is string => t !== null)
    .sort()
    .reverse()[0] ?? null;

  // ── Conflict detection ─────────────────────────────────────────────────────

  // PECOS enrolled + Opt-Out present = contradiction
  if (pecosState === 'ENROLLED' && optedOut) {
    return {
      status: 'conflict_review_required',
      decisionGrade: false,
      reviewRequired: true,
      eligibleToOrderRefer: null,
      optedOut: true,
      sources,
      label: statusLabel('conflict_review_required'),
      explanation:
        'PECOS shows Medicare enrollment AND CMS Opt-Out Affidavits show an active opt-out. '
        + 'These signals contradict each other. Human review is required before making '
        + 'any Medicare participation decision.',
      mostRecentCheckAt,
    };
  }

  // Opt-Out explicitly present → opted_out (no PECOS needed to confirm)
  if (optedOut) {
    return {
      status: 'opted_out',
      decisionGrade: !optOutStale,
      reviewRequired: false,
      eligibleToOrderRefer: false,
      optedOut: true,
      sources,
      label: statusLabel('opted_out'),
      explanation:
        'Provider is on the CMS Opt-Out Affidavits list. '
        + 'They have voluntarily opted out of Medicare participation and cannot bill '
        + 'Medicare for covered services during the opt-out period.',
      mostRecentCheckAt,
    };
  }

  // PECOS enrolled
  if (pecosState === 'ENROLLED' && !pecosStale) {
    const eligible = orderRef?.eligible ?? null;
    const status: MedicarePostureStatus =
      eligible === true ? 'enrolled_and_eligible' : 'enrolled_eligibility_unknown';

    return {
      status,
      decisionGrade: true,
      reviewRequired: false,
      eligibleToOrderRefer: eligible,
      optedOut: false,
      sources,
      label: statusLabel(status),
      explanation:
        status === 'enrolled_and_eligible'
          ? 'PECOS enrollment confirmed and eligible to order/refer Medicare services.'
          : 'PECOS enrollment confirmed. Order/refer eligibility was not independently checked via CMS Order and Referring file.',
      mostRecentCheckAt,
    };
  }

  // PECOS enrolled but stale
  if (pecosState === 'ENROLLED' && pecosStale) {
    return {
      status: 'stale',
      decisionGrade: false,
      reviewRequired: true,
      eligibleToOrderRefer: orderRef?.eligible ?? null,
      optedOut: false,
      sources,
      label: statusLabel('stale'),
      explanation:
        'PECOS enrollment was previously confirmed but the data is outside the quarterly freshness window. '
        + 'A fresh PECOS pull is required before making readiness decisions.',
      mostRecentCheckAt,
    };
  }

  // PECOS explicitly not found
  if (pecosState === 'NOT_FOUND') {
    // If Order/Referring shows eligible despite PECOS not_found → suspicious
    if (orderRef?.eligible === true) {
      return {
        status: 'conflict_review_required',
        decisionGrade: false,
        reviewRequired: true,
        eligibleToOrderRefer: null,
        optedOut: false,
        sources,
        label: statusLabel('conflict_review_required'),
        explanation:
          'CMS Order and Referring shows eligible-to-order/refer but PECOS shows no enrollment record. '
          + 'This contradiction may indicate a data lag or source sync issue. Human review required.',
        mostRecentCheckAt,
      };
    }

    return {
      status: 'not_found',
      decisionGrade: true,
      reviewRequired: false,
      eligibleToOrderRefer: false,
      optedOut: false,
      sources,
      label: statusLabel('not_found'),
      explanation:
        'Provider was not found in the CMS PECOS quarterly enrollment file. '
        + 'This does not necessarily mean they are ineligible — it may reflect a data lag, '
        + 'pending application, or non-Medicare specialty. '
        + 'Typical PECOS enrollment takes 45–60 days after application submission.',
      mostRecentCheckAt,
    };
  }

  // No PECOS data at all
  return {
    status: 'unknown',
    decisionGrade: false,
    reviewRequired: false,
    eligibleToOrderRefer: null,
    optedOut: false,
    sources,
    label: statusLabel('unknown'),
    explanation:
      'Medicare enrollment has not yet been checked for this provider. '
      + 'Run PECOS_PUBLIC ingestion to populate enrollment state.',
    mostRecentCheckAt,
  };
}
