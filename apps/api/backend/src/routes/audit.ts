import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import {
  buildMerkleTreeFromLeafHashes,
  hashMerkleConcat,
} from '../utils/merkle';
import { buildAuditBundleProof } from '../services/audit/auditBundleProof';

interface InclusionProof {
  eventHash: string;
  leafHash: string;
  merkleRoot: string;
  batchSize: number;
  anchoredAt: string;
  proof: Array<{ hash: string; position: 'left' | 'right' }>;
  verificationSteps: string[];
}

/**
 * Given a built MerkleTree, extract a proof-of-inclusion for a specific leaf.
 * Returns an array of (sibling-hash, position) pairs that allow independent
 * verification by hashing from the leaf to the root.
 */
function extractProof(
  levels: string[][],
  leafIndex: number,
): Array<{ hash: string; position: 'left' | 'right' }> {
  const proof: Array<{ hash: string; position: 'left' | 'right' }> = [];
  let idx = leafIndex;

  for (let level = 0; level < levels.length - 1; level++) {
    const currentLevel = levels[level];
    const isLeft = idx % 2 === 0;
    const siblingIdx = isLeft ? idx + 1 : idx - 1;

    if (siblingIdx < currentLevel.length) {
      proof.push({
        hash: currentLevel[siblingIdx],
        position: isLeft ? 'right' : 'left',
      });
    } else {
      // Odd leaf count — node is paired with itself.
      proof.push({
        hash: currentLevel[idx],
        position: isLeft ? 'right' : 'left',
      });
    }

    idx = Math.floor(idx / 2);
  }

  return proof;
}

/**
 * Produce a human-readable verification trace an auditor can follow.
 */
function buildVerificationSteps(
  leafHash: string,
  proof: Array<{ hash: string; position: 'left' | 'right' }>,
  root: string,
): string[] {
  const steps: string[] = [];
  let current = leafHash;
  steps.push(`Start: leaf = ${current}`);

  for (let i = 0; i < proof.length; i++) {
    const sibling = proof[i];
    const left = sibling.position === 'left' ? sibling.hash : current;
    const right = sibling.position === 'left' ? current : sibling.hash;
    current = hashMerkleConcat(left, right);
    steps.push(`Level ${i + 1}: H(${left.slice(0, 8)}… || ${right.slice(0, 8)}…) = ${current.slice(0, 16)}…`);
  }

  steps.push(current === root ? `Root matches: ${root} ✓` : `Root MISMATCH — expected ${root}`);
  return steps;
}

export function registerAuditRoutes(app: Express): void {
  app.get('/api/audit/bundle/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;

    if (!npi || !/^\d{10}$/.test(npi)) {
      return res.status(400).json({ error: 'Invalid NPI' });
    }

    try {
      const bundle = await buildAuditBundleProof(npi);
      res.setHeader('Content-Disposition', 'attachment; filename="audit_bundle.json"');
      return res.json(bundle);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to build audit bundle';
      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/audit/proof/:eventHash
   *
   * Given an event hash, look up the anchored AuditEvent, reconstruct its
   * batch Merkle tree, and return the inclusion proof.
   */
  app.get('/api/audit/proof/:eventHash', async (req: Request, res: Response) => {
    const { eventHash } = req.params;

    if (!eventHash || eventHash.length < 8) {
      return res.status(400).json({ error: 'Invalid event hash' });
    }

    // Find the target event.
    const targetEvent = await prisma.auditEvent.findFirst({
      where: { hash: eventHash, anchored: true },
      select: { id: true, hash: true, merkleRoot: true, createdAt: true },
    });

    if (!targetEvent || !targetEvent.merkleRoot) {
      return res.status(404).json({
        error: 'Event not found or not yet anchored',
        hint: 'Events are batched and anchored every 5 minutes.',
      });
    }

    // Retrieve all events in the same batch.
    const batchEvents = await prisma.auditEvent.findMany({
      where: { merkleRoot: targetEvent.merkleRoot, anchored: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, hash: true },
    });

    // Reconstruct leaf hashes (same dedup logic as the batcher).
    const seen = new Set<string>();
    const leafHashes: string[] = [];
    for (const event of batchEvents) {
      let leaf = event.hash;
      if (seen.has(leaf)) {
        leaf = `${leaf}:${event.id}`;
      }
      seen.add(leaf);
      leafHashes.push(leaf);
    }

    // Find which leaf corresponds to the target.
    let targetLeaf = targetEvent.hash;
    const firstOccurrence = batchEvents.find((e) => e.hash === targetEvent.hash);
    if (firstOccurrence && firstOccurrence.id !== targetEvent.id) {
      targetLeaf = `${targetEvent.hash}:${targetEvent.id}`;
    }

    const tree = buildMerkleTreeFromLeafHashes(leafHashes);

    // Leaves are sorted inside the tree builder — find the target's sorted index.
    const leafIndex = tree.leaves.indexOf(targetLeaf);
    if (leafIndex === -1) {
      return res.status(500).json({ error: 'Leaf reconstruction mismatch' });
    }

    const proof = extractProof(tree.levels, leafIndex);
    const verificationSteps = buildVerificationSteps(targetLeaf, proof, tree.root);

    const response: InclusionProof = {
      eventHash,
      leafHash: targetLeaf,
      merkleRoot: tree.root,
      batchSize: batchEvents.length,
      anchoredAt: targetEvent.createdAt.toISOString(),
      proof,
      verificationSteps,
    };

    return res.json(response);
  });
}
