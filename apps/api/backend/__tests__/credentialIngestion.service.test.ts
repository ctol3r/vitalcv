const mockLookupByNpi = jest.fn();
const mockCheckOigExclusion = jest.fn();
const mockLookupStateBoard = jest.fn();
const mockGetConnectorMode = jest.fn();
const mockSignArtifactHash = jest.fn();

jest.mock('@vitalcv/psv-adapters', () => ({
  NpiRegistryAdapter: jest.fn().mockImplementation(() => ({
    lookupByNpi: mockLookupByNpi,
  })),
}));

jest.mock('../src/services/providers/connectors/oigConnector', () => ({
  checkOIGExclusion: (...args: unknown[]) => mockCheckOigExclusion(...args),
}));

jest.mock('../src/services/providers/connectors/stateBoardConnector', () => ({
  lookupStateBoard: (...args: unknown[]) => mockLookupStateBoard(...args),
}));

jest.mock('../src/services/providers/connectors/connectorFactory', () => ({
  getConnectorMode: (...args: unknown[]) => mockGetConnectorMode(...args),
}));

jest.mock('../src/services/psv/signingService', () => ({
  signArtifactHash: (...args: unknown[]) => mockSignArtifactHash(...args),
}));

import {
  InMemoryCredentialIngestionRepository,
} from '../repositories/credentialIngestion.repo';
import {
  ingestLicenseVerification,
  ingestNpiProfile,
  ingestOigStatus,
  resetCredentialIngestionRepository,
  setCredentialIngestionRepository,
} from '../src/services/credentials/credentialIngestionService';

function buildNpiBatch(rawResponseHash = 'npi-hash-1', state = 'CA') {
  return {
    retrievalTime: '2026-03-13T12:00:00.000Z',
    rawResponseHash,
    rawResponse: {
      result_count: 1,
      results: [
        {
          number: '1234567893',
          enumeration_type: 'NPI-1',
          basic: {
            first_name: 'JANE',
            last_name: 'DOE',
            status: 'A',
          },
          taxonomies: [
            {
              code: '207Q00000X',
              desc: 'Family Medicine',
            },
          ],
          addresses: [
            {
              address_purpose: 'LOCATION',
              state,
            },
          ],
        },
      ],
    },
    summary: {
      sourceUrl: 'https://npiregistry.cms.hhs.gov/api/?version=2.1&number=1234567893',
      factCount: 3,
    },
    facts: [
      {
        fact: {
          factType: 'IdentityClaim',
          fullName: 'JANE DOE',
          enumerationType: 'NPI-1',
          taxonomies: ['Family Medicine'],
          practiceStates: [state],
          firstName: 'JANE',
          lastName: 'DOE',
        },
      },
    ],
  };
}

