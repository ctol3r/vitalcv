import {
  defaultAuthorityTruthFields,
  type AuthorityConnectorState,
  type AuthorityParticipationStatus,
  type AuthoritySourceScope,
  type AuthorityTargetDomain,
} from '../authority/contracts';
import { getConnectorMode } from '../providers/connectors/connectorFactory';
import {
  lookupStateBoard,
  type StateBoardResult,
} from '../providers/connectors/stateBoardConnector';
import type {
  AuthorityUnavailableValue,
  LicenseValue,
  NormalizedClaim,
} from './evidenceModel';
import { buildClaimArtifactTrace, computeClaimId } from './evidenceModel';
import {
  fetchFsmbClaims,
  isFsmbEnabled,
  type FsmbClaimSet,
} from './fsmbClaimMapper';
import { getSourceFreshnessWindowHours } from './sourceCatalog';

export const PHYSICIAN_LICENSURE_LAUNCH_STATE = 'CA' as const;

const PARSER_VERSION = 'physician-licensure-launch-lane/v1';
const STATE_BOARD_CA_SOURCE_URL = 'https://mbc.ca.gov/breeze/';
const STATE_BOARD_MANUAL_SOURCE_URL = 'https://www.fsmb.org/licensure/';

type LicensureTargetDomain = Extract<AuthorityTargetDomain, 'LICENSURE'>;

type LaunchLaneRoute =
  | 'state_board'
  | 'fsmb'
  | 'manual'
  | 'unsupported'
  | 'skipped';

type LaunchLaneResult = Readonly<{
  claims: NormalizedClaim[];
  launchState: string | null;
  route: LaunchLaneRoute;
}>;

type StateBoardLookup = (
  npi: string,
  state: string,
) => Promise<StateBoardResult>;

type FsmbClaimFetcher = (
  npi: string,
  observedAt: string,
) => Promise<FsmbClaimSet>;

function stateBoardDegradationReason(result: StateBoardResult, launchState: string): string | null {
  switch (result.degradationReason) {
    case 'ACCESS_REQUIRED':
      return `${launchState} live state-board access is not configured for this lane. Manual verification or FSMB-backed verification is required.`;
    case 'OUTAGE':
      return `${launchState} state-board lookup failed or timed out. Treat this lane as unavailable until the source recovers or is manually verified.`;
    case 'PARSER_FAILURE':
      return `${launchState} state-board response could not be parsed safely. Manual verification is required until the parser is repaired.`;
    case 'STALE':
      return `${launchState} state-board verification returned stale data. Treat this lane as unresolved until a fresh board result is available.`;
    case 'NOT_IMPLEMENTED':
      return `${launchState} is outside the supported live state-board adapter set. Manual verification is required.`;
    default:
      return null;
  }
}

function normalizeState(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().toUpperCase()
    : null;
}

function isFreshStateBoardVerification(lastVerifiedAt: string | null | undefined, now: Date): boolean {
  if (typeof lastVerifiedAt !== 'string' || lastVerifiedAt.trim().length === 0) {
    return false;
  }

  const verifiedAtMs = Date.parse(lastVerifiedAt);
  const freshnessWindowHours = getSourceFreshnessWindowHours('STATE_BOARD');
  if (!Number.isFinite(verifiedAtMs) || !freshnessWindowHours) {
    return false;
  }

  return verifiedAtMs + freshnessWindowHours * 60 * 60 * 1000 > now.getTime();
}

function buildBaseClaim(input: {
  claimType: NormalizedClaim['claimType'];
  sourceId: string;
  sourceUrl: string;
  artifactId: string;
  artifactChecksum: string;
  npi: string;
  observedAt: string;
  value: NormalizedClaim['value'];
  confidence: NormalizedClaim['confidence'];
  confidenceScore: number;
  status: NormalizedClaim['status'];
  validUntil?: string | null;
  expiresAt?: string | null;
  reviewRequired?: boolean;
  reviewReason?: string | null;
}): NormalizedClaim {
  const trace = buildClaimArtifactTrace({
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    retrievedAt: input.observedAt,
    artifactId: input.artifactId,
    checksum: input.artifactChecksum,
    claimType: input.claimType,
    matchConfidence: input.confidence,
  });

  return {
    claimId: computeClaimId(input.claimType, input.sourceId, input.npi, input.value),
    claimType: input.claimType,
    sourceId: input.sourceId,
    artifactId: input.artifactId,
    artifactChecksum: input.artifactChecksum,
    parserVersion: PARSER_VERSION,
    subjectNpi: input.npi,
    tier: 'GOLD',
    confidence: input.confidence,
    confidenceScore: input.confidenceScore,
    status: input.status,
    reviewRequired: input.reviewRequired ?? false,
    reviewReason: input.reviewReason ?? null,
    humanReviewAt: null,
    observedAt: input.observedAt,
    derivedAt: input.observedAt,
    source_id: trace.source_id,
    source_url: trace.source_url,
    retrieved_at: trace.retrieved_at,
    raw_artifact_ref: trace.raw_artifact_ref,
    checksum: trace.checksum,
    claim_type: trace.claim_type,
    match_confidence: trace.match_confidence,
    validFrom: input.observedAt,
    validUntil: input.validUntil ?? null,
    expiresAt: input.expiresAt ?? null,
    supersededBy: null,
    supersedes: null,
    value: input.value,
    freshnessWindowHours: getSourceFreshnessWindowHours(input.sourceId),
  };
}

