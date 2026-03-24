import React from 'react';
import type { PassportData } from '@/app/passport/[id]/page';
import { ProofDetailsList } from '@/components/trust/ProofDetailsList';
import type { AccordionItem } from '@/components/ui/vcv-accordion';
import {
  formatAsOfDate,
  formatCompactProofDate,
  formatProofDate,
  joinNoteParts,
  renderAttachedCheckFreshness,
  renderAttachedRecordFreshness,
  renderCredentialGroupFreshness,
} from '@/lib/trust/proof-language';

function accordionMeta(label: string) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/35">
      {label}
    </span>
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
  const code = credential.authorityClaimCode;

  if (code === 'BOARD_ORDER_PRESENT' || code === 'RN_LICENSE_DISCIPLINED' || credential.reviewRequired) {
    return 'review_required';
  }

  if (code === 'RN_LICENSE_EXPIRED' || credential.status === 'EXPIRED') {
    return 'review_required';
  }

  if (credential.stale) {
    return 'stale';
  }

  if (
    code === 'AUTHORITY_UNAVAILABLE'
    || credential.connectorState === 'unavailable'
    || credential.connectorState === 'unresolved'
  ) {
    return credential.participationStatus === 'institution_access_unavailable'
      ? 'access_required'
      : 'unavailable';
  }

  if (
    code === 'PHYSICIAN_LICENSE_ACTIVE'
    || code === 'RN_LICENSE_ACTIVE'
    || code === 'BOARD_CERTIFIED'
    || credential.status === 'ACTIVE'
  ) {
    return 'verified';
  }

  return 'pending';
}

function credentialEvidenceLabel(credential: PassportData['authority']['credentials'][0]): string {
  const jurisdiction = credential.jurisdiction ? ` (${credential.jurisdiction})` : '';

  switch (credential.authorityClaimCode) {
    case 'BOARD_ORDER_PRESENT':
      return `Board order${jurisdiction}`;
    case 'RN_LICENSE_DISCIPLINED':
      return `License disciplinary action${jurisdiction}`;
    case 'RN_LICENSE_EXPIRED':
      return `License${jurisdiction}`;
    case 'PHYSICIAN_LICENSE_ACTIVE':
    case 'RN_LICENSE_ACTIVE':
      return `License${jurisdiction}`;
    case 'BOARD_CERTIFIED':
      return 'Board certification';
    case 'AUTHORITY_UNAVAILABLE':
      return credential.participationStatus === 'institution_access_unavailable'
        ? `License verification${jurisdiction}`
        : `License source${jurisdiction}`;
    default:
      if (credential.domain === 'BOARD_CERTIFICATION') return 'Board certification';
      if (credential.domain === 'LICENSURE') return `License${jurisdiction}`;
      if (credential.domain === 'DEA_REGISTRATION') return 'DEA registration';
      return credential.domain.replace(/_/g, ' ').toLowerCase();
  }
}

function credentialGroupStatus(
  credentials: PassportData['authority']['credentials'],
  fallback: AccordionItem['status'] = 'pending',
): AccordionItem['status'] {
  if (credentials.length === 0) return fallback;

  const statuses = credentials.map(credentialAccordionStatus);
  if (statuses.includes('review_required')) return 'review_required';
  if (statuses.includes('verified')) return 'verified';
  if (statuses.includes('stale')) return 'stale';
  if (statuses.includes('access_required')) return 'access_required';
  if (statuses.includes('unavailable')) return 'unavailable';
  return 'pending';
}

function credentialStatusNote(status: AccordionItem['status'], emptyFallback: string): string {
  switch (status) {
    case 'verified':
      return 'Decision-grade proof is attached for this domain.';
    case 'stale':
      return 'Attached proof exists, but at least one record is outside the freshness window.';
    case 'review_required':
      return 'This domain has attached proof, but an employer should not rely on it without manual review.';
    case 'access_required':
      return 'A source exists for this domain, but institutional access is still required to complete it.';
    case 'unavailable':
      return 'The current source connection could not return a usable result.';
    case 'checked':
      return 'A source-backed result exists, but it is informational rather than fully decision-grade.';
    case 'pending':
    default:
      return emptyFallback;
  }
}

