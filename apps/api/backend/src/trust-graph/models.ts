import crypto from 'crypto';
import prisma from '../graphql/prisma_client';

export const TRUST_EDGE_TYPES = ['ISSUES', 'VERIFIES', 'REVOKES'] as const;
export type TrustEdgeType = (typeof TRUST_EDGE_TYPES)[number];

export type TrustActorRole = 'ISSUER' | 'EMPLOYER' | 'REGULATOR' | 'VERIFIER' | 'HOLDER' | 'CREDENTIAL';

export type TrustEdgeInput = {
  edgeType: TrustEdgeType;
  fromActor: string;
  fromRole: TrustActorRole;
  toActor: string;
  toRole: TrustActorRole;
  credentialId?: string | null;
  evidenceHash?: string | null;
};

type TrustEdgePayload = {
  edgeType: TrustEdgeType;
  fromActor: string;
  fromRole: TrustActorRole;
  toActor: string;
  toRole: TrustActorRole;
  credentialId?: string | null;
  evidenceHash?: string | null;
  createdAt: Date;
};

const DEFAULT_SNAPSHOT_INTERVAL = 25;

const sha256Hex = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

function normalizeActor(value: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 256) : 'unknown';
}

function normalizeRole(value: TrustActorRole): TrustActorRole {
  return value;
}

function merkleRootHex(hashes: string[]): string | null {
  if (!hashes.length) return null;
  let layer: Buffer[] = hashes.map((h) => Buffer.from(h, 'hex'));

  while (layer.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] ?? layer[i];
      next.push(
        crypto
          .createHash('sha256')
          .update(Buffer.concat([left, right]))
          .digest(),
      );
    }
    layer = next;
  }
  return layer[0].toString('hex');
}

function edgeDigest(edge: TrustEdgePayload): string {
  return sha256Hex(
    JSON.stringify({
      t: edge.edgeType,
      f: normalizeActor(edge.fromActor),
      fr: normalizeRole(edge.fromRole),
      to: normalizeActor(edge.toActor),
      tr: normalizeRole(edge.toRole),
      c: edge.credentialId || null,
      e: edge.evidenceHash || null,
      at: edge.createdAt.toISOString(),
    }),
  );
}

export async function recordTrustEdge(input: TrustEdgeInput) {
  const createdAt = new Date();
  const edge = await prisma.trustEdge.create({
    data: {
      edgeType: input.edgeType,
      fromActor: normalizeActor(input.fromActor),
      fromRole: normalizeRole(input.fromRole),
      toActor: normalizeActor(input.toActor),
      toRole: normalizeRole(input.toRole),
      credentialId: input.credentialId ?? null,
      evidenceHash: input.evidenceHash ?? null,
      createdAt,
    },
  });

  const interval =
    Number(process.env.TRUST_GRAPH_SNAPSHOT_INTERVAL || DEFAULT_SNAPSHOT_INTERVAL) || 0;
  if (interval > 0) {
    const totalEdges = await prisma.trustEdge.count();
    if (totalEdges % interval === 0) {
      await anchorTrustGraphSnapshot(`auto-every-${interval}-edges`);
    }
  }

  return edge;
}

export async function anchorTrustGraphSnapshot(note?: string) {
  const edges = await prisma.trustEdge.findMany({
    orderBy: { id: 'asc' },
    select: {
      edgeType: true,
      fromActor: true,
      fromRole: true,
      toActor: true,
      toRole: true,
      credentialId: true,
      evidenceHash: true,
      createdAt: true,
    },
  });

  const hashes = edges.map((edge) =>
    edgeDigest({
      edgeType: edge.edgeType as TrustEdgeType,
      fromActor: edge.fromActor,
      fromRole: edge.fromRole as TrustActorRole,
      toActor: edge.toActor,
      toRole: edge.toRole as TrustActorRole,
      credentialId: edge.credentialId,
      evidenceHash: edge.evidenceHash,
      createdAt: edge.createdAt,
    }),
  );
  const rootHash = merkleRootHex(hashes) ?? sha256Hex('trust-graph-empty');

  return prisma.trustSnapshot.create({
    data: {
      rootHash,
      edgeCount: edges.length,
      note: note || null,
    },
  });
}

export async function listTrustEdges(limit = 100) {
  const take = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 100;
  return prisma.trustEdge.findMany({
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function listTrustSnapshots(limit = 10) {
  const take = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 10;
  return prisma.trustSnapshot.findMany({
    orderBy: { createdAt: 'desc' },
    take,
  });
}
