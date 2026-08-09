import prisma from '../../graphql/prisma_client';
import { buildMerkleTreeFromLeafHashes } from '../../utils/merkle';
import { computeLeafHashes } from './anchorProof';
import { log } from '../../obs/logger';

export interface BatchResult {
  eventCount: number;
  merkleRoot: string;
  leafHashes: string[];
}

/**
 * Queries all un-anchored AuditEvents, builds a Merkle tree from their
 * `hash` fields, and updates them with `anchored = true` + the batch root.
 *
 * Returns null when there are no events to anchor.
 */
export async function anchorPendingEvents(): Promise<BatchResult | null> {
  const pending = await prisma.auditEvent.findMany({
    where: { anchored: false },
    // `id` as a tiebreaker makes the fetch order deterministic. The tree
    // itself sorts leaves, but the duplicate-hash disambiguation below
    // depends on iteration order — and the proof route must be able to
    // reproduce the exact leaf set later.
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, hash: true },
  });

  if (pending.length === 0) {
    return null;
  }

  // Deduplicate hashes — the Merkle builder rejects duplicates. If two
  // events share a hash, the later one gets its event id appended. Shared
  // with the inclusion-proof route (anchorProof.computeLeafHashes) so a
  // rebuilt batch always yields the same leaves.
  const leafHashes = [...computeLeafHashes(pending).values()];

  const tree = buildMerkleTreeFromLeafHashes(leafHashes);
  const { root } = tree;

  // Batch-update all pending events in a single transaction.
  const eventIds = pending.map((e) => e.id);
  await prisma.auditEvent.updateMany({
    where: { id: { in: eventIds } },
    data: { anchored: true, merkleRoot: root },
  });

  log('info', `[MERKLE BATCHER] Anchored ${pending.length} events`, { merkleRoot: root });

  return { eventCount: pending.length, merkleRoot: root, leafHashes };
}
