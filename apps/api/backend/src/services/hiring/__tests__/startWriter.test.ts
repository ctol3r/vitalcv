/**
 * A start and its non-repudiation audit row are inseparable.
 *
 * `START_ATTESTED` is one of the five canonical non-repudiation events, so a
 * `StartAttestation` without one is an unprovable claim. Both wired start
 * routes already paired them correctly, but nothing made that structural — a
 * third writer could have added a start with no audit row and no test would
 * have objected. `recordStart()` is now the only caller of
 * `startAttestation.create`, and this file is what keeps it that way.
 *
 * The last test is the load-bearing one: it asserts no route reintroduces its
 * own start write. That is the closure. The behavioural cases above it prove
 * the writer the routes were pointed at is itself correct — a guard that only
 * checked routing would happily protect a broken writer.
 */
jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
  },
}));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import prisma from '../../../graphql/prisma_client';
import { recordStart, type RecordStartInput } from '../startWriter';

const ROUTES = join(__dirname, '..', '..', '..', 'routes');

type TxStub = {
  startAttestation: { create: jest.Mock };
  auditEvent: { create: jest.Mock };
};

function txStub(overrides: Partial<TxStub> = {}): TxStub {
  return {
    startAttestation: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data })),
    },
    auditEvent: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data })),
    },
    ...overrides,
  };
}

/** Run the real callback against a stub tx, the way $transaction would. */
function runTransactionWith(tx: TxStub): void {
  (prisma.$transaction as unknown as jest.Mock).mockImplementation(
    (cb: (t: TxStub) => Promise<unknown>) => cb(tx),
  );
}

const INPUT: RecordStartInput = {
  attestationId: '11111111-1111-4111-8111-111111111111',
  acceptanceId: '22222222-2222-4222-8222-222222222222',
  clinicianNpi: '1234567893',
  role: '  Hospitalist  ',
  facility: '  Mercy General  ',
  startedAt: new Date('2026-09-01T00:00:00.000Z'),
  attestationHash: 'deadbeef',
  auditMetadata: { some: 'caller-specific context' },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('recordStart', () => {
  it('writes both rows inside one transaction', async () => {
    const tx = txStub();
    runTransactionWith(tx);

    await recordStart(INPUT);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.startAttestation.create).toHaveBeenCalledTimes(1);
    expect(tx.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it('binds the audit row to the attestation it attests to', async () => {
    const tx = txStub();
    runTransactionWith(tx);

    await recordStart(INPUT);

    const audit = tx.auditEvent.create.mock.calls[0][0].data;
    expect(audit.referenceId).toBe(INPUT.attestationId);
    expect(audit.type).toBe('START_ATTESTED');
    expect(audit.clinicianId).toBe(INPUT.clinicianNpi);
    expect(audit.anchored).toBe(false);
  });

  it("stores the caller's hash and metadata verbatim", async () => {
    const tx = txStub();
    runTransactionWith(tx);

    await recordStart(INPUT);

    const audit = tx.auditEvent.create.mock.calls[0][0].data;
    // The hash is a tamper-evident commitment to a payload only the caller
    // knows the shape of. Rewriting or recomputing it here would silently
    // change what the ledger commits to.
    expect(audit.hash).toBe(INPUT.attestationHash);
    expect(audit.metadata).toEqual(INPUT.auditMetadata);
  });

  it('trims role and facility, matching what both routes did inline', async () => {
    const tx = txStub();
    runTransactionWith(tx);

    await recordStart(INPUT);

    const row = tx.startAttestation.create.mock.calls[0][0].data;
    expect(row.role).toBe('Hospitalist');
    expect(row.facility).toBe('Mercy General');
  });

  it('pins createdAt only when the caller commits to it', async () => {
    const withPin = txStub();
    runTransactionWith(withPin);
    const createdAt = new Date('2026-08-11T00:00:00.000Z');
    await recordStart({ ...INPUT, createdAt });
    expect(withPin.startAttestation.create.mock.calls[0][0].data.createdAt).toEqual(createdAt);

    const withoutPin = txStub();
    runTransactionWith(withoutPin);
    await recordStart(INPUT);
    // Absent, so the column default applies — not null, which would override it.
    expect(withoutPin.startAttestation.create.mock.calls[0][0].data).not.toHaveProperty('createdAt');
  });

  it('writes no attestation when the audit row fails', async () => {
    // $transaction rejects, so neither row survives. Asserting the rejection
    // propagates is what proves the caller cannot treat a failed audit write as
    // a successful start.
    const tx = txStub({
      auditEvent: { create: jest.fn().mockRejectedValue(new Error('audit write failed')) },
    });
    runTransactionWith(tx);

    await expect(recordStart(INPUT)).rejects.toThrow('audit write failed');
  });
});

describe('no route writes a start on its own', () => {
  it.each([['hiring.ts'], ['employerActions.ts']])(
    '%s persists its start through recordStart, not directly',
    (file) => {
      const code = readFileSync(join(ROUTES, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');

      expect(code).not.toMatch(/startAttestation\s*\.\s*create/);
      expect(code).toMatch(/recordStart\s*\(/);
    },
  );
});
