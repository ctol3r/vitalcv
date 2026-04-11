function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

function parseDate(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareDateDesc(left: string | null, right: string | null): number {
  const leftParsed = parseDate(left) ?? Number.NEGATIVE_INFINITY;
  const rightParsed = parseDate(right) ?? Number.NEGATIVE_INFINITY;
  return rightParsed - leftParsed;
}

function uniqueValues(values: Array<string | null>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    const key = normalizeName(value);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(value);
  }

  return output;
}

function roundConfidence(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score * 100)));
}

function isVerifiedTier(tier: string): boolean {
  return tier === 'GOLD' || tier === 'SILVER';
}

const ACTIVE_STATUSES = new Set(['ACTIVE', 'UNVERIFIED', 'EXPIRED']);

export interface EmploymentClaim {
  id: string;
  employerName: string;
  title: string | null;
  department: string | null;
  startDate: string | null;
  endDate: string | null;
  observedAt: string;
  confidenceScore: number;
  sourceId: string;
  tier: string;
  reviewRequired: boolean;
  reviewReason: string | null;
  status: string;
}

export interface IdentityEmploymentClaimInput {
  claimId?: string;
  claimType?: string;
  value?: Record<string, unknown> | null;
  status?: string;
  sourceId?: string;
  tier?: string;
  confidenceScore?: number;
  reviewRequired?: boolean;
  reviewReason?: string | null;
  observedAt?: string;
}

export interface EmploymentGraphClaim extends EmploymentClaim {
  current: boolean;
  confidence: number;
  verified: boolean;
  inferred: boolean;
}

export interface EmploymentConflictFlag {
  kind: 'status_mismatch' | 'title_mismatch' | 'start_date_mismatch';
  explanation: string;
}

export interface EmploymentNode {
  id: string;
  employerName: string;
  claims: EmploymentGraphClaim[];
  current: boolean;
  verified: boolean;
  inferred: boolean;
  confidence: number;
  conflictFlags: EmploymentConflictFlag[];
  latestStartDate: string | null;
  latestObservedAt: string | null;
}

export interface EmploymentGraph {
  groupedEmployers: EmploymentNode[];
  currentEmployers: EmploymentNode[];
}

function isCurrentClaim(claim: EmploymentClaim, now = Date.now()): boolean {
  const endDate = parseDate(claim.endDate);
  return endDate === null || endDate >= now;
}

function toGraphClaim(claim: EmploymentClaim): EmploymentGraphClaim {
  const tier = claim.tier.trim().toUpperCase();
  const verified = !claim.reviewRequired && isVerifiedTier(tier);

  return {
    ...claim,
    current: isCurrentClaim(claim),
    confidence: roundConfidence(claim.confidenceScore),
    verified,
    inferred: !verified,
  };
}

function buildConflictFlags(claims: EmploymentGraphClaim[]): EmploymentConflictFlag[] {
  const activeClaims = claims.filter((claim) => claim.current);
  const inactiveClaims = claims.filter((claim) => !claim.current);
  const conflictFlags: EmploymentConflictFlag[] = [];

  if (activeClaims.length > 0 && inactiveClaims.length > 0) {
    conflictFlags.push({
      kind: 'status_mismatch',
      explanation: 'Some sources still mark this employer as current while others show it as ended.',
    });
  }

  const titles = uniqueValues(claims.map((claim) => claim.title));
  if (titles.length > 1) {
    conflictFlags.push({
      kind: 'title_mismatch',
      explanation: `Sources disagree on role title: ${titles.join(' vs ')}.`,
    });
  }

  const startDates = uniqueValues(activeClaims.map((claim) => claim.startDate));
  if (startDates.length > 1) {
    const parsedDates = startDates
      .map((value) => parseDate(value))
      .filter((value): value is number => value !== null)
      .sort((left, right) => left - right);
    const spreadDays = parsedDates.length > 1
      ? Math.round((parsedDates[parsedDates.length - 1] - parsedDates[0]) / 86_400_000)
      : 0;

    if (spreadDays >= 45) {
      conflictFlags.push({
        kind: 'start_date_mismatch',
        explanation: 'Sources disagree on when this employment started.',
      });
    }
  }

  return conflictFlags;
}

