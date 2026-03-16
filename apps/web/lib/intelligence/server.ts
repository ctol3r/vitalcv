import 'server-only';

import { fetchBackendJson } from '@/app/api/intelligence/_shared';
import type {
  ActionDetailResponse,
  InvestigatorFindingDetailResponse,
  ProviderDetailResponse,
  PublicProviderProfile,
  StorylineDetailResponse,
} from './detail-types';
import {
  normalizeActionDetailResponse,
  normalizeFindingDetailResponse,
} from './detail-normalizers';

const NPI_RE = /^\d{10}$/;
const ACTIVE_STORYLINE_STATUSES = new Set(['active', 'quiet', 'escalated']);

type ProviderPassportResponse = {
  public?: {
    name?: string;
    specialty?: string;
    providerType?: string;
    state?: string;
    readinessScore?: number;
    totalCredentials?: number;
    activeCredentials?: number;
  };
  credentials?: ProviderDetailResponse['credentials'];
};

type IdentitySummaryResponse = {
  identity?: {
    firstName?: string | null;
    lastName?: string | null;
    credential?: string | null;
    npiStatus?: string | null;
    enumerationType?: string | null;
    specialties?: Array<{
      code?: string | null;
      description?: string | null;
      isPrimary?: boolean;
    }>;
    practiceStates?: string[];
  } | null;
};

type IdentityClaimsResponse = {
  claims?: Array<{
    claimType?: string;
    value?: Record<string, unknown> | null;
  }>;
};

type FindingListResponse = {
  findings?: ProviderDetailResponse['findings'];
  total?: number;
};

type StorylineListResponse = {
  storylines?: Array<ProviderDetailResponse['storylines'][number] & {
    fingerprint?: string;
    findingIds?: string[];
  }>;
  total?: number;
};

type ActionListResponse = {
  actions?: ProviderDetailResponse['actions'];
  total?: number;
};

type ProviderIntelligenceAggregateResponse = {
  aggregate?: NonNullable<ProviderDetailResponse['intelligence']>;
};

type ProviderSignalSummaryResponse = NonNullable<ProviderDetailResponse['signals']>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function dedupeBy<T>(items: T[], keyForItem: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyForItem(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  return dedupeBy(
    values
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0),
    (value) => value.toLowerCase(),
  );
}

