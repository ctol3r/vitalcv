import React from 'react';
import type { PassportData } from '@/lib/trust/passport-contract';
import { Badge } from '@/components/ui/badge';
import { ProofDetailsList } from '@/components/trust/ProofDetailsList';
import type { AccordionItem } from '@/components/ui/accordion';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import {
  getPublicWedgeSurfaceStateLabel,
  resolvePublicWedgeSurfaceStateFromTruth,
} from '@/lib/trust/public-wedge-parity';
import {
  formatAsOfDate,
  formatCompactProofDate,
  formatProofDate,
  joinNoteParts,
  renderAttachedCheckFreshness,
  renderAttachedRecordFreshness,
  renderCredentialGroupFreshness,
} from '@/lib/trust/proof-language';
import {
  isDecisionGradeAuthorityCredential,
  resolveAuthorityAccordionStatus,
  resolveAuthorityEvidenceLabel,
  resolveAuthorityMethodLabel,
  resolveAuthorityNote,
} from '@/lib/trust/passport-truth';
import { resolvePassportTruthSet } from '@/lib/trust/passport-truth-set';
import type { CanonicalTruth } from '../../../../packages/trust-state';

void React;

function accordionMeta(label: string) {
  return (
    <Badge
      variant="outline"
      className="rounded-full border-white/8 bg-card px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
    >
      {label}
    </Badge>
  );
}

