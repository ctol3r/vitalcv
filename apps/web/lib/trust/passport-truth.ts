import type { PassportAuthorityCredential } from '@/lib/trust/passport-contract';
import type { AccordionStatus } from '@/components/ui/accordion';
import type { TrustStatus } from '@/components/ui/trust-label';
import type { VdsTrustStatus } from '@/lib/trust/status-language';

export type AuthorityEvidenceStatus =
  | 'verified'
  | 'review_required'
  | 'blocked'
  | 'access_required'
  | 'unavailable'
  | 'pending';

export type AuthorityDecisionBasisBucket =
  | 'sourceBackedNow'
  | 'stale'
  | 'needsReview'
  | 'missingOrAccessRequired';

function licensureJurisdiction(credential: PassportAuthorityCredential): string {
  return credential.jurisdiction ? ` (${credential.jurisdiction})` : '';
}

function isAuthorityUnavailable(credential: PassportAuthorityCredential): boolean {
  return credential.authorityClaimCode === 'AUTHORITY_UNAVAILABLE'
    || credential.connectorState === 'unavailable'
    || credential.connectorState === 'unresolved';
}

export function resolveAuthorityEvidenceStatus(
  credential: PassportAuthorityCredential,
): AuthorityEvidenceStatus {
  if (
    credential.authorityClaimCode === 'BOARD_ORDER_PRESENT'
    || credential.authorityClaimCode === 'RN_LICENSE_DISCIPLINED'
    || credential.reviewRequired
  ) {
    return 'review_required';
  }

  if (credential.authorityClaimCode === 'RN_LICENSE_EXPIRED' || credential.status === 'EXPIRED') {
    return 'blocked';
  }

  if (isAuthorityUnavailable(credential)) {
    return credential.participationStatus === 'institution_access_unavailable'
      ? 'access_required'
      : 'unavailable';
  }

  if (
    credential.authorityClaimCode === 'PHYSICIAN_LICENSE_ACTIVE'
    || credential.authorityClaimCode === 'RN_LICENSE_ACTIVE'
    || credential.authorityClaimCode === 'BOARD_CERTIFIED'
    || credential.authorityClaimCode === 'TRAINING_COMPLETED'
    || credential.status === 'ACTIVE'
  ) {
    return 'verified';
  }

  return 'pending';
}

export function resolveAuthorityAccordionStatus(
  credential: PassportAuthorityCredential,
): AccordionStatus {
  const status = resolveAuthorityEvidenceStatus(credential);

  if (status === 'review_required' || status === 'blocked') {
    return 'review_required';
  }
  if (credential.stale) {
    return 'stale';
  }
  if (status === 'access_required') {
    return 'access_required';
  }
  if (status === 'unavailable') {
    return 'unavailable';
  }
  if (status === 'verified') {
    return 'checked';
  }

  return 'pending';
}

export function resolveAuthorityVdsStatus(
  credential: PassportAuthorityCredential,
): VdsTrustStatus {
  const status = resolveAuthorityEvidenceStatus(credential);

  switch (status) {
    case 'verified':
      return 'checked';
    case 'review_required':
      return 'review required';
    case 'blocked':
      return 'blocked';
    case 'access_required':
      return 'access required';
    case 'unavailable':
      return 'unavailable';
    case 'pending':
    default:
      return 'pending';
  }
}

export function resolveAuthorityTrustStatus(
  credential: PassportAuthorityCredential,
): TrustStatus {
  const status = resolveAuthorityEvidenceStatus(credential);

  switch (status) {
    case 'verified':
      return 'checked';
    case 'review_required':
      return 'review_required';
    case 'blocked':
      return 'blocked';
    case 'access_required':
      return 'access_required';
    case 'unavailable':
      return 'unavailable';
    case 'pending':
    default:
      return 'pending';
  }
}

export function resolveAuthorityStatusLead(
  credential: PassportAuthorityCredential,
): string {
  const status = resolveAuthorityEvidenceStatus(credential);

  if (status === 'verified') return 'Source-backed';
  if (status === 'review_required') return 'Review required';
  if (status === 'blocked') return 'Blocked';
  if (status === 'access_required') return 'Access required';
  if (credential.participationStatus === 'manual_verification_required') return 'Manual only';
  if (status === 'unavailable') return 'Unavailable';
  return 'Pending';
}

export function resolveAuthorityMethodLabel(
  credential: PassportAuthorityCredential,
): string {
  switch (credential.sourceScope) {
    case 'STATE_BOARD_CA_API':
      return 'Live CA state board';
    case 'STATE_BOARD_MANUAL':
      return credential.jurisdiction
        ? `${credential.jurisdiction} state board (manual)`
        : 'State board (manual)';
    case 'FSMB_MED_API':
    case 'FSMB_PDC':
      return 'FSMB';
    case 'NURSYS_AUTHORIZED_PATH':
      return 'Nursys';
    default:
      return credential.issuerName ?? credential.sourceId ?? 'Authority source';
  }
}

