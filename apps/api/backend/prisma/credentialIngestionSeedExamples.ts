import { type CredentialVerificationMethod } from '../src/services/credentials/credentialIngestionTypes';
import {
  buildRunArtifactHash,
  calculateFreshUntil,
  createCredentialArtifactRecord,
  createVerificationArtifactRecord,
} from '../src/services/credentials/credentialIngestionArtifacts';
import type {
  CredentialArtifactStatus,
  CredentialArtifactType,
  CredentialIngestionSourceName,
  CredentialVerificationSourceType,
  IngestionProviderProfile,
  PersistIngestionBundleInput,
  PersistableCanonicalArtifact,
} from '../src/services/credentials/credentialIngestionTypes';
import { PrismaCredentialIngestionRepository } from '../repositories/credentialIngestion.repo';
import { getStateLicenseVerificationFreshnessDays } from '../src/services/credentials/credentialIngestionConfig';
import { signArtifactHash } from '../src/services/psv/signingService';
import { sha256ForPayload, sha256Hex } from '../src/utils/deterministic';

type ExampleSourceFixture = Readonly<{
  sourceName: CredentialIngestionSourceName;
  retrievedAt: string;
  rawPayload: Record<string, unknown>;
  credentialType: CredentialArtifactType;
  issuerOrgId: string;
  status: CredentialArtifactStatus;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  sourceType: CredentialVerificationSourceType;
  verificationMethod: CredentialVerificationMethod;
  payloadJson: Record<string, unknown>;
  includeRawPayloadHash?: boolean;
  compatibilityExpiresAt?: string | null;
}>;

type ExampleClinicianFixture = Readonly<{
  slug: string;
  provider: IngestionProviderProfile;
  sources: readonly ExampleSourceFixture[];
}>;

