'use client';

/**
 * Integration notes:
 * - Import this component into PassportWallet and InterviewClient once UX-3 lands their surface changes.
 * - Pass the canonical `passport` object from `@/app/passport/[id]/page`, plus `compact` for embedded or interview views.
 * - Wire-in deferred: UX-3 agent owns PassportWallet and InterviewClient - integrate after UX-3 commits.
 */

import type { PassportData } from '@/app/passport/[id]/page';
import { VStatusPill, type TrustStatusLabel } from '@/components/vds/primitives';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import {
  findPassportSourceCoverageCheck,
  sourceCoveragePosture,
} from '@/lib/trust/source-coverage';
import { useState, type ReactNode } from 'react';
import { SourceCoverageTag, type SourceCoverageTagProps } from './SourceCoverageTag';

type DomainStatus =
  | 'verified'
  | 'pending'
  | 'unavailable'
  | 'clear'
  | 'review-required'
  | 'access-required'
  | 'enrolled'
  | 'not-found'
  | 'unchecked';

type SourceCoverageEntry = {
  sourceId: string;
  state: SourceCoverageTagProps['status'];
  decisionGrade: boolean;
  lastChecked?: string | null;
};

type StateAuthorityEntry = {
  state?: string;
  jurisdiction?: string;
  licenseNumber?: string;
  number?: string;
  status?: string;
  verifiedAt?: string;
  observedAt?: string;
};

type StateAuthorityShape = {
  status?: string;
  licensedStates?: string[];
  licenses?: StateAuthorityEntry[];
  lastChecked?: string | null;
};

type BoardCertificationEntry = {
  id?: string;
  board?: string;
  specialty?: string;
  certification?: string;
  title?: string;
  status?: string;
  certificateNumber?: string;
  verifiedAt?: string;
  observedAt?: string;
  expiresAt?: string;
};

type PassportWithTrustExtensions = PassportData & {
  identity: PassportData['identity'] & {
    npiVerified?: boolean;
    fullName?: string;
    npiCheckedAt?: string | null;
  };
  authority: PassportData['authority'] & {
    stateAuthority?: StateAuthorityShape;
    boardCertifications?: BoardCertificationEntry[];
  };
  eligibility?: {
    pecosEnrollmentStatus?: 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN' | 'UNCHECKED';
    enrollmentNote?: string | null;
    enrollmentObservedAt?: string | null;
  };
};

type DomainRow = {
  label: string;
  value: ReactNode;
};

type TrustDomain = {
  id: string;
  title: string;
  status: DomainStatus;
  sourceLabel: string;
  lastChecked?: string | null;
  coverage: SourceCoverageEntry;
  rows: DomainRow[];
  note?: string | null;
};

const CHIP_TONES: Record<string, 'success' | 'warning' | 'critical' | 'neutral' | 'info'> = {
  verified: 'success',
  clear: 'success',
  enrolled: 'success',
  pending: 'info',
  'review required': 'warning',
  'access required': 'neutral',
  unavailable: 'critical',
  'not found': 'warning',
  unchecked: 'neutral',
};

const CHIP_CLASSES: Record<'success' | 'warning' | 'critical' | 'neutral' | 'info', string> = {
  success: 'border-[var(--vt-badge-success-border)] bg-[var(--vt-badge-success-bg)] text-[var(--vt-badge-success-text)]',
  warning: 'border-[var(--vt-badge-warning-border)] bg-[var(--vt-badge-warning-bg)] text-[var(--vt-badge-warning-text)]',
  critical: 'border-[var(--vt-badge-critical-border)] bg-[var(--vt-badge-critical-bg)] text-[var(--vt-badge-critical-text)]',
  neutral: 'border-[var(--vt-badge-neutral-border)] bg-[var(--vt-badge-neutral-bg)] text-[var(--vt-badge-neutral-text)]',
  info: 'border-[var(--vt-badge-info-border)] bg-[var(--vt-badge-info-bg)] text-[var(--vt-badge-info-text)]',
};

function asTrustPassport(passport: PassportData): PassportWithTrustExtensions {
  return passport as PassportWithTrustExtensions;
}

function toTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => toTrimmedString(value)).filter((value): value is string => Boolean(value)))];
}

