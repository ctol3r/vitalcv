import { createHash, generateKeyPairSync, verify as cryptoVerify } from 'crypto';

/**
 * Anchor witness — unit pins.
 *
 * Everything runs against mocked fetch and a mocked Prisma client. What we
 * pin: the RFC 3161 request is well-formed DER over the right digest, the
 * Rekor entry signs the documented artifact, a witness failure never
 * escapes the orchestrator, and the disabled state performs no network IO.
 */

const prismaMock = {
  anchorRoot: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  auditEvent: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
};

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: prismaMock,
}));

import {
  buildTimestampRequest,
  parseTimestampResponseStatus,
  rootDigest,
} from '../witness/tsa';
import { buildHashedRekordBody, loadWitnessSigningKey } from '../witness/rekor';
import { recordAnchorRoot, witnessPendingRoots } from '../anchorWitness';
import { buildLeafProof, buildTreeForBatch, computeLeafHashes, verifyLeafProof } from '../anchorProof';

const ROOT = 'a'.repeat(64);

function testKeyPem(): string {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
}

describe('RFC 3161 request builder', () => {
  it('builds a DER TimeStampReq: version 1, SHA-256 imprint, certReq TRUE', () => {
    const digest = rootDigest(ROOT);
    const nonce = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    const tsq = buildTimestampRequest(digest, nonce);

    // Outer SEQUENCE.
    expect(tsq[0]).toBe(0x30);
    // version INTEGER 1.
    expect(tsq.subarray(2, 5)).toEqual(Buffer.from([0x02, 0x01, 0x01]));
    // Contains the SHA-256 OID and the exact digest bytes.
    const sha256Oid = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]);
    expect(tsq.includes(sha256Oid)).toBe(true);
    expect(tsq.includes(digest)).toBe(true);
    // Ends with certReq BOOLEAN TRUE.
    expect(tsq.subarray(tsq.length - 3)).toEqual(Buffer.from([0x01, 0x01, 0xff]));
  });

  it('pads a high-bit nonce to keep the INTEGER positive', () => {
    const digest = rootDigest(ROOT);
    const highBitNonce = Buffer.from([0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);
    const tsq = buildTimestampRequest(digest, highBitNonce);
    expect(tsq.includes(Buffer.from([0x02, 0x09, 0x00, 0xff]))).toBe(true);
  });

  it('rejects a digest that is not 32 bytes', () => {
    expect(() => buildTimestampRequest(Buffer.from('short'))).toThrow('32-byte');
  });
});

describe('RFC 3161 response parser', () => {
  it('reads PKIStatus granted from a minimal TimeStampResp', () => {
    // SEQUENCE { SEQUENCE { INTEGER 0 } }
    const granted = Buffer.from([0x30, 0x05, 0x30, 0x03, 0x02, 0x01, 0x00]);
    expect(parseTimestampResponseStatus(granted)).toBe(0);
  });

  it('reads a rejection status', () => {
    const rejected = Buffer.from([0x30, 0x05, 0x30, 0x03, 0x02, 0x01, 0x02]);
    expect(parseTimestampResponseStatus(rejected)).toBe(2);
  });

  it('throws on non-SEQUENCE input', () => {
    expect(() => parseTimestampResponseStatus(Buffer.from([0x04, 0x01, 0x00]))).toThrow('SEQUENCE');
  });
});

describe('Rekor hashedrekord body', () => {
  it('signs the UTF-8 bytes of the lowercase hex root, verifiably', () => {
    const key = loadWitnessSigningKey(testKeyPem());
    expect(key).not.toBeNull();
    const body = buildHashedRekordBody(ROOT, key!) as {
      kind: string;
      spec: {
        data: { hash: { algorithm: string; value: string } };
        signature: { content: string; publicKey: { content: string } };
      };
    };

    expect(body.kind).toBe('hashedrekord');
    const artifact = Buffer.from(ROOT, 'utf8');
    expect(body.spec.data.hash.value).toBe(createHash('sha256').update(artifact).digest('hex'));

    const publicKeyPem = Buffer.from(body.spec.signature.publicKey.content, 'base64').toString('utf8');
    const signature = Buffer.from(body.spec.signature.content, 'base64');
    expect(cryptoVerify('sha256', artifact, publicKeyPem, signature)).toBe(true);
  });

  it('returns null when no key is configured', () => {
    expect(loadWitnessSigningKey(undefined)).toBeNull();
    expect(loadWitnessSigningKey('   ')).toBeNull();
  });
});

