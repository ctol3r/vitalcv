import { LAUNCH_SPINE_SOURCE_IDS } from '@vitalcv/trust-state';
import type {
  EmployerEvidencePacketLimitationsV1,
  EmployerEvidencePacketReadinessPosture,
  EmployerEvidencePacketV1,
} from './employerPacket';
import { computeReceiptIntegrityHash, type VerificationReceipt } from '../identity/evidenceModel';
import { getIssuer } from '../registry/trustRegistry';

export interface ManifestValidationIssue {
  code: string;
  message: string;
  sourceId?: string;
  severity: 'warning' | 'critical';
}

export interface ReceiptValidationResult {
  valid: boolean;
  issuerId: string | null;
  issues: ManifestValidationIssue[];
}

export interface ManifestValidationResult {
  readinessPosture: EmployerEvidencePacketReadinessPosture;
  issues: ManifestValidationIssue[];
  limitations: EmployerEvidencePacketLimitationsV1;
}

const SOURCE_SYSTEM_TO_ISSUER_ID: Record<string, string> = {
  NPPES_API: 'did:vitalcv:issuer:npi-registry',
  OIG_LEIE: 'did:vitalcv:issuer:oig-leie',
  PECOS_PUBLIC: 'did:vitalcv:issuer:pecos-public',
  STATE_BOARD: 'did:vitalcv:issuer:ca-medical-board',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function dedupeIssues(issues: ManifestValidationIssue[]): ManifestValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.sourceId ?? ''}:${issue.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => (
    left.localeCompare(right)
  ));
}

function resolveMappedIssuerId(sourceId: string): string | null {
  return SOURCE_SYSTEM_TO_ISSUER_ID[sourceId] ?? null;
}

function isEmployerEvidencePacketLike(value: unknown): value is EmployerEvidencePacketV1 {
  if (!isRecord(value) || !isRecord(value.manifest) || !Array.isArray(value.manifest.sources)) {
    return false;
  }

  return (
    isRecord(value.identity)
    && isRecord(value.safety)
    && isRecord(value.authority)
    && Array.isArray(value.authority.credentials)
    && isRecord(value.eligibility)
    && isRecord(value.readiness)
  );
}

function computeBaseLimitations(
  packet: EmployerEvidencePacketV1,
): EmployerEvidencePacketLimitationsV1 {
  const items = packet.manifest.sources.reduce<EmployerEvidencePacketLimitationsV1['items']>(
    (acc, source) => {
      switch (source.state) {
        case 'gated':
          acc.push({ sourceId: source.sourceId, state: 'access_required', reason: source.reason });
          break;
        case 'reviewRequired':
          acc.push({ sourceId: source.sourceId, state: 'review_required', reason: source.reason });
          break;
        case 'stale':
          acc.push({ sourceId: source.sourceId, state: 'stale', reason: source.reason });
          break;
        case 'unavailable':
          acc.push({ sourceId: source.sourceId, state: 'unavailable', reason: source.reason });
          break;
        default:
          break;
      }
      return acc;
    },
    [],
  );

  return {
    items,
    blockers: dedupeStrings([
      ...(packet.limitations?.blockers ?? []),
      ...(packet.readiness.blockers ?? []),
      ...items
        .filter((item) => item.state === 'review_required' || item.state === 'stale')
        .map((item) => item.reason),
    ]),
    gaps: dedupeStrings([
      ...(packet.limitations?.gaps ?? []),
      ...(packet.readiness.gaps ?? []),
      ...items
        .filter((item) => item.state === 'access_required' || item.state === 'unavailable')
        .map((item) => item.reason),
    ]),
  };
}

function assertArbitrationExplainabilityConsistency(packet: unknown): void {
  if (!isRecord(packet)) {
    return;
  }

  const arbitratedClaimsRaw = packet.arbitratedClaims;
  const explainabilityRaw = packet.explainability;
  if (!Array.isArray(arbitratedClaimsRaw) || !isRecord(explainabilityRaw)) {
    return;
  }

  const winningClaim = isRecord(explainabilityRaw.winningClaim)
    ? explainabilityRaw.winningClaim
    : null;
  if (!winningClaim || typeof winningClaim.value === 'undefined') {
    return;
  }

  const winningClaimId = typeof winningClaim.claimId === 'string' ? winningClaim.claimId : null;
  const arbitratedClaim = arbitratedClaimsRaw.find((entry) => {
    if (!isRecord(entry) || typeof entry.finalValue === 'undefined') {
      return false;
    }
    if (!winningClaimId) {
      return true;
    }
    return entry.claimId === winningClaimId;
  });

  if (isRecord(arbitratedClaim) && arbitratedClaim.finalValue !== winningClaim.value) {
    throw new Error('Arbitration/Explainability mismatch');
  }
}

