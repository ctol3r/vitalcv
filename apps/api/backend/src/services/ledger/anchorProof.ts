import { buildMerkleTreeFromLeafHashes, hashMerkleConcat, MerkleTree } from '../../utils/merkle';

/**
 * Inclusion proofs for anchored audit events.
 *
 * `buildMerkleTreeFromLeafHashes` sorts leaves lexicographically before
 * building levels, so the tree — and therefore the proof — is independent of
 * the order events were fetched in. What is NOT order-independent is the
 * duplicate-hash disambiguation in the batcher (`hash:eventId` suffixing),
 * which is why the batcher and the proof route share computeLeafForEvent /
 * computeLeafHashes and a deterministic query order.
 */

export interface EventLeafInput {
  id: string;
  hash: string;
}

/** Mirror of the batcher's dedup rule. Order of `events` matters for ties. */
export function computeLeafHashes(events: readonly EventLeafInput[]): Map<string, string> {
  const seen = new Set<string>();
  const leafByEventId = new Map<string, string>();
  for (const event of events) {
    let leaf = event.hash;
    if (seen.has(leaf)) {
      leaf = `${leaf}:${event.id}`;
    }
    seen.add(leaf);
    leafByEventId.set(event.id, leaf);
  }
  return leafByEventId;
}

export interface LeafProof {
  leafHash: string;
  leafIndex: number;
  proofPath: string[];
  root: string;
}

/**
 * Proof-path over the sorted-leaf tree. At each level, if the current index is
 * even the sibling is on the right (self-duplicated when absent), else on the
 * left. Verification walks the path with that parity rule — see
 * verifyLeafProof, which is the executable documentation.
 */
export function buildLeafProof(tree: MerkleTree, leafHash: string): LeafProof {
  const leafIndex = tree.leaves.indexOf(leafHash);
  if (leafIndex === -1) {
    throw new Error('leaf not present in tree');
  }

  const proofPath: string[] = [];
  let currentIndex = leafIndex;
  for (let levelIndex = 0; levelIndex < tree.levels.length - 1; levelIndex += 1) {
    const currentLevel = tree.levels[levelIndex];
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
    if (siblingIndex >= currentLevel.length) {
      proofPath.push(currentLevel[currentIndex]);
    } else {
      proofPath.push(currentLevel[siblingIndex]);
    }
    currentIndex = Math.floor(currentIndex / 2);
  }

  return { leafHash, leafIndex, proofPath, root: tree.root };
}

export function verifyLeafProof(proof: LeafProof): boolean {
  let current = proof.leafHash;
  let index = proof.leafIndex;
  for (const sibling of proof.proofPath) {
    current = index % 2 === 0 ? hashMerkleConcat(current, sibling) : hashMerkleConcat(sibling, current);
    index = Math.floor(index / 2);
  }
  return current === proof.root;
}

export function buildTreeForBatch(leafHashes: readonly string[]): MerkleTree {
  return buildMerkleTreeFromLeafHashes(leafHashes);
}
