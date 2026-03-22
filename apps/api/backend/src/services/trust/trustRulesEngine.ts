/**
 * trustRulesEngine.ts — Canonical Trust Decision Engine
 *
 * Implements the six-class decision model mandated by the Shape-of-Truth
 * architecture:
 *
 *   TRUSTED_CURRENT          — all required claims present, fresh, no conflicts,
 *                               no negative signals
 *   TRUSTED_BUT_STALE_SOON   — currently valid but at least one claim expires
 *                               within the staleness-warning horizon
 *   STALE_REVERIFY_REQUIRED  — at least one required claim type is outside
 *                               its allowed freshness window
 *   CONFLICT_REQUIRES_REVIEW — two GOLD/SILVER sources disagree on the same
 *                               claim type and the conflict cannot be auto-resolved
 *   NEGATIVE_FINDING_BLOCK   — hard-stop signal: exclusion hit, suspended /
 *                               revoked license, or deactivated NPI
 *   INSUFFICIENT_EVIDENCE    — not enough GOLD-tier claims to reach a verdict
 *
 * Source trust hierarchy (per NCQA + spec):
 *   GOLD   — primary source or official system of record
 *   SILVER — NCQA-recognized source or contracted agent of primary source
 *   BRONZE — advisory / enrichment only — never sole basis for a decision
 *
 * Freshness windows are based on NCQA 2025 shortened verification timeframes.
 * All windows are configurable per workflow context (credentialing vs accreditation).
 *
 * Design constraints:
 *   - No ML overrides any compliance decision.
 *   - Every decision is fully explainable from stored evidence.
 *   - The engine is pure: (claims, options) → DecisionArtifact.
 *   - Persistence is handled by the caller (trustStateService).
 */

import { createHash } from 'node:crypto';
import type { ClaimType, EvidenceTier } from '../identity/sourceCatalog';
import type { NormalizedClaim, LicenseValue, ExclusionValue, NpiIdentityValue, BoardCertValue } from '../identity/evidenceModel';

// ── Decision classes ──────────────────────────────────────────────────────────

export type DecisionClass =
  | 'TRUSTED_CURRENT'
  | 'TRUSTED_BUT_STALE_SOON'
  | 'STALE_REVERIFY_REQUIRED'
  | 'CONFLICT_REQUIRES_REVIEW'
  | 'NEGATIVE_FINDING_BLOCK'
  | 'INSUFFICIENT_EVIDENCE';

/** Ordered by severity (lower index = more blocking). */
export const DECISION_PRECEDENCE: DecisionClass[] = [
  'NEGATIVE_FINDING_BLOCK',
  'CONFLICT_REQUIRES_REVIEW',
  'INSUFFICIENT_EVIDENCE',
  'STALE_REVERIFY_REQUIRED',
  'TRUSTED_BUT_STALE_SOON',
  'TRUSTED_CURRENT',
];

export function mostSevere(...classes: DecisionClass[]): DecisionClass {
  for (const c of DECISION_PRECEDENCE) {
    if (classes.includes(c)) return c;
  }
  return 'INSUFFICIENT_EVIDENCE';
}

// ── Freshness windows (NCQA 2025 shortened timeframes) ───────────────────────

export type WorkflowContext = 'credentialing' | 'accreditation';

/** Days. Source: NCQA 2025 credentialing element shortened timeframes. */
export const FRESHNESS_WINDOWS: Record<WorkflowContext, Partial<Record<ClaimType, number>>> = {
  credentialing: {
    LICENSE:              90,
    NURSING_LICENSE:      90,
    BOARD_CERTIFICATION:  90,
    BOARD_CERT_FLAG:      90,
    EXCLUSION_STATUS:     30,   // OIG refreshes monthly; check within 30 days
    FEDERAL_EXCLUSION:    30,
    ENROLLMENT_STATUS:    90,
    DEA_REGISTRATION:     90,
    SANCTION_RECORD:      90,
    INSTITUTION_AFFILIATION: 120,
    NPI_IDENTITY:         180,
    PERSONAL_IDENTITY:    180,
    SPECIALTY:            180,
  },
  accreditation: {
    LICENSE:              180,
    NURSING_LICENSE:      180,
    BOARD_CERTIFICATION:  120,
    BOARD_CERT_FLAG:      120,
    EXCLUSION_STATUS:     30,
    FEDERAL_EXCLUSION:    30,
    ENROLLMENT_STATUS:    120,
    DEA_REGISTRATION:     120,
    SANCTION_RECORD:      120,
    INSTITUTION_AFFILIATION: 180,
    NPI_IDENTITY:         365,
    PERSONAL_IDENTITY:    365,
    SPECIALTY:            365,
  },
};