function deterministicUuid(seed: string): string {
  const hex = sha256Hex(seed);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

async function signPersistableArtifact<TArtifact extends object>(
  seed: string,
  artifact: TArtifact,
  signatureIssuedAt: string,
): Promise<PersistableCanonicalArtifact<TArtifact>> {
  const id = deterministicUuid(seed);
  const signature = await signArtifactHash(sha256ForPayload(artifact), id);

  return {
    id,
    artifact,
    signature,
    signatureAlgorithm: 'ES256',
    signatureIssuedAt,
  };
}

function buildVerificationPayload(
  source: ExampleSourceFixture,
  rawPayloadHash: string,
): Record<string, unknown> {
  if (!source.includeRawPayloadHash) {
    return source.payloadJson;
  }

  return {
    ...source.payloadJson,
    raw_payload_hash: rawPayloadHash,
  };
}

export const CREDENTIAL_INGESTION_EXAMPLE_FIXTURES: readonly ExampleClinicianFixture[] = [
  {
    slug: 'seeded-clinician-clear',
    provider: {
      npi: '1003000126',
      fullName: 'Dr. Jane Doe',
      providerType: 'INDIVIDUAL',
      taxonomyCode: '207Q00000X',
      stateOfPractice: 'CA',
    },
    sources: [
      {
        sourceName: 'npi-registry',
        retrievedAt: '2099-01-10T12:00:00.000Z',
        rawPayload: {
          results: [
            {
              basic: {
                first_name: 'Jane',
                last_name: 'Doe',
                status: 'A',
              },
              enumeration_type: 'NPI-1',
              taxonomies: [
                {
                  code: '207Q00000X',
                  desc: 'Family Medicine',
                },
              ],
              addresses: [
                {
                  address_purpose: 'LOCATION',
                  state: 'CA',
                },
              ],
            },
          ],
        },
        credentialType: 'NPI_ENROLLMENT',
        issuerOrgId: 'cms:nppes',
        status: 'ACTIVE',
        expiresAt: null,
        metadata: {
          full_name: 'Dr. Jane Doe',
          provider_type: 'INDIVIDUAL',
          taxonomy_code: '207Q00000X',
          taxonomy_descriptions: ['Family Medicine'],
          practice_state: 'CA',
          practice_states: ['CA'],
          enumeration_type: 'NPI-1',
          first_name: 'Jane',
          last_name: 'Doe',
        },
        sourceType: 'NPPES',
        verificationMethod: 'API',
        includeRawPayloadHash: true,
        payloadJson: {
          provider_name: 'Dr. Jane Doe',
          provider_type: 'INDIVIDUAL',
          taxonomy_code: '207Q00000X',
          practice_state: 'CA',
          practice_states: ['CA'],
          source_status: 'ACTIVE',
          source_url: 'https://npiregistry.cms.hhs.gov/api/?version=2.1&number=1003000126',
          fact_count: 3,
        },
      },
      {
        sourceName: 'oig',
        retrievedAt: '2099-01-11T08:00:00.000Z',
        rawPayload: {
          npi: '1003000126',
          excluded: false,
          exclusionType: null,
          exclusionDate: null,
          reinstatementDate: null,
          waiverState: null,
          lastCheckedAt: '2099-01-11T08:00:00.000Z',
          sourceUrl: 'https://oig.hhs.gov/exclusions/exclusions_list.asp',
        },
        credentialType: 'OIG_EXCLUSION',
        issuerOrgId: 'hhs:oig',
        status: 'CLEAR',
        expiresAt: null,
        metadata: {
          exclusion_type: null,
          exclusion_date: null,
          reinstatement_date: null,
          waiver_state: null,
        },
        sourceType: 'OIG',
        verificationMethod: 'BULK_DOWNLOAD',
        compatibilityExpiresAt: '2099-01-12T08:00:00.000Z',
        payloadJson: {
          excluded: false,
          exclusion_type: null,
          exclusion_date: null,
          reinstatement_date: null,
          waiver_state: null,
          source_url: 'https://oig.hhs.gov/exclusions/exclusions_list.asp',
          checked_at: '2099-01-11T08:00:00.000Z',
        },
      },
      {
        sourceName: 'state-board',
        retrievedAt: '2099-01-12T09:30:00.000Z',
        rawPayload: {
          npi: '1003000126',
          state: 'CA',
          licenseNumber: 'CA-MD-300012',
          licenseStatus: 'ACTIVE',
          licensee: 'Dr. Jane Doe',
          expirationDate: '2101-06-30T00:00:00.000Z',
          boardName: 'Medical Board of California',
          lastVerifiedAt: '2099-01-12T09:30:00.000Z',
          sourceUrl: 'https://mbc.ca.gov/breeze/',
        },
        credentialType: 'STATE_LICENSE',
        issuerOrgId: 'state_board:CA',
        status: 'ACTIVE',
        expiresAt: '2101-06-30T00:00:00.000Z',
        metadata: {
          license_number: 'CA-MD-300012',
          state: 'CA',
          board_name: 'Medical Board of California',
          licensee: 'Dr. Jane Doe',
        },
        sourceType: 'STATE_BOARD',
        verificationMethod: 'MOCK_ADAPTER',
        compatibilityExpiresAt: '2101-06-30T00:00:00.000Z',
        payloadJson: {
          state: 'CA',
          license_number: 'CA-MD-300012',
          license_status: 'ACTIVE',
          licensee: 'Dr. Jane Doe',
          expiration_date: '2101-06-30T00:00:00.000Z',
          board_name: 'Medical Board of California',
          source_url: 'https://mbc.ca.gov/breeze/',
          last_verified_at: '2099-01-12T09:30:00.000Z',
        },
      },
    ],
  },
  {
    slug: 'seeded-clinician-flagged',
    provider: {
      npi: '1003000129',
      fullName: 'Dr. Amir Patel',
      providerType: 'INDIVIDUAL',
      taxonomyCode: '208D00000X',
      stateOfPractice: 'NY',
    },
    sources: [
      {
        sourceName: 'npi-registry',
        retrievedAt: '2099-02-03T11:15:00.000Z',
        rawPayload: {
          results: [
            {
              basic: {
                first_name: 'Amir',
                last_name: 'Patel',
                status: 'A',
              },
              enumeration_type: 'NPI-1',
              taxonomies: [
                {
                  code: '208D00000X',
                  desc: 'General Practice',
                },
              ],
              addresses: [
                {
                  address_purpose: 'LOCATION',
                  state: 'NY',
                },
              ],
            },
          ],
        },
        credentialType: 'NPI_ENROLLMENT',
        issuerOrgId: 'cms:nppes',
        status: 'ACTIVE',
        expiresAt: null,
        metadata: {
          full_name: 'Dr. Amir Patel',
          provider_type: 'INDIVIDUAL',
          taxonomy_code: '208D00000X',
          taxonomy_descriptions: ['General Practice'],
          practice_state: 'NY',
          practice_states: ['NY'],
          enumeration_type: 'NPI-1',
          first_name: 'Amir',
          last_name: 'Patel',
        },
        sourceType: 'NPPES',
        verificationMethod: 'API',
        includeRawPayloadHash: true,
        payloadJson: {
          provider_name: 'Dr. Amir Patel',
          provider_type: 'INDIVIDUAL',
          taxonomy_code: '208D00000X',
          practice_state: 'NY',
          practice_states: ['NY'],
          source_status: 'ACTIVE',
          source_url: 'https://npiregistry.cms.hhs.gov/api/?version=2.1&number=1003000129',
          fact_count: 3,
        },
      },
      {
        sourceName: 'oig',
        retrievedAt: '2099-02-03T12:00:00.000Z',
        rawPayload: {
          npi: '1003000129',
          excluded: true,
          exclusionType: '1128(a)(1)',
          exclusionDate: '2098-11-01',
          reinstatementDate: null,
          waiverState: 'NY',
          lastCheckedAt: '2099-02-03T12:00:00.000Z',
          sourceUrl: 'https://oig.hhs.gov/exclusions/exclusions_list.asp',
        },
        credentialType: 'OIG_EXCLUSION',
        issuerOrgId: 'hhs:oig',
        status: 'EXCLUDED',
        expiresAt: null,
        metadata: {
          exclusion_type: '1128(a)(1)',
          exclusion_date: '2098-11-01',
          reinstatement_date: null,
          waiver_state: 'NY',
        },
        sourceType: 'OIG',
        verificationMethod: 'BULK_DOWNLOAD',
        compatibilityExpiresAt: '2099-02-04T12:00:00.000Z',
        payloadJson: {
          excluded: true,
          exclusion_type: '1128(a)(1)',
          exclusion_date: '2098-11-01',
          reinstatement_date: null,
          waiver_state: 'NY',
          source_url: 'https://oig.hhs.gov/exclusions/exclusions_list.asp',
          checked_at: '2099-02-03T12:00:00.000Z',
        },
      },
      {
        sourceName: 'state-board',
        retrievedAt: '2099-02-03T14:45:00.000Z',
        rawPayload: {
          npi: '1003000129',
          state: 'NY',
          licenseNumber: 'NY-MD-300012',
          licenseStatus: 'SUSPENDED',
          licensee: 'Dr. Amir Patel',
          expirationDate: null,
          boardName: 'New York State Education Department',
          lastVerifiedAt: '2099-02-03T14:45:00.000Z',
          sourceUrl: 'http://www.op.nysed.gov/opsearches.htm',
        },
        credentialType: 'STATE_LICENSE',
        issuerOrgId: 'state_board:NY',
        status: 'SUSPENDED',
        expiresAt: null,
        metadata: {
          license_number: 'NY-MD-300012',
          state: 'NY',
          board_name: 'New York State Education Department',
          licensee: 'Dr. Amir Patel',
        },
        sourceType: 'STATE_BOARD',
        verificationMethod: 'MOCK_ADAPTER',
        compatibilityExpiresAt: null,
        payloadJson: {
          state: 'NY',
          license_number: 'NY-MD-300012',
          license_status: 'SUSPENDED',
          licensee: 'Dr. Amir Patel',
          expiration_date: null,
          board_name: 'New York State Education Department',
          source_url: 'http://www.op.nysed.gov/opsearches.htm',
          last_verified_at: '2099-02-03T14:45:00.000Z',
        },
      },
    ],
  },
];

async function buildPersistInput(
  provider: IngestionProviderProfile,
  source: ExampleSourceFixture,
): Promise<PersistIngestionBundleInput> {
  const rawPayloadHash = sha256ForPayload(source.rawPayload);
  const freshUntil = calculateFreshUntil(
    source.sourceType,
    source.retrievedAt,
    getStateLicenseVerificationFreshnessDays(),
  );
  const credentialArtifact = createCredentialArtifactRecord({
    subject_npi: provider.npi,
    source_name: source.sourceName,
    credential_type: source.credentialType,
    issuer_org_id: source.issuerOrgId,
    issued_at: source.retrievedAt,
    expires_at: source.expiresAt,
    status: source.status,
    metadata: source.metadata,
  });
  const verificationArtifact = createVerificationArtifactRecord({
    subject_npi: provider.npi,
    source_name: source.sourceName,
    related_credential_hash: credentialArtifact.credential_hash,
    source_type: source.sourceType,
    verification_method: source.verificationMethod,
    verified_at: source.retrievedAt,
    fresh_until: freshUntil,
    payload_json: buildVerificationPayload(source, rawPayloadHash),
  });

  return {
    sourceName: source.sourceName,
    rawPayloadHash,
    retrievedAt: source.retrievedAt,
    runArtifactHash: buildRunArtifactHash([credentialArtifact, verificationArtifact]),
    provider,
    credentialArtifact: await signPersistableArtifact(
      `${provider.npi}:${source.sourceName}:credential`,
      credentialArtifact,
      source.retrievedAt,
    ),
    verificationArtifact: await signPersistableArtifact(
      `${provider.npi}:${source.sourceName}:verification`,
      verificationArtifact,
      source.retrievedAt,
    ),
    compatibilityArtifact: {
      npi: provider.npi,
      source: source.sourceType,
      status: source.status,
      checksum: verificationArtifact.evidence_hash,
      rawPayload: verificationArtifact,
      verifiedAt: source.retrievedAt,
      expiresAt: source.compatibilityExpiresAt ?? source.expiresAt ?? freshUntil,
      psvWindowStart: source.retrievedAt,
      psvWindowDeadline: freshUntil,
      psvWindowCompliant: Date.parse(freshUntil) > Date.now(),
      claimHashes: [credentialArtifact.credential_hash, verificationArtifact.evidence_hash],
    },
  };
}

export async function buildCredentialIngestionExampleBundles(): Promise<
  readonly PersistIngestionBundleInput[]
> {
  const bundles = await Promise.all(
    CREDENTIAL_INGESTION_EXAMPLE_FIXTURES.flatMap((fixture) =>
      fixture.sources.map((source) => buildPersistInput(fixture.provider, source)),
    ),
  );

  return bundles;
}

export async function seedCredentialIngestionExamples(): Promise<{
  clinicianCount: number;
  seededRunCount: number;
}> {
  const repository = new PrismaCredentialIngestionRepository();
  const bundles = await buildCredentialIngestionExampleBundles();
  let seededRunCount = 0;

  for (const bundle of bundles) {
    const persisted = await repository.persistIngestionBundle(bundle);
    if (!persisted.idempotent) {
      seededRunCount += 1;
    }
  }

  return {
    clinicianCount: CREDENTIAL_INGESTION_EXAMPLE_FIXTURES.length,
    seededRunCount,
  };
}