describe('witness orchestrator', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    jest.clearAllMocks();
  });

  it('records a root unconditionally via upsert', async () => {
    prismaMock.anchorRoot.upsert.mockResolvedValue({});
    await recordAnchorRoot(ROOT, 12);
    expect(prismaMock.anchorRoot.upsert).toHaveBeenCalledWith({
      where: { merkleRoot: ROOT },
      create: { merkleRoot: ROOT, eventCount: 12 },
      update: {},
    });
  });

  it('performs no network IO when disabled', async () => {
    delete process.env.ANCHOR_WITNESS_ENABLED;
    const fetchSpy = jest.fn();
    await witnessPendingRoots(fetchSpy as unknown as typeof fetch);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prismaMock.anchorRoot.findMany).not.toHaveBeenCalled();
  });

  it('marks both legs failed on outage, increments attempts, and does not throw', async () => {
    process.env.ANCHOR_WITNESS_ENABLED = 'true';
    process.env.ANCHOR_WITNESS_SIGNING_KEY = testKeyPem();
    prismaMock.anchorRoot.findMany.mockResolvedValue([
      { id: 'row-1', merkleRoot: ROOT, rekorStatus: 'pending', tsaStatus: 'pending', witnessedAt: null },
    ]);
    prismaMock.anchorRoot.update.mockResolvedValue({});
    const fetchSpy = jest.fn().mockRejectedValue(new Error('network down'));

    await expect(witnessPendingRoots(fetchSpy as unknown as typeof fetch)).resolves.toBeUndefined();

    const update = prismaMock.anchorRoot.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'row-1' });
    expect(update.data.rekorStatus).toBe('failed');
    expect(update.data.tsaStatus).toBe('failed');
    expect(update.data.witnessAttempts).toEqual({ increment: 1 });
    expect(update.data.witnessedAt).toBeUndefined();
  });

  it('witnesses both legs and stamps witnessedAt on success', async () => {
    process.env.ANCHOR_WITNESS_ENABLED = 'true';
    process.env.ANCHOR_WITNESS_SIGNING_KEY = testKeyPem();
    prismaMock.anchorRoot.findMany.mockResolvedValue([
      { id: 'row-1', merkleRoot: ROOT, rekorStatus: 'pending', tsaStatus: 'pending', witnessedAt: null },
    ]);
    prismaMock.anchorRoot.update.mockResolvedValue({});

    const grantedTsr = Buffer.from([0x30, 0x05, 0x30, 0x03, 0x02, 0x01, 0x00]);
    const fetchSpy = jest.fn(async (url: string | URL) => {
      if (String(url).includes('/api/v1/log/entries')) {
        return {
          ok: true,
          status: 201,
          headers: { get: () => null },
          json: async () => ({ 'entry-uuid-1': { logIndex: 424242 } }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => grantedTsr.buffer.slice(grantedTsr.byteOffset, grantedTsr.byteOffset + grantedTsr.byteLength),
      } as unknown as Response;
    });

    await witnessPendingRoots(fetchSpy as unknown as typeof fetch);

    const update = prismaMock.anchorRoot.update.mock.calls[0][0];
    expect(update.data.rekorStatus).toBe('witnessed');
    expect(update.data.rekorUuid).toBe('entry-uuid-1');
    expect(update.data.rekorLogIndex).toBe('424242');
    expect(update.data.tsaStatus).toBe('witnessed');
    expect(Buffer.isBuffer(update.data.tsaToken)).toBe(true);
    expect(update.data.witnessedAt).toBeInstanceOf(Date);
  });

  it('treats a Rekor 409 as already witnessed via the Location header', async () => {
    process.env.ANCHOR_WITNESS_ENABLED = 'true';
    process.env.ANCHOR_WITNESS_SIGNING_KEY = testKeyPem();
    prismaMock.anchorRoot.findMany.mockResolvedValue([
      { id: 'row-1', merkleRoot: ROOT, rekorStatus: 'pending', tsaStatus: 'witnessed', witnessedAt: null },
    ]);
    prismaMock.anchorRoot.update.mockResolvedValue({});

    const fetchSpy = jest.fn(async () => ({
      ok: false,
      status: 409,
      headers: { get: (name: string) => (name === 'location' ? '/api/v1/log/entries/existing-uuid' : null) },
    })) as unknown as typeof fetch;

    await witnessPendingRoots(fetchSpy);

    const update = prismaMock.anchorRoot.update.mock.calls[0][0];
    expect(update.data.rekorStatus).toBe('witnessed');
    expect(update.data.rekorUuid).toBe('existing-uuid');
  });
});

describe('inclusion proofs', () => {
  it('round-trips: every event in a batch gets a verifying proof', () => {
    const events = Array.from({ length: 7 }, (_, i) => ({
      id: `00000000-0000-4000-8000-00000000000${i}`,
      hash: createHash('sha256').update(`event-${i}`).digest('hex'),
    }));
    const leafByEventId = computeLeafHashes(events);
    const tree = buildTreeForBatch([...leafByEventId.values()]);

    for (const event of events) {
      const proof = buildLeafProof(tree, leafByEventId.get(event.id)!);
      expect(verifyLeafProof(proof)).toBe(true);
      expect(proof.root).toBe(tree.root);
    }
  });

  it('disambiguates duplicate hashes deterministically by order', () => {
    const dup = createHash('sha256').update('same').digest('hex');
    const events = [
      { id: 'aaaaaaaa-0000-4000-8000-000000000000', hash: dup },
      { id: 'bbbbbbbb-0000-4000-8000-000000000000', hash: dup },
    ];
    const leaves = computeLeafHashes(events);
    expect(leaves.get(events[0].id)).toBe(dup);
    expect(leaves.get(events[1].id)).toBe(`${dup}:${events[1].id}`);
  });

  it('a tampered proof fails verification', () => {
    const events = [
      { id: '00000000-0000-4000-8000-000000000001', hash: createHash('sha256').update('x').digest('hex') },
      { id: '00000000-0000-4000-8000-000000000002', hash: createHash('sha256').update('y').digest('hex') },
    ];
    const leafByEventId = computeLeafHashes(events);
    const tree = buildTreeForBatch([...leafByEventId.values()]);
    const proof = buildLeafProof(tree, leafByEventId.get(events[0].id)!);
    const tampered = { ...proof, leafHash: createHash('sha256').update('z').digest('hex') };
    expect(verifyLeafProof(tampered)).toBe(false);
  });
});