function sortClaims(claims: EmploymentGraphClaim[]): EmploymentGraphClaim[] {
  return [...claims].sort((left, right) => {
    if (left.current !== right.current) {
      return left.current ? -1 : 1;
    }

    const byStartDate = compareDateDesc(left.startDate, right.startDate);
    if (byStartDate !== 0) {
      return byStartDate;
    }

    return compareDateDesc(left.observedAt, right.observedAt);
  });
}

function latestDate(claims: EmploymentGraphClaim[], field: 'startDate' | 'observedAt'): string | null {
  return claims
    .map((claim) => claim[field])
    .filter((value): value is string => Boolean(value))
    .sort(compareDateDesc)[0] ?? null;
}

export function buildEmploymentGraph(input: EmploymentClaim[]): EmploymentGraph {
  const groups = new Map<string, EmploymentGraphClaim[]>();

  for (const claim of input) {
    if (!ACTIVE_STATUSES.has(claim.status.trim().toUpperCase())) {
      continue;
    }

    const key = normalizeName(claim.employerName);
    if (!key) {
      continue;
    }

    const existing = groups.get(key) ?? [];
    existing.push(toGraphClaim(claim));
    groups.set(key, existing);
  }

  const groupedEmployers = [...groups.entries()]
    .map(([key, claims]) => {
      const sortedClaims = sortClaims(claims);
      const current = sortedClaims.some((claim) => claim.current);
      const verified = sortedClaims.some((claim) => claim.verified);

      return {
        id: `employment:${key}`,
        employerName: sortedClaims[0]?.employerName ?? key,
        claims: sortedClaims,
        current,
        verified,
        inferred: !verified,
        confidence: Math.max(...sortedClaims.map((claim) => claim.confidence), 0),
        conflictFlags: buildConflictFlags(sortedClaims),
        latestStartDate: latestDate(sortedClaims, 'startDate'),
        latestObservedAt: latestDate(sortedClaims, 'observedAt'),
      } satisfies EmploymentNode;
    })
    .sort((left, right) => {
      if (left.current !== right.current) {
        return left.current ? -1 : 1;
      }

      const byStartDate = compareDateDesc(left.latestStartDate, right.latestStartDate);
      if (byStartDate !== 0) {
        return byStartDate;
      }

      return compareDateDesc(left.latestObservedAt, right.latestObservedAt);
    });

  return {
    groupedEmployers,
    currentEmployers: groupedEmployers.filter((node) => node.current),
  };
}

export function employmentClaimFromIdentityClaim(
  claim: IdentityEmploymentClaimInput,
): EmploymentClaim | null {
  if (claim.claimType !== 'INSTITUTION_AFFILIATION') {
    return null;
  }

  const value = asRecord(claim.value);
  const affiliationType = asString(value.affiliationType)?.toUpperCase();
  if (affiliationType && affiliationType !== 'EMPLOYER') {
    return null;
  }

  const employerName = asString(value.institution)
    ?? asString(value.organizationName)
    ?? asString(value.groupName);
  const observedAt = asString(claim.observedAt);
  const sourceId = asString(claim.sourceId);

  if (!employerName || !observedAt || !sourceId) {
    return null;
  }

  return {
    id: asString(claim.claimId) ?? `${sourceId}:${normalizeName(employerName)}:${observedAt}`,
    employerName,
    title: asString(value.title),
    department: asString(value.department),
    startDate: asString(value.startDate),
    endDate: asString(value.endDate),
    observedAt,
    confidenceScore: typeof claim.confidenceScore === 'number' ? claim.confidenceScore : 0,
    sourceId,
    tier: asString(claim.tier)?.toUpperCase() ?? 'BRONZE',
    reviewRequired: claim.reviewRequired === true,
    reviewReason: asString(claim.reviewReason),
    status: asString(claim.status)?.toUpperCase() ?? 'ACTIVE',
  };
}

export function buildEmploymentGraphFromIdentityClaims(
  claims: IdentityEmploymentClaimInput[],
): EmploymentGraph {
  return buildEmploymentGraph(
    claims
      .map((claim) => employmentClaimFromIdentityClaim(claim))
      .filter((claim): claim is EmploymentClaim => claim !== null),
  );
}
