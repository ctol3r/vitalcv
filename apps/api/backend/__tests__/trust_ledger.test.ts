import crypto from 'crypto';
import prisma from '../src/graphql/prisma_client';
import { merkleRoot, sha256 } from '../src/api/trust-ledger/merkle';
import { buildProof, verifyProof } from '../src/api/trust-ledger/proofs';
import { NoopAdapter } from '../src/api/trust-ledger/adapter';
import { runAnchorBatch } from '../src/api/jobs/anchor-batch';
import { ANCHOR_EVENT_TYPE, findLastAnchoringEvent } from '../src/api/audit/anchoring-events';

function hashPair(a: string, b: string) {
  return crypto.createHash('sha256').update(Buffer.concat([Buffer.from(a, 'hex'), Buffer.from(b, 'hex')])).digest('hex');
}

describe('trust ledger primitives', () => {
  beforeEach(async () => {
    await prisma.auditEvent.deleteMany();
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany();
    await prisma.$disconnect();
  });

  it('computes stable Merkle roots', () => {
    const leaves = ['one', 'two', 'three'].map((v) => sha256(v));
    const root = merkleRoot(leaves);

    const layer1A = hashPair(leaves[0], leaves[1]);
    const layer1B = hashPair(leaves[2], leaves[2]); // duplicate last for odd leaf count
    const expectedRoot = hashPair(layer1A, layer1B);

    expect(root).toBe(expectedRoot);
  });

  it('builds and verifies proofs for indexed leaves', () => {
    const leaves = ['alpha', 'beta', 'gamma', 'delta'].map((v) => sha256(v));
    const proof = buildProof(leaves, 2);
    expect(proof.index).toBe(2);
    expect(proof.leaf).toBe(leaves[2]);
    expect(proof.path.length).toBeGreaterThan(0);
    expect(verifyProof(proof)).toBe(true);
  });
});

describe('anchoring job', () => {
  beforeEach(async () => {
    await prisma.auditEvent.deleteMany();
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany();
    await prisma.$disconnect();
  });

  it('anchors pending audit hashes and records receipt', async () => {
    const now = new Date();
    const older = new Date(now.getTime() - 60_000);
    await prisma.auditEvent.create({
      data: {
        type: 'LOGIN',
        hash: sha256('login'),
        createdAt: older,
      },
    });
    await prisma.auditEvent.create({
      data: {
        type: 'ISSUANCE',
        hash: sha256('issuance'),
        createdAt: now,
      },
    });

    const result = await runAnchorBatch(new NoopAdapter());
    expect(result.anchored).toBe(true);
    expect(result.root).toBeDefined();
    expect(result.leafCount).toBe(2);
    expect(result.receipt?.adapter).toBe('noop');

    const anchorEvent = await findLastAnchoringEvent();
    expect(anchorEvent?.type).toBe(ANCHOR_EVENT_TYPE);
    const metadata = (anchorEvent?.metadata ?? {}) as any;
    expect(metadata.leafCount).toBe(2);
    expect(metadata.anchoredHashes).toHaveLength(2);
    expect(Array.isArray(metadata.proofSample)).toBe(true);
  });
});
