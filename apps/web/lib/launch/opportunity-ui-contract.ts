import type { OpportunitySummary } from './marketplace';

type SearchParamsLike = {
  get(name: string): string | null;
};

export interface OpportunityCardUiContract {
  levelExplanation: string;
  compensationLabel: string;
  lastSeenLabel: string | null;
}

export interface OpportunityPassportHandoffContext {
  roleId: string;
  roleTitle: string;
  employerSlug: string;
  employerName: string;
  canonicalOrgId: string;
  canonicalRoleId: string;
  readinessPreviewLink: string | null;
}

const LEVEL_EXPLANATIONS: Record<string, string> = {
  L1: 'L1: identity + one primary source has been checked.',
  L2: 'L2: identity, sanctions, and enrollment have all been checked against authoritative sources.',
  L3: 'L3: L2 plus board/credential verification attached with source-backed claims.',
};

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeCanonicalToken(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function collapseRepeatedDisplaySegments(value: string): string {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) {
    return '';
  }

  const segments = trimmed
    .split(/\s*[•·|/]\s*/g)
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean);

  const seen = new Set<string>();
  const unique: string[] = [];

  for (const segment of segments) {
    const normalized = normalizeCanonicalToken(segment);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    unique.push(segment);
  }

  return unique.join(' · ') || trimmed;
}

function formatLastSeenLabel(iso: string): string | null {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return 'Last seen today';
  if (days === 1) return 'Last seen yesterday';
  if (days < 30) return `Last seen ${days} days ago`;
  if (days < 90) return `Last seen ${Math.round(days / 7)} weeks ago`;
  return 'Last seen over 3 months ago';
}

function assertCanonicalField(value: string | null | undefined, label: string): string {
  const resolved = value?.trim();
  if (!resolved) {
    throw new Error(`Opportunity UI contract violation: missing ${label}`);
  }

  return resolved;
}

function resolveLevelExplanation(level: string): string {
  const explanation = LEVEL_EXPLANATIONS[level];
  if ((level === 'L2' || level === 'L3') && !explanation) {
    throw new Error(`Opportunity UI contract violation: missing explanation for ${level}`);
  }

  return explanation ?? 'Verification level is attached from the current source-backed record.';
}

function resolveCompensationLabel(opportunity: OpportunitySummary): string {
  if (opportunity.compensation_disclosure_status === 'undisclosed') {
    if (opportunity.payRange) {
      throw new Error('Opportunity UI contract violation: compensation disclosure conflicts with pay range');
    }

    return 'Compensation not disclosed by employer';
  }

  if (!opportunity.payRange) {
    throw new Error('Opportunity UI contract violation: compensation label is ambiguous');
  }

  return opportunity.payRange;
}

function assertNoDuplicateNormalizedField(value: string, label: string): void {
  if (collapseRepeatedDisplaySegments(value) !== normalizeWhitespace(value)) {
    throw new Error(`Opportunity UI contract violation: duplicate normalized ${label} survived to UI`);
  }
}

export function assertOpportunityCardUiContract(
  opportunity: OpportunitySummary,
): OpportunityCardUiContract {
  assertCanonicalField(opportunity.canonical_org_id, 'canonical_org_id');
  assertCanonicalField(opportunity.canonical_role_id, 'canonical_role_id');
  assertCanonicalField(opportunity.source_last_seen_at, 'source_last_seen_at');

  if (
    opportunity.freshness_status !== 'fresh'
    && opportunity.freshness_status !== 'aging'
    && opportunity.freshness_status !== 'stale'
    && opportunity.freshness_status !== 'unknown'
  ) {
    throw new Error('Opportunity UI contract violation: missing freshness_status');
  }

  if (Number.isNaN(Date.parse(opportunity.source_last_seen_at))) {
    throw new Error('Opportunity UI contract violation: source_last_seen_at must be a valid timestamp');
  }

  assertNoDuplicateNormalizedField(opportunity.title, 'title');
  assertNoDuplicateNormalizedField(opportunity.specialty, 'specialty');
  assertNoDuplicateNormalizedField(opportunity.hiringType, 'employment type');
  if (opportunity.roleType) {
    assertNoDuplicateNormalizedField(opportunity.roleType, 'role type');
  }

  if (opportunity.readiness_preview && opportunity.comparison) {
    if (
      opportunity.readiness_preview.clinician_npi !== opportunity.comparison.clinicianNpi
      || opportunity.readiness_preview.readiness_status !== opportunity.comparison.status
    ) {
      throw new Error('Opportunity UI contract violation: readiness preview linkage drifted');
    }
  }

  return {
    levelExplanation: resolveLevelExplanation(opportunity.requirementLevel),
    compensationLabel: resolveCompensationLabel(opportunity),
    lastSeenLabel: formatLastSeenLabel(opportunity.source_last_seen_at),
  };
}

