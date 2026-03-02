import prisma from '../../graphql/prisma_client';
import { buildMerkleTreeFromLeafHashes } from '../../utils/merkle';
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
    orderBy: { createdAt: 'asc' },
    select: { id: true, hash: true },
  });

  if (pending.length === 0) {
    return null;
  }

  // Deduplicate hashes — the Merkle builder rejects duplicates.
  // If two events share a hash, append the event id to disambiguate.
  const seen = new Set<string>();
  const leafHashes: string[] = [];
  for (const event of pending) {
    let leaf = event.hash;
    if (seen.has(leaf)) {
      leaf = `${leaf}:${event.id}`;
    }
    seen.add(leaf);
    leafHashes.push(leaf);
  }

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