describe('credential ingestion service', () => {
  beforeEach(() => {
    process.env.FEATURE_CREDENTIAL_INGESTION = 'true';
    mockLookupByNpi.mockReset();
    mockCheckOigExclusion.mockReset();
    mockLookupStateBoard.mockReset();
    mockGetConnectorMode.mockReset();
    mockSignArtifactHash.mockReset();
    mockGetConnectorMode.mockReturnValue('sandbox');
    mockSignArtifactHash.mockResolvedValue('signed-artifact');
    setCredentialIngestionRepository(new InMemoryCredentialIngestionRepository());
  });

  afterEach(() => {
    delete process.env.FEATURE_CREDENTIAL_INGESTION;
    resetCredentialIngestionRepository();
  });

  test('normalizes NPPES ingestion into credential and verification artifacts', async () => {
    mockLookupByNpi.mockResolvedValue(buildNpiBatch());

    const result = await ingestNpiProfile('1234567893');

    expect(result.sourceName).toBe('npi-registry');
    expect(result.idempotent).toBe(false);
    expect(result.credentialArtifact.credential_type).toBe('NPI_ENROLLMENT');
    expect(result.credentialArtifact.issuer_org_id).toBe('cms:nppes');
    expect(result.credentialArtifact.status).toBe('ACTIVE');
    expect(result.credentialArtifact.metadata?.practice_state).toBe('CA');
    expect(result.verificationArtifact.source_type).toBe('NPPES');
    expect(result.verificationArtifact.verification_method).toBe('API');
    expect(result.verificationArtifact.fresh_until).toBe('2026-04-12T12:00:00.000Z');
  });

  test('normalizes OIG ingestion with clear status', async () => {
    mockLookupByNpi.mockResolvedValue(buildNpiBatch());
    mockCheckOigExclusion.mockResolvedValue({
      npi: '1234567893',
      excluded: false,
      verdict: 'CLEAR',
      exclusionType: null,
      exclusionDate: null,
      reinstatementDate: null,
      waiverState: null,
      lastCheckedAt: '2026-03-13T15:00:00.000Z',
      sourceUrl: 'https://oig.hhs.gov/exclusions/exclusions_list.asp',
    });

    await ingestNpiProfile('1234567893');
    const result = await ingestOigStatus('1234567893');

    expect(result.sourceName).toBe('oig');
    expect(result.credentialArtifact.credential_type).toBe('OIG_EXCLUSION');
    expect(result.credentialArtifact.status).toBe('CLEAR');
    expect(result.verificationArtifact.source_type).toBe('OIG');
    expect(result.verificationArtifact.verification_method).toBe('MOCK_ADAPTER');
    expect(result.verificationArtifact.fresh_until).toBe('2026-03-14T15:00:00.000Z');
  });

  test('maps OIG uncertainty without silently clearing the subject', async () => {
    mockLookupByNpi.mockResolvedValue(buildNpiBatch());
    mockCheckOigExclusion.mockResolvedValue({
      npi: '1234567893',
      excluded: false,
      verdict: 'UNCERTAIN',
      exclusionType: null,
      exclusionDate: null,
      reinstatementDate: null,
      waiverState: null,
      lastCheckedAt: '2026-03-13T15:00:00.000Z',
      sourceUrl: 'https://oig.hhs.gov/exclusions/exclusions_list.asp',
    });

    await ingestNpiProfile('1234567893');
    const result = await ingestOigStatus('1234567893');

    expect(result.credentialArtifact.status).toBe('UNCERTAIN');
    expect(result.credentialArtifact.metadata).toEqual(
      expect.objectContaining({
        oig_verdict: 'UNCERTAIN',
      }),
    );
    expect(result.verificationArtifact.payload_json).toEqual(
      expect.objectContaining({
        verdict: 'UNCERTAIN',
      }),
    );
  });

  test('ingests state license after auto-ingesting NPPES when practice state is missing', async () => {
    mockLookupByNpi.mockResolvedValue(buildNpiBatch('npi-hash-license', 'CA'));
    mockLookupStateBoard.mockResolvedValue({
      npi: '1234567893',
      state: 'CA',
      licenseNumber: 'CA-MD-345678',
      licenseStatus: 'ACTIVE',
      licensee: 'Jane Doe',
      expirationDate: '2027-05-01',
      boardName: 'Medical Board of California',
      lastVerifiedAt: '2026-03-13T18:00:00.000Z',
      sourceUrl: 'https://mbc.ca.gov/breeze/',
    });

    const result = await ingestLicenseVerification('1234567893');

    expect(mockLookupByNpi).toHaveBeenCalledTimes(1);
    expect(mockLookupStateBoard).toHaveBeenCalledWith('1234567893', 'CA');
    expect(result.sourceName).toBe('state-board');
    expect(result.credentialArtifact.credential_type).toBe('STATE_LICENSE');
    expect(result.credentialArtifact.issuer_org_id).toBe('state_board:CA');
    expect(result.credentialArtifact.expires_at).toBe('2027-05-01');
    expect(result.verificationArtifact.source_type).toBe('STATE_BOARD');
    expect(result.verificationArtifact.verification_method).toBe('MOCK_ADAPTER');
    expect(result.verificationArtifact.fresh_until).toBe('2026-06-11T18:00:00.000Z');
  });

  test('returns idempotent results for repeated identical NPPES ingests', async () => {
    mockLookupByNpi.mockResolvedValue(buildNpiBatch('repeat-hash'));

    const first = await ingestNpiProfile('1234567893');
    const second = await ingestNpiProfile('1234567893');

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(second.verificationRunId).toBe(first.verificationRunId);
    expect(second.credentialArtifactId).toBe(first.credentialArtifactId);
    expect(second.verificationArtifactId).toBe(first.verificationArtifactId);
  });
});