/**
 * Required claim types for a decision to be "complete" evidence.
 * These are the minimum set to avoid INSUFFICIENT_EVIDENCE.
 * Specialties may require more (e.g., board cert for procedure-based work).
 */
export const REQUIRED_CLAIM_TYPES: ClaimType[] = [
  'NPI_IDENTITY',
  'EXCLUSION_STATUS',
];

export const STRONG_CLAIM_TYPES: ClaimType[] = [
  ...REQUIRED_CLAIM_TYPES,
  'LICENSE',
  'ENROLLMENT_STATUS',
];

/** Warn when a claim expires within this fraction of its window. */
const STALE_WARNING_FRACTION = 0.2; // warn when < 20% of window remains

// ── Negative signals ──────────────────────────────────────────────────────────

export interface NegativeFinding {
  claimType: ClaimType;
  claimId: string;
  reason: string;
  sourceId: string;
  tier: EvidenceTier;
  observedAt: string;
}

function detectNegativeSignals(claims: NormalizedClaim[]): NegativeFinding[] {
  const findings: NegativeFinding[] = [];

  for (const claim of claims) {
    // Skip bronze-tier negative signals — advisory only
    if (claim.tier === 'BRONZE') continue;
    // Skip superseded claims
    if (claim.status === 'SUPERSEDED') continue;

    const v = claim.value;

    // 1. OIG/Federal exclusion hit
    if (claim.claimType === 'EXCLUSION_STATUS' || claim.claimType === 'FEDERAL_EXCLUSION') {
      const excl = v as ExclusionValue;
      if (excl.excluded) {
        findings.push({
          claimType: claim.claimType,
          claimId: claim.claimId,
          reason: `Exclusion hit (${excl.exclusionType ?? 'type unknown'}) from ${claim.sourceId}. OIG: entities employing excluded individuals may face CMP liability.`,
          sourceId: claim.sourceId,
          tier: claim.tier,
          observedAt: claim.observedAt,
        });
      }
    }

    // 2. Suspended or revoked license from primary source
    if (claim.claimType === 'LICENSE' || claim.claimType === 'NURSING_LICENSE') {
      const lic = v as LicenseValue;
      if (lic.licenseStatus === 'SUSPENDED' || lic.licenseStatus === 'REVOKED') {
        findings.push({
          claimType: claim.claimType,
          claimId: claim.claimId,
          reason: `License ${lic.licenseStatus.toLowerCase()} in ${lic.state ?? 'unknown state'} per ${claim.sourceId}.`,
          sourceId: claim.sourceId,
          tier: claim.tier,
          observedAt: claim.observedAt,
        });
      }
    }

    // 3. Deactivated NPI
    if (claim.claimType === 'NPI_IDENTITY') {
      const npi = v as NpiIdentityValue;
      if (npi.status === 'D') {
        findings.push({
          claimType: claim.claimType,
          claimId: claim.claimId,
          reason: `NPI ${npi.npi} is deactivated in NPPES. No clinical activity allowed under a deactivated NPI.`,
          sourceId: claim.sourceId,
          tier: claim.tier,
          observedAt: claim.observedAt,
        });
      }
    }
  }

  return findings;
}

// ── Freshness evaluation ──────────────────────────────────────────────────────

export type FreshnessStatus =
  | 'CURRENT'
  | 'STALE_SOON'    // within staleness warning horizon
  | 'STALE'         // outside freshness window
  | 'NO_EXPIRY'     // no expiry — assume current (e.g. NPI identity)
  | 'NO_CLAIM';     // claim type not present

export interface ClaimFreshnessEval {
  claimType: ClaimType;
  claimId: string | null;
  sourceId: string | null;
  tier: EvidenceTier | null;
  observedAt: string | null;
  windowDays: number | null;
  ageAtDecisionDays: number | null;
  expiresAt: string | null;   // expiry of the CLAIM ITSELF (validUntil / expiresAt)
  status: FreshnessStatus;
  explanation: string;
}

