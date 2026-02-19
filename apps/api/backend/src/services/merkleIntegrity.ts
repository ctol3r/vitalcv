import { buildMerkleTreeFromLeafHashes } from './merkleTree';

type ArtifactMerklePayload = {
  merkleRoot?: unknown;
  claimHashes?: unknown;
};

function parseClaimHashes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const claimHashes: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.length === 0) {
      return [];
    }
    claimHashes.push(entry);
  }

  return claimHashes;
}

export function validateMerkleIntegrity(artifact: ArtifactMerklePayload): boolean {
  const merkleRoot = typeof artifact?.merkleRoot === 'string' ? artifact.merkleRoot : '';
  const claimHashes = parseClaimHashes(artifact?.claimHashes);

  if (!merkleRoot) {
    return false;
  }

  if (claimHashes.length === 0) {
    return false;
  }

  try {
    const tree = buildMerkleTreeFromLeafHashes(claimHashes);
    return tree.root === merkleRoot;
  } catch {
    return false;
  }
}
