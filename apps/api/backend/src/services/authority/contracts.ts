export type AuthorityClaimCode =
  | 'PHYSICIAN_LICENSE_ACTIVE'
  | 'BOARD_CERTIFIED'
  | 'BOARD_ORDER_PRESENT'
  | 'RN_LICENSE_ACTIVE'
  | 'RN_LICENSE_EXPIRED'
  | 'RN_LICENSE_DISCIPLINED'
  | 'TRAINING_COMPLETED'
  | 'AUTHORITY_UNAVAILABLE';

export type AuthoritySourceScope =
  | 'STATE_BOARD_CA_API'
  | 'STATE_BOARD_MANUAL'
  | 'FSMB_MED_API'
  | 'FSMB_PDC'
  | 'FSMB_TRAINING'
  | 'FSMB_ABMS_INCLUDED'
  | 'NURSYS_AUTHORIZED_PATH';

export type AuthorityConnectorState =
  | 'configured'
  | 'unavailable'
  | 'unresolved'
  | 'connected';

export type AuthorityParticipationStatus =
  | 'configured'
  | 'connected'
  | 'verified_result'
  | 'participating_state'
  | 'non_participating_state'
  | 'institution_access_unavailable'
  | 'manual_verification_required'
  | 'unresolved';

export type AuthorityTargetDomain =
  | 'LICENSURE'
  | 'BOARD_CERTIFICATION'
  | 'TRAINING';

export type BoardOrderSeverity =
  | 'NONE'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export interface AuthorityTruthFields {
  authorityClaimCode: AuthorityClaimCode;
  issuerEntityId: string | null;
  sourceScope: AuthoritySourceScope;
  effectiveAt: string | null;
  expiresAt: string | null;
  verifiedAt: string | null;
  confidenceLabel: string;
  dataFreshness: string;
  participationStatus: AuthorityParticipationStatus;
  boardOrderSeverity: BoardOrderSeverity;
  connectorState: AuthorityConnectorState;
  targetDomain: AuthorityTargetDomain;
}

export interface FsmbScopeContract {
  scope: AuthoritySourceScope;
  state: AuthorityConnectorState;
  targetDomain: AuthorityTargetDomain;
}

export interface FsmbContractSnapshot {
  source: 'FSMB';
  issuerEntityId: string;
  scopes: FsmbScopeContract[];
}

export interface NursysContractSnapshot {
  source: 'NURSYS';
  issuerEntityId: string;
  state: AuthorityConnectorState;
  sourceScope: 'NURSYS_AUTHORIZED_PATH';
  participationStatus: AuthorityParticipationStatus;
  jurisdiction: string | null;
}

const FSMB_ISSUER_ENTITY_ID = 'authority:fsmb';
const NURSYS_ISSUER_ENTITY_ID = 'authority:nursys';

export function normalizeBoardOrderSeverity(
  value: unknown,
): BoardOrderSeverity {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'LOW') return 'LOW';
  if (normalized === 'MEDIUM' || normalized === 'MODERATE') return 'MEDIUM';
  if (normalized === 'HIGH' || normalized === 'SEVERE') return 'HIGH';
  if (normalized === 'CRITICAL') return 'CRITICAL';
  return 'NONE';
}

export function boardOrderSeverityRequiresReview(
  severity: BoardOrderSeverity,
): boolean {
  return severity === 'LOW' || severity === 'MEDIUM';
}

export function boardOrderSeverityBlocksReadiness(
  severity: BoardOrderSeverity,
): boolean {
  return severity === 'HIGH' || severity === 'CRITICAL';
}

export function authorityConfidenceLabel(input: {
  connectorState: AuthorityConnectorState;
  connectedLabel?: string;
}): string {
  if (input.connectorState === 'connected') {
    return input.connectedLabel ?? 'Confirmed';
  }
  if (input.connectorState === 'configured') {
    return 'Configured but not yet verified';
  }
  if (input.connectorState === 'unavailable') {
    return 'Authority unavailable';
  }
  return 'Resolution pending';
}

