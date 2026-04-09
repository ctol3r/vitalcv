import { randomUUID } from 'node:crypto';
import {
  NpiRegistryAdapter,
  type CredentialFactBatch,
} from '@vitalcv/psv-adapters';
import { log } from '../../obs/logger';
import {
  checkOIGExclusion,
  type OIGExclusionResult,
} from '../providers/connectors/oigConnector';
import { getConnectorMode } from '../providers/connectors/connectorFactory';
import {
  lookupStateBoard,
  type StateBoardResult,
} from '../providers/connectors/stateBoardConnector';
import { sha256ForPayload } from '../../utils/deterministic';
import { signArtifactHash } from '../psv/signingService';
import {
  isCredentialIngestionEnabled,
  getStateLicenseVerificationFreshnessDays,
} from './credentialIngestionConfig';
import {
  buildRunArtifactHash,
  calculateFreshUntil,
  createCredentialArtifactRecord,
  createVerificationArtifactRecord,
} from './credentialIngestionArtifacts';
import {
  type ActiveCredentialArtifactRecord,
  type CanonicalCredentialArtifact,
  type CredentialArtifactStatus,
  type CredentialVerificationMethod,
  type PersistableCanonicalArtifact,
  type PersistedIngestionBundle,
  type IngestionProviderProfile,
} from './credentialIngestionTypes';
import {
  CredentialIngestionRepository,
  PrismaCredentialIngestionRepository,
} from '../../../repositories/credentialIngestion.repo';
import { queueQaSweep } from '../../qa/qaRuntime';

const NPI_RE = /^\d{10}$/;
const npiRegistryAdapter = new NpiRegistryAdapter();

let repository: CredentialIngestionRepository = new PrismaCredentialIngestionRepository();

export interface CredentialIngestionResult extends PersistedIngestionBundle {
  npi: string;
  sourceName: string;
}

type NpiRegistryIdentityFact = {
  fullName: string;
  enumerationType: string;
  taxonomies: readonly string[];
  practiceStates: readonly string[];
  firstName?: string;
  lastName?: string;
};

function assertFeatureEnabled(): void {
  if (!isCredentialIngestionEnabled()) {
    throw new Error('FEATURE_CREDENTIAL_INGESTION is disabled');
  }
}

function validateNpi(npi: string): string {
  const normalized = npi.trim();
  if (!NPI_RE.test(normalized)) {
    throw new Error('npi must be a 10-digit string');
  }
  return normalized;
}

function resolvePrimaryPracticeState(
  credentials: readonly ActiveCredentialArtifactRecord[],
): string | null {
  const identity = credentials.find(
    (record) => record.artifact.credential_type === 'NPI_ENROLLMENT',
  );
  const practiceStates = identity?.artifact.metadata?.practice_states;
  if (Array.isArray(practiceStates)) {
    const state = practiceStates.find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length === 2);
    return state?.trim().toUpperCase() ?? null;
  }

  const directState = identity?.artifact.metadata?.practice_state;
  return typeof directState === 'string' && directState.trim().length === 2
    ? directState.trim().toUpperCase()
    : null;
}

function resolveProviderProfileFromCredentials(
  npi: string,
  credentials: readonly ActiveCredentialArtifactRecord[],
): IngestionProviderProfile {
  const identity = credentials.find(
    (record) => record.artifact.credential_type === 'NPI_ENROLLMENT',
  );

  const metadata = identity?.artifact.metadata ?? {};
  const practiceState = resolvePrimaryPracticeState(credentials) ?? 'UNKNOWN';

  return {
    npi,
    fullName:
      typeof metadata.full_name === 'string' && metadata.full_name.trim().length > 0
        ? metadata.full_name
        : `Provider ${npi}`,
    providerType:
      typeof metadata.provider_type === 'string' && metadata.provider_type.trim().length > 0
        ? metadata.provider_type
        : 'UNKNOWN',
    taxonomyCode:
      typeof metadata.taxonomy_code === 'string' && metadata.taxonomy_code.trim().length > 0
        ? metadata.taxonomy_code
        : 'UNKNOWN',
    stateOfPractice: practiceState,
  };
}

