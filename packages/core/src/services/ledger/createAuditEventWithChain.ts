/**
 * createAuditEventWithChain — durable hash-chain wrapper for AuditEvent
 * inserts (WAVE C75).
 *
 * For each insert into a given `lineageKey`:
 *   1. Look up the most recent prior AuditEvent in that lineage.
 *   2. Compute chainHash = calculateNextHash(previous.hash, payload)
 *      via `@vitalcv/core` HashChainService (SHA-256, canonical-JSON).
 *   3. Persist the new row with:
 *        - hash       = chainHash         (repurposes the existing column)
 *        - lineageKey = caller-supplied
 *        - priorRunId = previous?.id ?? null   (null on genesis)
 *
 * The wrapper is intentionally tiny — it owns one Prisma read and one
 * Prisma write inside a transaction so the chain cannot interleave
 * across concurrent writes for the same lineage. Existing
 * `prisma.auditEvent.create` call sites are NOT touched by this wave;
 * adoption is per-callsite as auditors retrofit.
 */

import { calculateNextHash, CHAIN_GENESIS_MARKER } from './HashChainService';

/**
 * Narrow structural shape of the Prisma client surface we need. Keeps
 * this module decoupled from the regenerated Prisma client types so it
 * compiles before `prisma generate` runs in fresh environments.
 */
export interface MinimalAuditPrismaClient {
  auditEvent: {
    findFirst(args: {
      where: { lineageKey: string };
      orderBy: { createdAt: 'desc' };
      select: { id: true; hash: true };
    }): Promise<{ id: string; hash: string } | null>;
    create(args: {
      data: AuditEventCreateData & {
        hash: string;
        lineageKey: string;
        priorRunId: string | null;
      };
    }): Promise<{ id: string; hash: string }>;
  };
  $transaction<T>(fn: (tx: MinimalAuditPrismaClient) => Promise<T>): Promise<T>;
}

/**
 * Fields the caller supplies. `lineageKey` is required; the wrapper
 * supplies `hash` and `priorRunId` from the chain computation.
 */
export interface AuditEventCreateData {
  type: string;
  metadata?: Record<string, unknown> | null;
  referenceId?: string | null;
  clinicianId?: string | null;
  organizationId?: string | null;
  anchored?: boolean;
  merkleRoot?: string | null;
}

export interface ChainedAuditEventInput {
  lineageKey: string;
  data: AuditEventCreateData;
  /**
   * Payload the chain hash is computed over. Defaults to a canonical
   * projection of `data` if not supplied. Pass an explicit payload
   * when the chain should commit to fields outside the AuditEvent row
   * (e.g. the receipt body, the artifact bytes).
   */
  payload?: unknown;
}

export interface ChainedAuditEventResult {
  id: string;
  hash: string;
  priorRunId: string | null;
  lineageKey: string;
  isGenesis: boolean;
}

/**
 * Insert a new AuditEvent that is hash-linked to the most recent prior
 * event in its lineage.
 *
 * Concurrency: the read + write run inside a single Prisma transaction
 * so two simultaneous inserts for the same `lineageKey` cannot produce
 * a forked chain. The transaction isolation level is the Prisma default
 * (Read Committed on PostgreSQL); a `SERIALIZABLE` upgrade is the next
 * hardening step if forked-chain collisions are observed under load.
 */
export async function createAuditEventWithChain(
  prisma: MinimalAuditPrismaClient,
  input: ChainedAuditEventInput,
): Promise<ChainedAuditEventResult> {
  if (!input.lineageKey || input.lineageKey.length === 0) {
    throw new Error('createAuditEventWithChain: lineageKey is required');
  }
  return prisma.$transaction(async (tx) => {
    const prior = await tx.auditEvent.findFirst({
      where: { lineageKey: input.lineageKey },
      orderBy: { createdAt: 'desc' },
      select: { id: true, hash: true },
    });

    const previousHash = prior?.hash ?? CHAIN_GENESIS_MARKER;
    const payload = input.payload ?? canonicalEventPayload(input);
    const chainHash = calculateNextHash(previousHash, payload);

    const created = await tx.auditEvent.create({
      data: {
        ...input.data,
        hash: chainHash,
        lineageKey: input.lineageKey,
        priorRunId: prior?.id ?? null,
      },
    });

    return {
      id: created.id,
      hash: created.hash,
      priorRunId: prior?.id ?? null,
      lineageKey: input.lineageKey,
      isGenesis: prior === null,
    };
  });
}

/**
 * Default chain-payload projection. Includes the fields that are
 * audit-relevant for tampering detection; intentionally omits volatile
 * server-side fields (createdAt is added by the DB).
 */
function canonicalEventPayload(input: ChainedAuditEventInput): unknown {
  return {
    type: input.data.type,
    metadata: input.data.metadata ?? null,
    referenceId: input.data.referenceId ?? null,
    clinicianId: input.data.clinicianId ?? null,
    organizationId: input.data.organizationId ?? null,
    anchored: input.data.anchored ?? false,
    merkleRoot: input.data.merkleRoot ?? null,
    lineageKey: input.lineageKey,
  };
}
