// ── VitalCV Claim Engine ──────────────────────────────────────────
// Converts normalized source data into atomic, auditable claims.
// Every SourceCheckResult MUST produce deterministic claims.
// Claims are ATOMIC — no derived aggregation inside a claim.

import type { SourceCheckResult, MatchConfidence } from './types';
import { AuditEventType, createAuditEvent } from './audit-events';

// ── Claim Model ──────────────────────────────────────────────────

export type ClaimType =
  | 'identity.name'
  | 'identity.npi_status'
  | 'identity.entity_type'
  | 'identity.taxonomy'
  | 'identity.address'
  | 'identity.phone'
  | 'identity.enumeration_date'
  | 'oig.exclusion'
  | 'oig.match_confidence'
  | 'pecos.ordering_referring'
  | 'pecos.enrollment'
  | 'licensure.status'
  | 'licensure.discipline';

export interface Claim {
  /** UUID v4 */
  claimId: string;
  /** Canonical claim type */
  claimType: ClaimType;
  /** Atomic value — never derived, always from source */
  value: string | number | boolean | null;
  /** Source adapter that produced this claim */
  source: string;
  /** When the source authority last updated this data */
  observedAt: string | null;
  /** Confidence in the source-to-subject match */
  confidence: MatchConfidence;
  /** How the match was performed */
  matchBasis: string;
  /** Limitations attached to this claim */
  limitations: ClaimLimitation[];
  /** The original SourceCheckResult this claim came from */
  sourceCheckId: string;
}

export interface ClaimLimitation {
  code: string;
  description: string;
  adverse: boolean;
}

// ── Claim Batch ──────────────────────────────────────────────────

export interface ClaimBatch {
  /** The NPI all claims in this batch relate to */
  subjectNpi: string;
  /** When the batch was generated */
  generatedAt: string;
  /** All claims from this check cycle */
  claims: Claim[];
  /** All limitations across all claims */
  limitations: ClaimLimitation[];
  /** Whether any claim has an adverse limitation */
  hasAdverse: boolean;
  /** Audit event for the claim generation */
  auditEvent: ReturnType<typeof createAuditEvent>;
}

// ── Claim Extraction Rules ────────────────────────────────────────
// Each adapter type defines its own claim extraction logic.
// Claims are extracted from SourceCheckResult.claims array.

interface ClaimExtractionRule {
  sourceId: string;
  claimType: ClaimType;
  claimKey: string;
  adverseOnMissing?: boolean;
}

const CLAIM_EXTRACTION_RULES: ClaimExtractionRule[] = [
  // NPPES identity claims
  { sourceId: 'NPPES', claimType: 'identity.name', claimKey: 'credentialed_name' },
  { sourceId: 'NPPES', claimType: 'identity.npi_status', claimKey: 'active_status', adverseOnMissing: false },
  { sourceId: 'NPPES', claimType: 'identity.entity_type', claimKey: 'entity_type' },
  { sourceId: 'NPPES', claimType: 'identity.taxonomy', claimKey: 'taxonomy' },
  { sourceId: 'NPPES', claimType: 'identity.address', claimKey: 'address' },
  { sourceId: 'NPPES', claimType: 'identity.phone', claimKey: 'identifiers' },
  { sourceId: 'NPPES', claimType: 'identity.enumeration_date', claimKey: 'enumeration_date' },

  // OIG exclusion claims
  { sourceId: 'OIG_LEIE', claimType: 'oig.exclusion', claimKey: 'has_active_exclusion', adverseOnMissing: false },
  { sourceId: 'OIG_LEIE', claimType: 'oig.match_confidence', claimKey: 'exclusion_count' },

  // PECOS claims
  { sourceId: 'PECOS_ORDERING', claimType: 'pecos.ordering_referring', claimKey: 'pecos_enrolled' },
  { sourceId: 'PECOS_ENROLLMENT', claimType: 'pecos.enrollment', claimKey: 'pecos_enrolled' },

  // State board claims
  { sourceId: 'CA_PA_BOARD', claimType: 'licensure.status', claimKey: 'state_license' },
  { sourceId: 'CA_PA_BOARD', claimType: 'licensure.discipline', claimKey: 'has_discipline' },
];