function evaluateFreshness(
  claims: NormalizedClaim[],
  claimType: ClaimType,
  windowDays: number | null,
  decisionAt: Date,
): ClaimFreshnessEval {
  // Get the most recent active non-superseded claim of this type at GOLD/SILVER tier
  const eligible = claims
    .filter(c => c.claimType === claimType && c.status !== 'SUPERSEDED' && c.tier !== 'BRONZE')
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));

  if (eligible.length === 0) {
    return {
      claimType, claimId: null, sourceId: null, tier: null,
      observedAt: null, windowDays, ageAtDecisionDays: null, expiresAt: null,
      status: 'NO_CLAIM',
      explanation: `No GOLD/SILVER claim found for ${claimType}.`,
    };
  }

  const claim = eligible[0];
  const observedAt = new Date(claim.observedAt);
  const ageMs = decisionAt.getTime() - observedAt.getTime();
  const ageDays = Math.floor(ageMs / 86_400_000);

  // Check if the credential ITSELF has expired (validUntil / expiresAt on the value)
  let credentialExpiry: Date | null = null;
  const v = claim.value as Record<string, unknown>;
  const expiryField = v['expiryDate'] ?? v['expires_at'] ?? v['reinstatementDate'] ?? null;
  if (typeof expiryField === 'string' && expiryField) {
    const d = new Date(expiryField);
    if (!isNaN(d.getTime())) credentialExpiry = d;
  }
  if (!credentialExpiry && claim.validUntil) {
    credentialExpiry = new Date(claim.validUntil);
  }

  // 1. Credential currentness at decision time (NCQA: must be current at committee decision)
  if (credentialExpiry && credentialExpiry < decisionAt) {
    return {
      claimType, claimId: claim.claimId, sourceId: claim.sourceId, tier: claim.tier,
      observedAt: claim.observedAt, windowDays, ageAtDecisionDays: ageDays,
      expiresAt: credentialExpiry.toISOString(),
      status: 'STALE',
      explanation: `${claimType} credential expired ${credentialExpiry.toISOString().slice(0, 10)}. Not current at decision time.`,
    };
  }

  // 2. Source freshness window (was the VERIFICATION timely?)
  if (windowDays !== null) {
    if (ageDays > windowDays) {
      return {
        claimType, claimId: claim.claimId, sourceId: claim.sourceId, tier: claim.tier,
        observedAt: claim.observedAt, windowDays, ageAtDecisionDays: ageDays,
        expiresAt: credentialExpiry?.toISOString() ?? null,
        status: 'STALE',
        explanation: `${claimType} last verified ${ageDays}d ago; window is ${windowDays}d.`,
      };
    }
    const warnDays = Math.floor(windowDays * STALE_WARNING_FRACTION);
    if (ageDays > windowDays - warnDays) {
      return {
        claimType, claimId: claim.claimId, sourceId: claim.sourceId, tier: claim.tier,
        observedAt: claim.observedAt, windowDays, ageAtDecisionDays: ageDays,
        expiresAt: credentialExpiry?.toISOString() ?? null,
        status: 'STALE_SOON',
        explanation: `${claimType} verified ${ageDays}d ago; expires in ${windowDays - ageDays}d. Re-verify soon.`,
      };
    }
  }

  return {
    claimType, claimId: claim.claimId, sourceId: claim.sourceId, tier: claim.tier,
    observedAt: claim.observedAt, windowDays, ageAtDecisionDays: ageDays,
    expiresAt: credentialExpiry?.toISOString() ?? null,
    status: windowDays === null ? 'NO_EXPIRY' : 'CURRENT',
    explanation: `${claimType} verified ${ageDays}d ago${windowDays ? `; window ${windowDays}d` : ''}.`,
  };
}

// ── Conflict detection ────────────────────────────────────────────────────────

export interface ClaimConflict {
  claimType: ClaimType;
  sourceA: string;
  claimA: string;
  tierA: EvidenceTier;
  sourceB: string;
  claimB: string;
  tierB: EvidenceTier;
  reason: string;
}

function detectConflicts(claims: NormalizedClaim[]): ClaimConflict[] {
  const conflicts: ClaimConflict[] = [];
  const byType = new Map<ClaimType, NormalizedClaim[]>();

  for (const claim of claims) {
    if (claim.status === 'SUPERSEDED' || claim.tier === 'BRONZE') continue;
    const bucket = byType.get(claim.claimType) ?? [];
    bucket.push(claim);
    byType.set(claim.claimType, bucket);
  }

  for (const [claimType, bucket] of byType) {
    if (bucket.length < 2) continue;

    // Compare pairs — if values differ materially, it's a conflict
    for (let i = 0; i < bucket.length - 1; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i], b = bucket[j];
        if (isConflicting(claimType, a.value, b.value)) {
          conflicts.push({
            claimType,
            sourceA: a.sourceId, claimA: a.claimId, tierA: a.tier,
            sourceB: b.sourceId, claimB: b.claimId, tierB: b.tier,
            reason: `Sources ${a.sourceId} and ${b.sourceId} disagree on ${claimType}.`,
          });
        }
      }
    }
  }

  return conflicts;
}

