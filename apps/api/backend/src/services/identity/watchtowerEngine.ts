import { createHash } from 'node:crypto';
import prisma, { Prisma } from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import type { NormalizedClaim } from './evidenceModel';
import {
  persistIdentityClaimDeltas,
  persistTrustAlertRecord,
  updateClaimRecordState,
} from './identityStore';
import { getSource, type EvidenceTier } from './sourceCatalog';
import {
  checksumForAlertGroup,
  createWatchlist,
  findRecentAlertByChecksum,
  listWatchlists,
  loadLatestSourceSnapshots,
  loadWatchtowerStateForNpi,
  persistAlertDeliveryAttempt,
  persistEntityChangeEvent,
  persistSourceStalenessEvent,
  persistTrustDegradationEvent,
  persistWatchlistHit,
  type CreateWatchlistInput,
  type MonitoringSeverity,
  type WatchlistRecord,
} from './watchtowerStore';

export type WatchtowerDeltaEventType =
  | 'CLAIM_ADDED'
  | 'CLAIM_CHANGED'
  | 'CLAIM_EXPIRED'
  | 'EXCLUSION_DETECTED'
  | 'LICENSE_STATUS_CHANGED'
  | 'NEW_SANCTION_HIT'
  | 'NEW_PAYMENT_RELATIONSHIP'
  | 'PROVIDER_MOVED_ORGANIZATION'
  | 'PROVIDER_MOVED_LOCATION'
  | 'LICENSE_STATE_CHANGED'
  | 'BOARD_CERT_STATUS_CHANGED'
  | 'SOURCE_STALE'
  | 'SOURCE_DISAPPEARED';

export type WatchtowerDeltaEvent = Readonly<{
  type: WatchtowerDeltaEventType;
  claimType: string;
  previous: unknown;
  current: unknown;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  fieldPath?: string;
}>;

export type SourceWatchtowerInput = Readonly<{
  npi: string;
  sourceId: string;
  sourceRunId?: string;
  sourceRecordId?: string;
  verificationArtifactId?: string | null;
  claims: readonly NormalizedClaim[];
  observedAt: string;
  matchingStrategy?: string;
  mergeReason?: string;
  conflictReason?: string;
  status: 'SUCCESS' | 'SKIPPED';
  replayedFromExistingArtifact?: boolean;
}>;

export type SourceWatchtowerResult = Readonly<{
  deltaEvents: readonly WatchtowerDeltaEvent[];
  persistedDeltas: number;
  alertsCreated: number;
  watchlistHits: number;
}>;

export type PersistedDeltaWatchtowerInput = Readonly<{
  npi: string;
  sourceId: string;
  sourceRunId?: string;
  sourceRecordId?: string;
  verificationArtifactId?: string | null;
  observedAt: string;
  events: ReadonlyArray<
    Readonly<{
      checksum: string;
      persistedDeltaId?: string | null;
      event: WatchtowerDeltaEvent & Readonly<{ trustTier?: string | null }>;
    }>
  >;
}>;

type ExistingArtifactRecord = Readonly<{
  id: string;
  rawPayload: Prisma.JsonValue | null;
  observedAt: Date | null;
}>;

type SourceArtifactClient = {
  verificationArtifact: {
    findFirst(args: Record<string, unknown>): Promise<ExistingArtifactRecord | null>;
  };
};

const sourceArtifactPrisma = prisma as unknown as SourceArtifactClient;

type DeltaCandidate = Readonly<{
  deltaType:
    | 'CLAIM_ADDED'
    | 'CLAIM_CHANGED'
    | 'CLAIM_EXPIRED'
    | 'EXCLUSION_DETECTED'
    | 'LICENSE_STATUS_CHANGED'
    | 'NEW_SANCTION_HIT'
    | 'NEW_PAYMENT_RELATIONSHIP'
    | 'PROVIDER_MOVED_ORGANIZATION'
    | 'PROVIDER_MOVED_LOCATION'
    | 'LICENSE_STATE_CHANGED'
    | 'BOARD_CERT_STATUS_CHANGED';
  eventType:
    | 'CLAIM_VALUE_CHANGED'
    | 'CLAIM_EXPIRED'
    | 'NEW_SANCTION_HIT'
    | 'NEW_PAYMENT_RELATIONSHIP'
    | 'PROVIDER_MOVED_ORGANIZATION'
    | 'PROVIDER_MOVED_LOCATION'
    | 'LICENSE_STATE_CHANGED'
    | 'LICENSE_STATUS_CHANGED'
    | 'BOARD_CERT_STATUS_CHANGED';
  claimType: string;
  fieldPath?: string;
  previousClaimId?: string | null;
  currentClaimId?: string | null;
  previousValue?: unknown;
  currentValue?: unknown;
  severity: MonitoringSeverity;
  organizationKeys: readonly string[];
  checksum: string;
  shouldSupersedePrevious: boolean;
  shouldExpirePrevious: boolean;
}>;

type AlertCandidate = Readonly<{
  type: string;
  subject: string;
  sourceId?: string | null;
  claimType?: string | null;
  fieldPath?: string | null;
  severity: MonitoringSeverity;
  title: string;
  description: string;
  recommendedAction: string;
  observedAt: string;
  currentValue?: unknown;
  organizationKeys: readonly string[];
  sourceRunId?: string | null;
  sourceRecordId?: string | null;
  verificationArtifactId?: string | null;
  identityDeltaId?: string | null;
  entityChangeEventId?: string | null;
  sourceStalenessEventId?: string | null;
  trustDegradationEventId?: string | null;
}>;

type SourceStalenessCandidate = Readonly<{
  sourceId: string;
  subjectNpi: string;
  status: 'STALE' | 'DISAPPEARED';
  severity: MonitoringSeverity;
  checksum: string;
  slaHours: number;
  trustTier: string | null;
  lastObservedAt?: string | null;
  staleSince: string;
  metadata?: Record<string, unknown>;
  deltaEvent: WatchtowerDeltaEvent;
  alert: AlertCandidate;
}>;

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => (typeof entry === 'string' && entry.trim().length > 0 ? [entry.trim()] : []))
    : [];
}

function severityRank(severity: MonitoringSeverity): number {
  const order: Record<MonitoringSeverity, number> = {
    INFO: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  };

  return order[severity];
}

function normalizeSeverityForReport(severity: MonitoringSeverity): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (severity === 'INFO') {
    return 'LOW';
  }

  return severity;
}