function extractNpiIdentityFact(batch: CredentialFactBatch): NpiRegistryIdentityFact | null {
  const envelope = batch.facts.find((entry) => entry.fact.factType === 'IdentityClaim');
  if (!envelope) {
    return null;
  }

  const fact = envelope.fact as Record<string, unknown>;
  return {
    fullName: typeof fact.fullName === 'string' ? fact.fullName : '',
    enumerationType:
      typeof fact.enumerationType === 'string' ? fact.enumerationType : 'UNKNOWN',
    taxonomies: Array.isArray(fact.taxonomies)
      ? fact.taxonomies.filter((value): value is string => typeof value === 'string')
      : [],
    practiceStates: Array.isArray(fact.practiceStates)
      ? fact.practiceStates.filter((value): value is string => typeof value === 'string')
      : [],
    ...(typeof fact.firstName === 'string' ? { firstName: fact.firstName } : {}),
    ...(typeof fact.lastName === 'string' ? { lastName: fact.lastName } : {}),
  };
}

function parseRawNpiResponse(rawResponse: unknown): {
  taxonomyCode: string;
  status: CredentialArtifactStatus;
} {
  if (typeof rawResponse !== 'object' || rawResponse === null || Array.isArray(rawResponse)) {
    return {
      taxonomyCode: 'UNKNOWN',
      status: 'NOT_FOUND',
    };
  }

  const response = rawResponse as Record<string, unknown>;
  const results = Array.isArray(response.results) ? response.results : [];
  const firstResult =
    results.length > 0 && typeof results[0] === 'object' && results[0] !== null
      ? (results[0] as Record<string, unknown>)
      : null;

  const basic =
    firstResult?.basic && typeof firstResult.basic === 'object' && firstResult.basic !== null
      ? (firstResult.basic as Record<string, unknown>)
      : null;
  const taxonomies = Array.isArray(firstResult?.taxonomies) ? firstResult.taxonomies : [];
  const firstTaxonomy =
    taxonomies.length > 0 && typeof taxonomies[0] === 'object' && taxonomies[0] !== null
      ? (taxonomies[0] as Record<string, unknown>)
      : null;

  const status = basic?.status === 'A'
    ? 'ACTIVE'
    : results.length > 0
      ? 'DEACTIVATED'
      : 'NOT_FOUND';

  return {
    taxonomyCode:
      typeof firstTaxonomy?.code === 'string' && firstTaxonomy.code.trim().length > 0
        ? firstTaxonomy.code.trim()
        : 'UNKNOWN',
    status,
  };
}

async function signCanonicalArtifact<TArtifact extends object>(
  artifact: TArtifact,
): Promise<PersistableCanonicalArtifact<TArtifact>> {
  const id = randomUUID();
  const signatureIssuedAt = new Date().toISOString();
  const artifactHash = sha256ForPayload(artifact);
  const signature = await signArtifactHash(artifactHash, id);

  return {
    id,
    artifact,
    signature,
    signatureAlgorithm: 'ES256',
    signatureIssuedAt,
  };
}

function buildCredentialIngestionResult(
  persisted: PersistedIngestionBundle,
  npi: string,
  sourceName: string,
): CredentialIngestionResult {
  return {
    ...persisted,
    npi,
    sourceName,
  };
}

function queuePostIngestionQaSweep(npi: string): void {
  queueQaSweep({
    trigger: 'ingestion',
    targetNpi: npi,
  });
}

async function getActiveCredentials(npi: string): Promise<ActiveCredentialArtifactRecord[]> {
  return repository.findActiveCredentialsByNpi(npi);
}

export function setCredentialIngestionRepository(
  nextRepository: CredentialIngestionRepository,
): void {
  repository = nextRepository;
}

export function resetCredentialIngestionRepository(): void {
  repository = new PrismaCredentialIngestionRepository();
}