// ── Claim Engine ─────────────────────────────────────────────────

export function extractClaims(
  checkResults: SourceCheckResult[],
  subjectNpi: string,
): ClaimBatch {
  const claims: Claim[] = [];
  const allLimitations: ClaimLimitation[] = [];

  for (const result of checkResults) {
    const rules = CLAIM_EXTRACTION_RULES.filter(r => r.sourceId === result.sourceId);

    for (const rule of rules) {
      const sourceClaim = result.claims.find(c => c.key === rule.claimKey);

      let value: string | number | boolean | null;
      let limitations: ClaimLimitation[] = [];

      if (!sourceClaim || !sourceClaim.present) {
        value = null;
        limitations.push({
          code: 'CLAIM_NOT_PRESENT',
          description: `Claim "${rule.claimKey}" not present in ${result.sourceId} response`,
          adverse: rule.adverseOnMissing === true,
        });
      } else {
        value = sourceClaim.value as string | number | boolean | null;
      }

      // Map source limitations to claim limitations
      for (const lim of result.limitations) {
        limitations.push({
          code: lim.code,
          description: lim.description,
          adverse: lim.adverse,
        });
      }

      // Match uncertainty produces a limitation
      if (result.matchBasis.confidence !== 'exact') {
        limitations.push({
          code: 'MATCH_NOT_EXACT',
          description: `Match confidence is "${result.matchBasis.confidence}" — claim value may not correspond to the exact clinician`,
          adverse: false,
        });
      }

      // Access required produces a limitation
      if (result.errorClass || result.status === ('access_required' as any)) {
        limitations.push({
          code: 'ACCESS_REQUIRED',
          description: `Source ${result.sourceId} is not accessible — claim value is unavailable`,
          adverse: false,
        });
      }

      const claim: Claim = {
        claimId: crypto.randomUUID(),
        claimType: rule.claimType,
        value,
        source: result.sourceId,
        observedAt: result.observedAt,
        confidence: result.matchBasis.confidence,
        matchBasis: result.matchBasis.explanation,
        limitations,
        sourceCheckId: `${result.sourceId}:${result.checkedAt}`,
      };

      claims.push(claim);
      allLimitations.push(...limitations);
    }
  }

  // Deduplicate limitations
  const seenLimitations = new Set<string>();
  const uniqueLimitations = allLimitations.filter(l => {
    const key = `${l.code}:${l.description}`;
    if (seenLimitations.has(key)) return false;
    seenLimitations.add(key);
    return true;
  });

  const hasAdverse = uniqueLimitations.some(l => l.adverse);

  const auditEvent = createAuditEvent({
    eventType: AuditEventType.INGEST_STARTED,
    subjectNpi,
    metadata: {
      claimCount: claims.length,
      limitationCount: uniqueLimitations.length,
      hasAdverse,
      sourceCount: checkResults.length,
    },
  });

  return {
    subjectNpi,
    generatedAt: new Date().toISOString(),
    claims,
    limitations: uniqueLimitations,
    hasAdverse,
    auditEvent,
  };
}

// ── Deterministic Claim Hash ─────────────────────────────────────

export function hashClaims(claims: Claim[]): string {
  // Sort claims by claimType for deterministic ordering
  const sorted = [...claims].sort((a, b) => a.claimType.localeCompare(b.claimType));
  const payload = sorted.map(c => JSON.stringify({
    t: c.claimType,
    v: c.value,
    s: c.source,
    c: c.confidence,
  }));
  const combined = payload.join('|');
  // Simple deterministic hash using built-in
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