/** Compare two claim values for material disagreement. */
function isConflicting(claimType: ClaimType, a: unknown, b: unknown): boolean {
  const av = a as Record<string, unknown>;
  const bv = b as Record<string, unknown>;

  switch (claimType) {
    case 'LICENSE':
    case 'NURSING_LICENSE':
      // Status disagreement is a hard conflict
      return av['licenseStatus'] !== bv['licenseStatus'];

    case 'EXCLUSION_STATUS':
    case 'FEDERAL_EXCLUSION':
      return av['excluded'] !== bv['excluded'];

    case 'NPI_IDENTITY':
      return av['status'] !== bv['status'];

    case 'ENROLLMENT_STATUS':
      return av['enrolled'] !== bv['enrolled'];

    case 'BOARD_CERTIFICATION':
    case 'BOARD_CERT_FLAG': {
      const aStatus = (av as unknown as BoardCertValue)['certificationStatus'];
      const bStatus = (bv as unknown as BoardCertValue)['certificationStatus'];
      return aStatus !== undefined && bStatus !== undefined && aStatus !== bStatus;
    }

    default:
      // For other types, don't flag conflicts by default
      return false;
  }
}

// ── Confidence scoring ────────────────────────────────────────────────────────

function computeAggregateConfidence(
  claims: NormalizedClaim[],
  freshnessEvals: ClaimFreshnessEval[],
): number {
  if (claims.length === 0) return 0;

  const activeClaims = claims.filter(c => c.status !== 'SUPERSEDED' && c.tier !== 'BRONZE');
  if (activeClaims.length === 0) return 0;

  // Base confidence from claim scores
  const avgClaimConf = activeClaims.reduce((s, c) => s + c.confidenceScore, 0) / activeClaims.length;

  // Freshness penalty
  const staleCount = freshnessEvals.filter(f => f.status === 'STALE').length;
  const stalePenalty = Math.min(0.4, staleCount * 0.15);

  // Gold tier bonus
  const goldCount = activeClaims.filter(c => c.tier === 'GOLD').length;
  const goldBonus = Math.min(0.1, goldCount * 0.02);

  return Math.max(0, Math.min(1, avgClaimConf - stalePenalty + goldBonus));
}

// ── DecisionArtifact ──────────────────────────────────────────────────────────

export interface DecisionArtifact {
  /** Deterministic ID — hash of npi + decisionClass + evaluatedAt */
  decisionId:          string;
  npi:                 string;
  decisionClass:       DecisionClass;
  aggregateConfidence: number;         // 0.0–1.0
  context:             WorkflowContext;
  methodologyVersion:  string;
  evaluatedAt:         string;         // ISO
  expiresAt:           string;         // ISO — when to re-evaluate

  // Evidence summary
  claimCount:          number;
  goldClaimCount:      number;
  silverClaimCount:    number;

  // Per-claim-type freshness
  freshnessEvals:      ClaimFreshnessEval[];

  // Negative signals (if any)
  negativeFindings:    NegativeFinding[];

  // Conflicts (if any)
  conflicts:           ClaimConflict[];

  // Human-readable explanation
  explanation:         string;

  // Claim IDs used in this decision
  claimIds:            string[];
}

// ── METHODOLOGY_VERSION ───────────────────────────────────────────────────────
// Bump this when trust rule logic changes — enables historical audit comparison

export const METHODOLOGY_VERSION = '2026.03.22-v1';

// ── Core: evaluate ────────────────────────────────────────────────────────────

export interface TrustEvaluationOptions {
  context?:      WorkflowContext;
  decisionAt?:   Date;
  claimTypes?:   ClaimType[];   // restrict evaluation to these types; defaults to all
}

/**
 * Evaluate a set of claims for a provider and emit a formal DecisionArtifact.
 *
 * This function is PURE — it does not read from or write to the database.
 * The caller (trustStateService) is responsible for persistence.
 *
 * Decision precedence:
 *   1. NEGATIVE_FINDING_BLOCK  — exclusion, suspended/revoked license, deactivated NPI
 *   2. CONFLICT_REQUIRES_REVIEW — two authoritative sources disagree
 *   3. INSUFFICIENT_EVIDENCE   — not enough GOLD-tier claims
 *   4. STALE_REVERIFY_REQUIRED — at least one required type is outside freshness window
 *   5. TRUSTED_BUT_STALE_SOON  — all current but at least one expires soon
 *   6. TRUSTED_CURRENT         — all checks pass
 */
