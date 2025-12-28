export type Proof = {
  root: string;
  leaf: string;
  index: number;
  path: string[]; // sibling hashes
};

export function buildProof(leaves: string[], index: number, root: string): Proof {
  // Minimal placeholder; implement full Merkle path if needed
  return {
    root,
    leaf: leaves[index],
    index,
    path: [],
  };
}
