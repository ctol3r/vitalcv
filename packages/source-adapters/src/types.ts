// ── VitalCV Source Adapter Contract ──────────────────────────────
// Every primary source MUST implement this interface.
// Local adapter implementations are FORBIDDEN — import from here.

// Re-export from trust-contract for convenience
export { SourceStatus } from '../../trust-contract/dist/index';
import { SourceStatus } from '../../trust-contract/dist/index';

// ── Core Types ───────────────────────────────────────────────────

export type LaneType = 'identity' | 'exclusion' | 'enrollment' | 'licensure' | 'taxonomy' | 'address';

export type AuthMode = 'none' | 'api_key' | 'oauth' | 'basic' | 'certificate' | 'manual';

export type MatchConfidence = 'exact' | 'strong' | 'partial' | 'unresolved' | 'no_match';

export type MatchMode = 'npi_exact' | 'name_dob' | 'name_npi' | 'custom';

export type ErrorClass = 'TIMEOUT' | 'HTTP_4xx' | 'HTTP_5xx' | 'AUTH_FAILURE' | 'PARSE_ERROR' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'NOT_FOUND' | 'UNKNOWN';

// ── Canonical Adapter Interface ──────────────────────────────────

export interface SourceCheckResult {
  /** Unique source identifier (e.g. 'NPPES', 'OIG_LEIE') */
  sourceId: string;
  /** The lane this source populates */
  laneType: LaneType;
  /** Status derived from the fetch attempt */
  status: SourceStatus;
  /** Claims extracted from the source data */
  claims: SourceClaim[];
  /** Limitations / gaps / adverse signals detected */
  limitations: SourceLimitation[];
  /** How the subject was matched to this source record */
  matchBasis: MatchResult;
  /** When the source record was last updated by the authority */
  observedAt: string | null;
  /** When VitalCV performed this check (ISO 8601) */
  checkedAt: string;
  /** SHA-256 hash of the raw response payload */
  rawHash: string | null;
  /** Version of the parser/normalizer used */
  parserVersion: string;
  /** Error classification if the check failed */
  errorClass: ErrorClass | null;
}

export interface MatchResult {
  /** How the match was performed */
  mode: MatchMode;
  /** Confidence in the match */
  confidence: MatchConfidence;
  /** Human-readable explanation of what matched */
  explanation: string;
}

export interface SourceClaim {
  /** Canonical claim key (e.g. 'entity_type', 'taxonomy_code', 'license_state') */
  key: string;
  /** The claim value */
  value: unknown;
  /** Whether this claim was present in the source response */
  present: boolean;
}

export interface SourceLimitation {
  /** Short code identifying the limitation type */
  code: string;
  /** Human-readable description */
  description: string;
  /** Whether this is an adverse/blocking signal */
  adverse: boolean;
}

// ── Adapter Interface ────────────────────────────────────────────

export interface SourceAdapter {
  /** Unique source identifier */
  readonly sourceId: string;
  /** The lane this source populates */
  readonly laneType: LaneType;
  /** How often this source should be re-checked (ms) */
  readonly cadence: number;
  /** How long a CHECKED result is considered fresh (ms) */
  readonly freshnessTtl: number;
  /** Authentication mode required */
  readonly authMode: AuthMode;
  /** How the subject is matched */
  readonly matchMode: MatchMode;
  /** Current parser version */
  readonly parserVersion: string;

  /** Execute a check against the source */
  fetch(subject: string): Promise<SourceCheckResult>;

  /** Normalize raw source response into canonical shape */
  normalize(raw: unknown): Record<string, unknown>;

  /** Classify the normalized result (clear, adverse, needs review) */
  classify(normalized: Record<string, unknown>): SourceStatus;

  /** Extract claims from normalized data */
  buildClaims(normalized: Record<string, unknown>): SourceClaim[];

  /** Extract limitations from normalized data */
  buildLimitations(normalized: Record<string, unknown>): SourceLimitation[];

  /** Build the receipt payload for cryptographic proof */
  buildReceiptPayload(normalized: Record<string, unknown>): Record<string, unknown>;

  /** Check if the source is reachable (auth + network) */
  healthcheck(): Promise<{ healthy: boolean; errorClass: ErrorClass | null; latencyMs: number }>;
}

// ── Source Registry ──────────────────────────────────────────────

export interface SourceRegistryEntry {
  sourceId: string;
  laneType: LaneType;
  cadence: number;
  freshnessTtl: number;
  decisionGradeEligible: boolean;
  requiredForDecisionGrade: boolean;
  authMode: AuthMode;
  knownLimitations: string[];
}

export const SOURCE_REGISTRY: SourceRegistryEntry[] = [
  {
    sourceId: 'NPPES',
    laneType: 'identity',
    cadence: 24 * 60 * 60 * 1000,           // 24 hours
    freshnessTtl: 7 * 24 * 60 * 60 * 1000,   // 7 days
    decisionGradeEligible: true,
    requiredForDecisionGrade: true,
    authMode: 'none',
    knownLimitations: ['Deactivated NPIs may still return 200', 'Taxonomy may be outdated'],
  },
  {
    sourceId: 'OIG_LEIE',
    laneType: 'exclusion',
    cadence: 24 * 60 * 60 * 1000,           // 24 hours
    freshnessTtl: 24 * 60 * 60 * 1000,       // 24 hours (adverse data decays fast)
    decisionGradeEligible: true,
    requiredForDecisionGrade: true,
    authMode: 'none',
    knownLimitations: ['Monthly update cycle', 'Name variations may miss matches'],
  },
  {
    sourceId: 'PECOS_ORDERING',
    laneType: 'enrollment',
    cadence: 24 * 60 * 60 * 1000,
    freshnessTtl: 7 * 24 * 60 * 60 * 1000,
    decisionGradeEligible: false,
    requiredForDecisionGrade: false,
    authMode: 'none',
    knownLimitations: ['NPI must be in PECOS to query', 'Ordering/referring only'],
  },
  {
    sourceId: 'PECOS_ENROLLMENT',
    laneType: 'enrollment',
    cadence: 24 * 60 * 60 * 1000,
    freshnessTtl: 7 * 24 * 60 * 60 * 1000,
    decisionGradeEligible: false,
    requiredForDecisionGrade: false,
    authMode: 'none',
    knownLimitations: ['Enrollment status may lag behind actual status'],
  },
  {
    sourceId: 'CA_PA_BOARD',
    laneType: 'licensure',
    cadence: 7 * 24 * 60 * 60 * 1000,        // 7 days (state boards update infrequently)
    freshnessTtl: 30 * 24 * 60 * 60 * 1000,  // 30 days
    decisionGradeEligible: true,
    requiredForDecisionGrade: false,
    authMode: 'manual',
    knownLimitations: ['No public API', 'Requires manual web scraping or partnership'],
  },
];

export function getRegistryEntry(sourceId: string): SourceRegistryEntry | undefined {
  return SOURCE_REGISTRY.find(e => e.sourceId === sourceId);
}

export function getDecisionGradeSources(): SourceRegistryEntry[] {
  return SOURCE_REGISTRY.filter(e => e.requiredForDecisionGrade);
}