export function defaultAuthorityTruthFields(
  input: Omit<AuthorityTruthFields, 'boardOrderSeverity' | 'confidenceLabel'>
    & Partial<Pick<AuthorityTruthFields, 'boardOrderSeverity' | 'confidenceLabel'>>,
): AuthorityTruthFields {
  return {
    authorityClaimCode: input.authorityClaimCode,
    issuerEntityId: input.issuerEntityId ?? null,
    sourceScope: input.sourceScope,
    effectiveAt: input.effectiveAt ?? input.verifiedAt ?? null,
    expiresAt: input.expiresAt ?? null,
    verifiedAt: input.verifiedAt ?? null,
    confidenceLabel: input.confidenceLabel ?? authorityConfidenceLabel({
      connectorState: input.connectorState,
    }),
    dataFreshness: input.dataFreshness,
    participationStatus: input.participationStatus,
    boardOrderSeverity: normalizeBoardOrderSeverity(input.boardOrderSeverity),
    connectorState: input.connectorState,
    targetDomain: input.targetDomain,
  };
}

export function authorityStatusForClaim(input: {
  claimCode: AuthorityClaimCode;
  boardOrderSeverity?: BoardOrderSeverity;
}): 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED' | 'REVIEW_REQUIRED' | 'UNRESOLVED' {
  if (input.claimCode === 'PHYSICIAN_LICENSE_ACTIVE') return 'ACTIVE';
  if (input.claimCode === 'BOARD_CERTIFIED') return 'ACTIVE';
  if (input.claimCode === 'RN_LICENSE_ACTIVE') return 'ACTIVE';
  if (input.claimCode === 'RN_LICENSE_EXPIRED') return 'EXPIRED';
  if (input.claimCode === 'RN_LICENSE_DISCIPLINED') return 'SUSPENDED';
  if (input.claimCode === 'TRAINING_COMPLETED') return 'ACTIVE';
  if (input.claimCode === 'AUTHORITY_UNAVAILABLE') return 'UNRESOLVED';

  const severity = normalizeBoardOrderSeverity(input.boardOrderSeverity);
  if (boardOrderSeverityBlocksReadiness(severity)) {
    return 'SUSPENDED';
  }
  return 'REVIEW_REQUIRED';
}

export function buildFsmbContractSnapshot(): FsmbContractSnapshot {
  const enabled = process.env.FSMB_ENABLED === 'true';
  const hasApiKey = Boolean(process.env.FSMB_API_KEY?.trim());
  const configuredState: AuthorityConnectorState =
    !enabled ? 'unavailable' : hasApiKey ? 'configured' : 'unavailable';

  return {
    source: 'FSMB',
    issuerEntityId: FSMB_ISSUER_ENTITY_ID,
    scopes: [
      { scope: 'FSMB_MED_API', state: configuredState, targetDomain: 'LICENSURE' },
      { scope: 'FSMB_PDC', state: configuredState, targetDomain: 'LICENSURE' },
      { scope: 'FSMB_TRAINING', state: configuredState, targetDomain: 'TRAINING' },
      { scope: 'FSMB_ABMS_INCLUDED', state: configuredState, targetDomain: 'BOARD_CERTIFICATION' },
    ],
  };
}

export function buildNursysContractSnapshot(
  jurisdiction?: string | null,
): NursysContractSnapshot {
  const enabled = process.env.REAL_NURSYS_ENABLED === 'true';
  const normalizedJurisdiction = jurisdiction?.trim().toUpperCase() ?? null;
  const participationStatus: AuthorityParticipationStatus = enabled
    ? normalizedJurisdiction
      ? 'participating_state'
      : 'configured'
    : 'institution_access_unavailable';

  return {
    source: 'NURSYS',
    issuerEntityId: NURSYS_ISSUER_ENTITY_ID,
    state: enabled ? 'configured' : 'unavailable',
    sourceScope: 'NURSYS_AUTHORIZED_PATH',
    participationStatus,
    jurisdiction: normalizedJurisdiction,
  };
}
