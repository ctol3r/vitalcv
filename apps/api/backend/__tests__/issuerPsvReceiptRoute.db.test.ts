/**
 * ISSUER-10 — the client-safe write boundary, exercised end to end.
 *
 * The route is the seam a green build says nothing about: it is the only place
 * where the operator opt-in, the guarded auth, the repository contract and the
 * confirmation shape meet. These tests drive it over HTTP against real
 * Postgres.
 *
 * The outcome being defended: a 200 response that says `persisted: false` is
 * normal and honest. Nothing may read the status code as proof of a row.
 */
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../src/app';
import prisma from '../src/graphql/prisma_client';

const RUN = randomUUID().slice(0, 8);
const RECEIPT_IDS: string[] = [];
const ORIGINAL_FLAG = process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED;
const ORIGINAL_SECRET = process.env.ISSUER_PSV_RECEIPT_WRITER_SECRET;

const ROUTE = '/api/internal/issuer/psv-receipts';
const TEST_SECRET = `issuer10-writer-secret-${RUN}`;

beforeAll(() => {
  process.env.ISSUER_PSV_RECEIPT_WRITER_SECRET = TEST_SECRET;
});

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.ISSUER_PSV_RECEIPT_WRITER_SECRET;
  else process.env.ISSUER_PSV_RECEIPT_WRITER_SECRET = ORIGINAL_SECRET;
});

function post(body: object) {
  return request(app).post(ROUTE).set('x-issuer-writer-secret', TEST_SECRET).send(body);
}

function receipt(suffix: string) {
  const psvReceiptId = `psv-receipt-route-${RUN}-${suffix}`;
  RECEIPT_IDS.push(psvReceiptId);
  return {
    psvReceiptId,
    psvCandidateId: `psv-cand-${RUN}`,
    receiptCandidateId: `cand-${RUN}`,
    requestId: `req-${RUN}`,
    claimId: `claim-${RUN}`,
    claimType: 'residency',
    promotedAt: '2026-08-09T03:00:00.000Z',
    promotedBy: { actorId: 'reviewer-1', displayName: 'A. Reviewer', role: 'policy_reviewer' },
    sourceBasis: {
      sourceOrganizationName: 'Example GME Office',
      isContractedAgent: true,
      agentName: 'Example Verification Partner',
      agentActsFor: 'Example GME Office',
    },
    attributedResponder: {
      name: 'J. Doe',
      attributedAt: '2026-08-09T02:00:00.000Z',
      attributionMethod: 'directory_match',
    },
    scope: {
      claimType: 'residency',
      covers: 'Completion of the named residency program for the stated dates.',
      doesNotCover: 'Does not confirm licensure or board certification.',
      sourceOrganizationName: 'Example GME Office',
    },
    limitations: [{ kind: 'contracted_agent', description: 'Response came via a contracted agent.' }],
    freshness: {
      ttlDays: 365,
      issuedAt: '2026-08-09T03:00:00.000Z',
      staleAfter: '2027-08-09T03:00:00.000Z',
    },
    correlationId: `corr-${RUN}`,
  };
}

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED;
  else process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED = ORIGINAL_FLAG;
});

afterAll(async () => {
  await prisma.issuerPsvReceipt.deleteMany({ where: { psvReceiptId: { in: RECEIPT_IDS } } });
  await prisma.$disconnect();
});

describe('POST /api/internal/issuer/psv-receipts — auth', () => {
  it('refuses an unauthenticated write', async () => {
    process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED = 'true';
    const body = receipt('no-key');

    const res = await request(app)
      .post(ROUTE)
      .send({ receipt: body, enableRepositoryWrites: true });

    expect(res.status).toBe(403);

    const row = await prisma.issuerPsvReceipt.findUnique({
      where: { psvReceiptId: body.psvReceiptId },
    });
    expect(row).toBeNull();
  });

  it('refuses a wrong secret', async () => {
    process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED = 'true';
    const body = receipt('bad-key');

    const res = await request(app)
      .post(ROUTE)
      .set('x-issuer-writer-secret', 'not-the-configured-secret')
      .send({ receipt: body, enableRepositoryWrites: true });

    expect(res.status).toBe(403);

    const row = await prisma.issuerPsvReceipt.findUnique({
      where: { psvReceiptId: body.psvReceiptId },
    });
    expect(row).toBeNull();
  });

  it('fails closed when no secret is provisioned — refuses everyone', async () => {
    process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED = 'true';
    delete process.env.ISSUER_PSV_RECEIPT_WRITER_SECRET;
    const body = receipt('no-secret-configured');

    const res = await request(app)
      .post(ROUTE)
      .set('x-issuer-writer-secret', TEST_SECRET)
      .send({ receipt: body, enableRepositoryWrites: true });

    expect(res.status).toBe(403);
    process.env.ISSUER_PSV_RECEIPT_WRITER_SECRET = TEST_SECRET;

    const row = await prisma.issuerPsvReceipt.findUnique({
      where: { psvReceiptId: body.psvReceiptId },
    });
    expect(row).toBeNull();
  });
});