function latestTimestamp(values: Array<string | null | undefined>): string | null {
  let bestValue: string | null = null;
  let bestTime = 0;

  for (const value of values) {
    const trimmed = toTrimmedString(value);
    if (!trimmed) {
      continue;
    }

    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) {
      continue;
    }

    if (parsed > bestTime) {
      bestTime = parsed;
      bestValue = trimmed;
    }
  }

  return bestValue;
}

function humanizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function findCoverage(passport: PassportData, aliases: string[]): SourceCoverageEntry | null {
  const entry = findPassportSourceCoverageCheck(passport.sourceCoverage, aliases);

  if (!entry) {
    return null;
  }

  return {
    sourceId: entry.sourceId,
    state: entry.state,
    decisionGrade: entry.state === 'live',
    lastChecked: toTrimmedString(entry.checkedAt) ?? null,
  };
}

function formatTimestamp(value?: string | null): string | null {
  const trimmed = toTrimmedString(value);
  if (!trimmed || formatAbsoluteTime(trimmed) === 'Unknown') {
    return null;
  }

  return formatAbsoluteTime(trimmed);
}

function statusLabel(status: DomainStatus): string {
  switch (status) {
    case 'review-required':
      return 'Review required';
    case 'access-required':
      return 'Access required';
    case 'not-found':
      return 'Not found';
    default:
      return humanizeToken(status);
  }
}

function domainStatusToTrustStatusLabel(status: DomainStatus): TrustStatusLabel | null {
  switch (status) {
    case 'verified':
    case 'pending':
    case 'unavailable':
    case 'clear':
    case 'enrolled':
      return status;
    case 'review-required':
      return 'review required';
    case 'access-required':
      return 'access required';
    case 'not-found':
    case 'unchecked':
    default:
      return null;
  }
}

function StatusChip({ label }: { label: string }) {
  const tone = CHIP_TONES[label.toLowerCase()] ?? 'neutral';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${CHIP_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}

function DomainStatusPill({ status }: { status: DomainStatus }) {
  const label = statusLabel(status);
  const trustStatus = domainStatusToTrustStatusLabel(status);

  if (trustStatus) {
    return <VStatusPill status={trustStatus} size="sm" />;
  }

  return <StatusChip label={label} />;
}

function FieldRow({ label, value, compact = false }: { label: string; value: ReactNode; compact?: boolean }) {
  return (
    <div className={`grid gap-1 border-b border-[var(--vt-border)] py-2 last:border-b-0 ${compact ? 'sm:grid-cols-[9rem_1fr]' : 'sm:grid-cols-[11rem_1fr]'}`}>
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--vt-text-3)]">{label}</span>
      <div className={`min-w-0 text-[var(--vt-text-1)] ${compact ? 'text-xs' : 'text-sm'}`}>{value}</div>
    </div>
  );
}

function renderTextList(values: string[]): ReactNode {
  if (values.length === 0) {
    return null;
  }

  if (values.length === 1) {
    return values[0];
  }

  return (
    <ul className="space-y-1">
      {values.map((value) => (
        <li key={value} className="text-[var(--vt-text-1)]">
          {value}
        </li>
      ))}
    </ul>
  );
}

function authorityMethodLabel(
  credential: PassportData['authority']['credentials'][0] | undefined,
): string | null {
  if (!credential) {
    return null;
  }

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
      return toTrimmedString(credential.issuerName)
        ?? toTrimmedString(credential.sourceId)
        ?? null;
  }
}

function resolveIdentityDomain(passport: PassportData): TrustDomain {
  const trustPassport = asTrustPassport(passport);
  const fullName = toTrimmedString(trustPassport.identity.fullName) ?? toTrimmedString(trustPassport.identity.displayName);
  const specialty = toTrimmedString(trustPassport.identity.specialty);
  const npi = toTrimmedString(trustPassport.identity.npi) ?? toTrimmedString(passport.npi);
  const checkedAt = toTrimmedString(trustPassport.identity.npiCheckedAt) ?? toTrimmedString(passport.lastCheckedAt);
  const verified = typeof trustPassport.identity.npiVerified === 'boolean'
    ? trustPassport.identity.npiVerified
    : trustPassport.identity.status === 'ACTIVE';

  const status: DomainStatus = verified ? 'verified' : (npi ? 'pending' : 'unavailable');
  const coverage = findCoverage(passport, ['NPPES', 'CMS NPPES', 'NPI Registry']) ?? {
    sourceId: 'NPPES',
    state: npi || fullName ? 'live' : 'unavailable',
    decisionGrade: true,
    lastChecked: checkedAt,
  };

  return {
    id: 'identity',
    title: 'Identity Verification',
    status,
    sourceLabel: coverage.sourceId,
    lastChecked: checkedAt ?? coverage.lastChecked,
    coverage,
    rows: [
      ...(npi ? [{ label: 'NPI', value: npi }] : []),
      ...(fullName ? [{ label: 'Full name', value: fullName }] : []),
      ...(specialty ? [{ label: 'Specialty', value: specialty }] : []),
      ...(verified && checkedAt ? [{ label: 'NPI verified date', value: formatTimestamp(checkedAt) ?? checkedAt }] : []),
    ],
  };
}

