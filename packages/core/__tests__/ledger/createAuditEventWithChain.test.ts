import { describe, expect, it } from 'vitest';
import {
  CHAIN_GENESIS_MARKER,
  calculateNextHash,
} from '../../src/services/ledger/HashChainService';
import {
  createAuditEventWithChain,
  type MinimalAuditPrismaClient,
} from '../../src/services/ledger/createAuditEventWithChain';

/**
 * Builds a fake Prisma client backed by an in-memory store. Sufficient
 * for the unit-level chain-correctness tests; integration tests against
 * the real DB live in apps/api/backend/__tests__ already.
 */
function buildFakePrisma(): MinimalAuditPrismaClient {
  interface Row {
    id: string;
    hash: string;
    lineageKey: string | null;
    priorRunId: string | null;
    createdAt: number;
  }
  const rows: Row[] = [];
  let auto = 0;
  const tx: MinimalAuditPrismaClient = {
    auditEvent: {
      async findFirst({ where }) {
        const filtered = rows
          .filter((r) => r.lineageKey === where.lineageKey)
          .sort((a, b) => b.createdAt - a.createdAt);
        const first = filtered[0];
        return first ? { id: first.id, hash: first.hash } : null;
      },
      async create({ data }) {
        const id = `evt_${++auto}`;
        const row: Row = {
          id,
          hash: data.hash,
          lineageKey: data.lineageKey ?? null,
          priorRunId: data.priorRunId ?? null,
          createdAt: Date.now() + auto,
        };
        rows.push(row);
        return { id, hash: row.hash };
      },
    },
    async $transaction(fn) {
      return fn(tx);
    },
  };
  return tx;
}

describe('createAuditEventWithChain · genesis + chain', () => {
  it('rejects empty lineageKey', async () => {
    const prisma = buildFakePrisma();
    await expect(() =>
      createAuditEventWithChain(prisma, {
        lineageKey: '',
        data: { type: 'attestation' },
      }),
    ).rejects.toThrowError(/lineageKey is required/);
  });

  it('first insert in a lineage is genesis (priorRunId null, hashed against GENESIS marker)', async () => {
    const prisma = buildFakePrisma();
    const result = await createAuditEventWithChain(prisma, {
      lineageKey: 'nppes_identity:1356428912',
      data: { type: 'source_check' },
    });
    expect(result.isGenesis).toBe(true);
    expect(result.priorRunId).toBeNull();

    const expected = calculateNextHash(CHAIN_GENESIS_MARKER, {
      type: 'source_check',
      metadata: null,
      referenceId: null,
      clinicianId: null,
      organizationId: null,
      anchored: false,
      merkleRoot: null,
      lineageKey: 'nppes_identity:1356428912',
    });
    expect(result.hash).toBe(expected);
  });

  it('subsequent inserts link to the previous row', async () => {
    const prisma = buildFakePrisma();
    const a = await createAuditEventWithChain(prisma, {
      lineageKey: 'oig:1356428912',
      data: { type: 'sanction_screen' },
    });
    const b = await createAuditEventWithChain(prisma, {
      lineageKey: 'oig:1356428912',
      data: { type: 'sanction_screen', anchored: true },
    });
    expect(b.priorRunId).toBe(a.id);
    expect(b.isGenesis).toBe(false);
    // Chain reconciles offline:
    const expectedB = calculateNextHash(a.hash, {
      type: 'sanction_screen',
      metadata: null,
      referenceId: null,
      clinicianId: null,
      organizationId: null,
      anchored: true,
      merkleRoot: null,
      lineageKey: 'oig:1356428912',
    });
    expect(b.hash).toBe(expectedB);
  });

  it('parallel lineages remain independent (priorRunId never crosses lineages)', async () => {
    const prisma = buildFakePrisma();
    await createAuditEventWithChain(prisma, {
      lineageKey: 'lane_a',
      data: { type: 'a1' },
    });
    const b1 = await createAuditEventWithChain(prisma, {
      lineageKey: 'lane_b',
      data: { type: 'b1' },
    });
    expect(b1.isGenesis).toBe(true);
    expect(b1.priorRunId).toBeNull();
  });

  it('explicit payload override is used for the chain hash', async () => {
    const prisma = buildFakePrisma();
    const result = await createAuditEventWithChain(prisma, {
      lineageKey: 'attest:1356428912',
      data: { type: 'attestation' },
      payload: { custom: 'receipt-body-bytes' },
    });
    const expected = calculateNextHash(CHAIN_GENESIS_MARKER, {
      custom: 'receipt-body-bytes',
    });
    expect(result.hash).toBe(expected);
  });
});