function buildUnavailableLicensureClaim(input: {
  npi: string;
  observedAt: string;
  sourceId: 'STATE_BOARD' | 'FSMB';
  sourceUrl: string;
  sourceScope: Extract<AuthoritySourceScope, 'STATE_BOARD_MANUAL' | 'FSMB_MED_API'>;
  jurisdiction: string | null;
  connectorState: AuthorityConnectorState;
  participationStatus: AuthorityParticipationStatus;
  reason: string;
}): NormalizedClaim {
  const authorityFields = defaultAuthorityTruthFields({
    authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
    issuerEntityId:
      input.sourceId === 'FSMB'
        ? 'authority:fsmb'
        : 'authority:state-board',
    sourceScope: input.sourceScope,
    effectiveAt: null,
    expiresAt: null,
    verifiedAt: input.observedAt,
    dataFreshness: 'Freshness unavailable',
    participationStatus: input.participationStatus,
    boardOrderSeverity: 'NONE',
    connectorState: input.connectorState,
    targetDomain: 'LICENSURE' satisfies LicensureTargetDomain,
  });

  const value: AuthorityUnavailableValue = {
    _type: 'AUTHORITY_UNAVAILABLE',
    reason: input.reason,
    source: input.sourceId,
    targetDomain: 'LICENSURE',
    jurisdiction: input.jurisdiction,
    authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
    sourceScope: input.sourceScope,
    issuerEntityId: authorityFields.issuerEntityId,
    effectiveAt: authorityFields.effectiveAt,
    verifiedAt: authorityFields.verifiedAt,
    confidenceLabel: authorityFields.confidenceLabel,
    dataFreshness: authorityFields.dataFreshness,
    participationStatus: authorityFields.participationStatus,
    boardOrderSeverity: authorityFields.boardOrderSeverity,
    connectorState: authorityFields.connectorState,
  };

  return buildBaseClaim({
    claimType: 'AUTHORITY_UNAVAILABLE',
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    artifactId: `${input.sourceId.toLowerCase()}-licensure-unavailable-${input.npi}-${input.jurisdiction?.toLowerCase() ?? 'unknown'}`,
    artifactChecksum: computeClaimId('AUTHORITY_UNAVAILABLE', input.sourceId, input.npi, value),
    npi: input.npi,
    observedAt: input.observedAt,
    value,
    confidence: input.connectorState === 'connected' ? 'MEDIUM' : 'LOW',
    confidenceScore: input.connectorState === 'connected' ? 0.55 : 0.4,
    status: 'UNVERIFIED',
  });
}

function stateBoardLicenseStatus(
  raw: StateBoardResult['licenseStatus'],
): LicenseValue['licenseStatus'] {
  if (raw === 'ACTIVE') return 'ACTIVE';
  if (raw === 'EXPIRED') return 'EXPIRED';
  if (raw === 'SUSPENDED') return 'SUSPENDED';
  if (raw === 'REVOKED') return 'REVOKED';
  return 'UNKNOWN';
}