function resolveSafetyDomain(passport: PassportData): TrustDomain {
  const checkedAt = toTrimmedString(passport.standing.exclusionCheckedAt);
  const negativeFindings = passport.standing.negativeFindings.filter((value) => value.trim().length > 0);
  const needsReview = passport.standing.exclusionClear === false || negativeFindings.length > 0 || passport.standing.exclusionStatus === 'EXCLUDED' || passport.standing.exclusionStatus === 'POSSIBLE_MATCH';
  const status: DomainStatus = passport.standing.exclusionStatus === 'UNCHECKED' && !checkedAt
    ? 'unavailable'
    : (needsReview ? 'review-required' : 'clear');

  const coverage = findCoverage(passport, ['OIG', 'LEIE', 'OIG / LEIE']) ?? {
    sourceId: 'OIG / LEIE',
    state: checkedAt || passport.standing.exclusionStatus !== 'UNCHECKED' ? 'live' : 'unavailable',
    decisionGrade: true,
    lastChecked: checkedAt,
  };

  return {
    id: 'safety',
    title: 'Safety & Sanctions',
    status,
    sourceLabel: coverage.sourceId,
    lastChecked: checkedAt ?? coverage.lastChecked,
    coverage,
    rows: [
      { label: 'Exclusion status', value: humanizeToken(passport.standing.exclusionStatus) },
      ...(negativeFindings.length > 0 ? [{ label: 'Negative findings', value: renderTextList(negativeFindings) }] : []),
    ],
  };
}

function resolveLicensureDomain(passport: PassportData): TrustDomain {
  const trustPassport = asTrustPassport(passport);
  const licensureCredentials = passport.authority.credentials.filter((credential) => credential.domain === 'LICENSURE');
  const stateAuthority = trustPassport.authority.stateAuthority;
  const fallbackSource = toTrimmedString(licensureCredentials[0]?.issuerName)
    ?? toTrimmedString(licensureCredentials[0]?.sourceId)
    ?? 'Nursys';
  const states = uniqueStrings([
    ...(stateAuthority?.licensedStates ?? []),
    ...licensureCredentials.map((credential) => credential.jurisdiction),
    ...((stateAuthority?.licenses ?? []).map((license) => license.state ?? license.jurisdiction)),
  ]);
  const licenseNumbers = uniqueStrings([
    ...((stateAuthority?.licenses ?? []).map((license) => license.licenseNumber ?? license.number)),
  ]);
  const checkedAt = latestTimestamp([
    stateAuthority?.lastChecked,
    ...licensureCredentials.map((credential) => credential.observedAt ?? credential.verifiedAt),
    ...((stateAuthority?.licenses ?? []).map((license) => license.observedAt ?? license.verifiedAt)),
  ]);
  const methodLabel = authorityMethodLabel(licensureCredentials[0]);

  const hasVerifiedAuthority = passport.standing.licensureStatus === 'verified'
    || licensureCredentials.some((credential) => credential.status === 'ACTIVE')
    || toTrimmedString(stateAuthority?.status)?.toLowerCase() === 'verified';
  const hasStructuredAuthority = states.length > 0 || licenseNumbers.length > 0 || licensureCredentials.length > 0;

  const coverage = findCoverage(passport, ['Nursys', 'FSMB', 'State Board']) ?? {
    sourceId: fallbackSource,
    state: hasStructuredAuthority ? 'live' : 'accessRequired',
    decisionGrade: true,
    lastChecked: checkedAt,
  };

  const posture = sourceCoveragePosture(coverage.state);
  const status: DomainStatus =
    coverage.state === 'accessRequired' || coverage.state === 'gated'
      ? 'access-required'
      : posture === 'degraded'
        ? 'review-required'
        : hasVerifiedAuthority
          ? 'verified'
          : 'pending';

  return {
    id: 'licensure',
    title: 'State Licensure',
    status,
    sourceLabel: coverage.sourceId,
    lastChecked: checkedAt ?? coverage.lastChecked,
    coverage,
    rows: [
      ...(methodLabel ? [{ label: 'Method', value: methodLabel }] : []),
      ...(states.length > 0 ? [{ label: 'Licensed states', value: states.join(', ') }] : []),
      ...(licenseNumbers.length > 0 ? [{ label: 'License numbers', value: licenseNumbers.join(', ') }] : []),
      { label: 'Licensure status', value: humanizeToken(passport.standing.licensureStatus) },
    ],
    note: status === 'access-required'
      ? 'Only the CA physician licensure lane is production-enabled. Other states remain manual or access-required.'
      : null,
  };
}

