// ── VitalCV Proof Pack Manifest ──────────────────────────────────
// The canonical trust object. Combines claims, receipts, coverage,
// and limitations into ONE deterministic, exportable object.

import { SourceStatus, ReadinessPosture, ProofAvailability, derivePosture } from '../../trust-contract/src/index';
import type { Claim, ClaimLimitation } from './claim-engine';
import { getRegistryEntry, getDecisionGradeSources } from './types';

// ── Manifest Model ───────────────────────────────────────────────

export interface ProofManifest {
  /** UUID v4 */
  manifestId: string;
  /** Schema version */
  schema: 'vitalcv.manifest.v1';
  /** When this manifest was compiled */
  generatedAt: string;
  /** Subject identity context */
  subject: {
    npi: string;
    entityType: string | null;
    credentialedName: string | null;
  };
  /** Top-level trust posture at time of generation */
  readinessPosture: ReadinessPosture;
  /** Level of proof available in this manifest */
  proofAvailability: ProofAvailability;
  /** Source lane coverage and status */
  coverage: CoverageLane[];
  /** Atomic data points extracted from sources */
  claims: Claim[];
  /** Cryptographic receipts for verifiable sources */
  receipts: SourceReceipt[];
  /** Aggregate limitations / warnings / adverse signals */
  limitations: ClaimLimitation[];
  /** Freshness context */
  freshnessSummary: {
    oldestCheck: string | null;
    newestCheck: string | null;
    staleLanes: number;
  };
}

export interface CoverageLane {
  /** Unique source identifier (e.g. NPPES) */
  source: string;
  /** Lane category */
  laneType: string;
  /** Status of this source check */
  status: SourceStatus;
  /** When VitalCV performed the check */
  checkedAt: string | null;
  /** When the source authority last updated the data */
  observedAt: string | null;
  /** How long this data is considered fresh (ms) */
  ttl: number;
  /** Error class if check failed */
  errorClass: string | null;
}

export interface SourceReceipt {
  /** Unique receipt ID */
  receiptId: string;
  /** Source identifier */
  source: string;
  /** Parser version used */
  version: string;
  /** Raw payload from adapter.buildReceiptPayload() */
  payload: Record<string, unknown>;
  /** Hash of the raw source response */
  rawHash: string;
}

// ── Manifest Engine ──────────────────────────────────────────────

export interface ManifestInput {
  subjectNpi: string;
  coverageLanes: CoverageLane[];
  claims: Claim[];
  receipts: SourceReceipt[];
  limitations: ClaimLimitation[];
}

export function buildManifest(input: ManifestInput): ProofManifest {
  // 1. Extract subject context from claims
  const nameClaim = input.claims.find(c => c.claimType === 'identity.name');
  const entityClaim = input.claims.find(c => c.claimType === 'identity.entity_type');

  // 2. Derive Readiness Posture using Trust Contract
  const posture = derivePosture(input.coverageLanes.map(l => ({
    name: l.source,
    status: l.status,
  })));

  // 3. Determine Proof Availability
  const receiptCount = input.receipts.length;
  let proofAvailability = ProofAvailability.NONE;

  if (receiptCount > 0) {
    const dgSources = getDecisionGradeSources().map(s => s.sourceId);
    const checkedDgSources = input.coverageLanes.filter(
      l => dgSources.includes(l.source) && l.status === SourceStatus.CHECKED
    );

    if (checkedDgSources.length === dgSources.length) {
      proofAvailability = ProofAvailability.DECISION_GRADE;
    } else {
      proofAvailability = ProofAvailability.PARTIAL;
    }
  }

  // 4. Calculate Freshness
  const checkDates = input.coverageLanes
    .filter(l => l.checkedAt)
    .map(l => new Date(l.checkedAt!).getTime());

  const staleCount = input.coverageLanes.filter(l => l.status === SourceStatus.STALE).length;

  const freshnessSummary = {
    oldestCheck: checkDates.length > 0 ? new Date(Math.min(...checkDates)).toISOString() : null,
    newestCheck: checkDates.length > 0 ? new Date(Math.max(...checkDates)).toISOString() : null,
    staleLanes: staleCount,
  };

  // 5. Build Object
  const manifest: ProofManifest = {
    manifestId: crypto.randomUUID(),
    schema: 'vitalcv.manifest.v1',
    generatedAt: new Date().toISOString(),
    subject: {
      npi: input.subjectNpi,
      entityType: (entityClaim?.value as string) || null,
      credentialedName: (nameClaim?.value as string) || null,
    },
    readinessPosture: posture,
    proofAvailability,
    coverage: input.coverageLanes,
    claims: input.claims,
    receipts: input.receipts,
    limitations: dedupeLimitations(input.limitations, input.coverageLanes),
    freshnessSummary,
  };

  validateManifestContract(manifest);
  return manifest;
}

// ── Contract Validation ──────────────────────────────────────────

function dedupeLimitations(base: ClaimLimitation[], lanes: CoverageLane[]): ClaimLimitation[] {
  const limitations = [...base];

  // Auto-inject limitations for lane states
  for (const lane of lanes) {
    if (lane.status === SourceStatus.UNAVAILABLE) {
      limitations.push({
        code: 'SOURCE_UNAVAILABLE',
        description: `Source ${lane.source} is unavailable (${lane.errorClass || 'unknown error'})`,
        adverse: false,
      });
    }
    if (lane.status === SourceStatus.ACCESS_REQUIRED) {
      limitations.push({
        code: 'ACCESS_REQUIRED',
        description: `Source ${lane.source} requires manual access or configuration`,
        adverse: false,
      });
    }
    if (lane.status === SourceStatus.STALE) {
      limitations.push({
        code: 'SOURCE_STALE',
        description: `Data from ${lane.source} has exceeded freshness TTL`,
        adverse: false,
      });
    }
    if (lane.status === SourceStatus.REVIEW_REQUIRED) {
      limitations.push({
        code: 'REVIEW_REQUIRED',
        description: `Source ${lane.source} requires manual review`,
        adverse: false,
      });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return limitations.filter(l => {
    const key = `${l.code}:${l.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateManifestContract(manifest: ProofManifest): void {
  // Rule 1: Claims must reference a source
  for (const claim of manifest.claims) {
    if (!claim.source) throw new Error(`Claim ${claim.claimId} missing source`);
    const sourceExists = manifest.coverage.some(l => l.source === claim.source);
    if (!sourceExists) throw new Error(`Claim ${claim.claimId} references unknown source ${claim.source}`);
  }

  // Rule 2: Receipts must exist for checked lanes (if the registry says they should)
  for (const lane of manifest.coverage) {
    if (lane.status === SourceStatus.CHECKED) {
      const entry = getRegistryEntry(lane.source);
      // CA_PA_BOARD is manual, may not have a raw receipt hash
      if (entry && entry.authMode !== 'manual') {
        const hasReceipt = manifest.receipts.some(r => r.source === lane.source);
        if (!hasReceipt) throw new Error(`Missing receipt for CHECKED source ${lane.source}`);
      }
    }
  }

  // Rule 3: 0 receipts -> NONE, >=1 -> PARTIAL/DECISION_GRADE
  if (manifest.receipts.length === 0 && manifest.proofAvailability !== ProofAvailability.NONE) {
    throw new Error('Proof availability must be NONE when 0 receipts exist');
  }
  if (manifest.receipts.length > 0 && manifest.proofAvailability === ProofAvailability.NONE) {
    throw new Error('Proof availability cannot be NONE when receipts exist');
  }
}