export function validateReceipt(
  receipt: VerificationReceipt,
  asOf = new Date().toISOString(),
): ReceiptValidationResult {
  const issues: ManifestValidationIssue[] = [];
  const issuerId = resolveMappedIssuerId(receipt.source_system);

  try {
    const expectedIntegrityHash = computeReceiptIntegrityHash(receipt);
    if (receipt.integrity_hash !== expectedIntegrityHash) {
      issues.push({
        code: 'invalid_signature',
        message: `Receipt ${receipt.receipt_id} failed integrity verification.`,
        sourceId: receipt.source_system,
        severity: 'critical',
      });
    }
  } catch (error) {
    issues.push({
      code: 'invalid_signature',
      message: error instanceof Error
        ? error.message
        : `Receipt ${receipt.receipt_id} failed integrity verification.`,
      sourceId: receipt.source_system,
      severity: 'critical',
    });
  }

  if (!issuerId) {
    issues.push({
      code: 'issuer_mapping_missing',
      message: `Receipt ${receipt.receipt_id} source "${receipt.source_system}" cannot be mapped to the trust registry.`,
      sourceId: receipt.source_system,
      severity: 'warning',
    });
  } else {
    const issuer = getIssuer(issuerId);
    if (!issuer) {
      issues.push({
        code: 'issuer_missing',
        message: `Receipt ${receipt.receipt_id} issuer "${issuerId}" is missing from the trust registry.`,
        sourceId: receipt.source_system,
        severity: 'critical',
      });
    } else if (issuer.status !== 'ACTIVE') {
      issues.push({
        code: 'issuer_revoked',
        message: `Receipt ${receipt.receipt_id} issuer "${issuerId}" is ${issuer.status}.`,
        sourceId: receipt.source_system,
        severity: 'critical',
      });
    }
  }

  if (receipt.expires_at && Date.parse(receipt.expires_at) <= Date.parse(asOf)) {
    issues.push({
      code: 'receipt_expired',
      message: `Receipt ${receipt.receipt_id} expired at ${receipt.expires_at}.`,
      sourceId: receipt.source_system,
      severity: 'critical',
    });
  }

  return {
    valid: issues.length === 0,
    issuerId,
    issues,
  };
}

