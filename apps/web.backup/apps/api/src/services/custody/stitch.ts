import { createHash } from 'crypto';

import type { CustodyAction, CustodyTimelineEntry } from './log';

export interface CustodyAnchorLeaf {
  id: string;
  action: CustodyAction;
  timestamp: string;
  hash: string;
}

export interface CustodyAnchorBlock {
  clinicianId: string;
  documentId: string;
  custodyRoot: string;
  entryCount: number;
  firstEventAt: string;
  lastEventAt: string;
  leaves: CustodyAnchorLeaf[];
}

export function stitchCustodyBlock(entries: CustodyTimelineEntry[]): CustodyAnchorBlock {
  if (!entries.length) {
    throw new Error('Cannot stitch custody block without events');
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const leaves: CustodyAnchorLeaf[] = sorted.map((entry) => ({
    id: entry.id,
    action: entry.action,
    timestamp: entry.timestamp,
    hash: deriveCustodyLeafHash(entry),
  }));

  const custodyRoot = buildMerkleRoot(leaves.map((leaf) => leaf.hash));

  return {
    clinicianId: sorted[0].clinicianId,
    documentId: sorted[0].documentId,
    custodyRoot,
    entryCount: leaves.length,
    firstEventAt: sorted[0].timestamp,
    lastEventAt: sorted[sorted.length - 1].timestamp,
    leaves,
  };
}

export function buildMerkleRoot(hashes: string[]): string {
  if (!hashes.length) return '';
  if (hashes.length === 1) return normalizeHash(hashes[0]);

  let layer = hashes.map(normalizeHash);
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] ?? layer[i];
      next.push(hashPair(left, right));
    }
    layer = next;
  }
  return layer[0];
}

function hashPair(left: string, right: string): string {
  return normalizeHash(
    createHash('sha256')
      .update(`${normalizeHash(left)}:${normalizeHash(right)}`)
      .digest('hex'),
  );
}

export function deriveCustodyLeafHash(entry: CustodyTimelineEntry): string {
  return entry.metadata.hash ?? hashLeafFallback(entry);
}

function hashLeafFallback(entry: CustodyTimelineEntry): string {
  return normalizeHash(
    createHash('sha256')
      .update(
        JSON.stringify({
          id: entry.id,
          clinicianId: entry.clinicianId,
          documentId: entry.documentId,
          action: entry.action,
          timestamp: entry.timestamp,
        }),
      )
      .digest('hex'),
  );
}

function normalizeHash(value: string | null | undefined): string {
  if (!value) return '';
  return value.startsWith('0x') ? value.toLowerCase() : `0x${value.toLowerCase()}`;
}