function resolveBoardDomain(passport: PassportData): TrustDomain {
  const trustPassport = asTrustPassport(passport);
  const boardCredentials = passport.authority.credentials.filter((credential) => credential.domain === 'BOARD_CERTIFICATION');
  const boardEntries = Array.isArray(trustPassport.authority.boardCertifications)
    ? trustPassport.authority.boardCertifications
    : [];
  const fallbackSource = toTrimmedString(boardCredentials[0]?.issuerName)
    ?? toTrimmedString(boardCredentials[0]?.sourceId)
    ?? 'ABMS';
  const checkedAt = latestTimestamp([
    ...boardCredentials.map((credential) => credential.observedAt ?? credential.verifiedAt),
    ...boardEntries.map((entry) => entry.observedAt ?? entry.verifiedAt),
  ]);
  const certificationLabels = uniqueStrings([
    ...boardEntries.map((entry) => entry.board ?? entry.certification ?? entry.title),
    ...boardCredentials.map((credential) => credential.type || credential.statusLabel || credential.issuerName),
  ]);
  const certificateNumbers = uniqueStrings([
    ...boardEntries.map((entry) => entry.certificateNumber),
  ]);

  const coverage = findCoverage(passport, ['ABMS', 'Board Certification']) ?? {
    sourceId: fallbackSource,
    state: certificationLabels.length > 0 ? 'live' : 'accessRequired',
    decisionGrade: true,
    lastChecked: checkedAt,
  };

  const posture = sourceCoveragePosture(coverage.state);
  const status: DomainStatus =
    coverage.state === 'accessRequired' || coverage.state === 'gated'
      ? 'access-required'
      : posture === 'degraded'
        ? 'review-required'
        : certificationLabels.length > 0
          ? 'verified'
          : 'pending';

  return {
    id: 'board',
    title: 'Board Certification',
    status,
    sourceLabel: coverage.sourceId,
    lastChecked: checkedAt ?? coverage.lastChecked,
    coverage,
    rows: [
      ...(certificationLabels.length > 0 ? [{ label: 'Certifications', value: renderTextList(certificationLabels) }] : []),
      ...(certificateNumbers.length > 0 ? [{ label: 'Certificate numbers', value: certificateNumbers.join(', ') }] : []),
    ],
    note: 'Board data requires institutional access',
  };
}

function resolveEligibilityDomain(passport: PassportData): TrustDomain {
  const trustPassport = asTrustPassport(passport);
  const fallbackSource = toTrimmedString(passport.standing.enrollmentSourceLabel) ?? 'CMS PECOS';
  const pecosStatus = trustPassport.eligibility?.pecosEnrollmentStatus
    ?? passport.standing.pecosEnrollmentStatus
    ?? (passport.standing.pecosStatus === 'enrolled'
      ? 'ENROLLED'
      : passport.standing.pecosStatus === 'not_enrolled'
        ? 'NOT_FOUND'
        : 'UNCHECKED');
  const checkedAt = toTrimmedString(trustPassport.eligibility?.enrollmentObservedAt)
    ?? toTrimmedString(passport.standing.enrollmentObservedAt);
  const enrollmentNote = toTrimmedString(trustPassport.eligibility?.enrollmentNote)
    ?? toTrimmedString(passport.standing.enrollmentNote);

  const status: DomainStatus =
    pecosStatus === 'ENROLLED' ? 'enrolled'
      : pecosStatus === 'NOT_FOUND' ? 'not-found'
        : pecosStatus === 'UNKNOWN' ? 'pending'
          : 'unchecked';

  const coverage = findCoverage(passport, ['PECOS', 'CMS PECOS']) ?? {
    sourceId: fallbackSource,
    state: checkedAt || pecosStatus !== 'UNCHECKED' ? 'live' : 'unavailable',
    decisionGrade: true,
    lastChecked: checkedAt,
  };

  return {
    id: 'eligibility',
    title: 'Medicare Eligibility',
    status,
    sourceLabel: coverage.sourceId,
    lastChecked: checkedAt ?? coverage.lastChecked,
    coverage,
    rows: [
      { label: 'PECOS enrollment status', value: humanizeToken(pecosStatus) },
      ...(enrollmentNote ? [{ label: 'Enrollment note', value: enrollmentNote }] : []),
    ],
  };
}

