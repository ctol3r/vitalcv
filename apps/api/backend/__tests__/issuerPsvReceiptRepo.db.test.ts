/**
 * ISSUER-10 — round-trip proof for the contract-aligned PSV receipt writer.
 *
 * These tests are the evidence the ISSUER-9 defer memo demanded before
 * persistence could be enabled: every truth-contract field survives a real
 * Postgres write, and a partial write fails loud instead of being reported as
 * persisted.
 *
 * The regression they defend against is the reason the legacy repository was
 * unusable: it accepted a receipt, wrote `source_authority` + `attestor_id`,
 * and returned success — silently discarding limitations, the contracted-agent
 * distinction, attribution method, scope and freshness.
 */
import { randomUUID } from 'crypto';
import prisma from '../src/graphql/prisma_client';
import {
  assertWritableIssuerPsvReceipt,
  findIssuerPsvReceipt,
  IssuerPsvReceiptContractError,
  writeIssuerAuditEvent,
  writeIssuerPsvReceipt,
  type IssuerPsvReceiptWriteInput,
} from '../repositories/issuerPsvReceipts.repo';

const RUN = randomUUID().slice(0, 8);
const RECEIPT_IDS: string[] = [];
const EVENT_IDS: string[] = [];

const NOW_ISO = '2026-08-09T12:00:00.000Z';

function baseInput(overrides: Partial<IssuerPsvReceiptWriteInput> = {}): IssuerPsvReceiptWriteInput {
  const id = `psv-receipt-${RUN}-${RECEIPT_IDS.length + 1}`;
  RECEIPT_IDS.push(id);
  return {
    psvReceiptId: id,
    psvCandidateId: `psv-cand-${RUN}`,
    receiptCandidateId: `cand-${RUN}`,
    requestId: `req-${RUN}`,
    claimId: `claim-${RUN}`,
    claimType: 'residency',
    promotedAt: '2026-08-09T03:00:00.000Z',
    promotedBy: {
      actorId: 'reviewer-1',
      displayName: 'A. Reviewer',
      role: 'policy_reviewer',
    },
    sourceBasis: {
      sourceOrganizationName: 'Example GME Office',
      isContractedAgent: true,
      agentName: 'Example Verification Partner',
      agentActsFor: 'Example GME Office',
      basisNote: 'Partner responded on behalf of the program office.',
    },
    attributedResponder: {
      name: 'J. Doe',
      role: 'GME Coordinator',
      attributedAt: '2026-08-09T02:00:00.000Z',
      attributionMethod: 'directory_match',
    },
    scope: {
      claimType: 'residency',
      covers: 'Completion of the named residency program for the stated dates.',
      doesNotCover: 'Does not confirm board certification, licensure, or malpractice history.',
      sourceOrganizationName: 'Example GME Office',
    },
    limitations: [
      { kind: 'contracted_agent', description: 'Response came via a contracted agent.' },
      { kind: 'legally_only', description: 'Dates and identity only.' },
    ],
    freshness: {
      ttlDays: 365,
      issuedAt: '2026-08-09T03:00:00.000Z',
      staleAfter: '2027-08-09T03:00:00.000Z',
    },
    correlationId: `corr-${RUN}`,
    ...overrides,
  };
}

afterAll(async () => {
  await prisma.issuerPsvReceipt.deleteMany({ where: { psvReceiptId: { in: RECEIPT_IDS } } });
  await prisma.issuerAuditEvent.deleteMany({ where: { eventId: { in: EVENT_IDS } } });
  await prisma.$disconnect();
});