export function evaluateTrust(
  npi: string,
  claims: NormalizedClaim[],
  opts: TrustEvaluationOptions = {},
): DecisionArtifact {
  const context: WorkflowContext = opts.context ?? 'credentialing';
  const decisionAt = opts.decisionAt ?? new Date();
  const windows = FRESHNESS_WINDOWS[context];

  // Which claim types to evaluate freshness for
  const evalTypes = opts.claimTypes ?? (Object.keys(windows) as ClaimType[]);

  // --- Step 1: Negative signals (hard-stop) --------------------------------
  const negativeFindings = detectNegativeSignals(claims);

  // --- Step 2: Conflicts ---------------------------------------------------
  const conflicts = detectConflicts(claims);

  // --- Step 3: Evidence completeness ---------------------------------------
  const activeTrustedClaims = claims.filter(c => c.status !== 'SUPERSEDED' && c.tier !== 'BRONZE');
  const goldClaims = activeTrustedClaims.filter(c => c.tier === 'GOLD');

  const hasRequiredClaims = REQUIRED_CLAIM_TYPES.every(rt =>
    activeTrustedClaims.some(c => c.claimType === rt),
  );

  // --- Step 4: Freshness per claim type ------------------------------------
  const freshnessEvals: ClaimFreshnessEval[] = evalTypes.map(claimType =>
    evaluateFreshness(claims, claimType, windows[claimType] ?? null, decisionAt),
  );

  // --- Step 5: Determine decision class ------------------------------------
  let decisionClass: DecisionClass;
  let explanation: string;

  if (negativeFindings.length > 0) {
    decisionClass = 'NEGATIVE_FINDING_BLOCK';
    explanation = `Hard-stop: ${negativeFindings.map(f => f.reason).join('; ')}`;
  } else if (conflicts.length > 0) {
    decisionClass = 'CONFLICT_REQUIRES_REVIEW';
    explanation = `Source conflict on: ${conflicts.map(c => c.claimType).join(', ')}. Manual review required.`;
  } else if (goldClaims.length === 0 || !hasRequiredClaims) {
    decisionClass = 'INSUFFICIENT_EVIDENCE';
    const missing = REQUIRED_CLAIM_TYPES.filter(rt => !activeTrustedClaims.some(c => c.claimType === rt));
    explanation = `Insufficient GOLD-tier evidence. Missing: ${missing.join(', ') || 'no GOLD claims present'}.`;
  } else {
    const staleEvals = freshnessEvals.filter(f => f.status === 'STALE');
    const staleSoonEvals = freshnessEvals.filter(f => f.status === 'STALE_SOON');

    if (staleEvals.length > 0) {
      decisionClass = 'STALE_REVERIFY_REQUIRED';
      explanation = `Re-verification required: ${staleEvals.map(f => f.explanation).join('; ')}`;
    } else if (staleSoonEvals.length > 0) {
      decisionClass = 'TRUSTED_BUT_STALE_SOON';
      explanation = `Currently valid but reverification approaching: ${staleSoonEvals.map(f => f.explanation).join('; ')}`;
    } else {
      decisionClass = 'TRUSTED_CURRENT';
      explanation = `All ${activeTrustedClaims.length} claims current, no negative signals, no conflicts.`;
    }
  }

  // --- Step 6: Confidence + expiry -----------------------------------------
  const aggregateConfidence = computeAggregateConfidence(claims, freshnessEvals);

  // Next evaluation = soonest expiring claim window, or default 24h
  const minWindowDays = evalTypes
    .map(t => windows[t] ?? null)
    .filter((d): d is number => d !== null)
    .reduce((min, d) => Math.min(min, d), Infinity);

  const expiryDays = Number.isFinite(minWindowDays) ? minWindowDays : 1;
  const expiresAt = new Date(decisionAt.getTime() + expiryDays * 86_400_000).toISOString();

  // --- Step 7: Build artifact ----------------------------------------------
  const decisionId = createHash('sha256')
    .update(`${npi}:${decisionClass}:${decisionAt.toISOString()}`)
    .digest('hex')
    .slice(0, 32);

  return {
    decisionId,
    npi,
    decisionClass,
    aggregateConfidence,
    context,
    methodologyVersion: METHODOLOGY_VERSION,
    evaluatedAt: decisionAt.toISOString(),
    expiresAt,
    claimCount: activeTrustedClaims.length,
    goldClaimCount: goldClaims.length,
    silverClaimCount: activeTrustedClaims.filter(c => c.tier === 'SILVER').length,
    freshnessEvals,
    negativeFindings,
    conflicts,
    explanation,
    claimIds: activeTrustedClaims.map(c => c.claimId),
  };
}