function buildStateBoardLicenseClaim(input: {
  npi: string;
  observedAt: string;
  result: StateBoardResult;
}): NormalizedClaim {
  const authorityFields = defaultAuthorityTruthFields({
    authorityClaimCode:
      input.result.licenseStatus === 'ACTIVE'
        ? 'PHYSICIAN_LICENSE_ACTIVE'
        : 'AUTHORITY_UNAVAILABLE',
    issuerEntityId: 'authority:state-board',
    sourceScope: 'STATE_BOARD_CA_API',
    effectiveAt: input.observedAt,
    expiresAt: input.result.expirationDate,
    verifiedAt: input.result.lastVerifiedAt,
    dataFreshness: 'Updated weekly',
    participationStatus: 'verified_result',
    boardOrderSeverity: 'NONE',
    connectorState: 'connected',
    targetDomain: 'LICENSURE',
  });

  const licenseStatus = stateBoardLicenseStatus(input.result.licenseStatus);
  const value: LicenseValue = {
    _type: 'LICENSE',
    state: input.result.state,
    licenseNumber: input.result.licenseNumber,
    issueDate: null,
    expiryDate: input.result.expirationDate,
    licenseStatus,
    disciplinaryActions: [],
    source: 'STATE_BOARD',
    authorityClaimCode:
      licenseStatus === 'ACTIVE' ? 'PHYSICIAN_LICENSE_ACTIVE' : undefined,
    sourceScope: 'STATE_BOARD_CA_API',
    issuerEntityId: authorityFields.issuerEntityId,
    effectiveAt: authorityFields.effectiveAt,
    verifiedAt: authorityFields.verifiedAt,
    confidenceLabel: authorityFields.confidenceLabel,
    dataFreshness: authorityFields.dataFreshness,
    participationStatus: authorityFields.participationStatus,
    boardOrderSeverity: authorityFields.boardOrderSeverity,
    connectorState: authorityFields.connectorState,
    sourceDisclaimer: 'California live state-board lane only. No sandbox or scraper fallback.',
  };

  const reviewRequired = input.result.licenseStatus === 'NOT_FOUND';
  const reviewReason = reviewRequired
    ? 'California state board returned no physician license record for this NPI'
    : null;

  return buildBaseClaim({
    claimType: 'LICENSE',
    sourceId: 'STATE_BOARD',
    sourceUrl: input.result.sourceUrl || STATE_BOARD_CA_SOURCE_URL,
    artifactId: `state-board-ca-license-${input.npi}`,
    artifactChecksum: computeClaimId('LICENSE', 'STATE_BOARD', input.npi, value),
    npi: input.npi,
    observedAt: input.result.lastVerifiedAt || input.observedAt,
    value,
    confidence: reviewRequired ? 'MEDIUM' : 'HIGH',
    confidenceScore: reviewRequired ? 0.6 : 0.95,
    status:
      licenseStatus === 'ACTIVE'
        ? 'ACTIVE'
        : licenseStatus === 'EXPIRED'
          ? 'EXPIRED'
          : licenseStatus === 'SUSPENDED' || licenseStatus === 'REVOKED'
            ? 'BLOCKED'
            : 'UNVERIFIED',
    validUntil: input.result.expirationDate,
    expiresAt: input.result.expirationDate,
    reviewRequired,
    reviewReason,
  });
}

function filterLaunchStateFsmbClaims(
  result: FsmbClaimSet,
  state: string,
): NormalizedClaim[] {
  return result.claims.filter((claim) => {
    if (claim.claimType !== 'LICENSE' && claim.claimType !== 'LICENSE_DISCIPLINE') {
      return false;
    }

    const value = claim.value as Record<string, unknown>;
    return normalizeState(value.state as string | undefined) === state;
  });
}

export function isProductionEnabledPhysicianLicensureState(
  state: string | null | undefined,
): boolean {
  return normalizeState(state) === PHYSICIAN_LICENSURE_LAUNCH_STATE;
}

export function selectPhysicianLicensureLaunchState(
  states: readonly string[],
): string | null {
  return states
    .map((state) => normalizeState(state))
    .find((state): state is string => isProductionEnabledPhysicianLicensureState(state))
    ?? null;
}

