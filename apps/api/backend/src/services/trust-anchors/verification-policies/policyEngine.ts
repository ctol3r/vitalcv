/**
 * Wave 197 — Verification Policy Engine
 */

import type { TrustAnchor } from '../anchors/anchorRegistry';

export interface VerificationPolicy {
  id: string;
  name: string;
  requiredAnchorTypes: string[];
  minTrustLevel: 1 | 2 | 3;
  allowExpiredWithWarning: boolean;
}

export interface PolicyEvaluationResult {
  pass: boolean;
  warnings: string[];
  errors: string[];
}

export const DEFAULT_POLICIES: VerificationPolicy[] = [
  {
    id: 'STRICT_HEALTHCARE',
    name: 'Strict Healthcare Verification',
    requiredAnchorTypes: ['AAMVA_VICAL', 'VITALCV'],
    minTrustLevel: 3,
    allowExpiredWithWarning: false,
  },
  {
    id: 'STANDARD',
    name: 'Standard Verification',
    requiredAnchorTypes: ['VITALCV'],
    minTrustLevel: 2,
    allowExpiredWithWarning: true,
  },
  {
    id: 'DEMO',
    name: 'Demo / Development',
    requiredAnchorTypes: [],
    minTrustLevel: 1,
    allowExpiredWithWarning: true,
  },
];

const policyIndex = new Map<string, VerificationPolicy>(
  DEFAULT_POLICIES.map((p) => [p.id, p]),
);

export function getPolicy(id: string): VerificationPolicy | undefined {
  return policyIndex.get(id);
}

export function listPolicies(): VerificationPolicy[] {
  return Array.from(policyIndex.values());
}

export function evaluatePolicy(policyId: string, anchor: TrustAnchor): PolicyEvaluationResult {
  const policy = policyIndex.get(policyId);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!policy) {
    return { pass: false, warnings: [], errors: [`Unknown policy: ${policyId}`] };
  }

  // Root type check
  if (
    policy.requiredAnchorTypes.length > 0 &&
    !policy.requiredAnchorTypes.includes(anchor.rootType)
  ) {
    errors.push(
      `Anchor rootType '${anchor.rootType}' not in required types: [${policy.requiredAnchorTypes.join(', ')}]`,
    );
  }

  // Status check
  if (anchor.status === 'REVOKED') {
    errors.push('Anchor has been revoked');
  } else if (anchor.status === 'EXPIRED') {
    if (policy.allowExpiredWithWarning) {
      warnings.push('Anchor is expired but policy allows expired anchors with warning');
    } else {
      errors.push('Anchor is expired and policy does not allow expired anchors');
    }
  } else if (anchor.status === 'PENDING') {
    warnings.push('Anchor TTL has elapsed — re-verification pending');
  }

  // Valid-until check
  if (anchor.validUntil) {
    const expires = new Date(anchor.validUntil).getTime();
    if (expires < Date.now()) {
      if (policy.allowExpiredWithWarning) {
        warnings.push(`Anchor validUntil (${anchor.validUntil}) is in the past`);
      } else {
        errors.push(`Anchor validUntil (${anchor.validUntil}) is in the past`);
      }
    } else if (expires - Date.now() < 30 * 24 * 60 * 60 * 1_000) {
      warnings.push(`Anchor expires within 30 days (${anchor.validUntil})`);
    }
  }

  return { pass: errors.length === 0, warnings, errors };
}
