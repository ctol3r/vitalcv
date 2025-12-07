import { createHash } from 'crypto';

export interface AnchorRecord {
  anchorId: string;
  txHash: string;
  blockHash: string;
  blockNumber: number;
  network: string;
  timestamp: string;
  merkleProof: string[];
  status: 'anchored' | 'pending';
  anchored: boolean;
}

export function createAnchor(seedParts: Array<string | number>, prefix = 'anchor'): AnchorRecord {
  const seed = seedParts.join(':');
  const txHash = `0x${createHash('sha256').update(seed).digest('hex')}`;
  const blockHash = `0x${createHash('sha256').update(`block:${txHash}`).digest('hex')}`;
  const blockNumber = parseInt(txHash.slice(2, 10), 16);
  const proof = [
    `0x${createHash('sha256').update(txHash.slice(2, 34)).digest('hex')}`,
    `0x${createHash('sha256').update(txHash.slice(34)).digest('hex')}`,
  ];

  return {
    anchorId: `${prefix}-${seedParts[0] ?? 'event'}`,
    txHash,
    blockHash,
    blockNumber,
    network: process.env.VERIFIER_CHAIN_NETWORK || 'pilot-l2',
    timestamp: new Date().toISOString(),
    merkleProof: proof,
    status: 'anchored',
    anchored: true,
  };
}


