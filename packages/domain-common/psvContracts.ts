/**
 * PRIMARY SOURCE VERIFICATION (PSV) CONTRACTS
 *
 * Evidence-first, auditability-first domain model for verifying healthcare
 * practitioners against authoritative sources (OIG LEIE, SAM, State Boards, etc.)
 *
 * DESIGN PRINCIPLES:
 * - NO network calls in domain layer
 * - Evidence anchors (queryFingerprint, rawHash, evidenceRef)
 * - Explicit expiry/freshness tracking
 * - Deterministic policy evaluation
 * - Clear separation: data capture vs. decision logic
 */

/**
 * Authoritative PSV sources
 *
 * Each source has specific evidence requirements documented in
 * docs/antigravity/psv.md
 */
export enum PSVSource {
  /** Office of Inspector General - List of Excluded Individuals/Entities */
  OIG_LEIE = 'OIG_LEIE',

  /** System for Award Management - Federal exclusions */
  SAM_EXCLUSIONS = 'SAM_EXCLUSIONS',

  /** CMS Provider Enrollment, Chain, and Ownership System (via PPEF) */
  CMS_PPEF = 'CMS_PPEF',

  /** State Medical/Professional Board */
  STATE_BOARD = 'STATE_BOARD',

  /** Drug Enforcement Administration */
  DEA = 'DEA',

  /** National Practitioner Data Bank */
  NPDB = 'NPDB',
}

/**
 * Immutable list of all PSV sources
 */
export const PSV_SOURCE_VALUES = Object.values(PSVSource) as readonly PSVSource[];

/**
 * PSV check result status
 */
export enum PSVStatus {
  /** No adverse findings - practitioner clear */
  PASS = 'PASS',

  /** Adverse finding confirmed - practitioner excluded/sanctioned */
  FAIL = 'FAIL',

  /** Potential match requiring manual review */
  FLAG = 'FLAG',

  /** Unable to determine (source unavailable, insufficient data) */
  UNKNOWN = 'UNKNOWN',

  /** Technical error during verification */
  ERROR = 'ERROR',
}

/**
 * Immutable list of all PSV statuses
 */
export const PSV_STATUS_VALUES = Object.values(PSVStatus) as readonly PSVStatus[];

/**
 * Evidence artifact for a single PSV check
 *
 * INVARIANTS:
 * - queryFingerprint must be deterministic for given search parameters
 * - evidenceRef must be retrievable for audit (S3 key, IPFS CID, etc.)
 * - rawHash is SHA-256 of raw response payload
 */
export interface PSVCheckEvidence {
  /** PSV source queried */
  source: PSVSource;

  /** ISO 8601 timestamp when check was performed */
  checkedAt: string;

  /** ISO 8601 timestamp when evidence expires (null = no expiry) */
  expiresAt: string | null;

  /**
   * Deterministic fingerprint of search query
   * Example: "sha256:hash(firstName=JOHN&lastName=DOE&dob=1980-01-01&npi=1234567890)"
   */
  queryFingerprint: string;

  /**
   * Reference to stored evidence (S3 key, IPFS CID, etc.)
   * Example: "s3://vitalcv-psv-evidence/leie/2025-01-29/abc123.json"
   */
  evidenceRef: string;

  /** SHA-256 hash of raw response payload */
  rawHash: string;

  /** Optional human-readable notes */
  notes?: string;

  /**
   * Source-specific metadata for auditability
   * Examples:
   * - LEIE: { fileVersion: "202501", downloadDate: "2025-01-01" }
   * - SAM: { transactionId: "abc123", apiVersion: "v2" }
   * - NPDB: { dcn: "12345678" }
   * - State Board: { licenseNumber: "MD12345", state: "CA" }
   */
  metadata?: Record<string, unknown>;
}

/**
 * Normalized finding from PSV check
 *
 * Used to store structured adverse findings (exclusions, sanctions, etc.)
 */
export interface PSVFinding {
  /** Finding type (exclusion, sanction, adverse_action, etc.) */
  type: string;