describe('writeIssuerPsvReceipt — every contract field round-trips', () => {
  it('persists and reads back all four nested contract objects verbatim', async () => {
    const input = baseInput();
    const confirmation = await writeIssuerPsvReceipt(input, {
      confirmedBy: 'issuer10-test',
      nowIso: NOW_ISO,
    });

    expect(confirmation.writerMode).toBe('repository');
    expect(confirmation.alreadyPersisted).toBe(false);
    expect(confirmation.persistedRowId).toBeTruthy();

    const row = await findIssuerPsvReceipt(input.psvReceiptId);
    expect(row).not.toBeNull();

    // The exact fields the legacy repository dropped.
    expect(row!.limitations).toEqual(input.limitations);
    expect(row!.sourceBasis).toEqual(input.sourceBasis);
    expect(row!.attributedResponder).toEqual(input.attributedResponder);
    expect(row!.scope).toEqual(input.scope);
    expect(row!.freshness).toEqual(input.freshness);
    expect(row!.promotedBy).toEqual(input.promotedBy);
  });

  it('keeps the contracted-agent and source-of-record identities distinct', async () => {
    const input = baseInput();
    await writeIssuerPsvReceipt(input, { confirmedBy: 'issuer10-test', nowIso: NOW_ISO });
    const row = await findIssuerPsvReceipt(input.psvReceiptId);
    const basis = row!.sourceBasis as unknown as {
      agentName: string;
      agentActsFor: string;
      sourceOrganizationName: string;
    };
    expect(basis.agentName).toBe('Example Verification Partner');
    expect(basis.agentActsFor).toBe('Example GME Office');
    expect(basis.sourceOrganizationName).toBe('Example GME Office');
    expect(basis.agentName).not.toBe(basis.sourceOrganizationName);
  });

  it('writes the truth-tier literals itself', async () => {
    const input = baseInput();
    await writeIssuerPsvReceipt(input, { confirmedBy: 'issuer10-test', nowIso: NOW_ISO });
    const row = await findIssuerPsvReceipt(input.psvReceiptId);
    expect(row!.proofTier).toBe('psv_receipt');
    expect(row!.decisionGrade).toBe(true);
    expect(row!.globalCredentialTruth).toBe(false);
  });

  it('stores the caller-supplied promotion time, not the write clock', async () => {
    const input = baseInput();
    await writeIssuerPsvReceipt(input, { confirmedBy: 'issuer10-test', nowIso: NOW_ISO });
    const row = await findIssuerPsvReceipt(input.psvReceiptId);
    // promotedAt is when the review happened; createdAt is when the row landed.
    // Conflating them is how a request clock becomes a fake observation time.
    expect(row!.promotedAt.toISOString()).toBe('2026-08-09T03:00:00.000Z');
    expect(row!.createdAt.toISOString()).not.toBe(row!.promotedAt.toISOString());
    const freshness = row!.freshness as unknown as { issuedAt: string; staleAfter: string };
    expect(freshness.issuedAt).toBe('2026-08-09T03:00:00.000Z');
    expect(freshness.staleAfter).toBe('2027-08-09T03:00:00.000Z');
  });

  it('persists an empty limitations array as an array, never as absent', async () => {
    const input = baseInput({
      limitations: [],
      sourceBasis: {
        sourceOrganizationName: 'Direct Issuer Office',
        isContractedAgent: false,
      },
    });
    await writeIssuerPsvReceipt(input, { confirmedBy: 'issuer10-test', nowIso: NOW_ISO });
    const row = await findIssuerPsvReceipt(input.psvReceiptId);
    expect(Array.isArray(row!.limitations)).toBe(true);
    expect(row!.limitations).toEqual([]);
  });
});

describe('writeIssuerPsvReceipt — idempotency', () => {
  it('returns the same row for a retried write under one idempotency key', async () => {
    const input = baseInput({ idempotencyKey: `idem-${RUN}` });
    const first = await writeIssuerPsvReceipt(input, {
      confirmedBy: 'issuer10-test',
      nowIso: NOW_ISO,
    });
    const second = await writeIssuerPsvReceipt(input, {
      confirmedBy: 'issuer10-test',
      nowIso: NOW_ISO,
    });

    expect(first.alreadyPersisted).toBe(false);
    expect(second.alreadyPersisted).toBe(true);
    expect(second.persistedRowId).toBe(first.persistedRowId);

    const rows = await prisma.issuerPsvReceipt.findMany({
      where: { idempotencyKey: `idem-${RUN}` },
    });
    expect(rows).toHaveLength(1);
  });
});