function claimCodeToNote(credential: PassportData['authority']['credentials'][0]): string | null {
  const code = credential.authorityClaimCode;
  const severity = credential.boardOrderSeverity;

  if (code === 'BOARD_ORDER_PRESENT') {
    const severityLabel = severity && severity !== 'NONE' ? ` Severity: ${severity}.` : '';
    return `A board order is on file for this license.${severityLabel} Manual employer review required before proceeding.`;
  }

  if (code === 'AUTHORITY_UNAVAILABLE') {
    const participationStatus = credential.participationStatus;
    if (participationStatus === 'non_participating_state' && credential.jurisdiction) {
      return `${credential.jurisdiction} does not participate in automated license verification. Request a board-issued verification letter directly.`;
    }
    if (participationStatus === 'institution_access_unavailable') {
      return 'Requires institutional FSMB or Nursys agreement. Contact your administrator.';
    }
    return 'Authority source access not configured for this record.';
  }

  if (code === 'RN_LICENSE_DISCIPLINED') {
    return 'A disciplinary action is recorded on this license. Review required before clinical placement.';
  }

  return null;
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
            <span className="text-white/70">{credentialEvidenceLabel(credential)}</span>
            <span className="text-white/35 uppercase tracking-[0.14em]">
              {credentialAccordionStatus(credential).replaceAll('_', ' ')}
            </span>
          </div>
          <p className="mt-1 text-white/45">
            {joinNoteParts([
              credential.issuerName ?? credential.sourceId ?? credential.verificationLevel,
              formatAsOfDate(credential.observedAt ?? credential.verifiedAt),
              credential.dataFreshnessLabel,
              credential.claimConfidenceLabel,
            ])}
          </p>
          {claimCodeToNote(credential) && (
            <p className="mt-1 text-white/32">{claimCodeToNote(credential)}</p>
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
  const checkedAt = passport.lastCheckedAt ?? null;

  return {
    id: 'identity',
    trigger: 'Identity Verification',
    triggerRight: accordionMeta(
      checkedAt ? `checked ${formatCompactProofDate(checkedAt)}` : 'not checked',
    ),
    status: passport.identity.npi ? 'verified' : 'pending',
    content: (
      <ProofDetailsList
        rows={[
          { id: 'source', label: 'Source', value: 'CMS NPPES', tone: 'strong' },
          { id: 'checked', label: 'Last checked', value: formatProofDate(checkedAt) ?? 'Not checked' },
          { id: 'freshness', label: 'Freshness', value: renderAttachedRecordFreshness(checkedAt) },
          {
            id: 'trust-note',
            label: 'Trust note',
            value: passport.identity.npi
              ? 'The candidate identity resolves to a source-backed NPI record.'
              : 'The review does not yet have a resolved NPI anchor.',
          },
          {
            id: 'status-note',
            label: 'Status note',
            value: passport.identity.npi
              ? 'Identity can anchor the rest of the employer review.'
              : 'Identity needs to resolve before the rest of the trust stack can be treated as reliable.',
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
            value: uniqueCredentialSources(licensureCredentials, 'State Board / FSMB'),
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
              licensureCredentials.length > 0
                ? 'Primary-source authority records are attached for this review.'
                : 'No decision-grade licensure proof is attached yet.',
          },
          {
            id: 'status-note',
            label: 'Status note',
            value: credentialStatusNote(status, 'Licensure remains incomplete until a source-backed record is attached.'),
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
              boardCredentials.length > 0
                ? 'Board evidence is attached from the issuing authority path.'
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
              deaCredentials.length > 0
                ? 'Controlled-substance authority evidence is attached for this review.'
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
      return 'clear';
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
  const checkedAt = passport.standing.exclusionCheckedAt ?? passport.lastCheckedAt ?? null;
  const status = exclusionAccordionStatus(passport.standing.exclusionStatus);

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
            value: renderAttachedCheckFreshness(checkedAt),
          },
          {
            id: 'trust-note',
            label: 'Trust note',
            value:
              passport.standing.exclusionStatus === 'CLEAR'
                ? 'The attached OIG LEIE check returned no exclusion entry.'
                : passport.standing.exclusionStatus === 'POSSIBLE_MATCH'
                  ? 'A potential exclusion match needs employer review before proceeding.'
                  : passport.standing.exclusionStatus === 'EXCLUDED'
                    ? 'An exclusion record is attached to this provider.'
                    : 'The exclusion layer does not have a reliable result attached yet.',
          },
          {
            id: 'status-note',
            label: 'Status note',
            value:
              passport.standing.negativeFindings.length > 0
                ? passport.standing.negativeFindings.join(' · ')
                : 'NPDB and SAM.gov remain separate institutional checks outside this review.',
            tone: 'muted',
          },
        ]}
      />
    ),
  };
}

function eligibilityProofSection(passport: PassportData): AccordionItem | null {
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

  const status: AccordionItem['status'] =
    pecosStatus === 'ENROLLED' ? 'checked'
      : pecosStatus === 'UNCHECKED' ? 'pending'
        : 'review_required';

  return {
    id: 'eligibility',
    trigger: 'Enrollment / Eligibility',
    triggerRight: accordionMeta(
      passport.standing.enrollmentObservedAt
        ? `checked ${formatCompactProofDate(passport.standing.enrollmentObservedAt)}`
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
            value: formatProofDate(passport.standing.enrollmentObservedAt) ?? 'Not checked',
          },
          {
            id: 'freshness',
            label: 'Freshness',
            value: passport.standing.enrollmentDataFreshness ?? passport.standing.enrollmentFreshnessLabel ?? 'Quarterly',
          },
          {
            id: 'trust-note',
            label: 'Trust note',
            value:
              pecosStatus === 'ENROLLED'
                ? 'CMS PECOS confirms an enrolled provider record in the current quarterly release.'
                : passport.standing.enrollmentNote ?? 'Enrollment still needs manual confirmation.',
          },
          {
            id: 'status-note',
            label: 'Status note',
            value:
              pecosStatus === 'ENROLLED'
                ? 'Enrollment is informative and current, but should still be read in the context of quarterly publication cadence.'
                : passport.standing.enrollmentNote ?? 'Do not treat eligibility as satisfied until a current PECOS result is attached.',
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
  const decisionGradeCount = items.filter((item) => item.status === 'verified' || item.status === 'clear').length;
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