export function resolveAuthorityTitle(
  credential: PassportAuthorityCredential,
): string {
  const state = licensureJurisdiction(credential);

  switch (credential.authorityClaimCode) {
    case 'PHYSICIAN_LICENSE_ACTIVE':
      return `Physician license${state}`;
    case 'RN_LICENSE_ACTIVE':
      return `Nursing license${state}`;
    case 'RN_LICENSE_EXPIRED':
      return `Nursing license${state} — expired`;
    case 'RN_LICENSE_DISCIPLINED':
      return `Nursing license${state} — disciplinary record`;
    case 'BOARD_CERTIFIED':
      return 'Board certified';
    case 'BOARD_ORDER_PRESENT':
      return `Board order present${state}`;
    case 'TRAINING_COMPLETED':
      return 'Training completed';
    case 'AUTHORITY_UNAVAILABLE':
      if (credential.participationStatus === 'non_participating_state') {
        return `License verification — state not in network${state}`;
      }
      if (credential.participationStatus === 'manual_verification_required') {
        return `License verification — manual lane only${state}`;
      }
      if (credential.participationStatus === 'institution_access_unavailable') {
        return `License verification — access required${state}`;
      }
      return `License verification — unavailable${state}`;
    default:
      if (credential.domain === 'LICENSURE') return `License${state}`;
      if (credential.domain === 'BOARD_CERTIFICATION') return 'Board certification';
      if (credential.domain === 'DEA_REGISTRATION') return 'DEA registration';
      return credential.domain.replace(/_/g, ' ').toLowerCase();
  }
}

export function resolveAuthorityEvidenceLabel(
  credential: PassportAuthorityCredential,
): string {
  const state = licensureJurisdiction(credential);

  switch (credential.authorityClaimCode) {
    case 'BOARD_ORDER_PRESENT':
      return `Board order${state}`;
    case 'RN_LICENSE_DISCIPLINED':
      return `License disciplinary action${state}`;
    case 'RN_LICENSE_EXPIRED':
    case 'PHYSICIAN_LICENSE_ACTIVE':
    case 'RN_LICENSE_ACTIVE':
      return `License${state}`;
    case 'BOARD_CERTIFIED':
      return 'Board certification';
    case 'AUTHORITY_UNAVAILABLE':
      return credential.participationStatus === 'institution_access_unavailable'
        ? `License verification${state}`
        : `License source${state}`;
    default:
      if (credential.domain === 'BOARD_CERTIFICATION') return 'Board certification';
      if (credential.domain === 'LICENSURE') return `License${state}`;
      if (credential.domain === 'DEA_REGISTRATION') return 'DEA registration';
      return credential.domain.replace(/_/g, ' ').toLowerCase();
  }
}

export function resolveAuthorityNote(
  credential: PassportAuthorityCredential,
): string | null {
  if (credential.authorityClaimCode === 'BOARD_ORDER_PRESENT') {
    const severity =
      credential.boardOrderSeverity && credential.boardOrderSeverity !== 'NONE'
        ? ` Severity: ${credential.boardOrderSeverity}.`
        : '';

    return `A board order is on file for this license.${severity} Manual employer review required before proceeding.`;
  }

  if (credential.authorityClaimCode === 'AUTHORITY_UNAVAILABLE') {
    if (credential.participationStatus === 'non_participating_state' && credential.jurisdiction) {
      return `${credential.jurisdiction} does not participate in automated license verification. Request a board-issued verification letter directly.`;
    }
    if (credential.participationStatus === 'manual_verification_required' && credential.jurisdiction) {
      return `${credential.jurisdiction} is outside the current CA physician licensure launch lane. Manual state board verification is required and is not decision-grade.`;
    }
    if (credential.participationStatus === 'institution_access_unavailable') {
      return credential.sourceScope === 'STATE_BOARD_MANUAL' || credential.sourceScope === 'STATE_BOARD_CA_API'
        ? 'Access required. CA physician licensure needs source-backed California board access or an institutional FSMB agreement.'
        : 'Access required. Institutional FSMB or Nursys agreement is not configured.';
    }

    return 'Authority source access not configured for this record.';
  }

  if (credential.authorityClaimCode === 'RN_LICENSE_DISCIPLINED') {
    return 'A disciplinary action is recorded on this license. Review required before clinical placement.';
  }

  return null;
}

export function resolveAuthoritySectionStatus(
  credentials: readonly PassportAuthorityCredential[],
  missingDomains: readonly string[],
): AccordionStatus {
  const statuses = credentials.map(resolveAuthorityAccordionStatus);
  const hasChecked = statuses.includes('checked');
  const hasUnavailable = statuses.includes('unavailable');
  const hasAccessRequired = statuses.includes('access_required');

  if (statuses.includes('review_required')) return 'review_required';
  if (hasChecked && !hasUnavailable && !hasAccessRequired && !statuses.includes('stale')) return 'checked';
  if (!hasChecked && hasAccessRequired) return 'access_required';
  if (!hasChecked && hasUnavailable) return 'unavailable';
  if (statuses.includes('stale')) return 'stale';
  if (missingDomains.includes('LICENSURE')) return 'pending';
  if (hasChecked) return 'review_required';
  return 'pending';
}

export function isDecisionGradeAuthorityCredential(
  credential: PassportAuthorityCredential,
): boolean {
  return !credential.stale && resolveAuthorityEvidenceStatus(credential) === 'verified';
}

export function resolveAuthorityDecisionBasisBucket(
  credential: PassportAuthorityCredential,
): AuthorityDecisionBasisBucket {
  if (credential.stale) {
    return 'stale';
  }

  const status = resolveAuthorityEvidenceStatus(credential);

  if (status === 'verified') {
    return 'sourceBackedNow';
  }

  if (status === 'review_required' || status === 'blocked') {
    return 'needsReview';
  }

  return 'missingOrAccessRequired';
}