export async function ingestNpiProfile(npi: string): Promise<CredentialIngestionResult> {
  assertFeatureEnabled();
  const normalizedNpi = validateNpi(npi);
  const batch = await npiRegistryAdapter.lookupByNpi(normalizedNpi);
  const identityFact = extractNpiIdentityFact(batch);
  const rawNpi = parseRawNpiResponse(batch.rawResponse);
  const verifiedAt = batch.retrievalTime;
  const freshUntil = calculateFreshUntil('NPPES', verifiedAt, getStateLicenseVerificationFreshnessDays());

  const providerProfile: IngestionProviderProfile = {
    npi: normalizedNpi,
    fullName: identityFact?.fullName || `Provider ${normalizedNpi}`,
    providerType:
      identityFact?.enumerationType === 'NPI-2' ? 'ORGANIZATION' : 'INDIVIDUAL',
    taxonomyCode: rawNpi.taxonomyCode,
    stateOfPractice: identityFact?.practiceStates[0] ?? 'UNKNOWN',
  };

  const credentialArtifact = createCredentialArtifactRecord({
    subject_npi: normalizedNpi,
    source_name: 'npi-registry',
    credential_type: 'NPI_ENROLLMENT',
    issuer_org_id: 'cms:nppes',
    issued_at: verifiedAt,
    expires_at: null,
    status: rawNpi.status,
    metadata: {
      full_name: providerProfile.fullName,
      provider_type: providerProfile.providerType,
      taxonomy_code: providerProfile.taxonomyCode,
      taxonomy_descriptions: identityFact?.taxonomies ?? [],
      practice_state: providerProfile.stateOfPractice,
      practice_states: identityFact?.practiceStates ?? [],
      enumeration_type: identityFact?.enumerationType ?? 'UNKNOWN',
      first_name: identityFact?.firstName ?? null,
      last_name: identityFact?.lastName ?? null,
    },
  });

  const payloadJson = {
    provider_name: providerProfile.fullName,
    provider_type: providerProfile.providerType,
    taxonomy_code: providerProfile.taxonomyCode,
    practice_state: providerProfile.stateOfPractice,
    practice_states: identityFact?.practiceStates ?? [],
    source_status: rawNpi.status,
    raw_payload_hash: batch.rawResponseHash,
    source_url: batch.summary.sourceUrl,
    fact_count: batch.summary.factCount,
  };
  const verificationArtifact = createVerificationArtifactRecord({
    subject_npi: normalizedNpi,
    source_name: 'npi-registry',
    related_credential_hash: credentialArtifact.credential_hash,
    source_type: 'NPPES',
    verification_method: 'API',
    verified_at: verifiedAt,
    fresh_until: freshUntil,
    payload_json: payloadJson,
  });

  const persisted = await repository.persistIngestionBundle({
    sourceName: 'npi-registry',
    rawPayloadHash: batch.rawResponseHash,
    retrievedAt: verifiedAt,
    runArtifactHash: buildRunArtifactHash([credentialArtifact, verificationArtifact]),
    provider: providerProfile,
    credentialArtifact: await signCanonicalArtifact(credentialArtifact),
    verificationArtifact: await signCanonicalArtifact(verificationArtifact),
    compatibilityArtifact: {
      npi: normalizedNpi,
      source: 'NPPES',
      status: credentialArtifact.status,
      checksum: verificationArtifact.evidence_hash,
      rawPayload: verificationArtifact,
      verifiedAt,
      expiresAt: freshUntil,
      psvWindowStart: verifiedAt,
      psvWindowDeadline: freshUntil,
      psvWindowCompliant: Date.parse(freshUntil) > Date.now(),
      claimHashes: [credentialArtifact.credential_hash, verificationArtifact.evidence_hash],
    },
  });

  log('info', 'credential_ingestion_npi_profile_persisted', {
    npi: normalizedNpi,
    idempotent: persisted.idempotent,
    verificationRunId: persisted.verificationRunId,
  });
  queuePostIngestionQaSweep(normalizedNpi);

  return buildCredentialIngestionResult(persisted, normalizedNpi, 'npi-registry');
}