function DomainHeader({
  domain,
  compact,
  isOpen,
  onToggle,
}: {
  domain: TrustDomain;
  compact: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-start justify-between gap-3 text-left ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}`}
      aria-expanded={isOpen}
      onClick={onToggle}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-[var(--vt-text-1)]`}>
            {domain.title}
          </span>
          <DomainStatusPill status={domain.status} />
        </div>
      </div>
      <div className="flex shrink-0 items-start gap-3">
        <div className="text-right">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--vt-text-3)]">
            {domain.sourceLabel}
          </div>
          {domain.lastChecked ? (
            <div className="text-[11px] text-[var(--vt-text-3)]" title={formatAbsoluteTime(domain.lastChecked)}>
              {formatRelativeTime(domain.lastChecked)}
            </div>
          ) : null}
        </div>
        <span
          className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--vt-border)] text-[var(--vt-text-2)]"
          style={{
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 200ms var(--vt-ease-standard)',
          }}
          aria-hidden="true"
        >
          &gt;
        </span>
      </div>
    </button>
  );
}

function DomainPanel({ domain, compact, isOpen }: { domain: TrustDomain; compact: boolean; isOpen: boolean }) {
  return (
    <div
      className="overflow-hidden"
      style={{
        maxHeight: isOpen ? (compact ? '36rem' : '48rem') : '0px',
        opacity: isOpen ? 1 : 0,
        transition: 'max-height 200ms var(--vt-ease-standard), opacity 200ms var(--vt-ease-standard)',
      }}
    >
      <div className={`border-t border-[var(--vt-border)] ${compact ? 'px-3 py-3' : 'px-4 py-4'}`}>
        <div className="space-y-1">
          {domain.rows.map((row) => (
            <FieldRow key={row.label} label={row.label} value={row.value} compact={compact} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SourceCoverageTag
            source={domain.coverage.sourceId}
            status={domain.coverage.state}
            decisionGrade={domain.coverage.decisionGrade}
            lastChecked={domain.coverage.lastChecked ?? undefined}
          />
        </div>
        {domain.note ? (
          <p className="mt-3 text-xs leading-6 text-[var(--vt-text-2)]">{domain.note}</p>
        ) : null}
      </div>
    </div>
  );
}

export interface TrustDomainViewProps {
  passport: PassportData;
  compact?: boolean;
}

export function TrustDomainView({ passport, compact = false }: TrustDomainViewProps) {
  const domains = [
    resolveIdentityDomain(passport),
    resolveSafetyDomain(passport),
    resolveLicensureDomain(passport),
    resolveBoardDomain(passport),
    resolveEligibilityDomain(passport),
  ];
  const [openDomain, setOpenDomain] = useState<number | null>(compact ? null : 0);

  return (
    <section className={`rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] ${compact ? '' : 'shadow-[var(--vt-shadow-sm)]'}`}>
      <div className={`border-b border-[var(--vt-border)] ${compact ? 'px-3 py-2.5' : 'px-4 py-3.5'}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Trust domains</p>
      </div>
      <div className="divide-y divide-[var(--vt-border)]">
        {domains.map((domain, index) => {
          const isOpen = openDomain === index;

          return (
            <div key={domain.id}>
              <DomainHeader
                domain={domain}
                compact={compact}
                isOpen={isOpen}
                onToggle={() => setOpenDomain(isOpen ? null : index)}
              />
              <DomainPanel domain={domain} compact={compact} isOpen={isOpen} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default TrustDomainView;