  /** Severity (critical, high, medium, low) */
  severity: 'critical' | 'high' | 'medium' | 'low';

  /** Human-readable description */
  description: string;

  /** Effective date of the finding (ISO 8601) */
  effectiveDate: string | null;

  /** Expiration date of the finding (ISO 8601), null if permanent */
  expirationDate: string | null;

  /** Source-specific finding details */
  details: Record<string, unknown>;
}

/**
 * Result of a single PSV check
 */
export interface PSVCheckResult {
  /** Source checked */
  source: PSVSource;

  /** Check status */
  status: PSVStatus;

  /** Evidence artifact */
  evidence: PSVCheckEvidence;

  /** Normalized findings (empty array if PASS) */
  normalizedFindings: PSVFinding[];
}

/**
 * Final decision for PSV evaluation
 */
export enum PSVDecision {
  /** All required checks passed - practitioner cleared */
  CLEAR = 'CLEAR',

  /** Manual review required (flags, missing sources, expired checks) */
  REVIEW = 'REVIEW',

  /** Hard block - confirmed adverse findings */
  BLOCK = 'BLOCK',
}

/**
 * Immutable list of all PSV decisions
 */
export const PSV_DECISION_VALUES = Object.values(PSVDecision) as readonly PSVDecision[];

/**
 * Complete PSV report for a practitioner
 */
export interface PSVReport {
  /** Subject identifier (practitionerDid, NPI, etc.) */
  subjectId: string;

  /** All PSV checks performed */
  checks: PSVCheckResult[];

  /** Final decision (evaluated by policy) */
  decision: PSVDecision;

  /** ISO 8601 timestamp when decision was made */
  decidedAt: string;

  /** Reasons for decision (human-readable) */
  reasons: string[];

  /** Policy version used for evaluation */
  policyVersion?: string;
}

/**
 * Freshness rule for a PSV source
 */
export interface PSVFreshnessRule {
  /** PSV source */
  source: PSVSource;

  /**
   * Maximum age of check in seconds
   * Example: 2592000 = 30 days
   */
  maxAgeSeconds: number;

  /**
   * Is this source required for CLEAR decision?
   */
  required: boolean;
}

/**
 * Matching rule for PSV queries
 *
 * Defines how to match practitioner identity to PSV source records
 */
export interface PSVMatchingRule {
  /** PSV source */
  source: PSVSource;

  /**
   * Required fields for query
   * Example: ["firstName", "lastName", "dob"]
   */
  requiredFields: string[];

  /**
   * Match strategy: exact | fuzzy | hybrid
   * NOTE: Deterministic by default - fuzzy requires explicit opt-in
   */
  matchStrategy: 'exact' | 'fuzzy' | 'hybrid';

  /**
   * Minimum match confidence (0-1) for fuzzy/hybrid strategies
   */
  minConfidence?: number;
}

/**
 * PSV Policy definition
 *
 * Defines requirements for clearing a practitioner
 */
export interface PSVPolicy {
  /** Policy identifier */
  policyId: string;

  /** Policy version */
  version: string;

  /** Human-readable policy name */
  name: string;

  /** Freshness rules per source */
  freshnessRules: PSVFreshnessRule[];

  /** Matching rules per source */
  matchingRules: PSVMatchingRule[];

  /**
   * Auto-block on any FAIL status?
   * If true, any FAIL immediately results in BLOCK decision
   */
  blockOnAnyFail: boolean;

  /**
   * Auto-review on any FLAG status?
   * If true, any FLAG immediately results in REVIEW decision
   */
  reviewOnAnyFlag: boolean;

  /**
   * Allow CLEAR decision with UNKNOWN sources?
   * If false, any UNKNOWN results in REVIEW
   */
  allowUnknownSources: boolean;
}

/**
 * PSV policy evaluation result
 */
export interface PSVPolicyEvaluation {
  /** Final decision */
  decision: PSVDecision;

  /** Reasons for decision */
  reasons: string[];

  /** Checks that violated policy */
  violations: Array<{
    source: PSVSource;
    rule: string;
    description: string;
  }>;
}
