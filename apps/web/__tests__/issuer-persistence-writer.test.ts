import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReceiptCandidate } from '@/lib/issuer-verification/types';

vi.mock('server-only', () => ({}));

const baseCandidate: ReceiptCandidate = {
  candidateId: 'cand-123',
  createdAt: new Date('2026-05-05T12:00:00Z').toISOString(),
  basis: 'issuer_direct',
  sourceOrganizationName: 'Test GME Office',
  attributionStatus: 'unattributed',
  decisionGrade: false,
  requestId: 'req-456',
  proofTier: 'receipt_candidate',
  reviewState: 'review_required',
};

const createMock = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    receiptCandidate: {
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

const ORIGINAL_FLAG = process.env.ISSUER_PERSISTENCE_ENABLED;

beforeEach(() => {
  createMock.mockReset();
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.ISSUER_PERSISTENCE_ENABLED;
  else process.env.ISSUER_PERSISTENCE_ENABLED = ORIGINAL_FLAG;
});

describe('issuerPersistenceWriter — disabled (default)', () => {
  it('returns recordedBy: demo and never calls prisma when the flag is unset', async () => {
    delete process.env.ISSUER_PERSISTENCE_ENABLED;
    const { writeReceiptCandidateRow } = await import('../lib/issuer-verification/issuerPersistenceWriter');
    const out = await writeReceiptCandidateRow({ candidate: baseCandidate, surface: 'review_surface' });
    expect(out.status).toBe('disabled');
    expect(out.recordedBy).toBe('demo');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns recordedBy: demo when the flag is anything other than the literal "true"', async () => {
    process.env.ISSUER_PERSISTENCE_ENABLED = '1';
    const { writeReceiptCandidateRow } = await import('../lib/issuer-verification/issuerPersistenceWriter');
    const out = await writeReceiptCandidateRow({ candidate: baseCandidate, surface: 'review_surface' });
    expect(out.status).toBe('disabled');
    expect(out.recordedBy).toBe('demo');
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe('issuerPersistenceWriter — enabled, happy path', () => {
  it('persists with recordedBy: system and decisionGrade: false on success', async () => {
    process.env.ISSUER_PERSISTENCE_ENABLED = 'true';
    createMock.mockResolvedValueOnce({ id: 'row-1' });
    const { writeReceiptCandidateRow } = await import('../lib/issuer-verification/issuerPersistenceWriter');
    const out = await writeReceiptCandidateRow({ candidate: baseCandidate, surface: 'review_surface' });
    expect(out.status).toBe('persisted');
    expect(out.recordedBy).toBe('system');
    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.decisionGrade).toBe(false);
    expect(arg.data.proofTier).toBe('receipt_candidate');
    expect(arg.data.recordedBy).toBe('system');
    expect(arg.data.candidateId).toBe('cand-123');
  });
});

describe('issuerPersistenceWriter — enabled, DB CHECK constraint violation', () => {
  it('classifies SQLSTATE 23514 as tamper_detected and falls back to demo', async () => {
    process.env.ISSUER_PERSISTENCE_ENABLED = 'true';
    createMock.mockRejectedValueOnce({ code: '23514', message: 'check constraint violation' });
    const { writeReceiptCandidateRow } = await import('../lib/issuer-verification/issuerPersistenceWriter');
    const out = await writeReceiptCandidateRow({ candidate: baseCandidate, surface: 'review_surface' });
    expect(out.status).toBe('tamper_detected');
    expect(out.recordedBy).toBe('demo');
  });

  it('classifies Prisma-wrapped 23514 as tamper_detected', async () => {
    process.env.ISSUER_PERSISTENCE_ENABLED = 'true';
    createMock.mockRejectedValueOnce({ code: 'P2010', meta: { code: '23514' } });
    const { writeReceiptCandidateRow } = await import('../lib/issuer-verification/issuerPersistenceWriter');
    const out = await writeReceiptCandidateRow({ candidate: baseCandidate, surface: 'review_surface' });
    expect(out.status).toBe('tamper_detected');
    expect(out.recordedBy).toBe('demo');
  });
});

describe('issuerPersistenceWriter — enabled, transient error', () => {
  it('falls back to demo on a generic write failure', async () => {
    process.env.ISSUER_PERSISTENCE_ENABLED = 'true';
    createMock.mockRejectedValueOnce(new Error('connection reset'));
    const { writeReceiptCandidateRow } = await import('../lib/issuer-verification/issuerPersistenceWriter');
    const out = await writeReceiptCandidateRow({ candidate: baseCandidate, surface: 'review_surface' });
    expect(out.status).toBe('transient_error');
    expect(out.recordedBy).toBe('demo');
  });
});