describe('assertWritableIssuerPsvReceipt — refusals (no DB required)', () => {
  it('refuses a truth-tier field supplied by a caller', () => {
    const smuggled = { ...baseInput(), decisionGrade: true } as IssuerPsvReceiptWriteInput;
    expect(() => assertWritableIssuerPsvReceipt(smuggled)).toThrow(IssuerPsvReceiptContractError);
  });

  it('refuses a contracted-agent basis with no named principal', () => {
    const input = baseInput({
      sourceBasis: {
        sourceOrganizationName: 'Example GME Office',
        isContractedAgent: true,
      },
    });
    expect(() => assertWritableIssuerPsvReceipt(input)).toThrow(/agentName and agentActsFor/);
  });

  it('refuses a responder with no attribution method', () => {
    const input = baseInput({
      attributedResponder: {
        name: 'J. Doe',
        attributedAt: '2026-08-09T02:00:00.000Z',
      } as IssuerPsvReceiptWriteInput['attributedResponder'],
    });
    expect(() => assertWritableIssuerPsvReceipt(input)).toThrow(/attribution/);
  });

  it('refuses a scope missing its doesNotCover bound', () => {
    const input = baseInput({
      scope: {
        claimType: 'residency',
        covers: 'Completion of the named residency program.',
        doesNotCover: '',
        sourceOrganizationName: 'Example GME Office',
      },
    });
    expect(() => assertWritableIssuerPsvReceipt(input)).toThrow(/doesNotCover/);
  });

  it('refuses a receipt with no freshness policy', () => {
    const input = baseInput({
      freshness: { ttlDays: 365 } as IssuerPsvReceiptWriteInput['freshness'],
    });
    expect(() => assertWritableIssuerPsvReceipt(input)).toThrow(/freshness/);
  });

  it('refuses a missing required field rather than writing a partial row', () => {
    const input = baseInput();
    delete (input as Partial<IssuerPsvReceiptWriteInput>).limitations;
    expect(() => assertWritableIssuerPsvReceipt(input)).toThrow(/limitations/);
  });
});

describe('writeIssuerPsvReceipt — a refused write persists nothing', () => {
  it('leaves no row behind when the contract check fails', async () => {
    const input = baseInput({
      sourceBasis: {
        sourceOrganizationName: 'Example GME Office',
        isContractedAgent: true,
      },
    });
    await expect(
      writeIssuerPsvReceipt(input, { confirmedBy: 'issuer10-test', nowIso: NOW_ISO }),
    ).rejects.toThrow(IssuerPsvReceiptContractError);

    const row = await findIssuerPsvReceipt(input.psvReceiptId);
    expect(row).toBeNull();
  });
});

describe('writeIssuerAuditEvent', () => {
  it('persists an event and preserves an empty payloadHash placeholder', async () => {
    const eventId = `evt-${RUN}-1`;
    EVENT_IDS.push(eventId);
    const confirmation = await writeIssuerAuditEvent(
      {
        eventId,
        correlationId: `corr-${RUN}`,
        requestId: `req-${RUN}`,
        actor: { actorId: 'reviewer-1', displayName: 'A. Reviewer', role: 'policy_reviewer' },
        actorRole: 'policy_reviewer',
        eventType: 'psv_receipt_promoted',
        occurredAt: '2026-08-09T03:00:00.000Z',
        source: 'review_surface',
        // The record type permits this placeholder; a fabricated hash is the
        // failure mode, so the writer must not invent one.
        payloadHash: '',
      },
      { nowIso: NOW_ISO },
    );

    expect(confirmation.writerMode).toBe('repository');
    expect(confirmation.alreadyPersisted).toBe(false);

    const row = await prisma.issuerAuditEvent.findUnique({ where: { eventId } });
    expect(row!.payloadHash).toBe('');
    expect(row!.actorRole).toBe('policy_reviewer');
  });

  it('refuses when actorRole does not mirror actor.role', async () => {
    const eventId = `evt-${RUN}-2`;
    EVENT_IDS.push(eventId);
    await expect(
      writeIssuerAuditEvent(
        {
          eventId,
          correlationId: `corr-${RUN}`,
          requestId: `req-${RUN}`,
          actor: { actorId: 'reviewer-1', role: 'policy_reviewer' },
          actorRole: 'compliance_officer',
          eventType: 'psv_receipt_promoted',
          occurredAt: '2026-08-09T03:00:00.000Z',
          source: 'review_surface',
          payloadHash: '',
        },
        { nowIso: NOW_ISO },
      ),
    ).rejects.toThrow(/mirror mismatch/);

    const row = await prisma.issuerAuditEvent.findUnique({ where: { eventId } });
    expect(row).toBeNull();
  });

  it('is idempotent on eventId', async () => {
    const eventId = `evt-${RUN}-3`;
    EVENT_IDS.push(eventId);
    const payload = {
      eventId,
      correlationId: `corr-${RUN}`,
      requestId: `req-${RUN}`,
      actor: { actorId: 'reviewer-1', role: 'policy_reviewer' },
      actorRole: 'policy_reviewer',
      eventType: 'psv_receipt_promoted',
      occurredAt: '2026-08-09T03:00:00.000Z',
      source: 'review_surface',
      payloadHash: 'sha256:abc',
    };
    const first = await writeIssuerAuditEvent(payload, { nowIso: NOW_ISO });
    const second = await writeIssuerAuditEvent(payload, { nowIso: NOW_ISO });
    expect(second.alreadyPersisted).toBe(true);
    expect(second.persistedRowId).toBe(first.persistedRowId);
  });
});