function normalizeStringSet(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function claimComparisonKey(claim: NormalizedClaim): string {
  const value = asObject(claim.value);
  switch (claim.claimType) {
    case 'PRACTICE_LOCATION':
    case 'MAILING_ADDRESS':
      return `${claim.claimType}:${asString(value.addressType) ?? 'LOCATION'}`;
    case 'INSTITUTION_AFFILIATION':
      return `${claim.claimType}:${asString(value.affiliationType) ?? 'UNKNOWN'}`;
    case 'GROUP_AFFILIATION':
      return claim.claimType;
    case 'LICENSE':
    case 'NURSING_LICENSE':
      return `${claim.claimType}:${asString(value.state) ?? 'UNKNOWN'}:${asString(value.licenseNumber) ?? 'UNKNOWN'}`;
    case 'BOARD_CERTIFICATION':
      return `${claim.claimType}:${asString(value.certifyingBoard) ?? 'UNKNOWN'}:${asString(value.specialty) ?? 'UNKNOWN'}`;
    case 'SPECIALTY':
      return `${claim.claimType}:${asString(value.taxonomyCode) ?? 'UNKNOWN'}`;
    case 'INDUSTRY_PAYMENT':
    case 'OWNERSHIP_INTEREST':
    case 'RESEARCH_PAYMENT':
      return `${claim.claimType}:${String(value.paymentYear ?? 'UNKNOWN')}`;
    default:
      return claim.claimType;
  }
}

function buildClaimMap(claims: readonly NormalizedClaim[]): Map<string, NormalizedClaim> {
  return new Map(
    claims
      .slice()
      .sort((left, right) => Date.parse(right.derivedAt) - Date.parse(left.derivedAt))
      .map((claim) => [claimComparisonKey(claim), claim]),
  );
}

function isExpiredClaim(claim: NormalizedClaim | null | undefined, nowIso: string): boolean {
  if (!claim) {
    return false;
  }

  if (claim.status === 'EXPIRED') {
    return true;
  }

  const expiry = claim.expiresAt ?? claim.validUntil;
  if (!expiry) {
    return false;
  }

  return Date.parse(expiry) <= Date.parse(nowIso);
}

function extractOrganizationKeys(claim: NormalizedClaim | null | undefined): string[] {
  if (!claim) {
    return [];
  }

  const value = asObject(claim.value);
  if (claim.claimType === 'INSTITUTION_AFFILIATION' || claim.claimType === 'GROUP_AFFILIATION') {
    return normalizeStringSet([
      asString(value.institution) ?? '',
      asString(value.department) ?? '',
      asString(value.source) ?? '',
    ]);
  }

  return [];
}

function extractOrganizationKeysFromPayload(previous: unknown, current: unknown): string[] {
  const previousValue = asObject(previous);
  const currentValue = asObject(current);

  return normalizeStringSet([
    asString(previousValue.institution) ?? '',
    asString(previousValue.department) ?? '',
    asString(currentValue.institution) ?? '',
    asString(currentValue.department) ?? '',
  ]);
}

function changedField(previousValue: Record<string, unknown>, currentValue: Record<string, unknown>, fields: readonly string[]): string | undefined {
  return fields.find((field) => stableHash(previousValue[field] ?? null) !== stableHash(currentValue[field] ?? null));
}

function deltaSeverityForClaim(claimType: string, deltaType: DeltaCandidate['deltaType'], currentValue: unknown): MonitoringSeverity {
  const value = asObject(currentValue);

  if (deltaType === 'NEW_SANCTION_HIT' || deltaType === 'EXCLUSION_DETECTED') {
    return 'CRITICAL';
  }

  if (deltaType === 'LICENSE_STATUS_CHANGED') {
    const status = asString(value.licenseStatus)?.toUpperCase();
    if (status === 'REVOKED') return 'CRITICAL';
    if (status === 'SUSPENDED' || status === 'EXPIRED') return 'HIGH';
    return 'MEDIUM';
  }

  if (deltaType === 'CLAIM_EXPIRED') {
    if (claimType === 'LICENSE' || claimType === 'NURSING_LICENSE') return 'HIGH';
    if (claimType === 'BOARD_CERTIFICATION') return 'MEDIUM';
    return 'LOW';
  }

  if (deltaType === 'BOARD_CERT_STATUS_CHANGED') {
    return 'MEDIUM';
  }

  if (deltaType === 'PROVIDER_MOVED_ORGANIZATION' || deltaType === 'PROVIDER_MOVED_LOCATION') {
    return 'MEDIUM';
  }

  if (deltaType === 'NEW_PAYMENT_RELATIONSHIP') {
    return 'LOW';
  }

  return 'LOW';
}

function summarizeDelta(
  previousClaim: NormalizedClaim | null,
  currentClaim: NormalizedClaim | null,
  nowIso: string,
): DeltaCandidate | null {
  if (!previousClaim && !currentClaim) {
    return null;
  }

  const claim = currentClaim ?? previousClaim;
  if (!claim) {
    return null;
  }

  const previousValue = previousClaim ? asObject(previousClaim.value) : {};
  const currentValue = currentClaim ? asObject(currentClaim.value) : {};
  const organizationKeys = normalizeStringSet([
    ...extractOrganizationKeys(previousClaim),
    ...extractOrganizationKeys(currentClaim),
  ]);

  if (!previousClaim && currentClaim) {
    let deltaType: DeltaCandidate['deltaType'] = 'CLAIM_ADDED';
    let eventType: DeltaCandidate['eventType'] = 'CLAIM_VALUE_CHANGED';
    if (claim.claimType === 'EXCLUSION_STATUS' && currentValue.excluded === true) {
      deltaType = 'NEW_SANCTION_HIT';
      eventType = 'NEW_SANCTION_HIT';
    } else if (
      claim.claimType === 'INDUSTRY_PAYMENT'
      || claim.claimType === 'OWNERSHIP_INTEREST'
      || claim.claimType === 'RESEARCH_PAYMENT'
    ) {
      deltaType = 'NEW_PAYMENT_RELATIONSHIP';
      eventType = 'NEW_PAYMENT_RELATIONSHIP';
    }

    const checksum = stableHash({
      claimId: currentClaim.claimId,
      deltaType,
      previousValue: null,
      currentValue: currentClaim.value,
    });

    return {
      deltaType,
      eventType,
      claimType: claim.claimType,
      previousClaimId: null,
      currentClaimId: currentClaim.claimId,
      previousValue: null,
      currentValue: currentClaim.value,
      severity: deltaSeverityForClaim(claim.claimType, deltaType, currentClaim.value),
      organizationKeys,
      checksum,
      shouldSupersedePrevious: false,
      shouldExpirePrevious: false,
    };
  }

  if (previousClaim && !currentClaim) {
    const deltaType: DeltaCandidate['deltaType'] = isExpiredClaim(previousClaim, nowIso)
      ? 'CLAIM_EXPIRED'
      : previousClaim.claimType === 'PRACTICE_LOCATION'
        ? 'PROVIDER_MOVED_LOCATION'
        : previousClaim.claimType === 'INSTITUTION_AFFILIATION' || previousClaim.claimType === 'GROUP_AFFILIATION'
          ? 'PROVIDER_MOVED_ORGANIZATION'
          : 'CLAIM_CHANGED';
    const eventType: DeltaCandidate['eventType'] =
      deltaType === 'CLAIM_EXPIRED'
        ? 'CLAIM_EXPIRED'
        : deltaType === 'PROVIDER_MOVED_LOCATION'
          ? 'PROVIDER_MOVED_LOCATION'
          : deltaType === 'PROVIDER_MOVED_ORGANIZATION'
            ? 'PROVIDER_MOVED_ORGANIZATION'
            : 'CLAIM_VALUE_CHANGED';

    return {
      deltaType,
      eventType,
      claimType: previousClaim.claimType,
      previousClaimId: previousClaim.claimId,
      currentClaimId: null,
      previousValue: previousClaim.value,
      currentValue: null,
      severity: deltaSeverityForClaim(previousClaim.claimType, deltaType, previousClaim.value),
      organizationKeys,
      checksum: stableHash({
        claimId: previousClaim.claimId,
        deltaType,
        previousValue: previousClaim.value,
        currentValue: null,
      }),
      shouldSupersedePrevious: deltaType !== 'CLAIM_EXPIRED',
      shouldExpirePrevious: deltaType === 'CLAIM_EXPIRED',
    };
  }

  if (!previousClaim || !currentClaim) {
    return null;
  }

  if (stableHash(previousClaim.value) === stableHash(currentClaim.value) && previousClaim.status === currentClaim.status) {
    if (isExpiredClaim(currentClaim, nowIso) && !isExpiredClaim(previousClaim, previousClaim.observedAt)) {
      return {
        deltaType: 'CLAIM_EXPIRED',
        eventType: 'CLAIM_EXPIRED',
        claimType: currentClaim.claimType,
        previousClaimId: previousClaim.claimId,
        currentClaimId: currentClaim.claimId,
        previousValue: previousClaim.value,
        currentValue: currentClaim.value,
        severity: deltaSeverityForClaim(currentClaim.claimType, 'CLAIM_EXPIRED', currentClaim.value),
        organizationKeys,
        checksum: stableHash({
          previousClaimId: previousClaim.claimId,
          currentClaimId: currentClaim.claimId,
          deltaType: 'CLAIM_EXPIRED',
          expiresAt: currentClaim.expiresAt ?? currentClaim.validUntil,
        }),
        shouldSupersedePrevious: false,
        shouldExpirePrevious: true,
      };
    }

    return null;
  }

  let deltaType: DeltaCandidate['deltaType'] = 'CLAIM_CHANGED';
  let eventType: DeltaCandidate['eventType'] = 'CLAIM_VALUE_CHANGED';
  let fieldPath: string | undefined;

  if (currentClaim.claimType === 'EXCLUSION_STATUS' && previousValue.excluded !== currentValue.excluded && currentValue.excluded === true) {
    deltaType = 'NEW_SANCTION_HIT';
    eventType = 'NEW_SANCTION_HIT';
    fieldPath = 'excluded';
  } else if (currentClaim.claimType === 'LICENSE' || currentClaim.claimType === 'NURSING_LICENSE') {
    if (previousValue.state !== currentValue.state) {
      deltaType = 'LICENSE_STATE_CHANGED';
      eventType = 'LICENSE_STATE_CHANGED';
      fieldPath = 'state';
    } else if (previousValue.licenseStatus !== currentValue.licenseStatus) {
      deltaType = 'LICENSE_STATUS_CHANGED';
      eventType = 'LICENSE_STATUS_CHANGED';
      fieldPath = 'licenseStatus';
    } else if (isExpiredClaim(currentClaim, nowIso)) {
      deltaType = 'CLAIM_EXPIRED';
      eventType = 'CLAIM_EXPIRED';
      fieldPath = 'expiryDate';
    }
  } else if (currentClaim.claimType === 'BOARD_CERTIFICATION') {
    if (previousValue.certificationStatus !== currentValue.certificationStatus) {
      deltaType = 'BOARD_CERT_STATUS_CHANGED';
      eventType = 'BOARD_CERT_STATUS_CHANGED';
      fieldPath = 'certificationStatus';
    }
  } else if (currentClaim.claimType === 'PRACTICE_LOCATION' || currentClaim.claimType === 'MAILING_ADDRESS') {
    deltaType = 'PROVIDER_MOVED_LOCATION';
    eventType = 'PROVIDER_MOVED_LOCATION';
    fieldPath = changedField(previousValue, currentValue, ['address1', 'address2', 'city', 'state', 'zip']);
  } else if (currentClaim.claimType === 'INSTITUTION_AFFILIATION' || currentClaim.claimType === 'GROUP_AFFILIATION') {
    deltaType = 'PROVIDER_MOVED_ORGANIZATION';
    eventType = 'PROVIDER_MOVED_ORGANIZATION';
    fieldPath = changedField(previousValue, currentValue, ['institution', 'department', 'title', 'affiliationType']);
  } else if (
    currentClaim.claimType === 'INDUSTRY_PAYMENT'
    || currentClaim.claimType === 'OWNERSHIP_INTEREST'
    || currentClaim.claimType === 'RESEARCH_PAYMENT'
  ) {
    deltaType = 'NEW_PAYMENT_RELATIONSHIP';
    eventType = 'NEW_PAYMENT_RELATIONSHIP';
    fieldPath = changedField(previousValue, currentValue, ['totalAmount', 'paymentTypes', 'topPayers']);
  } else if (isExpiredClaim(currentClaim, nowIso)) {
    deltaType = 'CLAIM_EXPIRED';
    eventType = 'CLAIM_EXPIRED';
  }

  return {
    deltaType,
    eventType,
    claimType: currentClaim.claimType,
    fieldPath,
    previousClaimId: previousClaim.claimId,
    currentClaimId: currentClaim.claimId,
    previousValue: previousClaim.value,
    currentValue: currentClaim.value,
    severity: deltaSeverityForClaim(currentClaim.claimType, deltaType, currentClaim.value),
    organizationKeys,
    checksum: stableHash({
      previousClaimId: previousClaim.claimId,
      currentClaimId: currentClaim.claimId,
      deltaType,
      fieldPath: fieldPath ?? null,
      previousValue: previousClaim.value,
      currentValue: currentClaim.value,
    }),
    shouldSupersedePrevious: deltaType !== 'CLAIM_EXPIRED' && previousClaim.claimId !== currentClaim.claimId,
    shouldExpirePrevious: deltaType === 'CLAIM_EXPIRED',
  };
}

function buildAlertCandidateFromDelta(
  delta: DeltaCandidate,
  subject: string,
  sourceId: string,
  observedAt: string,
  entityChangeEventId?: string | null,
): AlertCandidate | null {
  if (severityRank(delta.severity) < severityRank('MEDIUM') && delta.deltaType !== 'NEW_PAYMENT_RELATIONSHIP') {
    return null;
  }

  if (delta.deltaType === 'NEW_PAYMENT_RELATIONSHIP' && severityRank(delta.severity) < severityRank('LOW')) {
    return null;
  }

  const titleByType: Record<DeltaCandidate['deltaType'], string> = {
    CLAIM_ADDED: `New ${delta.claimType} claim observed`,
    CLAIM_CHANGED: `${delta.claimType} value changed`,
    CLAIM_EXPIRED: `${delta.claimType} expired`,
    EXCLUSION_DETECTED: 'Exclusion signal changed',
    LICENSE_STATUS_CHANGED: 'License status changed',
    NEW_SANCTION_HIT: 'New sanction or exclusion hit',
    NEW_PAYMENT_RELATIONSHIP: 'New payment relationship observed',
    PROVIDER_MOVED_ORGANIZATION: 'Provider organization changed',
    PROVIDER_MOVED_LOCATION: 'Provider location changed',
    LICENSE_STATE_CHANGED: 'License state changed',
    BOARD_CERT_STATUS_CHANGED: 'Board certification changed',
  };
  const descriptionByType: Record<DeltaCandidate['deltaType'], string> = {
    CLAIM_ADDED: `A new ${delta.claimType} claim was derived from ${sourceId}.`,
    CLAIM_CHANGED: `${delta.claimType} changed in ${sourceId}.`,
    CLAIM_EXPIRED: `${delta.claimType} is no longer current in ${sourceId}.`,
    EXCLUSION_DETECTED: `Exclusion status changed for ${subject} in ${sourceId}.`,
    LICENSE_STATUS_CHANGED: `License status changed for ${subject} in ${sourceId}.`,
    NEW_SANCTION_HIT: `A new sanction or exclusion hit was detected for ${subject}.`,
    NEW_PAYMENT_RELATIONSHIP: `A new payment relationship was detected for ${subject}.`,
    PROVIDER_MOVED_ORGANIZATION: `Provider affiliation changed for ${subject}.`,
    PROVIDER_MOVED_LOCATION: `Provider location changed for ${subject}.`,
    LICENSE_STATE_CHANGED: `License issuing state changed for ${subject}.`,
    BOARD_CERT_STATUS_CHANGED: `Board certification status changed for ${subject}.`,
  };
  const actionByType: Record<DeltaCandidate['deltaType'], string> = {
    CLAIM_ADDED: 'Review the new evidence and confirm it should affect downstream trust decisions.',
    CLAIM_CHANGED: 'Review the changed claim and confirm downstream trust state remains correct.',
    CLAIM_EXPIRED: 'Re-verify the expired claim or route to human review.',
    EXCLUSION_DETECTED: 'Immediately review the exclusion signal and block sensitive workflows if confirmed.',
    LICENSE_STATUS_CHANGED: 'Review the license status change and suspend privileged actions if required.',
    NEW_SANCTION_HIT: 'Escalate to manual review before allowing further credential use.',
    NEW_PAYMENT_RELATIONSHIP: 'Review the financial relationship for disclosure or compliance impact.',
    PROVIDER_MOVED_ORGANIZATION: 'Review org affiliation changes and refresh dependent rosters or privileges.',
    PROVIDER_MOVED_LOCATION: 'Review location changes and refresh dependent rosters or routing.',
    LICENSE_STATE_CHANGED: 'Review interstate licensure implications and compact coverage.',
    BOARD_CERT_STATUS_CHANGED: 'Review certification status and any affected privileging requirements.',
  };

  return {
    type:
      delta.deltaType === 'CLAIM_EXPIRED'
        ? 'credential_expiring'
        : delta.deltaType === 'NEW_SANCTION_HIT' || delta.deltaType === 'LICENSE_STATUS_CHANGED'
          ? 'credential_revoked'
          : delta.deltaType === 'NEW_PAYMENT_RELATIONSHIP'
            ? 'claim_delta'
            : 'watchtower_delta',
    subject,
    sourceId,
    claimType: delta.claimType,
    fieldPath: delta.fieldPath ?? null,
    severity: delta.severity,
    title: titleByType[delta.deltaType],
    description: descriptionByType[delta.deltaType],
    recommendedAction: actionByType[delta.deltaType],
    observedAt,
    currentValue: delta.currentValue,
    organizationKeys: delta.organizationKeys,
    entityChangeEventId: entityChangeEventId ?? null,
  };
}

function stalenessSeverityForTier(tier: EvidenceTier | null): MonitoringSeverity {
  if (tier === 'GOLD') return 'HIGH';
  if (tier === 'SILVER') return 'MEDIUM';
  return 'LOW';
}

async function loadPreviousSourceClaims(
  npi: string,
  sourceId: string,
  currentArtifactId?: string | null,
): Promise<readonly NormalizedClaim[]> {
  const previous = await sourceArtifactPrisma.verificationArtifact.findFirst({
    where: {
      npi,
      source: sourceId,
      lifecycleState: 'active',
      ...(currentArtifactId ? { id: { not: currentArtifactId } } : {}),
    },
    orderBy: { observedAt: 'desc' },
    select: {
      id: true,
      rawPayload: true,
      observedAt: true,
    },
  });

  if (!previous) {
    return [];
  }

  const rawPayload = asObject(previous.rawPayload);
  return Object.freeze(
    (((rawPayload._claims ?? []) as NormalizedClaim[]).map((claim) => ({
      ...claim,
      artifactId: claim.artifactId || previous.id,
    }))),
  );
}

async function createAlertAndDeliveries(
  alert: AlertCandidate,
  watchlists: readonly WatchlistRecord[],
): Promise<{ created: number; watchlistHits: number }> {
  const matchingWatchlists = watchlists.filter((watchlist) => {
    if (!watchlist.active) {
      return false;
    }
    if (severityRank(alert.severity) < severityRank(watchlist.severityFloor)) {
      return false;
    }
    if (watchlist.targetType === 'PROVIDER') {
      return watchlist.targetValue === alert.subject;
    }
    if (watchlist.targetType === 'CLAIM_CLASS') {
      return Boolean(alert.claimType) && watchlist.targetValue === alert.claimType;
    }
    return alert.organizationKeys.includes(watchlist.targetValue);
  }).filter((watchlist) => {
    if (watchlist.claimType && watchlist.claimType !== alert.claimType) {
      return false;
    }
    if (watchlist.fieldPath && watchlist.fieldPath !== alert.fieldPath) {
      return false;
    }
    return true;
  });

  const suppressionWindowMinutes = matchingWatchlists.length > 0
    ? Math.min(...matchingWatchlists.map((watchlist) => watchlist.suppressionWindowMinutes))
    : 1440;
  const checksum = checksumForAlertGroup({
    subject: alert.subject,
    type: alert.type,
    sourceId: alert.sourceId,
    claimType: alert.claimType ?? null,
    fieldPath: alert.fieldPath ?? null,
    currentValue: alert.currentValue,
  });
  const windowStart = new Date(Date.now() - suppressionWindowMinutes * 60_000);
  const existing = await findRecentAlertByChecksum(alert.subject, checksum, windowStart);

  if (existing) {
    await persistAlertDeliveryAttempt({
      channel: 'INTERNAL_FEED',
      status: 'SUPPRESSED',
      dedupeKey: stableHash({
        checksum,
        existingAlertId: existing.alertId,
        status: 'SUPPRESSED',
      }),
      payload: {
        subject: alert.subject,
        checksum,
        existingAlertId: existing.alertId,
      },
    });
    return { created: 0, watchlistHits: 0 };
  }

  const persistedAlert = await persistTrustAlertRecord({
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    description: alert.description,
    subject: alert.subject,
    sourceRunId: alert.sourceRunId ?? undefined,
    sourceRecordId: alert.sourceRecordId ?? undefined,
    verificationArtifactId: alert.verificationArtifactId ?? null,
    identityDeltaId: alert.identityDeltaId ?? undefined,
    checksum,
    recommendedAction: alert.recommendedAction,
    observedAt: alert.observedAt,
  });

  if (!persistedAlert) {
    return { created: 0, watchlistHits: 0 };
  }

  await persistAlertDeliveryAttempt({
    trustAlertRecordId: persistedAlert.id,
    channel: 'INTERNAL_FEED',
    status: 'DELIVERED',
    destination: 'trust_alert_feed',
    dedupeKey: stableHash({
      trustAlertRecordId: persistedAlert.id,
      channel: 'INTERNAL_FEED',
    }),
    payload: {
      subject: alert.subject,
      type: alert.type,
      severity: alert.severity,
    },
  });

  let watchlistHitCount = 0;
  for (const watchlist of matchingWatchlists) {
    const hit = await persistWatchlistHit({
      watchlistId: watchlist.id,
      trustAlertRecordId: persistedAlert.id,
      entityChangeEventId: alert.entityChangeEventId ?? null,
      sourceStalenessEventId: alert.sourceStalenessEventId ?? null,
      trustDegradationEventId: alert.trustDegradationEventId ?? null,
      subjectNpi: alert.subject,
      organizationKey: alert.organizationKeys[0] ?? null,
      claimType: alert.claimType ?? null,
      fieldPath: alert.fieldPath ?? null,
      severity: alert.severity,
      observedAt: alert.observedAt,
      dedupeKey: stableHash({
        watchlistId: watchlist.id,
        trustAlertRecordId: persistedAlert.id,
        checksum,
      }),
      payload: {
        checksum,
        targetType: watchlist.targetType,
        targetValue: watchlist.targetValue,
      },
    });

    if (hit) {
      watchlistHitCount += 1;
    }

    const channels = watchlist.deliveryChannels.length > 0 ? watchlist.deliveryChannels : ['INTERNAL_FEED'];
    for (const channel of channels) {
      if (channel === 'INTERNAL_FEED') {
        continue;
      }

      if (channel === 'WEBHOOK' || channel === 'EVENT_SINK') {
        await persistAlertDeliveryAttempt({
          trustAlertRecordId: persistedAlert.id,
          watchlistId: watchlist.id,
          channel,
          destination: watchlist.webhookUrl ?? null,
          status: watchlist.webhookUrl ? 'PENDING' : 'NOT_CONFIGURED',
          dedupeKey: stableHash({
            trustAlertRecordId: persistedAlert.id,
            watchlistId: watchlist.id,
            channel,
            destination: watchlist.webhookUrl ?? null,
          }),
          payload: {
            subject: alert.subject,
            severity: alert.severity,
            type: alert.type,
            title: alert.title,
            description: alert.description,
          },
        });
        continue;
      }

      await persistAlertDeliveryAttempt({
        trustAlertRecordId: persistedAlert.id,
        watchlistId: watchlist.id,
        channel: channel as 'EMAIL' | 'SLACK',
        status: 'NOT_CONFIGURED',
        dedupeKey: stableHash({
          trustAlertRecordId: persistedAlert.id,
          watchlistId: watchlist.id,
          channel,
        }),
        payload: {
          subject: alert.subject,
          type: alert.type,
          severity: alert.severity,
        },
      });
    }
  }

  return { created: 1, watchlistHits: watchlistHitCount };
}

export async function evaluateSourceWatchtower(
  input: SourceWatchtowerInput,
): Promise<SourceWatchtowerResult> {
  if (input.replayedFromExistingArtifact) {
    return {
      deltaEvents: [],
      persistedDeltas: 0,
      alertsCreated: 0,
      watchlistHits: 0,
    };
  }

  const previousClaims = await loadPreviousSourceClaims(
    input.npi,
    input.sourceId,
    input.verificationArtifactId ?? null,
  );
  const watchlists = await listWatchlists({ activeOnly: true });

  if (input.status === 'SKIPPED') {
    if (previousClaims.length === 0) {
      return {
        deltaEvents: [],
        persistedDeltas: 0,
        alertsCreated: 0,
        watchlistHits: 0,
      };
    }

    const source = getSource(input.sourceId);
    const staleCandidate: SourceStalenessCandidate = {
      sourceId: input.sourceId,
      subjectNpi: input.npi,
      status: 'DISAPPEARED',
      severity: stalenessSeverityForTier(source?.tier ?? null),
      checksum: stableHash({
        subjectNpi: input.npi,
        sourceId: input.sourceId,
        status: 'DISAPPEARED',
        previousClaimIds: previousClaims.map((claim) => claim.claimId).sort(),
      }),
      slaHours: source?.refreshSlaHours ?? 24,
      trustTier: source?.tier ?? null,
      lastObservedAt: previousClaims[0]?.observedAt ?? null,
      staleSince: input.observedAt,
      metadata: {
        mergeReason: input.mergeReason ?? null,
        conflictReason: input.conflictReason ?? null,
      },
      deltaEvent: {
        type: 'SOURCE_DISAPPEARED',
        claimType: 'SOURCE_CAPTURE',
        previous: previousClaims.map((claim) => claim.claimId),
        current: null,
        severity: normalizeSeverityForReport(stalenessSeverityForTier(source?.tier ?? null)),
      },
      alert: {
        type: 'source_stale',
        subject: input.npi,
        sourceId: input.sourceId,
        severity: stalenessSeverityForTier(source?.tier ?? null),
        title: `${input.sourceId} no longer returned a record`,
        description: `${input.sourceId} did not return data for ${input.npi} even though prior evidence exists.`,
        recommendedAction: 'Re-run the source, verify the lookup key, and route to human review if the record genuinely disappeared.',
        observedAt: input.observedAt,
        organizationKeys: [],
        sourceRunId: input.sourceRunId ?? null,
        sourceRecordId: input.sourceRecordId ?? null,
        verificationArtifactId: input.verificationArtifactId ?? null,
      },
    };

    const persistedStaleness = await persistSourceStalenessEvent({
      sourceRunId: input.sourceRunId,
      sourceRecordId: input.sourceRecordId,
      verificationArtifactId: input.verificationArtifactId,
      subjectNpi: input.npi,
      sourceId: input.sourceId,
      status: staleCandidate.status,
      severity: staleCandidate.severity,
      slaHours: staleCandidate.slaHours,
      trustTier: staleCandidate.trustTier,
      lastObservedAt: staleCandidate.lastObservedAt ?? null,
      staleSince: staleCandidate.staleSince,
      metadata: staleCandidate.metadata,
      checksum: staleCandidate.checksum,
    });
    let alertsCreated = 0;
    let watchlistHits = 0;
    if (persistedStaleness) {
      const trustDegradation = await persistTrustDegradationEvent({
        sourceRunId: input.sourceRunId,
        sourceRecordId: input.sourceRecordId,
        verificationArtifactId: input.verificationArtifactId,
        sourceStalenessEventId: persistedStaleness.id,
        subjectNpi: input.npi,
        reason: 'SOURCE_DISAPPEARED',
        severity: staleCandidate.severity,
        description: `${input.sourceId} disappeared for ${input.npi}.`,
        observedAt: input.observedAt,
        checksum: stableHash({
          subjectNpi: input.npi,
          sourceId: input.sourceId,
          reason: 'SOURCE_DISAPPEARED',
          checksum: staleCandidate.checksum,
        }),
      });
      const alertResult = await createAlertAndDeliveries(
        {
          ...staleCandidate.alert,
          sourceStalenessEventId: persistedStaleness.id,
          trustDegradationEventId: trustDegradation?.id ?? null,
        },
        watchlists,
      );
      alertsCreated += alertResult.created;
      watchlistHits += alertResult.watchlistHits;
    }

    return {
      deltaEvents: [staleCandidate.deltaEvent],
      persistedDeltas: 0,
      alertsCreated,
      watchlistHits,
    };
  }

  const previousByKey = buildClaimMap(previousClaims);
  const currentByKey = buildClaimMap(input.claims);
  const comparisonKeys = new Set([...previousByKey.keys(), ...currentByKey.keys()]);
  const deltaCandidates = [...comparisonKeys]
    .map((key) => summarizeDelta(previousByKey.get(key) ?? null, currentByKey.get(key) ?? null, input.observedAt))
    .filter((candidate): candidate is DeltaCandidate => candidate !== null);

  if (deltaCandidates.length === 0) {
    return {
      deltaEvents: [],
      persistedDeltas: 0,
      alertsCreated: 0,
      watchlistHits: 0,
    };
  }

  const persistedDeltas = await persistIdentityClaimDeltas(
    deltaCandidates.map((candidate) => ({
      sourceRunId: input.sourceRunId,
      sourceRecordId: input.sourceRecordId,
      verificationArtifactId: input.verificationArtifactId,
      subjectNpi: input.npi,
      sourceId: input.sourceId,
      claimType: candidate.claimType,
      deltaType: candidate.deltaType,
      severity: normalizeSeverityForReport(candidate.severity),
      trustTier: getSource(input.sourceId)?.tier ?? null,
      previousClaimId: candidate.previousClaimId ?? null,
      currentClaimId: candidate.currentClaimId ?? null,
      previousValue: candidate.previousValue,
      currentValue: candidate.currentValue,
      matchingStrategy: input.matchingStrategy,
      mergeReason: input.mergeReason,
      conflictReason: input.conflictReason,
      observedAt: input.observedAt,
      checksum: candidate.checksum,
    })),
  );

  let alertsCreated = 0;
  let watchlistHits = 0;
  const persistedByChecksum = new Map(persistedDeltas.map((delta) => [delta.checksum, delta]));

  for (const candidate of deltaCandidates) {
    const persistedDelta = persistedByChecksum.get(candidate.checksum);
    if (!persistedDelta) {
      continue;
    }

    if (candidate.shouldSupersedePrevious && candidate.previousClaimId && candidate.currentClaimId) {
      await updateClaimRecordState({
        claimId: candidate.previousClaimId,
        subjectNpi: input.npi,
        status: 'SUPERSEDED',
        supersededByClaimId: candidate.currentClaimId,
      });
    }

    if (candidate.shouldExpirePrevious && candidate.previousClaimId) {
      await updateClaimRecordState({
        claimId: candidate.previousClaimId,
        subjectNpi: input.npi,
        status: 'EXPIRED',
        expiresAt: input.observedAt,
      });
    }

    const entityChangeEvent = await persistEntityChangeEvent({
      sourceRunId: input.sourceRunId,
      sourceRecordId: input.sourceRecordId,
      verificationArtifactId: input.verificationArtifactId,
      identityDeltaId: persistedDelta.id,
      subjectNpi: input.npi,
      sourceId: input.sourceId,
      claimType: candidate.claimType,
      fieldPath: candidate.fieldPath ?? null,
      eventType: candidate.eventType,
      severity: candidate.severity,
      previousValue: candidate.previousValue,
      currentValue: candidate.currentValue,
      observedAt: input.observedAt,
      checksum: stableHash({
        identityDeltaId: persistedDelta.id,
        eventType: candidate.eventType,
        fieldPath: candidate.fieldPath ?? null,
      }),
    });

    const trustDegradationReason =
      candidate.eventType === 'CLAIM_EXPIRED'
        ? 'CLAIM_EXPIRED'
        : candidate.eventType === 'NEW_SANCTION_HIT'
          ? 'NEW_SANCTION_HIT'
          : candidate.eventType === 'LICENSE_STATUS_CHANGED'
            ? 'LICENSE_STATUS_CHANGED'
            : candidate.eventType === 'BOARD_CERT_STATUS_CHANGED'
              ? 'BOARD_CERT_STATUS_CHANGED'
              : null;

    const trustDegradation = trustDegradationReason
      ? await persistTrustDegradationEvent({
          sourceRunId: input.sourceRunId,
          sourceRecordId: input.sourceRecordId,
          verificationArtifactId: input.verificationArtifactId,
          entityChangeEventId: entityChangeEvent?.id ?? null,
          subjectNpi: input.npi,
          claimType: candidate.claimType,
          reason: trustDegradationReason,
          severity: candidate.severity,
          description: `${candidate.claimType} triggered ${trustDegradationReason.toLowerCase()} for ${input.npi}.`,
          observedAt: input.observedAt,
          checksum: stableHash({
            subjectNpi: input.npi,
            identityDeltaId: persistedDelta.id,
            reason: trustDegradationReason,
          }),
        })
      : null;

    const alertCandidate = buildAlertCandidateFromDelta(
      candidate,
      input.npi,
      input.sourceId,
      input.observedAt,
      entityChangeEvent?.id ?? null,
    );

    if (alertCandidate) {
      const alertResult = await createAlertAndDeliveries(
        {
          ...alertCandidate,
          sourceRunId: input.sourceRunId ?? null,
          sourceRecordId: input.sourceRecordId ?? null,
          verificationArtifactId: input.verificationArtifactId ?? null,
          identityDeltaId: persistedDelta.id,
          trustDegradationEventId: trustDegradation?.id ?? null,
        },
        watchlists,
      );
      alertsCreated += alertResult.created;
      watchlistHits += alertResult.watchlistHits;
    }
  }

  return {
    deltaEvents: deltaCandidates.map((candidate) => ({
      type: candidate.deltaType,
      claimType: candidate.claimType,
      previous: candidate.previousValue ?? null,
      current: candidate.currentValue ?? null,
      severity: normalizeSeverityForReport(candidate.severity),
      ...(candidate.fieldPath ? { fieldPath: candidate.fieldPath } : {}),
    })),
    persistedDeltas: persistedDeltas.length,
    alertsCreated,
    watchlistHits,
  };
}

function eventTypeForDeltaEvent(event: WatchtowerDeltaEvent): DeltaCandidate['eventType'] {
  switch (event.type) {
    case 'CLAIM_EXPIRED':
      return 'CLAIM_EXPIRED';
    case 'EXCLUSION_DETECTED':
    case 'NEW_SANCTION_HIT':
      return 'NEW_SANCTION_HIT';
    case 'NEW_PAYMENT_RELATIONSHIP':
      return 'NEW_PAYMENT_RELATIONSHIP';
    case 'PROVIDER_MOVED_ORGANIZATION':
      return 'PROVIDER_MOVED_ORGANIZATION';
    case 'PROVIDER_MOVED_LOCATION':
      return 'PROVIDER_MOVED_LOCATION';
    case 'LICENSE_STATE_CHANGED':
      return 'LICENSE_STATE_CHANGED';
    case 'LICENSE_STATUS_CHANGED':
      return 'LICENSE_STATUS_CHANGED';
    case 'BOARD_CERT_STATUS_CHANGED':
      return 'BOARD_CERT_STATUS_CHANGED';
    default:
      return 'CLAIM_VALUE_CHANGED';
  }
}

function trustDegradationReasonForDeltaEvent(event: WatchtowerDeltaEvent):
  | 'CLAIM_EXPIRED'
  | 'NEW_SANCTION_HIT'
  | 'LICENSE_STATUS_CHANGED'
  | 'BOARD_CERT_STATUS_CHANGED'
  | null {
  switch (event.type) {
    case 'CLAIM_EXPIRED':
      return 'CLAIM_EXPIRED';
    case 'EXCLUSION_DETECTED':
    case 'NEW_SANCTION_HIT':
      return 'NEW_SANCTION_HIT';
    case 'LICENSE_STATUS_CHANGED':
      return 'LICENSE_STATUS_CHANGED';
    case 'BOARD_CERT_STATUS_CHANGED':
      return 'BOARD_CERT_STATUS_CHANGED';
    default:
      return null;
  }
}

export async function emitWatchtowerArtifactsForPersistedDeltas(
  input: PersistedDeltaWatchtowerInput,
): Promise<{ alertsCreated: number; watchlistHits: number }> {
  const watchlists = await listWatchlists({ activeOnly: true });
  let alertsCreated = 0;
  let watchlistHits = 0;

  for (const { checksum, persistedDeltaId, event } of input.events) {
    const organizationKeys = extractOrganizationKeysFromPayload(event.previous, event.current);
    const candidate: DeltaCandidate = {
      deltaType:
        event.type === 'EXCLUSION_DETECTED'
          ? 'NEW_SANCTION_HIT'
          : event.type === 'SOURCE_STALE' || event.type === 'SOURCE_DISAPPEARED'
            ? 'CLAIM_CHANGED'
            : (event.type as DeltaCandidate['deltaType']),
      eventType: eventTypeForDeltaEvent(event),
      claimType: event.claimType,
      fieldPath: event.fieldPath,
      previousValue: event.previous,
      currentValue: event.current,
      severity: event.severity,
      organizationKeys,
      checksum,
      shouldSupersedePrevious: false,
      shouldExpirePrevious: false,
    };

    const entityChangeEvent = await persistEntityChangeEvent({
      sourceRunId: input.sourceRunId,
      sourceRecordId: input.sourceRecordId,
      verificationArtifactId: input.verificationArtifactId,
      identityDeltaId: persistedDeltaId ?? null,
      subjectNpi: input.npi,
      sourceId: input.sourceId,
      claimType: event.claimType,
      fieldPath: event.fieldPath ?? null,
      eventType: candidate.eventType,
      severity: event.severity,
      previousValue: event.previous,
      currentValue: event.current,
      observedAt: input.observedAt,
      checksum: stableHash({
        sourceRunId: input.sourceRunId ?? null,
        persistedDeltaId: persistedDeltaId ?? null,
        eventType: candidate.eventType,
        checksum,
      }),
    });

    const trustReason = trustDegradationReasonForDeltaEvent(event);
    const trustDegradation = trustReason
      ? await persistTrustDegradationEvent({
          sourceRunId: input.sourceRunId,
          sourceRecordId: input.sourceRecordId,
          verificationArtifactId: input.verificationArtifactId,
          entityChangeEventId: entityChangeEvent?.id ?? null,
          subjectNpi: input.npi,
          claimType: event.claimType,
          reason: trustReason,
          severity: event.severity,
          description: `${event.claimType} triggered ${trustReason.toLowerCase()} for ${input.npi}.`,
          observedAt: input.observedAt,
          checksum: stableHash({
            trustReason,
            persistedDeltaId: persistedDeltaId ?? null,
            subjectNpi: input.npi,
          }),
        })
      : null;

    const alertCandidate = buildAlertCandidateFromDelta(
      candidate,
      input.npi,
      input.sourceId,
      input.observedAt,
      entityChangeEvent?.id ?? null,
    );

    if (!alertCandidate) {
      continue;
    }

    const alertResult = await createAlertAndDeliveries(
      {
        ...alertCandidate,
        sourceRunId: input.sourceRunId ?? null,
        sourceRecordId: input.sourceRecordId ?? null,
        verificationArtifactId: input.verificationArtifactId ?? null,
        identityDeltaId: persistedDeltaId ?? null,
        trustDegradationEventId: trustDegradation?.id ?? null,
      },
      watchlists,
    );
    alertsCreated += alertResult.created;
    watchlistHits += alertResult.watchlistHits;
  }

  return { alertsCreated, watchlistHits };
}

export async function recordSkippedSourceWatchtower(input: Omit<SourceWatchtowerInput, 'claims' | 'replayedFromExistingArtifact'>): Promise<SourceWatchtowerResult> {
  return evaluateSourceWatchtower({
    ...input,
    claims: [],
    replayedFromExistingArtifact: false,
  });
}

export async function scanSourceStalenessForNpi(
  npi: string,
  nowIso = new Date().toISOString(),
): Promise<readonly WatchtowerDeltaEvent[]> {
  const snapshots = await loadLatestSourceSnapshots(npi);
  const watchlists = await listWatchlists({ activeOnly: true });
  const deltaEvents: WatchtowerDeltaEvent[] = [];

  for (const snapshot of snapshots) {
    const source = getSource(snapshot.sourceId);
    if (!source) {
      continue;
    }

    const lastObserved = snapshot.observedAt ?? snapshot.fetchedAt;
    const staleThreshold = lastObserved.getTime() + source.refreshSlaHours * 60 * 60 * 1000;
    if (staleThreshold > Date.parse(nowIso)) {
      continue;
    }

    const severity = stalenessSeverityForTier(source.tier);
    const checksum = stableHash({
      subjectNpi: npi,
      sourceId: snapshot.sourceId,
      status: 'STALE',
      lastObservedAt: lastObserved.toISOString(),
      refreshSlaHours: source.refreshSlaHours,
    });
    const persistedStaleness = await persistSourceStalenessEvent({
      sourceRunId: snapshot.sourceRunId ?? undefined,
      sourceRecordId: snapshot.id,
      subjectNpi: npi,
      sourceId: snapshot.sourceId,
      status: 'STALE',
      severity,
      slaHours: source.refreshSlaHours,
      trustTier: source.tier,
      lastObservedAt: lastObserved.toISOString(),
      staleSince: new Date(staleThreshold).toISOString(),
      checksum,
      metadata: {
        sourceName: source.name,
      },
    });

    if (!persistedStaleness) {
      continue;
    }

    const trustDegradation = await persistTrustDegradationEvent({
      sourceRunId: snapshot.sourceRunId ?? undefined,
      sourceRecordId: snapshot.id,
      subjectNpi: npi,
      reason: 'SOURCE_STALE',
      severity,
      description: `${snapshot.sourceId} is stale for ${npi}.`,
      observedAt: nowIso,
      checksum: stableHash({
        subjectNpi: npi,
        sourceId: snapshot.sourceId,
        reason: 'SOURCE_STALE',
        checksum,
      }),
    });

    const alertResult = await createAlertAndDeliveries(
      {
        type: 'source_stale',
        subject: npi,
        sourceId: snapshot.sourceId,
        severity,
        title: `${snapshot.sourceId} is stale`,
        description: `${snapshot.sourceId} has exceeded its ${source.refreshSlaHours}h freshness SLA for ${npi}.`,
        recommendedAction: 'Refresh the source or route to manual review before relying on stale evidence.',
        observedAt: nowIso,
        organizationKeys: [],
        sourceRunId: snapshot.sourceRunId ?? null,
        sourceRecordId: snapshot.id,
        sourceStalenessEventId: persistedStaleness.id,
        trustDegradationEventId: trustDegradation?.id ?? null,
      },
      watchlists,
    );

    deltaEvents.push({
      type: 'SOURCE_STALE',
      claimType: 'SOURCE_CAPTURE',
      previous: {
        lastObservedAt: lastObserved.toISOString(),
      },
      current: {
        staleSince: new Date(staleThreshold).toISOString(),
      },
      severity: normalizeSeverityForReport(severity),
      fieldPath: 'freshness',
    });

    if (alertResult.created > 0) {
      log('warn', 'watchtower_source_stale_alert_created', {
        subjectNpi: npi,
        sourceId: snapshot.sourceId,
        severity,
      });
    }
  }

  return Object.freeze(deltaEvents);
}

export async function registerWatchlist(input: CreateWatchlistInput): Promise<WatchlistRecord> {
  return createWatchlist(input);
}

export async function getWatchtowerState(npi: string) {
  return loadWatchtowerStateForNpi(npi);
}