function latestCredentialDate(credentials: PassportData['authority']['credentials']): string | null {
  const values = credentials
    .map((credential) => credential.observedAt ?? credential.verifiedAt ?? null)
    .filter((value): value is string => Boolean(value));

  if (values.length === 0) return null;

  return values.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function uniqueCredentialSources(credentials: PassportData['authority']['credentials'], fallback: string): string {
  const sources = Array.from(new Set(
    credentials
      .map((credential) => credential.issuerName ?? credential.sourceId ?? null)
      .filter((value): value is string => Boolean(value && value.trim())),
  ));

  return sources.length > 0 ? sources.join(' · ') : fallback;
}

function credentialAccordionStatus(
  credential: PassportData['authority']['credentials'][0],
): NonNullable<AccordionItem['status']> {
  return resolveAuthorityAccordionStatus(credential);
}

function credentialEvidenceLabel(credential: PassportData['authority']['credentials'][0]): string {
  return resolveAuthorityEvidenceLabel(credential);
}

function credentialGroupStatus(
  credentials: PassportData['authority']['credentials'],
  fallback: AccordionItem['status'] = 'pending',
): AccordionItem['status'] {
  if (credentials.length === 0) return fallback;

  const statuses = credentials.map(credentialAccordionStatus);
  if (statuses.includes('review_required')) return 'review_required';
  if (statuses.includes('stale')) return 'stale';
  if (statuses.includes('checked')) return 'checked';
  if (statuses.includes('access_required')) return 'access_required';
  if (statuses.includes('unavailable')) return 'unavailable';
  return 'pending';
}

function truthAccordionStatus(
  truth: CanonicalTruth,
  checkedStatus: NonNullable<AccordionItem['status']>,
): NonNullable<AccordionItem['status']> {
  const surfaceState = resolvePublicWedgeSurfaceStateFromTruth(truth);

  switch (surfaceState) {
    case 'checked':
      return checkedStatus;
    case 'stale':
      return 'stale';
    case 'access_required':
      return 'access_required';
    case 'unavailable':
      return 'unavailable';
    case 'review_required':
      return 'review_required';
    case 'preview_only':
      return 'preview_only';
    case 'pending':
    default:
      return 'pending';
  }
}

function truthFreshnessLabel(
  truth: CanonicalTruth,
  checkedAt: string | null,
  kind: 'check' | 'record',
): string {
  const surfaceState = resolvePublicWedgeSurfaceStateFromTruth(truth);

  if (surfaceState === 'checked' || surfaceState === 'pending') {
    return kind === 'record'
      ? renderAttachedRecordFreshness(checkedAt)
      : renderAttachedCheckFreshness(checkedAt);
  }

  return getPublicWedgeSurfaceStateLabel(surfaceState);
}

function credentialStatusNote(status: AccordionItem['status'], emptyFallback: string): string {
  switch (status) {
    case 'checked':
      return 'Decision-grade proof is attached for this domain.';
    case 'stale':
      return 'Attached proof exists, but at least one record is outside the freshness window.';
    case 'review_required':
      return 'This domain has attached proof, but an employer should not rely on it without manual review.';
    case 'access_required':
      return 'A source exists for this domain, but institutional access is still required to complete it.';
    case 'unavailable':
      return 'The current source connection could not return a usable result.';
    case 'pending':
    default:
      return emptyFallback;
  }
}

function credentialRecordsValue(credentials: PassportData['authority']['credentials']) {
  if (credentials.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {credentials.map((credential) => (
        <div
          key={credential.id}
          className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-foreground/70">{credentialEvidenceLabel(credential)}</span>
            <TrustStatusBadge status={credentialAccordionStatus(credential)} size="sm" />
          </div>
          <p className="mt-1 text-foreground">
            {joinNoteParts([
              resolveAuthorityMethodLabel(credential),
              formatAsOfDate(credential.observedAt ?? credential.verifiedAt),
              credential.dataFreshnessLabel,
              credential.claimConfidenceLabel,
            ])}
          </p>
          {resolveAuthorityNote(credential) && (
            <p className="mt-1 text-white/32">{resolveAuthorityNote(credential)}</p>
          )}
          {credential.sourceDisclaimer && (
            <p className="mt-1 text-white/28">{credential.sourceDisclaimer}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function identityProofSection(passport: PassportData): AccordionItem {
  const truth = resolvePassportTruthSet(passport).identity;
  const checkedAt = truth.coverage.checkedAt ?? passport.lastCheckedAt ?? null;
  const status = truthAccordionStatus(truth, 'checked');

  return {
    id: 'identity',
    trigger: 'Identity Verification',
    triggerRight: accordionMeta(
      checkedAt ? `checked ${formatCompactProofDate(checkedAt)}` : 'not checked',
    ),
    status,
    content: (
      <ProofDetailsList
        rows={[
          { id: 'source', label: 'Source', value: 'CMS NPPES', tone: 'strong' },
          { id: 'checked', label: 'Last checked', value: formatProofDate(checkedAt) ?? 'Not checked' },
          { id: 'freshness', label: 'Freshness', value: truthFreshnessLabel(truth, checkedAt, 'record') },
          {
            id: 'trust-note',
            label: 'Trust note',
            value: status === 'checked'
              ? 'The candidate identity resolves to a source-backed NPI record.'
              : truth.coverage.reason || 'The review does not yet have a resolved NPI anchor.',
          },
          {
            id: 'status-note',
            label: 'Status note',
            value: status === 'checked'
              ? 'Identity can anchor the rest of the employer review.'
              : 'Identity needs a current source-backed anchor before the rest of the trust stack can be treated as reliable.',
            tone: 'muted',
          },
        ]}
      />
    ),
  };
}

function authorityProofSection(passport: PassportData): AccordionItem {
  const licensureCredentials = passport.authority.credentials.filter(
    (credential) => credential.domain === 'LICENSURE',
  );
  const checkedAt = latestCredentialDate(licensureCredentials);
  const hasDecisionGradeLicensure = licensureCredentials.some(isDecisionGradeAuthorityCredential);
  const status = credentialGroupStatus(
    licensureCredentials,
    passport.authority.summary.missing.includes('LICENSURE') ? 'pending' : 'access_required',
  );

  return {
    id: 'licensure',
    trigger: 'State Licensure / Authority',
    triggerRight: accordionMeta(
      licensureCredentials.length > 0
        ? `${licensureCredentials.length} record${licensureCredentials.length === 1 ? '' : 's'}`
        : 'no records',
    ),
    status,
    content: (
      <ProofDetailsList
        rows={[
          {
            id: 'source',
            label: 'Source',
            value: uniqueCredentialSources(licensureCredentials, 'CA State Board / FSMB'),
            tone: 'strong',
          },
          { id: 'checked', label: 'Last checked', value: formatProofDate(checkedAt) ?? 'Not checked' },
          {
            id: 'freshness',
            label: 'Freshness',
            value: renderCredentialGroupFreshness(licensureCredentials),
          },
          {
            id: 'trust-note',
            label: 'Trust note',
            value:
              hasDecisionGradeLicensure
                ? 'Primary-source authority records are attached for this review.'
                : licensureCredentials.length > 0
                  ? 'The attached licensure entries are honest status markers, but they are not yet decision-grade for employer reliance.'
                  : 'Only the CA physician licensure lane can become decision-grade in this launch wedge.',
          },
          {
            id: 'status-note',
            label: 'Status note',
            value: credentialStatusNote(status, 'Licensure remains incomplete until the CA launch lane returns a source-backed record.'),
            tone: 'muted',
          },
          {
            id: 'records',
            label: 'Records',
            value: credentialRecordsValue(licensureCredentials),
          },
        ]}
      />
    ),
  };
}

function boardProofSection(passport: PassportData): AccordionItem {
  const boardCredentials = passport.authority.credentials.filter(
    (credential) => credential.domain === 'BOARD_CERTIFICATION',
  );
  const checkedAt = latestCredentialDate(boardCredentials);
  const hasDecisionGradeBoard = boardCredentials.some(isDecisionGradeAuthorityCredential);
  const status = credentialGroupStatus(
    boardCredentials,
    passport.authority.summary.missing.includes('BOARD_CERTIFICATION') ? 'pending' : 'access_required',
  );

  return {
    id: 'board',
    trigger: 'Board Certification',
    triggerRight: accordionMeta(
      boardCredentials.length > 0
        ? `${boardCredentials.length} record${boardCredentials.length === 1 ? '' : 's'}`
        : 'no records',
    ),
    status,
    content: (
      <ProofDetailsList
        rows={[
          {
            id: 'source',
            label: 'Source',
            value: uniqueCredentialSources(boardCredentials, 'ABMS / specialty board'),
            tone: 'strong',
          },
          { id: 'checked', label: 'Last checked', value: formatProofDate(checkedAt) ?? 'Not checked' },
          {
            id: 'freshness',
            label: 'Freshness',
            value: renderCredentialGroupFreshness(boardCredentials),
          },
          {
            id: 'trust-note',
            label: 'Trust note',
            value:
              hasDecisionGradeBoard
                ? 'Board evidence is attached from the issuing authority path.'
                : boardCredentials.length > 0
                  ? 'Board evidence is attached, but it is not currently decision-grade for employer reliance.'
                : 'Board coverage is not attached for this review yet.',
          },
          {
            id: 'status-note',
            label: 'Status note',
            value: credentialStatusNote(status, 'Board certification remains incomplete until evidence is attached.'),
            tone: 'muted',
          },
          {
            id: 'records',
            label: 'Records',
            value: credentialRecordsValue(boardCredentials),
          },
        ]}
      />
    ),
  };
}

function deaProofSection(passport: PassportData): AccordionItem {
  const deaCredentials = passport.authority.credentials.filter(
    (credential) => credential.domain === 'DEA_REGISTRATION',
  );
  const checkedAt = latestCredentialDate(deaCredentials);
  const hasDecisionGradeDea = deaCredentials.some(isDecisionGradeAuthorityCredential);
  const status = credentialGroupStatus(
    deaCredentials,
    passport.standing.deaStatus === 'unknown' ? 'access_required' : 'checked',
  );

  return {
    id: 'dea',
    trigger: 'DEA / Controlled Substance',
    triggerRight: accordionMeta(
      deaCredentials.length > 0
        ? `${deaCredentials.length} record${deaCredentials.length === 1 ? '' : 's'}`
        : passport.standing.deaStatus === 'unknown'
          ? 'no records'
          : 'status only',
    ),
    status,
    content: (
      <ProofDetailsList
        rows={[
          {
            id: 'source',
            label: 'Source',
            value: uniqueCredentialSources(deaCredentials, 'DEA'),
            tone: 'strong',
          },
          { id: 'checked', label: 'Last checked', value: formatProofDate(checkedAt) ?? 'Not checked' },
          {
            id: 'freshness',
            label: 'Freshness',
            value: renderCredentialGroupFreshness(deaCredentials),
          },
          {
            id: 'trust-note',
            label: 'Trust note',
            value:
              hasDecisionGradeDea
                ? 'Controlled-substance authority evidence is attached for this review.'
                : deaCredentials.length > 0
                  ? 'Controlled-substance authority evidence is attached, but it is not currently decision-grade for employer reliance.'
                : passport.standing.deaStatus === 'unknown'
                  ? 'No decision-grade DEA proof is attached yet.'
                  : `The review carries a DEA status field (${passport.standing.deaStatus}), but no portable record is attached.`,
          },
          {
            id: 'status-note',
            label: 'Status note',
            value: credentialStatusNote(status, 'DEA coverage remains incomplete until source-backed evidence is attached.'),
            tone: 'muted',
          },
          {
            id: 'records',
            label: 'Records',
            value: credentialRecordsValue(deaCredentials),
          },
        ]}
      />
    ),
  };
}

function exclusionAccordionStatus(status: PassportData['standing']['exclusionStatus']): AccordionItem['status'] {
  switch (status) {
    case 'CLEAR':
      return 'checked';
    case 'POSSIBLE_MATCH':
    case 'EXCLUDED':
      return 'review_required';
    case 'UNKNOWN':
      return 'unavailable';
    case 'UNCHECKED':
    default:
      return 'pending';
  }
}

function sanctionsProofSection(passport: PassportData): AccordionItem {
  const truth = resolvePassportTruthSet(passport).safety;
  const checkedAt = truth.coverage.checkedAt ?? passport.standing.exclusionCheckedAt ?? passport.lastCheckedAt ?? null;
  const status = passport.standing.exclusionStatus === 'POSSIBLE_MATCH' || passport.standing.exclusionStatus === 'EXCLUDED'
    ? exclusionAccordionStatus(passport.standing.exclusionStatus)
    : truthAccordionStatus(truth, 'checked');
  const trustNote =
    passport.standing.exclusionStatus === 'CLEAR' && status === 'checked'
      ? 'The attached OIG LEIE check returned no exclusion entry.'
      : passport.standing.exclusionStatus === 'POSSIBLE_MATCH'
        ? 'A potential exclusion match needs employer review before proceeding.'
        : passport.standing.exclusionStatus === 'EXCLUDED'
          ? 'An exclusion record is attached to this provider.'
          : truth.coverage.reason || 'The exclusion layer does not have a reliable result attached yet.';
  const statusNote =
    passport.standing.negativeFindings.length > 0
      ? passport.standing.negativeFindings.join(' · ')
      : status === 'stale'
        ? 'Refresh the exclusion check before relying on this layer.'
        : status === 'preview_only'
          ? 'This exclusion result is contextual only and not decision-grade.'
          : 'NPDB and SAM.gov remain separate institutional checks outside this review.';

  return {
    id: 'sanctions',
    trigger: 'Sanctions & Exclusions',
    triggerRight: accordionMeta(
      checkedAt ? `checked ${formatCompactProofDate(checkedAt)}` : 'not checked',
    ),
    status,
    content: (
      <ProofDetailsList
        rows={[
          { id: 'source', label: 'Source', value: 'OIG / LEIE', tone: 'strong' },
          { id: 'checked', label: 'Last checked', value: formatProofDate(checkedAt) ?? 'Not checked' },
          {
            id: 'freshness',
            label: 'Freshness',
            value: truthFreshnessLabel(truth, checkedAt, 'check'),
          },
          {
            id: 'trust-note',
            label: 'Trust note',
            value: trustNote,
          },
          {
            id: 'status-note',
            label: 'Status note',
            value: statusNote,
            tone: 'muted',
          },
        ]}
      />
    ),
  };
}

function eligibilityProofSection(passport: PassportData): AccordionItem | null {
  const truth = resolvePassportTruthSet(passport).eligibility;
  const pecosStatus = passport.standing.pecosEnrollmentStatus ?? (
    passport.standing.pecosStatus === 'enrolled' ? 'ENROLLED'
      : passport.standing.pecosStatus === 'not_enrolled' ? 'NOT_FOUND'
        : 'UNCHECKED'
  );
  const relevant = pecosStatus !== 'UNCHECKED'
    || passport.readiness.blockers.some((blocker) => /pecos|medicare|enrollment/i.test(blocker));

  if (!relevant) {
    return null;
  }

  const checkedAt = truth.coverage.checkedAt ?? passport.standing.enrollmentObservedAt ?? null;
  const status: AccordionItem['status'] =
    pecosStatus === 'NOT_FOUND'
      ? 'review_required'
      : truthAccordionStatus(truth, 'checked');
  const trustNote =
    status === 'checked'
      ? 'CMS PECOS confirms an enrolled provider record in the current quarterly release.'
      : pecosStatus === 'NOT_FOUND'
        ? passport.standing.enrollmentNote ?? 'Enrollment still needs manual confirmation.'
        : truth.coverage.reason || passport.standing.enrollmentNote || 'Enrollment still needs manual confirmation.';
  const statusNote =
    status === 'checked'
      ? 'Enrollment is informative and current, but should still be read in the context of quarterly publication cadence.'
      : status === 'preview_only'
        ? 'This PECOS result is contextual only and should not be treated as a strong trust outcome.'
        : passport.standing.enrollmentNote ?? 'Do not treat eligibility as satisfied until a current PECOS result is attached.';

  return {
    id: 'eligibility',
    trigger: 'Enrollment / Eligibility',
    triggerRight: accordionMeta(
      checkedAt
        ? `checked ${formatCompactProofDate(checkedAt)}`
        : 'quarterly',
    ),
    status,
    content: (
      <ProofDetailsList
        rows={[
          {
            id: 'source',
            label: 'Source',
            value: passport.standing.enrollmentSourceLabel ?? 'CMS PECOS',
            tone: 'strong',
          },
          {
            id: 'checked',
            label: 'Last checked',
            value: formatProofDate(checkedAt) ?? 'Not checked',
          },
          {
            id: 'freshness',
            label: 'Freshness',
            value: status === 'checked'
              ? passport.standing.enrollmentFreshnessLabel ?? passport.standing.enrollmentDataFreshness ?? 'Quarterly'
              : truthFreshnessLabel(truth, checkedAt, 'check'),
          },
          {
            id: 'trust-note',
            label: 'Trust note',
            value: trustNote,
          },
          {
            id: 'status-note',
            label: 'Status note',
            value: statusNote,
            tone: 'muted',
          },
        ]}
      />
    ),
  };
}

export function buildPassportProofSections(passport: PassportData): AccordionItem[] {
  const items: AccordionItem[] = [
    identityProofSection(passport),
    authorityProofSection(passport),
    boardProofSection(passport),
    deaProofSection(passport),
    sanctionsProofSection(passport),
  ];

  const eligibility = eligibilityProofSection(passport);
  if (eligibility) {
    items.push(eligibility);
  }

  return items;
}

export function summarizePassportProofSections(items: AccordionItem[]) {
  const decisionGradeCount = 0;
  const informationalCount = items.filter((item) => item.status === 'checked').length;
  const warningCount = items.filter((item) => item.status === 'review_required' || item.status === 'stale').length;
  const incompleteCount = items.filter((item) => item.status === 'pending' || item.status === 'unavailable' || item.status === 'access_required').length;

  return {
    total: items.length,
    decisionGradeCount,
    informationalCount,
    warningCount,
    incompleteCount,
  };
}