function resolveProviderNpi(finding: InvestigatorFindingDetailResponse['finding']): string | null {
  const metadataNpi = asString(asRecord(finding.metadata).npi);
  if (metadataNpi && NPI_RE.test(metadataNpi)) {
    return metadataNpi;
  }

  for (const entityId of finding.entityIds) {
    if (NPI_RE.test(entityId)) {
      return entityId;
    }

    const match = entityId.match(/(\d{10})/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

async function loadRelatedStoryline(
  finding: InvestigatorFindingDetailResponse['finding'],
): Promise<InvestigatorFindingDetailResponse['relatedStoryline']> {
  if (!finding.storylineKey) {
    return null;
  }

  const providerNpi = resolveProviderNpi(finding);
  if (!providerNpi) {
    return null;
  }

  const upstream = await fetchBackendJson<StorylineListResponse>(
    '/api/storylines',
    new URLSearchParams({
      provider: providerNpi,
      limit: '100',
      sync: 'false',
    }),
  );

  if (!upstream.ok) {
    return null;
  }

  const storyline = (upstream.payload.storylines ?? []).find((candidate) => (
    candidate.fingerprint === finding.storylineKey
    || (candidate.findingIds ?? []).includes(finding.findingId)
  ));

  return storyline
    ? {
        storylineId: storyline.storylineId,
        title: storyline.title,
        severity: storyline.severity,
        status: storyline.status,
      }
    : null;
}

function parseActionDueAt(
  metadata: Record<string, unknown>,
): string | null {
  const value = (
    asString(metadata.dueAt)
    ?? asString(metadata.dueDate)
    ?? asString(metadata.deadline)
    ?? asString(metadata.expiresAt)
  );

  return value ?? null;
}

function resolveProviderName(
  npi: string,
  passport: ProviderPassportResponse['public'] | undefined,
  identity: IdentitySummaryResponse['identity'],
): string {
  const fromPassport = asString(passport?.name);
  if (fromPassport) {
    return fromPassport;
  }

  const identityName = [asString(identity?.firstName), asString(identity?.lastName)]
    .filter((value): value is string => Boolean(value))
    .join(' ');
  return identityName || `Provider ${npi}`;
}

function buildProviderSpecialties(
  passport: ProviderPassportResponse['public'] | undefined,
  identity: IdentitySummaryResponse['identity'],
  claims: IdentityClaimsResponse['claims'],
): string[] {
  const fromIdentity = (identity?.specialties ?? [])
    .map((specialty) => asString(specialty.description) ?? asString(specialty.code))
    .filter((value): value is string => Boolean(value));
  const fromClaims = (claims ?? [])
    .filter((claim) => claim.claimType === 'SPECIALTY')
    .map((claim) => {
      const value = asRecord(claim.value);
      return asString(value.taxonomyDescription) ?? asString(value.taxonomyCode);
    })
    .filter((value): value is string => Boolean(value));

  return dedupeStrings([
    asString(passport?.specialty),
    ...fromIdentity,
    ...fromClaims,
  ]);
}

function buildProviderIdentifiers(
  npi: string,
  identity: IdentitySummaryResponse['identity'],
  claims: IdentityClaimsResponse['claims'],
): ProviderDetailResponse['provider']['identifiers'] {
  const identifiers: ProviderDetailResponse['provider']['identifiers'] = [
    { label: 'NPI', value: npi },
  ];

  const credential = asString(identity?.credential);
  if (credential) {
    identifiers.push({ label: 'Credential', value: credential });
  }

  const enumerationType = asString(identity?.enumerationType);
  if (enumerationType) {
    identifiers.push({ label: 'Enumeration', value: enumerationType });
  }

  const npiStatus = asString(identity?.npiStatus);
  if (npiStatus) {
    identifiers.push({ label: 'NPI status', value: npiStatus });
  }

  for (const claim of claims ?? []) {
    const value = asRecord(claim.value);
    if (claim.claimType === 'SPECIALTY') {
      const taxonomyCode = asString(value.taxonomyCode);
      if (taxonomyCode) {
        identifiers.push({
          label: value.isPrimary === true ? 'Primary taxonomy' : 'Taxonomy',
          value: taxonomyCode,
        });
      }
    }

    if (claim.claimType === 'LICENSE' || claim.claimType === 'NURSING_LICENSE') {
      const licenseNumber = asString(value.licenseNumber);
      const state = asString(value.state);
      if (licenseNumber) {
        identifiers.push({
          label: state ? `License ${state}` : 'License',
          value: licenseNumber,
        });
      }
    }
  }

  return dedupeBy(identifiers, (identifier) => `${identifier.label}:${identifier.value}`);
}

function buildProviderLocations(
  identity: IdentitySummaryResponse['identity'],
  claims: IdentityClaimsResponse['claims'],
): ProviderDetailResponse['provider']['locations'] {
  const fromClaims = (claims ?? [])
    .filter((claim) => claim.claimType === 'PRACTICE_LOCATION')
    .map((claim) => {
      const value = asRecord(claim.value);
      const label = [
        asString(value.address1),
        asString(value.address2),
        asString(value.city),
        asString(value.state),
        asString(value.zip),
      ]
        .filter((part): part is string => Boolean(part))
        .join(', ');

      return {
        label: label || asString(value.state) || 'Practice location',
        state: asString(value.state),
      };
    })
    .filter((location) => location.label.trim().length > 0);

  if (fromClaims.length > 0) {
    return dedupeBy(fromClaims, (location) => `${location.label}:${location.state ?? ''}`);
  }

  return dedupeBy(
    (identity?.practiceStates ?? [])
      .map((state) => state.trim())
      .filter((state) => state.length > 0)
      .map((state) => ({ label: state, state })),
    (location) => `${location.label}:${location.state ?? ''}`,
  );
}

export async function loadFindingDetail(findingId: string) {
  const upstream = await fetchBackendJson<InvestigatorFindingDetailResponse>(
    `/api/investigators/findings/${encodeURIComponent(findingId)}`,
  );

  if (upstream.status === 404) {
    return null;
  }

  if (!upstream.ok) {
    throw new Error(`Finding detail request failed with ${upstream.status}`);
  }

  const normalized = normalizeFindingDetailResponse(upstream.payload);
  const relatedStoryline = await loadRelatedStoryline(normalized.finding);
  return {
    ...normalized,
    finding: {
      ...normalized.finding,
      storylineId: relatedStoryline?.storylineId ?? null,
      storylineTitle: relatedStoryline?.title ?? null,
    },
    relatedStoryline,
  };
}

export async function loadStorylineDetail(storylineId: string) {
  const upstream = await fetchBackendJson<StorylineDetailResponse>(
    `/api/storylines/${encodeURIComponent(storylineId)}`,
    new URLSearchParams({ sync: 'false' }),
  );

  if (upstream.status === 404) {
    return null;
  }

  if (!upstream.ok) {
    throw new Error(`Storyline detail request failed with ${upstream.status}`);
  }

  return upstream.payload;
}

export async function loadActionDetail(actionId: string) {
  const upstream = await fetchBackendJson<ActionDetailResponse>(
    `/api/actions/${encodeURIComponent(actionId)}`,
  );

  if (upstream.status === 404) {
    return null;
  }

  if (!upstream.ok) {
    throw new Error(`Action detail request failed with ${upstream.status}`);
  }

  const normalized = normalizeActionDetailResponse(upstream.payload);
  return {
    ...normalized,
    action: {
      ...normalized.action,
      dueAt: parseActionDueAt(asRecord(normalized.action.metadata)),
    },
  };
}

export async function loadProviderDetail(npi: string): Promise<ProviderDetailResponse | null> {
  const [profile, passport, identity, claims, findings, storylines, actions, intelligenceAggregate, signalSummary] = await Promise.all([
    fetchBackendJson<PublicProviderProfile>(`/api/public/profile/npi/${encodeURIComponent(npi)}`),
    fetchBackendJson<ProviderPassportResponse>(`/api/passport/${encodeURIComponent(npi)}`),
    fetchBackendJson<IdentitySummaryResponse>(`/api/identity/${encodeURIComponent(npi)}`),
    fetchBackendJson<IdentityClaimsResponse>(
      `/api/identity/${encodeURIComponent(npi)}/claims`,
      new URLSearchParams({ status: 'ACTIVE', limit: '200' }),
    ),
    fetchBackendJson<FindingListResponse>(
      '/api/investigators/findings',
      new URLSearchParams({ provider: npi, limit: '12' }),
    ),
    fetchBackendJson<StorylineListResponse>(
      '/api/storylines',
      new URLSearchParams({ provider: npi, limit: '100', sync: 'false' }),
    ),
    fetchBackendJson<ActionListResponse>(
      '/api/actions',
      new URLSearchParams({ entity: npi, limit: '12' }),
    ),
    fetchBackendJson<ProviderIntelligenceAggregateResponse>(
      `/api/intelligence/aggregates/providers/${encodeURIComponent(npi)}`,
    ),
    fetchBackendJson<ProviderSignalSummaryResponse>(
      `/api/provider-intelligence/${encodeURIComponent(npi)}`,
      new URLSearchParams({ limit: '20', sync: 'false' }),
    ),
  ]);

  if (profile.status === 404) {
    return null;
  }

  if (!profile.ok) {
    throw new Error(`Provider detail request failed with ${profile.status}`);
  }

  const identitySummary = identity.ok ? identity.payload.identity ?? null : null;
  const activeClaims = claims.ok ? claims.payload.claims ?? [] : [];
  const passportPublic = passport.ok ? passport.payload.public : undefined;
  const providerSignals = signalSummary.ok ? signalSummary.payload : null;
  const trustScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        typeof providerSignals?.trust.score === 'number'
          ? providerSignals.trust.score
          : typeof passportPublic?.readinessScore === 'number'
            ? passportPublic.readinessScore
            : profile.payload.readinessScore,
      ),
    ),
  );
  const findingCount = findings.ok ? findings.payload.total ?? (findings.payload.findings ?? []).length : 0;
  const storylineItems = storylines.ok ? storylines.payload.storylines ?? [] : [];
  const activeStorylineCount = storylineItems.filter((storyline) => (
    ACTIVE_STORYLINE_STATUSES.has(storyline.status.toLowerCase())
  )).length;

  const fallbackCredentials = profile.payload.artifactSummaries.map((artifact) => ({
    id: artifact.artifactId,
    type: artifact.issuer,
    name: artifact.issuer,
    issuer: artifact.issuer,
    status: artifact.status,
    verifiedAt: artifact.verifiedAt,
    expiresAt: artifact.expiresAt,
    isPublic: true,
  }));

  return {
    provider: {
      npi,
      fullName: resolveProviderName(npi, passportPublic, identitySummary),
      providerType: asString(passportPublic?.providerType),
      credential: asString(identitySummary?.credential),
      npiStatus: asString(identitySummary?.npiStatus),
      enumerationType: asString(identitySummary?.enumerationType),
      specialties: buildProviderSpecialties(passportPublic, identitySummary, activeClaims),
      identifiers: buildProviderIdentifiers(npi, identitySummary, activeClaims),
      locations: buildProviderLocations(identitySummary, activeClaims),
      trustScore,
      riskScore: Math.max(0, 100 - trustScore),
      findingCount,
      activeStorylineCount,
      totalCredentialCount: typeof passportPublic?.totalCredentials === 'number'
        ? passportPublic.totalCredentials
        : profile.payload.artifactSummaries.length,
      activeCredentialCount: typeof passportPublic?.activeCredentials === 'number'
        ? passportPublic.activeCredentials
        : profile.payload.activeCredentials.length,
    },
    profile: profile.payload,
    credentials: passport.ok ? passport.payload.credentials ?? fallbackCredentials : fallbackCredentials,
    findings: findings.ok ? (findings.payload.findings ?? []).slice(0, 6) : [],
    storylines: storylineItems.slice(0, 6),
    actions: actions.ok ? (actions.payload.actions ?? []).slice(0, 6) : [],
    signals: providerSignals,
    intelligence: intelligenceAggregate.ok ? intelligenceAggregate.payload.aggregate ?? null : null,
  };
}