export async function ingestOigStatus(npi: string): Promise<CredentialIngestionResult> {
  assertFeatureEnabled();
  const normalizedNpi = validateNpi(npi);
  const activeCredentials = await getActiveCredentials(normalizedNpi);
  const providerProfile = resolveProviderProfileFromCredentials(normalizedNpi, activeCredentials);

  let result: OIGExclusionResult;
  let status: CredentialArtifactStatus = 'CHECK_FAILED';
  try {
    result = await checkOIGExclusion(normalizedNpi);
    status =
      result.verdict === 'EXCLUDED'
        ? 'EXCLUDED'
        : result.verdict === 'CLEAR'
          ? 'CLEAR'
          : result.verdict === 'REVIEW_REQUIRED'
            ? 'REVIEW_REQUIRED'
            : 'UNCERTAIN';
  } catch (error) {
    const failedAt = new Date().toISOString();
    result = {
      npi: normalizedNpi,
      excluded: false,
      verdict: 'UNCERTAIN',
      exclusionType: null,
      exclusionDate: null,
      reinstatementDate: null,
      waiverState: null,
      lastCheckedAt: failedAt,
      sourceUrl: 'https://oig.hhs.gov/exclusions/exclusions_list.asp',
      lastVerifiedAt: failedAt,
      provenance: 'OIG LEIE Monthly CSV (check failed)',
    };
    log('warn', 'credential_ingestion_oig_status_failed', {
      npi: normalizedNpi,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }

  const verifiedAt = result.lastCheckedAt;
  const freshUntil = calculateFreshUntil('OIG', verifiedAt, getStateLicenseVerificationFreshnessDays());
  const verificationMethod: CredentialVerificationMethod =
    getConnectorMode('OIG') === 'live' ? 'BULK_DOWNLOAD' : 'MOCK_ADAPTER';
  const rawPayloadHash = sha256ForPayload(result);

  const credentialArtifact = createCredentialArtifactRecord({
    subject_npi: normalizedNpi,
    source_name: 'oig',
    credential_type: 'OIG_EXCLUSION',
    issuer_org_id: 'hhs:oig',
    issued_at: verifiedAt,
    expires_at: null,
    status,
    metadata: {
      oig_verdict: result.verdict,
      exclusion_type: result.exclusionType,
      exclusion_date: result.exclusionDate,
      reinstatement_date: result.reinstatementDate,
      waiver_state: result.waiverState,
    },
  });

  const verificationArtifact = createVerificationArtifactRecord({
    subject_npi: normalizedNpi,
    source_name: 'oig',
    related_credential_hash: credentialArtifact.credential_hash,
    source_type: 'OIG',
    verification_method: verificationMethod,
    verified_at: verifiedAt,
    fresh_until: freshUntil,
    payload_json: {
      excluded: result.excluded,
      verdict: result.verdict,
      exclusion_type: result.exclusionType,
      exclusion_date: result.exclusionDate,
      reinstatement_date: result.reinstatementDate,
      waiver_state: result.waiverState,
      source_url: result.sourceUrl,
      checked_at: result.lastCheckedAt,
    },
  });

  const persisted = await repository.persistIngestionBundle({
    sourceName: 'oig',
    rawPayloadHash,
    retrievedAt: verifiedAt,
    runArtifactHash: buildRunArtifactHash([credentialArtifact, verificationArtifact]),
    provider: providerProfile,
    credentialArtifact: await signCanonicalArtifact(credentialArtifact),
    verificationArtifact: await signCanonicalArtifact(verificationArtifact),
    compatibilityArtifact: {
      npi: normalizedNpi,
      source: 'OIG',
      status,
      checksum: verificationArtifact.evidence_hash,
      rawPayload: verificationArtifact,
      verifiedAt,
      expiresAt: freshUntil,
      psvWindowStart: verifiedAt,
      psvWindowDeadline: freshUntil,
      psvWindowCompliant: Date.parse(freshUntil) > Date.now(),
      claimHashes: [credentialArtifact.credential_hash, verificationArtifact.evidence_hash],
    },
  });

  log('info', 'credential_ingestion_oig_status_persisted', {
    npi: normalizedNpi,
    idempotent: persisted.idempotent,
    verificationRunId: persisted.verificationRunId,
  });
  queuePostIngestionQaSweep(normalizedNpi);

  return buildCredentialIngestionResult(persisted, normalizedNpi, 'oig');
}

export async function ingestLicenseVerification(
  npi: string,
): Promise<CredentialIngestionResult> {
  assertFeatureEnabled();
  const normalizedNpi = validateNpi(npi);

  let activeCredentials = await getActiveCredentials(normalizedNpi);
  let practiceState = resolvePrimaryPracticeState(activeCredentials);
  if (!practiceState) {
    const ingestedNpi = await ingestNpiProfile(normalizedNpi);
    const practiceStates = ingestedNpi.credentialArtifact.metadata?.practice_states;
    practiceState = Array.isArray(practiceStates)
      ? practiceStates.find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length === 2)?.trim().toUpperCase() ?? null
      : null;
    activeCredentials = await getActiveCredentials(normalizedNpi);
  }

  if (!practiceState) {
    throw new Error('license_state_unresolvable');
  }

  const providerProfile = resolveProviderProfileFromCredentials(normalizedNpi, activeCredentials);
  const result: StateBoardResult = await lookupStateBoard(normalizedNpi, practiceState);
  const verifiedAt = result.lastVerifiedAt;
  const freshUntil = calculateFreshUntil(
    'STATE_BOARD',
    verifiedAt,
    getStateLicenseVerificationFreshnessDays(),
  );
  const verificationMethod: CredentialVerificationMethod =
    getConnectorMode('STATE_BOARD') === 'live' ? 'API' : 'MOCK_ADAPTER';
  const rawPayloadHash = sha256ForPayload(result);

  const credentialArtifact = createCredentialArtifactRecord({
    subject_npi: normalizedNpi,
    source_name: 'state-board',
    credential_type: 'STATE_LICENSE',
    issuer_org_id: `state_board:${result.state}`,
    issued_at: verifiedAt,
    expires_at: result.expirationDate,
    status: result.licenseStatus,
    metadata: {
      license_number: result.licenseNumber,
      state: result.state,
      board_name: result.boardName,
      licensee: result.licensee,
    },
  });

  const verificationArtifact = createVerificationArtifactRecord({
    subject_npi: normalizedNpi,
    source_name: 'state-board',
    related_credential_hash: credentialArtifact.credential_hash,
    source_type: 'STATE_BOARD',
    verification_method: verificationMethod,
    verified_at: verifiedAt,
    fresh_until: freshUntil,
    payload_json: {
      state: result.state,
      license_number: result.licenseNumber,
      license_status: result.licenseStatus,
      licensee: result.licensee,
      expiration_date: result.expirationDate,
      board_name: result.boardName,
      source_url: result.sourceUrl,
      last_verified_at: result.lastVerifiedAt,
    },
  });

  const persisted = await repository.persistIngestionBundle({
    sourceName: 'state-board',
    rawPayloadHash,
    retrievedAt: verifiedAt,
    runArtifactHash: buildRunArtifactHash([credentialArtifact, verificationArtifact]),
    provider: {
      ...providerProfile,
      stateOfPractice: result.state,
    },
    credentialArtifact: await signCanonicalArtifact(credentialArtifact),
    verificationArtifact: await signCanonicalArtifact(verificationArtifact),
    compatibilityArtifact: {
      npi: normalizedNpi,
      source: 'STATE_BOARD',
      status: result.licenseStatus,
      checksum: verificationArtifact.evidence_hash,
      rawPayload: verificationArtifact,
      verifiedAt,
      expiresAt: result.expirationDate,
      psvWindowStart: verifiedAt,
      psvWindowDeadline: freshUntil,
      psvWindowCompliant: Date.parse(freshUntil) > Date.now(),
      claimHashes: [credentialArtifact.credential_hash, verificationArtifact.evidence_hash],
    },
  });

  log('info', 'credential_ingestion_state_license_persisted', {
    npi: normalizedNpi,
    state: result.state,
    idempotent: persisted.idempotent,
    verificationRunId: persisted.verificationRunId,
  });
  queuePostIngestionQaSweep(normalizedNpi);

  return buildCredentialIngestionResult(persisted, normalizedNpi, 'state-board');
}