export function validateManifest(
  packet: EmployerEvidencePacketV1,
  receipts: readonly VerificationReceipt[] = [],
  asOf = packet.exportedAt,
): ManifestValidationResult {
  if (!isEmployerEvidencePacketLike(packet)) {
    return {
      readinessPosture: 'degraded',
      issues: [{
        code: 'manifest_shape_invalid',
        message: 'Manifest payload is missing required structure.',
        severity: 'critical',
      }],
      limitations: {
        items: [],
        blockers: [],
        gaps: [],
      },
    };
  }

  assertArbitrationExplainabilityConsistency(packet as unknown);

  const issues: ManifestValidationIssue[] = [];
  const limitations = computeBaseLimitations(packet);
  const receiptsById = new Map(receipts.map((receipt) => [receipt.receipt_id, receipt] as const));

  if (!packet.identity.source) {
    issues.push({
      code: 'claim_missing_source',
      message: 'Identity claim is missing a source reference.',
      sourceId: 'NPPES_API',
      severity: 'critical',
    });
  }

  if (!packet.safety.source) {
    issues.push({
      code: 'claim_missing_source',
      message: 'Safety claim is missing a source reference.',
      sourceId: 'OIG_LEIE',
      severity: 'critical',
    });
  }

  if (!packet.eligibility.source) {
    issues.push({
      code: 'claim_missing_source',
      message: 'Eligibility claim is missing a source reference.',
      sourceId: 'PECOS_PUBLIC',
      severity: 'warning',
    });
  }

  for (const credential of packet.authority.credentials) {
    if (!credential.sourceId) {
      issues.push({
        code: 'claim_missing_source',
        message: `Authority credential "${credential.domain}" is missing a source reference.`,
        sourceId: 'STATE_BOARD',
        severity: 'critical',
      });
    }
  }

  for (const source of packet.manifest.sources) {
    if (source.state === 'checked' && source.receiptIds.length === 0) {
      issues.push({
        code: 'checked_lane_missing_receipt',
        message: `Checked lane "${source.sourceId}" is missing a receipt reference.`,
        sourceId: source.sourceId,
        severity: 'critical',
      });
      continue;
    }

    if (source.state !== 'checked') {
      const expectedState = source.state === 'gated'
        ? 'access_required'
        : source.state === 'reviewRequired'
          ? 'review_required'
          : source.state;
      const hasLimitation = limitations.items.some((item) => (
        item.sourceId === source.sourceId && item.state === expectedState
      ));
      if (
        ['unavailable', 'stale', 'gated', 'reviewRequired'].includes(source.state)
        && !hasLimitation
      ) {
        issues.push({
          code: 'missing_limitation',
          message: `Source "${source.sourceId}" requires a limitation entry for state "${expectedState}".`,
          sourceId: source.sourceId,
          severity: 'warning',
        });
      }
      continue;
    }

    const receiptValidationResults = source.receiptIds.map((receiptId) => {
      const receipt = receiptsById.get(receiptId);
      if (!receipt) {
        issues.push({
          code: 'missing_receipt',
          message: `Receipt "${receiptId}" for source "${source.sourceId}" is missing from the manifest export.`,
          sourceId: source.sourceId,
          severity: 'critical',
        });
        return null;
      }

      return validateReceipt(receipt, asOf);
    }).filter((result): result is ReceiptValidationResult => result !== null);

    if (receiptValidationResults.length > 0 && receiptValidationResults.every((result) => !result.valid)) {
      issues.push({
        code: 'checked_lane_invalid_receipt',
        message: `Checked lane "${source.sourceId}" has no valid receipt.`,
        sourceId: source.sourceId,
        severity: 'critical',
      });
    }

    for (const receiptValidation of receiptValidationResults) {
      issues.push(...receiptValidation.issues.map((issue) => ({
        ...issue,
        sourceId: issue.sourceId ?? source.sourceId,
      })));
    }
  }

  for (const requiredSourceId of LAUNCH_SPINE_SOURCE_IDS) {
    if (!packet.manifest.sources.some((source) => source.sourceId === requiredSourceId)) {
      issues.push({
        code: 'critical_lane_missing',
        message: `Critical lane "${requiredSourceId}" is missing from the manifest.`,
        sourceId: requiredSourceId,
        severity: 'critical',
      });
    }
  }

  const criticalLaneBlocked = packet.manifest.sources.some((source) => (
    LAUNCH_SPINE_SOURCE_IDS.includes(source.sourceId as typeof LAUNCH_SPINE_SOURCE_IDS[number])
    && source.state !== 'checked'
  ));
  const hasCriticalIssue = issues.some((issue) => issue.severity === 'critical');

  const readinessPosture: EmployerEvidencePacketReadinessPosture =
    criticalLaneBlocked || hasCriticalIssue
      ? 'review_required'
      : issues.length > 0
        ? 'degraded'
        : 'stable';

  return {
    readinessPosture,
    issues: dedupeIssues(issues),
    limitations,
  };
}

export function applyManifestFailureGuards(
  packet: EmployerEvidencePacketV1,
  receipts: readonly VerificationReceipt[] = [],
): EmployerEvidencePacketV1 {
  if (!isEmployerEvidencePacketLike(packet)) {
    return packet;
  }

  const validation = validateManifest(packet, receipts);

  return {
    ...packet,
    readinessPosture: validation.readinessPosture,
    limitations: {
      ...validation.limitations,
      validationIssues: validation.issues,
    },
    manifest: {
      ...packet.manifest,
      status: {
        ...packet.manifest.status,
        readinessPosture: validation.readinessPosture,
      },
    },
  };
}
