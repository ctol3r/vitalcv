const verificationReceiptCreateMock = jest.fn();
const claimRecordFindFirstMock = jest.fn();

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    claimRecord: {
      findFirst: (...args: unknown[]) => claimRecordFindFirstMock(...args),
    },
    verificationReceiptRecord: {
      create: (...args: unknown[]) => verificationReceiptCreateMock(...args),
      findMany: jest.fn(),
    },
  },
  Prisma: {},
}));

import {
  normalizeVerificationRecordInput,
  persistVerificationReceiptRecords,
} from '../identityStore';
import type { NormalizedClaim, VerificationReceipt } from '../evidenceModel';

describe('identityStore verification receipt serialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    claimRecordFindFirstMock.mockResolvedValue({ id: 'claim-record-1' });
    verificationReceiptCreateMock.mockResolvedValue({ id: 'receipt-record-1' });
  });

  test('normalizes Prisma receipt payload fields into safe scalar values', () => {
    const normalized = normalizeVerificationRecordInput({
      receiptId: 'receipt-1',
      claimRecordId: 'claim-record-1',
      claimId: 'claim-1',
      sourceRunId: 'source-run-1',
      sourceRecordId: 'source-record-1',
      verificationArtifactId: 'artifact-1',
      personProfileId: null,
      subjectNpi: '1558302470',
      entityId: 'npi:1558302470',
      field: 'licenseStatus',
      value: {
        status: 'ACTIVE',
        dropMe: undefined,
        nested: {
          keep: true,
          remove: undefined,
        },
      },
      trustTier: 'GOLD',
      confidence: '0.91',
      sourceArtifactId: 'artifact-1',
      sourceSystem: 'NPPES_API',
      parserVersion: 'nppes/v1',
      matchingStrategy: undefined,
      observedAt: 'not-a-date',
      explanation: 'Source-backed verification.',
      expiresAt: 'still-not-a-date',
      sourceUrl: 'https://example.com/source',
      retrievedAt: '2026-04-03T12:00:00.000Z',
      rawArtifactRef: undefined,
      checksum: undefined,
      claimType: 'LICENSE_STATUS',
      matchConfidence: 'HIGH',
      freshnessWindowHours: '168',
      integrityHash: undefined,
    });

    expect(normalized.value).toEqual({
      status: 'ACTIVE',
      nested: { keep: true },
    });
    expect(normalized.confidence).toBe(0.91);
    expect(normalized.freshnessWindowHours).toBe(168);
    expect(normalized.observedAt).toBeInstanceOf(Date);
    expect(Number.isNaN((normalized.observedAt as Date).getTime())).toBe(false);
    expect(normalized.expiresAt).toBeNull();
    expect(normalized.retrievedAt).toEqual(new Date('2026-04-03T12:00:00.000Z'));
    expect(Object.values(normalized)).not.toContain(undefined);
  });

  test('sanitizes receipt writes before calling Prisma create', async () => {
    const claim: NormalizedClaim = {
      claimId: 'claim-1',
      claimType: 'LICENSE',
      subjectNpi: '1558302470',
      value: {
        _type: 'GENERIC',
        status: 'ACTIVE',
      },
      tier: 'GOLD',
      confidence: 'HIGH',
      confidenceScore: 0.97,
      sourceId: 'NPPES_API',
      artifactId: 'artifact-1',
      artifactChecksum: 'checksum-1',
      parserVersion: 'nppes/v1',
      derivedAt: '2026-04-03T12:00:00.000Z',
      observedAt: '2026-04-02T12:00:00.000Z',
      validFrom: null,
      validUntil: null,
      expiresAt: '2026-04-10T12:00:00.000Z',
      status: 'ACTIVE',
      supersededBy: null,
      supersedes: null,
      reviewRequired: false,
      reviewReason: null,
      humanReviewAt: null,
      explanation: 'License status verified.',
      freshnessWindowHours: 168,
    };

    await persistVerificationReceiptRecords({
      sourceRunId: 'source-run-1',
      sourceRecordId: 'source-record-1',
      verificationArtifactId: 'artifact-1',
      personProfileId: undefined,
      subjectNpi: '1558302470',
      claims: [claim],
      receipts: [
        {
          receipt_id: 'receipt-1',
          claim_id: 'claim-1',
          entity_id: 'npi:1558302470',
          field: 'licenseStatus',
          value: {
            status: 'ACTIVE',
            omitMe: undefined,
            nested: {
              keep: 'yes',
              remove: undefined,
            },
          },
          tier: 'GOLD',
          confidence: '0.88' as unknown as number,
          source_artifact_id: 'artifact-1',
          source_system: 'NPPES_API',
          observed_at: 'invalid-date',
          parser_version: 'nppes/v1',
          expires_at: null,
          explanation: 'Source-backed verification.',
          source_url: 'https://example.com/source',
          retrieved_at: 'still-invalid',
          raw_artifact_ref: undefined,
          checksum: undefined,
          claim_type: 'LICENSE',
          match_confidence: 'HIGH',
          freshness_window_hours: 168,
          integrity_hash: undefined,
        } as unknown as VerificationReceipt,
      ],
      matchingStrategy: undefined,
    });

    expect(verificationReceiptCreateMock).toHaveBeenCalledTimes(1);

    const [{ data }] = verificationReceiptCreateMock.mock.calls[0] as Array<{
      data: Record<string, unknown>;
    }>;

    expect(data.value).toEqual({
      status: 'ACTIVE',
      nested: { keep: 'yes' },
    });
    expect(data.confidence).toBe(0.88);
    expect(data.observedAt).toBeInstanceOf(Date);
    expect(Number.isNaN((data.observedAt as Date).getTime())).toBe(false);
    expect(data.retrievedAt).toBeNull();
    expect(data.personProfileId).toBeNull();
    expect(Object.values(data)).not.toContain(undefined);
  });
});
