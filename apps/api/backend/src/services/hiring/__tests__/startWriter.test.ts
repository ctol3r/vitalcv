/**
 * A start and its non-repudiation audit row are inseparable.
 *
 * `START_ATTESTED` is one of the five canonical non-repudiation events, so a
 * `StartAttestation` without one is an unprovable claim. The canonical writer
 * is now `services/activation/applicationStartCommandService.ts` (ADR 0007
 * amendment, start-writer succession); this legacy writer remains solely for
 * the entity-scoped confirm-start path in employerActions.ts, and the
 * behavioural cases here prove it still pairs the two rows correctly for that
 * caller.
 *
 * The last describe is the routing closure: every start route persists through
 * its ALLOWLISTED writer, never directly. The whole-tree closure (only the two
 * allowlisted modules contain `startAttestation.create` at all) lives in
 * `src/__tests__/acceptanceWriterInventory.test.ts`.
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
  const stripComments = (src: string): string => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it.each([
    // The machine lane and the application surface persist through the
    // canonical application-bound command.
    ['hiring.ts', /confirmStartByAcceptance\s*\(/],
    ['activation.ts', /confirmApplicationStart\s*\(/],
    // The entity-scoped confirm-start path still writes through this legacy
    // writer — its migration is ADR 0007's recorded follow-up.
    ['employerActions.ts', /recordStart\s*\(/],
  ] as const)(
    '%s persists its start through its allowlisted writer, not directly',
    (file, writerCall) => {
      const code = stripComments(readFileSync(join(ROUTES, file), 'utf8'));

      expect(code).not.toMatch(/startAttestation\s*\.\s*create/);
      expect(code).toMatch(writerCall);
    },
  );
});