export async function resolvePhysicianLicensureLaunchLane(input: {
  npi: string;
  observedAt: string;
  candidateStates: readonly string[];
  stateBoardLookup?: StateBoardLookup;
  fsmbClaimFetcher?: FsmbClaimFetcher;
}): Promise<LaunchLaneResult> {
  const normalizedStates = input.candidateStates
    .map((state) => normalizeState(state))
    .filter((state): state is string => Boolean(state));
  const launchState = selectPhysicianLicensureLaunchState(normalizedStates);

  if (!launchState) {
    const firstUnsupportedState = normalizedStates[0] ?? null;
    if (!firstUnsupportedState) {
      return {
        claims: [],
        launchState: null,
        route: 'skipped',
      };
    }

    return {
      claims: [
        buildUnavailableLicensureClaim({
          npi: input.npi,
          observedAt: input.observedAt,
          sourceId: 'STATE_BOARD',
          sourceUrl: STATE_BOARD_MANUAL_SOURCE_URL,
          sourceScope: 'STATE_BOARD_MANUAL',
          jurisdiction: firstUnsupportedState,
          connectorState: 'unavailable',
          participationStatus: 'institution_access_unavailable',
          reason: `${firstUnsupportedState} physician licensure requires institutional access to the state board. Treat this lane as access required.`,
        }),
      ],
      launchState: null,
      route: 'unsupported',
    };
  }

  const liveStateBoardLookup =
    input.stateBoardLookup
    ?? (getConnectorMode('STATE_BOARD') === 'live'
      ? lookupStateBoard
      : null);

  if (liveStateBoardLookup) {
    try {
      const stateBoardResult = await liveStateBoardLookup(input.npi, launchState);
      const degradationReason = stateBoardDegradationReason(stateBoardResult, launchState);
      if (degradationReason) {
        return {
          claims: [
            buildUnavailableLicensureClaim({
              npi: input.npi,
              observedAt: input.observedAt,
              sourceId: 'STATE_BOARD',
              sourceUrl: stateBoardResult.sourceUrl || STATE_BOARD_CA_SOURCE_URL,
              sourceScope: 'STATE_BOARD_MANUAL',
              jurisdiction: launchState,
              connectorState: 'unavailable',
              participationStatus: 'manual_verification_required',
              reason: degradationReason,
            }),
          ],
          launchState,
          route: 'manual',
        };
      }
      const stateBoardFresh = isFreshStateBoardVerification(
        stateBoardResult.lastVerifiedAt,
        new Date(input.observedAt),
      );
      if (!stateBoardFresh) {
        return {
          claims: [
            buildUnavailableLicensureClaim({
              npi: input.npi,
              observedAt: input.observedAt,
              sourceId: 'STATE_BOARD',
              sourceUrl: stateBoardResult.sourceUrl || STATE_BOARD_CA_SOURCE_URL,
              sourceScope: 'STATE_BOARD_MANUAL',
              jurisdiction: launchState,
              connectorState: 'unavailable',
              participationStatus: 'manual_verification_required',
              reason: `${launchState} state-board verification returned stale or invalid freshness metadata. Treat this lane as unresolved until a fresh board result is available.`,
            }),
          ],
          launchState,
          route: 'manual',
        };
      }

      if (
        stateBoardResult.licenseStatus !== 'NOT_AVAILABLE'
        && stateBoardResult.licenseStatus !== 'INACTIVE'
      ) {
        return {
          claims: [buildStateBoardLicenseClaim({
            npi: input.npi,
            observedAt: input.observedAt,
            result: stateBoardResult,
          })],
          launchState,
          route: 'state_board',
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        claims: [
          buildUnavailableLicensureClaim({
            npi: input.npi,
            observedAt: input.observedAt,
            sourceId: 'STATE_BOARD',
            sourceUrl: STATE_BOARD_CA_SOURCE_URL,
            sourceScope: 'STATE_BOARD_MANUAL',
            jurisdiction: launchState,
            connectorState: 'unavailable',
            participationStatus: 'manual_verification_required',
            reason: `${launchState} state-board lookup failed (${message}). Treat this lane as unavailable until the source recovers or is manually verified.`,
          }),
        ],
        launchState,
        route: 'manual',
      };
    }
  }

  const fsmbFetcher = input.fsmbClaimFetcher ?? (isFsmbEnabled() ? fetchFsmbClaims : null);
  if (fsmbFetcher) {
    const fsmbResult = await fsmbFetcher(input.npi, input.observedAt);
    const launchClaims = filterLaunchStateFsmbClaims(fsmbResult, launchState);
    if (launchClaims.length > 0) {
      return {
        claims: launchClaims,
        launchState,
        route: 'fsmb',
      };
    }

    return {
      claims: [
        buildUnavailableLicensureClaim({
          npi: input.npi,
          observedAt: fsmbResult.fetchedAt,
          sourceId: 'FSMB',
          sourceUrl: 'https://docinfo-api.fsmb.org/v1/physicians',
          sourceScope: 'FSMB_MED_API',
          jurisdiction: launchState,
          connectorState: 'connected',
          participationStatus: 'connected',
          reason: `FSMB returned no ${launchState} physician licensure record for this NPI.`,
        }),
      ],
      launchState,
      route: 'fsmb',
    };
  }

  return {
    claims: [
      buildUnavailableLicensureClaim({
        npi: input.npi,
        observedAt: input.observedAt,
        sourceId: 'STATE_BOARD',
        sourceUrl: STATE_BOARD_CA_SOURCE_URL,
        sourceScope: 'STATE_BOARD_MANUAL',
        jurisdiction: launchState,
        connectorState: 'unavailable',
        participationStatus: 'institution_access_unavailable',
        reason: `${launchState} physician licensure requires live California board access or FSMB institutional access. Until then, treat this lane as access required.`,
      }),
    ],
    launchState,
    route: 'manual',
  };
}