export function buildOpportunityPassportHandoff(
  opportunity: OpportunitySummary,
): OpportunityPassportHandoffContext {
  assertOpportunityCardUiContract(opportunity);

  return {
    roleId: opportunity.id,
    roleTitle: opportunity.title,
    employerSlug: opportunity.organizationSlug,
    employerName: opportunity.organizationName,
    canonicalOrgId: opportunity.canonical_org_id,
    canonicalRoleId: opportunity.canonical_role_id,
    readinessPreviewLink: opportunity.readiness_preview ? opportunity.id : null,
  };
}

export function buildOpportunityPassportHref(opportunity: OpportunitySummary): string {
  const handoff = buildOpportunityPassportHandoff(opportunity);
  const params = new URLSearchParams();
  params.set('role', handoff.roleId);
  params.set('roleTitle', handoff.roleTitle);
  params.set('employer', handoff.employerSlug);
  params.set('employerName', handoff.employerName);
  params.set('canonicalOrgId', handoff.canonicalOrgId);
  params.set('canonicalRoleId', handoff.canonicalRoleId);
  if (handoff.readinessPreviewLink) {
    params.set('readinessPreviewLink', handoff.readinessPreviewLink);
  }
  return `/passport?${params.toString()}`;
}

export function parseOpportunityPassportHandoff(
  searchParams: SearchParamsLike | null | undefined,
): OpportunityPassportHandoffContext | null {
  if (!searchParams) {
    return null;
  }

  const roleId = searchParams.get('role');
  const roleTitle = searchParams.get('roleTitle');
  const employerSlug = searchParams.get('employer');
  const employerName = searchParams.get('employerName');
  const canonicalOrgId = searchParams.get('canonicalOrgId');
  const canonicalRoleId = searchParams.get('canonicalRoleId');
  const readinessPreviewLink = searchParams.get('readinessPreviewLink');

  const hasAnyContext = [
    roleId,
    roleTitle,
    employerSlug,
    employerName,
    canonicalOrgId,
    canonicalRoleId,
    readinessPreviewLink,
  ].some((value) => Boolean(value));

  if (!hasAnyContext) {
    return null;
  }

  if (!roleId || !roleTitle || !employerSlug || !employerName || !canonicalOrgId || !canonicalRoleId) {
    throw new Error('Opportunity handoff violation: incomplete passport context');
  }

  const normalizedEmployerSlug = normalizeCanonicalToken(employerSlug.replace(/[-_]+/g, ' '));
  if (normalizeCanonicalToken(canonicalOrgId) !== normalizedEmployerSlug) {
    throw new Error('Opportunity handoff violation: org identity drift detected');
  }

  const normalizedRoleTitle = normalizeCanonicalToken(roleTitle);
  if (!normalizeCanonicalToken(canonicalRoleId).startsWith(normalizedRoleTitle)) {
    throw new Error('Opportunity handoff violation: role identity drift detected');
  }

  if (readinessPreviewLink && readinessPreviewLink !== roleId) {
    throw new Error('Opportunity handoff violation: readiness preview linkage drift detected');
  }

  return {
    roleId,
    roleTitle,
    employerSlug,
    employerName,
    canonicalOrgId,
    canonicalRoleId,
    readinessPreviewLink,
  };
}
