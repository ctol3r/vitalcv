import {
  createCredentialArtifactRecord,
  createVerificationArtifactRecord,
} from '../../credentials/credentialIngestionArtifacts';

const mockFindActiveCredentialsByNpi = jest.fn();
const mockFindVerificationArtifactsByNpi = jest.fn();
const mockGetStatus = jest.fn();
const mockComputeForClinician = jest.fn();
const mockPsvReceiptFindMany = jest.fn();
const mockVerificationArtifactFindFirst = jest.fn();
const mockVerificationRunFindMany = jest.fn();

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    psvReceipt: {
      findMany: mockPsvReceiptFindMany,
    },
    verificationArtifact: {
      findFirst: mockVerificationArtifactFindFirst,
    },
    verificationRun: {
      findMany: mockVerificationRunFindMany,
    },
  },
}));

jest.mock('../../../../repositories/credentialIngestion.repo', () => ({
  PrismaCredentialIngestionRepository: jest.fn().mockImplementation(() => ({
    findActiveCredentialsByNpi: mockFindActiveCredentialsByNpi,
    findVerificationArtifactsByNpi: mockFindVerificationArtifactsByNpi,
  })),
}));

jest.mock('../../psvInterop/canonicalFactStore', () => ({
  BackendCanonicalCredentialFactStore: jest.fn().mockImplementation(() => ({
    getStatus: mockGetStatus,
  })),
}));

jest.mock('@vitalcv/crs', () => ({
  CrsEngine: jest.fn().mockImplementation(() => ({
    computeForClinician: mockComputeForClinician,
  })),
}));

import { buildPASObject } from '../pasBuilder';

describe('buildPASObject', () => {
  const npi = '1003000126';
  const credentialArtifact = createCredentialArtifactRecord({
    subject_npi: npi,
    source_name: 'npi-registry',
    credential_type: 'NPI_ENROLLMENT',
    issuer_org_id: 'cms:nppes',
    issued_at: '2026-03-13T12:00:00.000Z',
    expires_at: null,
    status: 'ACTIVE',
    metadata: {
      full_name: 'Seeded Provider',
    },
  });
  const verificationArtifact = createVerificationArtifactRecord({
    subject_npi: npi,
    source_name: 'npi-registry',
    related_credential_hash: credentialArtifact.credential_hash,
    source_type: 'NPPES',
    verification_method: 'API',
    verified_at: '2026-03-13T12:00:00.000Z',
    fresh_until: '2026-04-12T12:00:00.000Z',
    payload_json: {
      provider_name: 'Seeded Provider',
    },
  });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-14T12:00:00.000Z'));

    mockFindActiveCredentialsByNpi.mockReset();
    mockFindVerificationArtifactsByNpi.mockReset();
    mockGetStatus.mockReset();
    mockComputeForClinician.mockReset();
    mockPsvReceiptFindMany.mockReset();
    mockVerificationArtifactFindFirst.mockReset();
    mockVerificationRunFindMany.mockReset();

    mockFindActiveCredentialsByNpi.mockResolvedValue([
      {
        artifactId: 'cred-1',
        verificationRunId: 'run-1',
        artifact: credentialArtifact,
        createdAt: '2026-03-13T12:00:01.000Z',
      },
    ]);
    mockFindVerificationArtifactsByNpi.mockResolvedValue([
      {
        artifactId: 'ver-1',
        verificationRunId: 'run-1',
        artifact: verificationArtifact,
        createdAt: '2026-03-13T12:00:01.000Z',
      },
    ]);
    mockGetStatus.mockResolvedValue({
      readinessScore: 92,
      lastRun: '2026-03-13T12:05:00.000Z',
    });
    mockComputeForClinician.mockResolvedValue({
      clinician_id: npi,
      score: 90,
      band: 'GREEN',
      blocking_reasons: [],
      last_verified_at: '2026-03-13T12:05:00.000Z',
    });
    mockPsvReceiptFindMany.mockResolvedValue([
      {
        receiptId: 'rcpt-1',
        sourceAuthority: 'NPPES',
        licenseId: npi,
        fetchedAt: new Date('2026-03-13T12:00:00.000Z'),
        ttlSeconds: 2_592_000,
        revoked: false,
        responseHash: 'r'.repeat(64),
        lane: 'PUBLIC',
        verificationCheck: 'NPPES',
        verificationOutcome: 'PASS',
        failureReason: null,
        source: 'NPPES',
        attestorId: null,
        verificationRequestId: 'req-1',
      },
    ]);
    mockVerificationArtifactFindFirst.mockResolvedValue({
      id: 'compat-1',
      merkleRoot: 'merkle-root-1',
    });
    mockVerificationRunFindMany.mockResolvedValue([
      {
        artifacts: [
          { artifactJson: credentialArtifact },
          { artifactJson: verificationArtifact },
        ],
      },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('derives PAS fields from canonical artifacts and receipts', async () => {
    const pas = await buildPASObject(npi);

    expect(pas.subject).toEqual({
      npi,
      name: 'Seeded Provider',
    });
    expect(pas.credentials).toEqual([
      expect.objectContaining({
        immutable_hash: credentialArtifact.credential_hash,
        verified_at: verificationArtifact.verified_at,
        source_authority: 'npi-registry',
      }),
    ]);
    expect(pas.psv_receipts).toEqual([
      expect.objectContaining({
        receipt_id: 'rcpt-1',
        source_authority: 'NPPES',
      }),
    ]);
    expect(pas.authority_state.status).toBe('GREEN');
    expect(pas.audit_trail_pointer).toEqual({
      merkle_root: 'merkle-root-1',
      latest_artifact_id: 'compat-1',
      snapshot_count: 3,
      generated_at: '2026-03-14T12:00:00.000Z',
    });
  });

  test('fails closed when verification provenance is unavailable', async () => {
    mockFindVerificationArtifactsByNpi.mockResolvedValue([]);
    mockVerificationArtifactFindFirst.mockResolvedValue(null);
    mockVerificationRunFindMany.mockResolvedValue([]);

    const pas = await buildPASObject(npi);

    expect(pas.authority_state.status).toBe('RED');
    expect(pas.authority_state.score).toBe(25);
    expect(pas.credentials[0].verified_at).toBe(credentialArtifact.issued_at);
  });
});
