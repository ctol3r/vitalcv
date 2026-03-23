import type {
  ClaimConfidence,
  ExclusionValue,
  LicenseValue,
  NormalizedClaim,
} from '../identity/evidenceModel';
import { getSource, type RefreshCadence } from '../identity/sourceCatalog';

export type SourceLatency =
  | 'REALTIME'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'UNKNOWN';

export type DataFreshnessCadence =
  | 'TODAY'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'UNKNOWN';

export type ExclusionClaimState =
  | 'CLEAR'
  | 'EXCLUDED'
  | 'POSSIBLE_MATCH'
  | 'UNCHECKED';

export type LicenseClaimState =
  | 'LICENSE_ACTIVE'
  | 'LICENSE_EXPIRED'
  | 'LICENSE_DISCIPLINED'
  | 'LICENSE_UNKNOWN';

function toSourceLatency(cadence: RefreshCadence | null | undefined): SourceLatency {
  if (cadence === 'REALTIME') return 'REALTIME';
  if (cadence === 'DAILY') return 'DAILY';
  if (cadence === 'WEEKLY') return 'WEEKLY';
  if (cadence === 'MONTHLY') return 'MONTHLY';
  if (cadence === 'QUARTERLY') return 'QUARTERLY';
  return 'UNKNOWN';
}

function sourceDisplayName(sourceId: string): string {
  return getSource(sourceId)?.name ?? sourceId;
}

export function sourceLatencyForSource(sourceId: string): SourceLatency {
  if (sourceId === 'OIG_LEIE') {
    return 'MONTHLY';
  }
  if (sourceId === 'PECOS_PUBLIC') {
    return 'QUARTERLY';
  }

  return toSourceLatency(getSource(sourceId)?.refreshCadence);
}

export function dataFreshnessCadenceForSource(
  sourceId: string,
  observedAt?: string | null,
  now: Date = new Date(),
): DataFreshnessCadence {
  if (observedAt) {
    const observedAtMs = Date.parse(observedAt);
    if (Number.isFinite(observedAtMs) && now.getTime() - observedAtMs < 24 * 60 * 60 * 1000) {
      return 'TODAY';
    }
  }

  const latency = sourceLatencyForSource(sourceId);
  if (latency === 'REALTIME') return 'TODAY';
  if (latency === 'DAILY') return 'DAILY';
  if (latency === 'WEEKLY') return 'WEEKLY';
  if (latency === 'MONTHLY') return 'MONTHLY';
  if (latency === 'QUARTERLY') return 'QUARTERLY';
  return 'UNKNOWN';
}

export function dataFreshnessLabel(cadence: DataFreshnessCadence): string {
  if (cadence === 'TODAY') return 'Updated today';
  if (cadence === 'DAILY') return 'Updated daily';
  if (cadence === 'WEEKLY') return 'Updated weekly';
  if (cadence === 'MONTHLY') return 'Updated monthly';
  if (cadence === 'QUARTERLY') return 'Updated quarterly';
  return 'Freshness unavailable';
}

export function claimConfidenceLabel(level: ClaimConfidence, sourceId: string): string {
  if (level === 'HIGH') {
    return `Confirmed via ${sourceDisplayName(sourceId)}`;
  }
  if (level === 'MEDIUM') {
    return 'Likely match — review recommended';
  }
  return 'Unverified';
}

export function exclusionClaimState(
  value: Pick<ExclusionValue, 'excluded' | 'matchType'> & { verdict?: ExclusionClaimState },
  reviewRequired: boolean,
): ExclusionClaimState {
  if (value.verdict) {
    return value.verdict;
  }
  if (value.excluded) {
    return 'EXCLUDED';
  }
  if (reviewRequired || value.matchType === 'NAME_MATCH' || value.matchType === 'UNCLEAR') {
    return 'POSSIBLE_MATCH';
  }
  if (value.matchType === 'NO_MATCH') {
    return 'CLEAR';
  }
  return 'UNCHECKED';
}

export function licenseClaimState(value: Pick<LicenseValue, 'licenseStatus' | 'disciplinaryActions'>): LicenseClaimState {
  if ((value.disciplinaryActions ?? []).length > 0) {
    return 'LICENSE_DISCIPLINED';
  }
  if (value.licenseStatus === 'ACTIVE') {
    return 'LICENSE_ACTIVE';
  }
  if (value.licenseStatus === 'EXPIRED') {
    return 'LICENSE_EXPIRED';
  }
  return 'LICENSE_UNKNOWN';
}

export function defaultCredentialTrustMetadata(input: {
  claim: Pick<NormalizedClaim, 'confidence' | 'observedAt'>;
  sourceId: string;
  dataVersion?: string | null;
}): {
  sourceLatency: SourceLatency;
  dataFreshness: DataFreshnessCadence;
  dataFreshnessLabel: string;
  matchConfidence: ClaimConfidence;
  claimConfidenceLabel: string;
  observedAt: string;
  dataVersion: string | null;
} {
  const freshness = dataFreshnessCadenceForSource(input.sourceId, input.claim.observedAt);

  return {
    sourceLatency: sourceLatencyForSource(input.sourceId),
    dataFreshness: freshness,
    dataFreshnessLabel: dataFreshnessLabel(freshness),
    matchConfidence: input.claim.confidence,
    claimConfidenceLabel: claimConfidenceLabel(input.claim.confidence, input.sourceId),
    observedAt: input.claim.observedAt,
    dataVersion: input.dataVersion ?? null,
  };
}
