'use client';

/**
 * ReviewClient.tsx — Employer decision surface
 *
 * THE DECISION SURFACE. One screen. Can you hire this person?
 *
 * Layout (spec-exact):
 *   Header         — VitalCV + "Employer review"
 *   DecisionCard   — Name, specialty, READY/PARTIAL/BLOCKED, start estimate, confidence
 *   ReadinessBreak — Identity / Authority / Standing / Enrollment rows
 *   ProofPanel     — accordion: each credential with source + timestamp + status
 *   ActionPanel    — Accept / Request missing / Save
 *   ShareContext   — if accessed via share link, shows who shared + when
 *
 * UX rules:
 *   - Decision first, proof collapsible
 *   - < 10 seconds to decide
 *   - No tabs, no sidebars, no clutter
 *   - Status via opacity only (doctrine)
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRoleContext } from '@/components/auth/RoleContext';
import { Accordion, type AccordionItem } from '@/components/ui/vcv-accordion';
import { ProofDetailsList } from '@/components/trust/ProofDetailsList';
import {
  buildPassportProofSections,
  summarizePassportProofSections,
} from '@/components/trust/passportProofSections';
import { TrustLabel, type TrustStatus } from '@/components/ui/trust-label';
import type { PassportData } from '@/app/passport/[id]/page';
import { EmployerAdvisoryPanel } from '@/components/advisory/AdvisoryPanel';
import {
  CLERK_PROVIDER_ENABLED,
  CLERK_SIGN_IN_URL,
} from '@/lib/auth/clerkConfig';
import {
  VStatusPill,
  type TrustStatusLabel,
} from '@/components/vds/primitives';

function formatProofDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
}

function formatQuarter(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const q = Math.floor(parsed.getMonth() / 3) + 1;
  return `Q${q} ${parsed.getFullYear()}`;
}

function joinNoteParts(parts: Array<string | null | undefined>): string | undefined {
  const values = parts.filter((part): part is string => Boolean(part && part.trim()));
  return values.length > 0 ? values.join(' · ') : undefined;
}

function formatAsOfDate(value?: string | null): string | null {
  const date = formatProofDate(value);
  return date ? `as of ${date}` : null;
}

function formatAsOfQuarter(
  observedAt?: string | null,
  dataVersion?: string | null,
): string | null {
  const quarter = dataVersion ?? formatQuarter(observedAt);
  return quarter ? `as of ${quarter}` : null;
}

function formatCompactProofDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function accordionMeta(label: string) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/35">
      {label}
    </span>
  );
}

// ── Proof accordion builder ────────────────────────────────────────────────────

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
  const state = credential.jurisdiction ? ` (${credential.jurisdiction})` : '';

  switch (credential.authorityClaimCode) {
    case 'BOARD_ORDER_PRESENT':
      return `Board order${state}`;
    case 'RN_LICENSE_DISCIPLINED':
      return `License disciplinary action${state}`;
    case 'RN_LICENSE_EXPIRED':
      return `License${state}`;
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
      if (credential.domain === 'DEA_REGISTRATION') return `DEA registration${state}`;
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
          { id: 'freshness', label: 'Freshness', value: checkedAt ? 'Current attached record' : 'No attached record' },
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
            value:
              licensureCredentials.length === 0
                ? 'No attached record'
                : licensureCredentials.some((credential) => credential.stale)
                  ? 'Mixed freshness'
                  : 'Within freshness window',
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
            value:
              boardCredentials.length === 0
                ? 'No attached record'
                : boardCredentials.some((credential) => credential.stale)
                  ? 'Mixed freshness'
                  : 'Within freshness window',
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
            value:
              deaCredentials.length === 0
                ? 'No attached record'
                : deaCredentials.some((credential) => credential.stale)
                  ? 'Mixed freshness'
                  : 'Within freshness window',
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
            value: checkedAt ? 'Current attached check' : 'No attached check',
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

function buildProofSections(passport: PassportData): AccordionItem[] {
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

function claimCodeToNote(c: PassportData['authority']['credentials'][0]): string | null {
  const code = c.authorityClaimCode;
  const severity = c.boardOrderSeverity;
  if (code === 'BOARD_ORDER_PRESENT') {
    const sev = severity && severity !== 'NONE' ? ` Severity: ${severity}.` : '';
    return `A board order is on file for this license.${sev} Manual employer review required before proceeding.`;
  }
  if (code === 'AUTHORITY_UNAVAILABLE') {
    const p = c.participationStatus;
    if (p === 'non_participating_state' && c.jurisdiction)
      return `${c.jurisdiction} does not participate in automated license verification. Request a board-issued verification letter directly.`;
    if (p === 'institution_access_unavailable')
      return 'Requires institutional FSMB or Nursys agreement. Contact your administrator.';
    return 'Authority source access not configured for this record.';
  }
  if (code === 'RN_LICENSE_DISCIPLINED')
    return 'A disciplinary action is recorded on this license. Review required before clinical placement.';
  return null;
}

function buildSafetyRow(standing: PassportData['standing']): {
  status: TrustStatus;
  label: string;
  note?: string;
  explanation: string;
} {
  // MS16-E: note contract — checkedAt · dataFreshness · confidenceLabel (· action-flag)
  const checkedNote = formatAsOfDate(standing.exclusionCheckedAt);
  const confidence  = standing.exclusionConfidenceLabel ?? null;

  switch (standing.exclusionStatus) {
    case 'CLEAR':
      return {
        status: 'confirmed',
        label: 'Exclusion check',
        note: joinNoteParts(['Clear', checkedNote, confidence]),
        explanation: 'No exclusion entry was found in the current OIG LEIE check.',
      };
    case 'POSSIBLE_MATCH':
      return {
        status: 'review',
        label: 'Exclusion check',
        note: joinNoteParts(['Review required', checkedNote, confidence, 'requires verification']),
        explanation: 'A potential OIG match needs manual adjudication before the employer can rely on this safety layer.',
      };
    case 'EXCLUDED':
      return {
        status: 'blocked',
        label: 'Exclusion check',
        note: joinNoteParts(['Blocked', checkedNote, confidence, 'requires verification']),
        explanation: 'An exclusion record is attached to this provider. Employment should not proceed until it is resolved.',
      };
    case 'UNKNOWN':
      return {
        status: 'review',
        label: 'Exclusion check',
        note: joinNoteParts(['Unavailable', confidence, 'requires verification']),
        explanation: 'The exclusion result could not be resolved from the current OIG check.',
      };
    case 'UNCHECKED':
    default:
      return {
        status: 'unchecked',
        label: 'Exclusion check',
        note: 'Unavailable · requires verification',
        explanation: 'No current OIG exclusion check is attached to this review.',
      };
  }
}

function buildAuthorityRow(credential: PassportData['authority']['credentials'][0]): {
  status: TrustStatus;
  label: string;
  note?: string;
  explanation?: string;
} {
  const code = credential.authorityClaimCode;
  const isUnavailable =
    code === 'AUTHORITY_UNAVAILABLE'
    || credential.connectorState === 'unavailable'
    || credential.connectorState === 'unresolved';
  const isBoardOrder = code === 'BOARD_ORDER_PRESENT';
  const isDisciplined =
    code === 'RN_LICENSE_DISCIPLINED'
    || (credential.reviewRequired && credential.domain === 'LICENSURE');
  const isExpired = code === 'RN_LICENSE_EXPIRED' || credential.status === 'EXPIRED';
  const isActive =
    (code === 'PHYSICIAN_LICENSE_ACTIVE' || code === 'RN_LICENSE_ACTIVE')
    && !isDisciplined
    && !isBoardOrder;

  const label =
    isBoardOrder ? `Board order${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}` :
    isDisciplined ? `License disciplinary action${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}` :
    isExpired ? `License expired${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}` :
    isUnavailable ? (
      credential.participationStatus === 'non_participating_state'
        ? `License source unavailable${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}`
        : 'License source not configured'
    ) :
    isActive ? `License active${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}` :
    `License${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}`;

  const status: TrustStatus =
    isBoardOrder || isDisciplined ? 'review' :
    isExpired ? 'blocked' :
    isUnavailable ? 'unchecked' :
    isActive ? 'confirmed' :
    'unchecked';

  // MS16-E: note carries dataFreshness + confidenceLabel (row contract)
  const note = joinNoteParts([
    isUnavailable
      ? credential.participationStatus === 'institution_access_unavailable'
        ? 'Access required'
        : 'Unavailable'
      : isExpired
        ? 'Blocked'
        : isBoardOrder || isDisciplined
          ? 'Review required'
          : isActive
            ? 'Verified'
            : 'Pending',
    formatAsOfDate(credential.observedAt ?? credential.verifiedAt),
    credential.dataFreshnessLabel ?? null,
    credential.claimConfidenceLabel ?? null,
    isBoardOrder || isDisciplined || isExpired || isUnavailable ? 'requires verification' : null,
  ]);

  return {
    status,
    label,
    note,
    explanation: claimCodeToNote(credential) ?? undefined,
  };
}

function buildEligibilityRow(standing: PassportData['standing'], status: 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN' | 'UNCHECKED'): {
  status: TrustStatus;
  label: string;
  note?: string;
  explanation: string;
} {
  const quarterNote  = formatAsOfQuarter(standing.enrollmentObservedAt, standing.enrollmentDataVersion);
  // MS16-E: note contract — dataFreshness · confidenceLabel · checkedAt (· action-flag)
  const freshness    = standing.enrollmentDataFreshness ?? standing.enrollmentFreshnessLabel ?? null;
  const confidence   = standing.enrollmentConfidenceLabel ?? null;

  switch (status) {
    case 'ENROLLED':
      return {
        status: 'confirmed',
        label: 'Medicare enrollment',
        // MS16-A explicit label: "Medicare enrolled — as of Q4 2025"
        note: joinNoteParts(['Enrolled', freshness, confidence, quarterNote]),
        explanation: standing.enrollmentNote ?? 'CMS PECOS confirms an enrolled provider record in the current quarterly release.',
      };
    case 'NOT_FOUND':
      return {
        status: 'review',
        label: 'Medicare enrollment',
        // MS16-A explicit label: "Not found in CMS enrollment data — may indicate not enrolled or data lag"
        note: joinNoteParts(['Review required', freshness, confidence, quarterNote, 'estimated quarterly publication lag possible', 'requires verification']),
        explanation:
          standing.enrollmentNote
          ?? 'Not finding a record may indicate non-enrollment or a quarterly CMS publication lag. Verify at pecos.cms.hhs.gov before relying on this layer.',
      };
    case 'UNKNOWN':
      return {
        status: 'review',
        label: 'Medicare enrollment',
        note: joinNoteParts(['Unavailable', freshness, confidence, quarterNote, 'requires verification']),
        explanation:
          standing.enrollmentNote
          ?? 'The CMS PECOS result could not be resolved from the current quarterly release. Manual verification required.',
      };
    case 'UNCHECKED':
    default:
      return {
        status: 'unchecked',
        label: 'Medicare enrollment',
        note: joinNoteParts(['Unavailable', freshness ?? 'Quarterly', 'Source: CMS PECOS', 'requires verification']),
        explanation: 'No CMS PECOS lookup has been performed yet. Enrollment eligibility is unknown.',
      };
  }
}

// ── Main review component ──────────────────────────────────────────────────────

interface Props {
  passport:   PassportData;
  contextId?: string;
  sharedBy?:  string;
}

// ── M2: Freshness helpers ──────────────────────────────────────────────────

interface FreshnessEntry {
  layer:      string;
  checkedAt:  string | null | undefined;
  source:     string;
  stale:      boolean;   // > staleDays since last check
  unchecked:  boolean;
}

/** Return true if the ISO date is older than thresholdDays from now. */
function isStale(iso: string | null | undefined, thresholdDays: number): boolean {
  if (!iso) return false;
  const ms = Date.now() - new Date(iso).getTime();
  return ms > thresholdDays * 86_400_000;
}

