import { normalizeLeafHashes, sha256 } from './merkle';

export type MerklePathNode = { position: 'left' | 'right'; hash: string };

export interface Proof {
  root: string;
  leaf: string;
  index: number;
  path: MerklePathNode[];
}

export function buildProof(leaves: string[], index: number): Proof {
  if (leaves.length === 0) {
    throw new Error('Cannot build a proof with no leaves');
  }
  if (index < 0 || index >= leaves.length) {
    throw new Error('Leaf index out of bounds');
  }

  const normalized = normalizeLeafHashes(leaves);
  let layer = normalized.map((leaf) => Buffer.from(leaf, 'hex'));
  let currentIndex = index;
  const path: MerklePathNode[] = [];

  while (layer.length > 1) {
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
    const sibling = layer[siblingIndex] ?? layer[currentIndex];
    path.push({
      position: currentIndex % 2 === 0 ? 'right' : 'left',
      hash: sibling.toString('hex'),
    });

    const nextLayer: Buffer[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] ?? layer[i];
      nextLayer.push(Buffer.from(sha256(Buffer.concat([left, right])), 'hex'));
    }

    layer = nextLayer;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    root: layer[0].toString('hex'),
    leaf: normalized[index],
    index,
    path,
  };
}

export function verifyProof(proof: Proof): boolean {
  let computed = proof.leaf;
  for (const step of proof.path) {
    if (step.position === 'left') {
      computed = sha256(Buffer.concat([Buffer.from(step.hash, 'hex'), Buffer.from(computed, 'hex')]));
    } else {
      computed = sha256(Buffer.concat([Buffer.from(computed, 'hex'), Buffer.from(step.hash, 'hex')]));
    }
  }
  return computed === proof.root;
}