describe('POST /api/internal/issuer/psv-receipts — dual opt-in', () => {
  it('defers and writes nothing when the deployment flag is off', async () => {
    delete process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED;
    const body = receipt('flag-off');

    const res = await post({ receipt: body, enableRepositoryWrites: true });

    expect(res.status).toBe(200);
    expect(res.body.persisted).toBe(false);
    expect(res.body.status).toBe('deferred');

    const row = await prisma.issuerPsvReceipt.findUnique({
      where: { psvReceiptId: body.psvReceiptId },
    });
    expect(row).toBeNull();
  });

  it('defers when the flag is on but the caller did not ask', async () => {
    process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED = 'true';
    const body = receipt('caller-off');

    const res = await post({ receipt: body });

    expect(res.status).toBe(200);
    expect(res.body.persisted).toBe(false);

    const row = await prisma.issuerPsvReceipt.findUnique({
      where: { psvReceiptId: body.psvReceiptId },
    });
    expect(row).toBeNull();
  });
});

describe('POST /api/internal/issuer/psv-receipts — enabled', () => {
  beforeEach(() => {
    process.env.ISSUER_PSV_RECEIPT_PERSISTENCE_ENABLED = 'true';
  });

  it('persists, confirms, and stores every contract field', async () => {
    const body = receipt('ok');

    const res = await post({ receipt: body, enableRepositoryWrites: true, confirmedBy: 'route-test' });

    expect(res.status).toBe(200);
    expect(res.body.persisted).toBe(true);
    expect(res.body.confirmation.writerMode).toBe('repository');
    expect(res.body.confirmation.persistedRowId).toBeTruthy();
    expect(res.body.confirmation.alreadyPersisted).toBe(false);

    const row = await prisma.issuerPsvReceipt.findUnique({
      where: { psvReceiptId: body.psvReceiptId },
    });
    expect(row).not.toBeNull();
    expect(row!.limitations).toEqual(body.limitations);
    expect(row!.sourceBasis).toEqual(body.sourceBasis);
    expect(row!.attributedResponder).toEqual(body.attributedResponder);
    expect(row!.scope).toEqual(body.scope);
    expect(row!.freshness).toEqual(body.freshness);
    expect(row!.proofTier).toBe('psv_receipt');
    expect(row!.decisionGrade).toBe(true);
    expect(row!.globalCredentialTruth).toBe(false);
  });

  it('refuses a contract violation with 422 and writes nothing', async () => {
    const body = receipt('bad-basis');
    // A contracted agent with no named principal — the collapse the contract forbids.
    body.sourceBasis = {
      sourceOrganizationName: 'Example GME Office',
      isContractedAgent: true,
    } as typeof body.sourceBasis;

    const res = await post({ receipt: body, enableRepositoryWrites: true });

    expect(res.status).toBe(422);
    expect(res.body.persisted).toBe(false);
    expect(res.body.field).toBe('sourceBasis');

    const row = await prisma.issuerPsvReceipt.findUnique({
      where: { psvReceiptId: body.psvReceiptId },
    });
    expect(row).toBeNull();
  });

  it('refuses a caller-supplied truth-tier field', async () => {
    const body = receipt('smuggled') as Record<string, unknown>;
    body.globalCredentialTruth = true;

    const res = await post({ receipt: body, enableRepositoryWrites: true });

    expect(res.status).toBe(422);
    expect(res.body.persisted).toBe(false);
    expect(res.body.field).toBe('globalCredentialTruth');
  });

  it('rejects a request with no receipt', async () => {
    const res = await post({ enableRepositoryWrites: true });
    expect(res.status).toBe(400);
    expect(res.body.persisted).toBe(false);
  });

  it('is idempotent — a retried write returns the same row', async () => {
    const body = { ...receipt('idem'), idempotencyKey: `route-idem-${RUN}` };

    const first = await post({ receipt: body, enableRepositoryWrites: true });
    const second = await post({ receipt: body, enableRepositoryWrites: true });

    expect(first.body.confirmation.alreadyPersisted).toBe(false);
    expect(second.body.confirmation.alreadyPersisted).toBe(true);
    expect(second.body.confirmation.persistedRowId).toBe(first.body.confirmation.persistedRowId);

    const rows = await prisma.issuerPsvReceipt.findMany({
      where: { idempotencyKey: `route-idem-${RUN}` },
    });
    expect(rows).toHaveLength(1);
  });

  it('co-persists an audit event without fabricating a payload hash', async () => {
    const body = receipt('with-audit');
    const eventId = `evt-route-${RUN}`;

    const res = await post({
        receipt: body,
        enableRepositoryWrites: true,
        auditEvent: {
          eventId,
          correlationId: `corr-${RUN}`,
          requestId: `req-${RUN}`,
          actor: { actorId: 'reviewer-1', role: 'policy_reviewer' },
          actorRole: 'policy_reviewer',
          eventType: 'psv_receipt_promoted',
          occurredAt: '2026-08-09T03:00:00.000Z',
          source: 'review_surface',
          payloadHash: '',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.auditEvent.persistedRowId).toBeTruthy();

    const event = await prisma.issuerAuditEvent.findUnique({ where: { eventId } });
    expect(event!.payloadHash).toBe('');
    await prisma.issuerAuditEvent.deleteMany({ where: { eventId } });
  });
});