function FreshnessPanel({ entries }: { entries: FreshnessEntry[] }) {
  const hasWarning = entries.some(e => e.stale || e.unchecked);
  if (!hasWarning) return null;

  return (
    <div className="rounded-xl border border-[var(--vt-badge-warning-border)] bg-[var(--vt-surface-2)] px-4 py-3 space-y-1.5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--vt-badge-warning-text)]">
        Source freshness
      </p>
      {entries.map(e => (
        <div key={e.layer} className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 shrink-0 text-[10px] text-[var(--vt-text-3)]">
              {e.stale ? '⚠' : e.unchecked ? '○' : '✔'}
            </span>
            <span className={`text-xs ${e.stale || e.unchecked ? 'text-[var(--vt-text-1)]' : 'text-[var(--vt-text-2)]'}`}>
              {e.layer}
            </span>
          </div>
          <span className="shrink-0 text-right text-[10px] text-[var(--vt-text-3)]">
            {e.unchecked
              ? 'Unavailable'
              : e.stale
                ? `stale — ${e.checkedAt ? new Date(e.checkedAt).toLocaleDateString() : 'date unknown'}`
                : e.checkedAt
                  ? new Date(e.checkedAt).toLocaleDateString()
                  : 'unknown'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── M2: Action state type ──────────────────────────────────────────────────

type ActionState =
  | { phase: 'idle' }
  | { phase: 'loading'; intent: 'accept' | 'refresh' | 'review' | 'download' }
  | { phase: 'done';    intent: 'accept' | 'refresh' | 'review'; auditEventId: string; timestamp: string }
  | { phase: 'error';   intent: 'accept' | 'refresh' | 'review'; message: string }
  | { phase: 'downloading' };

// ── M2: API call helpers ───────────────────────────────────────────────────

const API = '';

async function postAction(
  entityId: string,
  endpoint: 'accept' | 'request-refresh' | 'route-to-review',
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; auditEventId: string; timestamp: string }> {
  const res = await fetch(`${API}/api/employer-review/${entityId}/${endpoint}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error_description?: string };
    throw new Error(err.error_description ?? `Action failed (${res.status})`);
  }
  return res.json() as Promise<{ ok: boolean; auditEventId: string; timestamp: string }>;
}

export default function ReviewClient({ passport, contextId, sharedBy }: Props) {
  const [actionState, setActionState] = useState<ActionState>({ phase: 'idle' });
  const { isLoaded, isSignedIn, isEmployer } = useRoleContext();

  const { identity, readiness, standing, authority } = passport;
  const readinessStatus: TrustStatusLabel =
    readiness.status === 'READY' ? 'clear' :
    readiness.status === 'BLOCKED' ? 'blocked' :
    'review required';
  const pecosEnrollmentStatus: 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN' | 'UNCHECKED' =
    standing.pecosEnrollmentStatus ?? (
      standing.pecosStatus === 'enrolled' ? 'ENROLLED' :
      standing.pecosStatus === 'not_enrolled' ? 'NOT_FOUND' : 'UNCHECKED'
    );

  const missingDomains    = authority.summary.missing;
  const blocked = Array.from(new Set([
    ...readiness.blockers,
    ...missingDomains.map((domain) => domain.replace(/_/g, ' ').toLowerCase()),
  ]));
  const proofItems = buildPassportProofSections(passport);
  const proofSummary = summarizePassportProofSections(proofItems);
  const safetyRow = buildSafetyRow(standing);
  const eligibilityRow = buildEligibilityRow(standing, pecosEnrollmentStatus);
  const lastSyncedAt =
    passport.lastCheckedAt
    ?? standing.exclusionCheckedAt
    ?? authority.credentials[0]?.observedAt
    ?? standing.enrollmentObservedAt
    ?? null;
  const previewOnlyMessage =
    !CLERK_PROVIDER_ENABLED
      ? 'Preview only. Authentication is unavailable in this environment, so employer actions are intentionally disabled.'
      : !isLoaded
        ? 'Checking employer session before enabling actions.'
        : !isSignedIn
          ? 'Preview only. Sign in with an employer workspace to persist decisions.'
          : !isEmployer
            ? 'Preview only. Switch into an employer workspace to persist decisions.'
            : null;
  const canPersistActions = previewOnlyMessage === null;

  // M2: Freshness entries for pre-action panel
  const freshnessEntries: FreshnessEntry[] = [
    {
      layer:     'Identity (NPPES)',
      checkedAt: passport.lastCheckedAt ?? null,
      source:    'CMS NPPES',
      stale:     isStale(passport.lastCheckedAt, 30),
      unchecked: !passport.lastCheckedAt,
    },
    {
      layer:     'Safety (OIG)',
      checkedAt: standing.exclusionCheckedAt ?? null,
      source:    'OIG LEIE',
      stale:     isStale(standing.exclusionCheckedAt, 90),
      unchecked: standing.exclusionStatus === 'UNCHECKED',
    },
    {
      layer:     'Authority (Licenses)',
      checkedAt: authority.credentials.length > 0
        ? authority.credentials[0]?.observedAt ?? null
        : null,
      source:    'State Boards / FSMB',
      stale:     isStale(authority.credentials[0]?.observedAt, 90),
      unchecked: authority.credentials.length === 0,
    },
    {
      layer:     'Eligibility (PECOS)',
      checkedAt: standing.enrollmentObservedAt ?? null,
      source:    standing.enrollmentSourceLabel ?? 'CMS PECOS',
      stale:     false, // PECOS is quarterly by design — not "stale" on time alone
      unchecked: pecosEnrollmentStatus === 'UNCHECKED',
    },
  ];
  const freshnessState = freshnessEntries.some((entry) => entry.stale)
    ? 'Stale sources present'
    : freshnessEntries.some((entry) => entry.unchecked)
      ? 'Partial source coverage'
      : 'Current attached checks';

  // M2: Handlers with real API calls + mandatory audit
  async function handleAccept() {
    if (!canPersistActions) return;
    setActionState({ phase: 'loading', intent: 'accept' });
    try {
      const result = await postAction(passport.entityId, 'accept', {
        staleSources:   freshnessEntries.filter(e => e.stale).map(e => e.source),
        missingDomains: authority.summary.missing,
      });
      setActionState({ phase: 'done', intent: 'accept', auditEventId: result.auditEventId, timestamp: result.timestamp });
    } catch (err) {
      setActionState({ phase: 'error', intent: 'accept', message: (err as Error).message });
    }
  }

  async function handleRequestRefresh() {
    if (!canPersistActions) return;
    setActionState({ phase: 'loading', intent: 'refresh' });
    try {
      const result = await postAction(passport.entityId, 'request-refresh', {
        staleSources:   freshnessEntries.filter(e => e.stale || e.unchecked).map(e => e.source),
        missingDomains: authority.summary.missing,
      });
      setActionState({ phase: 'done', intent: 'refresh', auditEventId: result.auditEventId, timestamp: result.timestamp });
    } catch (err) {
      setActionState({ phase: 'error', intent: 'refresh', message: (err as Error).message });
    }
  }

  async function handleRouteToReview() {
    if (!canPersistActions) return;
    setActionState({ phase: 'loading', intent: 'review' });
    try {
      const result = await postAction(passport.entityId, 'route-to-review', {
        reason: blocked.length > 0
          ? `Employer routed to review. Blockers: ${blocked.slice(0, 3).join(', ')}`
          : 'Employer routed for manual review.',
        priority: blocked.length > 0 ? 'HIGH' : 'NORMAL',
      });
      setActionState({ phase: 'done', intent: 'review', auditEventId: result.auditEventId, timestamp: result.timestamp });
    } catch (err) {
      setActionState({ phase: 'error', intent: 'review', message: (err as Error).message });
    }
  }

  async function handleDownloadPacket() {
    if (!canPersistActions) return;
    setActionState({ phase: 'downloading' });
    try {
      const res = await fetch(`${API}/api/employer-review/${passport.entityId}/packet`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const npi  = passport.identity.npi ?? passport.entityId;
      a.download = `vitalcv-packet-${npi}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* download failure is non-fatal */ }
    setActionState({ phase: 'idle' });
  }

  return (
    <main className="min-h-screen bg-vt-surface-ops-base flex flex-col items-center px-4 pt-10 sm:pt-16 pb-28">
      <div className="w-full max-w-3xl space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <span className="text-white/25 text-xs tracking-widest uppercase">VitalCV</span>
          <span className="text-white/25 text-xs">Employer review</span>
        </div>

        {/* ── Share context (if accessed via share link) ───────────────────── */}
        {(sharedBy || contextId) && (
          <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3">
            {sharedBy && (
              <div className="flex justify-between text-xs">
                <span className="text-white/35">Shared by</span>
                <span className="text-white/55">{sharedBy}</span>
              </div>
            )}
            <div className={`flex justify-between text-xs ${sharedBy ? 'mt-1' : ''}`}>
              <span className="text-white/35">Purpose</span>
              <span className="text-white/55">Employment review</span>
            </div>
            {contextId && (
              <div className="flex justify-between text-xs mt-1">
                <span className="text-white/35">Review context</span>
                <span className="text-white/45 font-mono">{contextId.slice(0, 8)}…</span>
              </div>
            )}
          </div>
        )}

        {/* ── Decision card — Exact Layout ──────────────────────────────── */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-6 mb-6">
          {/* Identity */}
          <div>
            <h1 className="text-white text-xl font-semibold leading-tight">
              {identity.displayName}
            </h1>
            {identity.specialty && (
              <p className="text-white/50 text-sm mt-0.5">{identity.specialty}</p>
            )}
            <div className="mt-3">
              <VStatusPill status={readinessStatus} size="sm" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Readiness</p>
              <p className="mt-1 text-lg font-semibold text-white">{readiness.score}/100</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Trust band</p>
              <p className="mt-1 text-lg font-semibold text-white">{readiness.level}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Freshness</p>
              <p className="mt-1 text-sm font-medium text-white">{freshnessState}</p>
              <p className="mt-1 text-[11px] text-white/30">{formatProofDate(lastSyncedAt) ?? 'Not checked'}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Proof completeness</p>
              <p className="mt-1 text-sm font-medium text-white">
                {proofSummary.decisionGradeCount + proofSummary.informationalCount}/{proofSummary.total} attached
              </p>
              <p className="mt-1 text-[11px] text-white/30">
                {proofSummary.warningCount > 0 ? `${proofSummary.warningCount} review warning${proofSummary.warningCount === 1 ? '' : 's'}` : 'No review warnings'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Decision snapshot</p>
                <p className="mt-1 text-sm leading-relaxed text-white/56">
                  {blocked.length > 0
                    ? `Proceed only as a head start. ${blocked.length} blocker${blocked.length === 1 ? '' : 's'} still need review or refresh.`
                    : 'No visible blockers are attached to this review right now.'}
                </p>
              </div>
              <p className="text-xs text-white/34">
                Estimated start: {readiness.estimatedStartDays === null ? 'Cannot estimate while blocked' : readiness.estimatedStartDays === 0 ? '0 days' : `~${readiness.estimatedStartDays} days`}
              </p>
            </div>
          </div>

          {/* MS16-F: Employer 6-question flow — strict order */}
          <div className="pt-2 mt-4 space-y-6">
            {/* Q1: Who is this? */}
            <div className="space-y-2">
              <h2 className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-2">Identity</h2>
              <TrustLabel
                status={identity.npi ? 'confirmed' : 'unchecked'}
                label={identity.npi ? 'Identity confirmed' : 'Identity missing'}
                source={identity.npi ? 'CMS NPPES' : undefined}
                note={identity.npi ? formatAsOfDate(passport.lastCheckedAt) ?? undefined : 'requires verification'}
                explanation={
                  identity.npi
                    ? 'Identity confirmed against the national provider registry.'
                    : 'Identity must resolve to CMS NPPES before the rest of the trust stack can be relied on.'
                }
              />
            </div>

            <div className="border-t border-white/10 pt-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-white/30 text-xs uppercase tracking-widest font-semibold">Trust stack</h2>
                <span className="text-white/18 text-[11px] uppercase tracking-[0.18em]">Safety · Authority · Eligibility</span>
              </div>

              {/* Q2: Safe? */}
              <div className="space-y-2">
                <h3 className="text-white/24 text-[10px] uppercase tracking-widest font-semibold">Safety</h3>
                <TrustLabel
                  status={safetyRow.status}
                  label={safetyRow.label}
                  source="OIG LEIE"
                  timestamp={standing.exclusionCheckedAt ? `checked ${formatProofDate(standing.exclusionCheckedAt)}` : undefined}
                  note={safetyRow.note}
                  explanation={safetyRow.explanation}
                />
              </div>

              {/* Q3: Licensed? */}
              <div className="space-y-2">
                <h3 className="text-white/24 text-[10px] uppercase tracking-widest font-semibold">Authority</h3>
                {(() => {
                  const licCreds = authority.credentials.filter((credential) => credential.domain === 'LICENSURE');
                  const certCreds = authority.credentials.filter((credential) => credential.domain === 'BOARD_CERTIFICATION');
                  const hasAny = licCreds.length > 0 || certCreds.length > 0;

                  return (
                    <div className="space-y-2">
                      {licCreds.map((credential) => {
                        const row = buildAuthorityRow(credential);
                        return (
                          <TrustLabel
                            key={credential.id}
                            status={row.status}
                            label={row.label}
                            source={credential.issuerName ?? credential.sourceId ?? 'Authority source'}
                            timestamp={credential.observedAt || credential.verifiedAt ? `checked ${formatProofDate(credential.observedAt ?? credential.verifiedAt)}` : undefined}
                            note={row.note}
                            explanation={row.explanation}
                          />
                        );
                      })}

                      {certCreds.map((credential) => (
                        <TrustLabel
                          key={credential.id}
                          status="confirmed"
                          label={`Board certified${credential.jurisdiction ? ` — ${credential.jurisdiction}` : ''}`}
                          source={credential.issuerName ?? credential.sourceId ?? 'ABMS'}
                          timestamp={credential.observedAt || credential.verifiedAt ? `checked ${formatProofDate(credential.observedAt ?? credential.verifiedAt)}` : undefined}
                          note={formatAsOfDate(credential.observedAt ?? credential.verifiedAt) ?? undefined}
                          explanation="Board certification is on file from the issuing authority."
                        />
                      ))}

                      {!hasAny && (
                        <TrustLabel
                          status="unchecked"
                          label="Authority"
                          source="FSMB / Nursys"
                          note="Access required · requires verification"
                          explanation="No source-backed authority record is attached yet. Institutional access or manual verification is still required."
                        />
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Q4: Eligible? — MS16-B: 4-state canonical rendering */}
              <div className="space-y-2">
                <h3 className="text-white/24 text-[10px] uppercase tracking-widest font-semibold">Eligibility</h3>
                <TrustLabel
                  status={eligibilityRow.status}
                  label={eligibilityRow.label}
                  source={standing.enrollmentSourceLabel ?? 'CMS PECOS'}
                  timestamp={standing.enrollmentObservedAt ? `checked ${formatProofDate(standing.enrollmentObservedAt)}` : undefined}
                  note={eligibilityRow.note}
                  explanation={eligibilityRow.explanation}
                />
              </div>
            </div>

            {/* Q5: What blocks start? + Q6: What do I do? */}
            <div className="border-t border-white/10 pt-4 space-y-1 text-sm">
              <h2 className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-2">Readiness</h2>
              <p className="text-white/90 font-medium pb-1">{readiness.score}% ready</p>

              {/* Q5: Blockers */}
              {blocked.length > 0 && (
                <div className="space-y-1 pb-1">
                  {blocked.slice(0, 4).map((b, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-white/20 text-xs w-3 shrink-0 mt-0.5" aria-hidden>·</span>
                      <span className="text-white/50 text-xs">{b.charAt(0).toUpperCase() + b.slice(1)}</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-white/50 pt-1">
                Estimated start: {readiness.estimatedStartDays === null ? 'Cannot estimate while blocked' : readiness.estimatedStartDays === 0 ? '0 days' : `~${readiness.estimatedStartDays} days`}
              </p>

              {/* Q6: What do I do? — sourced from readiness.nextActions[] */}
              {readiness.nextActions.length > 0 && (
                <div className="pt-3 mt-1 border-t border-white/8 space-y-2">
                  <p className="text-white/25 text-[10px] uppercase tracking-widest">Next actions</p>
                  {readiness.nextActions.slice(0, 4).map(action => (
                    <div key={action.id} className="flex items-start gap-2">
                      <span className="text-white/15 text-xs w-3 shrink-0 mt-0.5">·</span>
                      <div>
                        <p className="text-white/55 text-xs font-medium">{action.title}</p>
                        <p className="text-white/30 text-xs mt-0.5 leading-relaxed">{action.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Advisory Panel — gated, clearly labeled, below readiness ── */}
        <EmployerAdvisoryPanel passport={passport} />

        {/* ── Proof panel — collapsible ────────────────────────────────────── */}
        {proofItems.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-white/25 text-xs uppercase tracking-widest">Proof</p>
              <button
                onClick={handleDownloadPacket}
                disabled={!canPersistActions || actionState.phase === 'downloading'}
                className="rounded-xl border border-white/10 px-4 py-2 text-[11px] font-medium text-white/45 transition hover:border-white/20 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {actionState.phase === 'downloading' ? 'Exporting…' : 'Export packet'}
              </button>
            </div>
            <Accordion items={proofItems} />
          </div>
        )}

        {/* ── M2: Freshness panel — visible before any action ───────────────── */}
        <FreshnessPanel entries={freshnessEntries} />

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Last synced</p>
              <p className="mt-1 text-sm text-white/62">{formatProofDate(lastSyncedAt) ?? 'Not checked'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Freshness</p>
              <p className="mt-1 text-sm text-white/62">{freshnessState}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Proof completeness</p>
              <p className="mt-1 text-sm text-white/62">
                {proofSummary.decisionGradeCount + proofSummary.informationalCount}/{proofSummary.total} sections attached
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Review warnings</p>
              <p className="mt-1 text-sm text-white/62">
                {blocked.length > 0 ? `${blocked.length} blocker${blocked.length === 1 ? '' : 's'}` : 'No blockers'}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-white/36">
            {previewOnlyMessage ?? 'Employer actions below are real. VitalCV waits for the backend audit event before it renders success.'}
          </p>
        </div>

        {/* ── M2: Action panel — all actions write audit events ────────────── */}
        {actionState.phase === 'idle' || actionState.phase === 'downloading' ? (
          <div className="space-y-3 pt-2">
            {/* Primary — Accept as head start */}
            <button
              onClick={handleAccept}
              disabled={!canPersistActions || actionState.phase === 'downloading'}
              className="h-14 w-full rounded-xl bg-[var(--vt-success)] text-sm font-medium text-white transition hover:opacity-90 active:opacity-80 disabled:opacity-40"
            >
              Accept as head start
            </button>

            {/* Secondary row */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleRequestRefresh}
                disabled={!canPersistActions || actionState.phase === 'downloading'}
                className="rounded-xl border border-white/10 bg-white/4 text-white/55 hover:text-white/80 hover:bg-white/8 disabled:opacity-40 text-xs py-3.5 min-h-[48px] transition-all"
              >
                Request refresh
              </button>
              <button
                onClick={handleRouteToReview}
                disabled={!canPersistActions || actionState.phase === 'downloading'}
                className="rounded-xl border border-white/10 bg-white/4 text-white/55 hover:text-white/80 hover:bg-white/8 disabled:opacity-40 text-xs py-3.5 min-h-[48px] transition-all"
              >
                Route to review
              </button>
            </div>

            {!canPersistActions && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {CLERK_PROVIDER_ENABLED && !isSignedIn ? (
                  <Link
                    href={CLERK_SIGN_IN_URL}
                    className="text-xs text-white/38 transition-colors hover:text-white/58"
                  >
                    Sign in with employer workspace
                  </Link>
                ) : (
                  <Link
                    href={`/passport/${passport.entityId}`}
                    className="text-xs text-white/38 transition-colors hover:text-white/58"
                  >
                    Open full passport
                  </Link>
                )}
              </div>
            )}
          </div>

        ) : actionState.phase === 'loading' ? (
          /* Loading state */
          <div className="rounded-xl border border-white/10 bg-white/4 px-5 py-5 text-center">
            <p className="text-white/40 text-sm animate-pulse motion-reduce:animate-none">
              {actionState.intent === 'accept'  ? 'Recording acceptance…'
               : actionState.intent === 'refresh' ? 'Sending refresh request…'
               :                                    'Routing to review queue…'}
            </p>
            <p className="text-white/20 text-xs mt-1">Writing audit event…</p>
          </div>

        ) : actionState.phase === 'done' ? (
          /* Success — show audit event ID for verifiability */
          <div className="rounded-xl border border-white/12 bg-white/4 px-5 py-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[var(--vt-success)] text-sm">✔</span>
              <p className="text-white/75 text-sm font-medium">
                {actionState.intent === 'accept'  ? 'Head start accepted'
                 : actionState.intent === 'refresh' ? 'Refresh requested'
                 :                                    'Routed to review'}
              </p>
            </div>
            <p className="text-white/35 text-xs">
              {actionState.intent === 'accept'
                ? `${identity.displayName ?? 'Provider'} — acceptance recorded`
                : actionState.intent === 'refresh'
                  ? 'Provider will be notified of missing or stale data'
                  : 'Added to the manual review queue'}
            </p>
            {/* Audit event ID — verifiable, not just a UI label */}
            <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2 mt-1">
              <p className="text-white/20 text-[10px] uppercase tracking-widest mb-0.5">Audit event</p>
              <p className="text-white/45 text-[10px] font-mono break-all">{actionState.auditEventId}</p>
              <p className="text-white/20 text-[10px] mt-0.5">{new Date(actionState.timestamp).toLocaleString()}</p>
            </div>
            <button
              onClick={() => setActionState({ phase: 'idle' })}
              className="text-white/25 hover:text-white/40 text-xs transition-colors min-h-[44px] block w-full"
            >
              Back
            </button>
          </div>

        ) : /* error */ (
          <div className="rounded-xl border border-[var(--vt-badge-critical-border)] bg-[var(--vt-surface-2)] px-5 py-4 space-y-2">
            <p className="text-white/60 text-sm font-medium">Action failed</p>
            <p className="text-white/35 text-xs">{actionState.message}</p>
            <button
              onClick={() => setActionState({ phase: 'idle' })}
              className="text-white/25 hover:text-white/40 text-xs transition-colors min-h-[44px] block w-full"
            >
              Try again
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
