/**
 * B187A-DRIFT-002: DriftRuleSet registry
 *
 * Encodes drift causes, their owning drift types, and the severity that
 * should be emitted when the cause is detected.
 */

import { DriftSeverity, DriftType } from '../models/DriftEvent';

export const DRIFT_CAUSES = [
  'LICENSE_EXPIRED',
  'LICENSE_SUSPENDED',
  'LICENSE_REVOKED',
  'LICENSE_EXPIRING_SOON',
  'BOARD_SANCTION',
  'BOARD_DISCIPLINARY_ACTION',
  'DEA_NUMBER_MISMATCH',
  'NAME_VARIANT',
  'NAME_CONFLICT',
  'TAXONOMY_CONFLICT',
  'ADDRESS_MISMATCH',
  'SPECIALTY_DISCREPANCY',
  'PECOS_GAP',
  'MEDICAID_GAP',
  'NPPES_OUT_OF_SYNC',
  'COMPACT_STATUS_CHANGED',
] as const;

export type DriftCause = (typeof DRIFT_CAUSES)[number];

export interface DriftRuleDefinition {
  driftType: DriftType;
  severity: DriftSeverity;
  rationale: string;
  autoNotify?: boolean;
  requiresManualReview?: boolean;
}

export const DriftRuleSet: Record<DriftCause, DriftRuleDefinition> = {
  LICENSE_EXPIRED: {
    driftType: 'LICENSE_STATUS',
    severity: 'CRITICAL',
    rationale: 'Primary source reports license expiration.',
    autoNotify: true,
    requiresManualReview: true,
  },
  LICENSE_SUSPENDED: {
    driftType: 'LICENSE_STATUS',
    severity: 'CRITICAL',
    rationale: 'Licensing board indicates suspension.',
    autoNotify: true,
    requiresManualReview: true,
  },
  LICENSE_REVOKED: {
    driftType: 'LICENSE_STATUS',
    severity: 'CRITICAL',
    rationale: 'License revoked by issuing board.',
    autoNotify: true,
    requiresManualReview: true,
  },
  LICENSE_EXPIRING_SOON: {
    driftType: 'LICENSE_EXPIRY',
    severity: 'HIGH',
    rationale: 'License expiration date falls inside configured threshold.',
  },
  BOARD_SANCTION: {
    driftType: 'BOARD_STATUS',
    severity: 'HIGH',
    rationale: 'Active disciplinary sanction detected from board data.',
    requiresManualReview: true,
  },
  BOARD_DISCIPLINARY_ACTION: {
    driftType: 'BOARD_STATUS',
    severity: 'MEDIUM',
    rationale: 'Historical disciplinary action requires acknowledgement.',
  },
  DEA_NUMBER_MISMATCH: {
    driftType: 'DEA_STATUS',
    severity: 'HIGH',
    rationale: 'DEA registry mismatch detected for registered address or name.',
  },
  NAME_VARIANT: {
    driftType: 'NAME_MISMATCH',
    severity: 'LOW',
    rationale: 'Minor spelling variation detected across sources.',
  },
  NAME_CONFLICT: {
    driftType: 'NAME_MISMATCH',
    severity: 'MEDIUM',
    rationale: 'Conflicting legal name reported by authoritative source.',
  },
  TAXONOMY_CONFLICT: {
    driftType: 'TAXONOMY_DRIFT',
    severity: 'MEDIUM',
    rationale: 'Taxonomy/specialty classification changed without acknowledgement.',
  },
  ADDRESS_MISMATCH: {
    driftType: 'ADDRESS_DRIFT',
    severity: 'MEDIUM',
    rationale: 'Primary practice address differs between systems.',
  },
  SPECIALTY_DISCREPANCY: {
    driftType: 'SPECIALTY_DRIFT',
    severity: 'HIGH',
    rationale: 'Specialty differs between primary and authoritative sources.',
    requiresManualReview: true,
  },
  PECOS_GAP: {
    driftType: 'PECOS_DRIFT',
    severity: 'HIGH',
    rationale: 'PECOS enrollment missing or inactive for required payer.',
  },
  MEDICAID_GAP: {
    driftType: 'MEDICAID_DRIFT',
    severity: 'MEDIUM',
    rationale: 'Medicaid enrollment out of sync with state roster.',
  },
  NPPES_OUT_OF_SYNC: {
    driftType: 'NPPES_DRIFT',
    severity: 'MEDIUM',
    rationale: 'NPPES record does not match source-of-truth profile.',
  },
  COMPACT_STATUS_CHANGED: {
    driftType: 'COMPACT_STATUS_DRIFT',
    severity: 'HIGH',
    rationale: 'Compact eligibility changed since last reconciliation.',
  },
} as const;

export const DriftTypeDefaultSeverity: Record<DriftType, DriftSeverity> = {
  LICENSE_STATUS: 'HIGH',
  LICENSE_EXPIRY: 'MEDIUM',
  BOARD_STATUS: 'MEDIUM',
  DEA_STATUS: 'MEDIUM',
  NAME_MISMATCH: 'LOW',
  TAXONOMY_DRIFT: 'MEDIUM',
  ADDRESS_DRIFT: 'LOW',
  SPECIALTY_DRIFT: 'MEDIUM',
  PECOS_DRIFT: 'MEDIUM',
  MEDICAID_DRIFT: 'MEDIUM',
  NPPES_DRIFT: 'LOW',
  COMPACT_STATUS_DRIFT: 'MEDIUM',
};

export function getRuleForCause(cause: DriftCause): DriftRuleDefinition {
  const rule = DriftRuleSet[cause];
  if (!rule) {
    throw new Error(`Unknown drift cause: ${cause}`);
  }
  return rule;
}

export function getSeverityForCause(cause: DriftCause): DriftSeverity {
  return getRuleForCause(cause).severity;
}

export function getDefaultSeverityForType(driftType: DriftType): DriftSeverity {
  const severity = DriftTypeDefaultSeverity[driftType];
  if (!severity) {
    throw new Error(`No default severity configured for drift type ${driftType}`);
  }
  return severity;
}

export function inferSeverityForDrift(params: { driftType: DriftType; cause?: DriftCause }): DriftSeverity {
  if (params.cause) {
    const rule = DriftRuleSet[params.cause];
    if (rule) {
      return rule.severity;
    }
  }
  return getDefaultSeverityForType(params.driftType);
}

export function listCausesForType(driftType: DriftType): DriftCause[] {
  return DRIFT_CAUSES.filter((cause) => DriftRuleSet[cause].driftType === driftType);
}

