jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    psvReceipt: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../../../graphql/prisma_client';
import { PSVReceipt } from '@vitalcv/psv';
import { PrismaBackedPsvStore } from '../PrismaBackedPsvStore';

const prismaMock = prisma as unknown as {
  psvReceipt: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
};

function createReceipt() {
  return PSVReceipt.create({
    receipt_id: '11111111-1111-4111-8111-111111111111',
    source_authority: 'NPI',
    access_or_license_id: '1234567890',
    transaction_id: 'txn-1',
    fetched_at: '2026-03-14T00:00:00.000Z',
    raw_response: 'raw-response',
    ttl_seconds: 86400,
    revoked: true,
  });
}

describe('PrismaBackedPsvStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.psvReceipt.create.mockResolvedValue({ id: 'psv-row-1' });
    prismaMock.psvReceipt.findMany.mockResolvedValue([]);
  });

  it('mapRowToReceiptRecord maps Prisma row fields into a trust-state receipt record', () => {
    const record = PrismaBackedPsvStore.mapRowToReceiptRecord({
      receiptId: 'receipt-1',
      fetchedAt: new Date('2026-03-14T01:02:03.000Z'),
      ttlSeconds: 3600,
      revoked: true,
      lane: 'MANUAL',
      verificationCheck: 'OIG_LEIE',
      verificationOutcome: 'FAIL',
      failureReason: 'excluded',
      source: 'CVO',
      attestorId: 'attestor-1',
      verificationRequestId: 'verification-request-1',
    });

    expect(record).toEqual({
      receipt_id: 'receipt-1',
      fetched_at: '2026-03-14T01:02:03.000Z',
      ttl_seconds: 3600,
      revoked: true,
      lane: 'MANUAL',
      verification_check: 'OIG_LEIE',
      verification_outcome: 'FAIL',
      failure_reason: 'excluded',
      source: 'CVO',
      attestor_id: 'attestor-1',
      verification_request_id: 'verification-request-1',
    });
  });

  it('appendReceipt writes the expected Prisma PsvReceipt fields', async () => {
    const store = new PrismaBackedPsvStore();
    const receipt = createReceipt();

    await store.appendReceipt({
      clinician_id: '1234567890',
      receipt,
      lane: 'MANUAL',
      verification_check: 'NPI_IDENTITY',
      verification_outcome: 'PASS',
      failure_reason: 'none',
      source: 'CVO',
      attestor_id: 'attestor-1',
      verification_request_id: 'verification-request-1',
    });

    expect(prismaMock.psvReceipt.create).toHaveBeenCalledWith({
      data: {
        receiptId: receipt.receipt_id,
        clinicianId: '1234567890',
        sourceAuthority: 'NPPES',
        licenseId: receipt.receipt_id,
        transactionId: receipt.receipt_id,
        fetchedAt: new Date('2026-03-14T00:00:00.000Z'),
        responseHash: receipt.response_hash,
        ttlSeconds: 86400,
        revoked: true,
        lane: 'MANUAL',
        verificationCheck: 'NPI_IDENTITY',
        verificationOutcome: 'PASS',
        failureReason: 'none',
        source: 'CVO',
        attestorId: 'attestor-1',
        verificationRequestId: 'verification-request-1',
      },
    });
  });

  it('listByClinician queries Prisma by clinicianId and maps the results', async () => {
    prismaMock.psvReceipt.findMany.mockResolvedValue([
      {
        receiptId: 'receipt-1',
        fetchedAt: new Date('2026-03-14T01:02:03.000Z'),
        ttlSeconds: 86400,
        revoked: false,
        lane: 'PUBLIC',
        verificationCheck: 'NPI_IDENTITY',
        verificationOutcome: 'PASS',
        failureReason: null,
        source: null,
        attestorId: null,
        verificationRequestId: null,
      },
    ]);

    const store = new PrismaBackedPsvStore();
    const records = await store.listByClinician('1234567890');

    expect(prismaMock.psvReceipt.findMany).toHaveBeenCalledWith({
      where: { clinicianId: '1234567890' },
      orderBy: { fetchedAt: 'desc' },
    });
    expect(records).toEqual([
      {
        receipt_id: 'receipt-1',
        fetched_at: '2026-03-14T01:02:03.000Z',
        ttl_seconds: 86400,
        revoked: false,
        lane: 'PUBLIC',
        verification_check: 'NPI_IDENTITY',
        verification_outcome: 'PASS',
      },
    ]);
  });

  it('appendReceipt is idempotent when receiptId already exists', async () => {
    prismaMock.psvReceipt.create.mockRejectedValueOnce({ code: 'P2002' });

    const store = new PrismaBackedPsvStore();
    const receipt = createReceipt();

    await expect(
      store.appendReceipt({
        clinician_id: '1234567890',
        receipt,
      }),
    ).resolves.toBe(receipt);

    expect(prismaMock.psvReceipt.create).toHaveBeenCalledTimes(1);
  });
});
