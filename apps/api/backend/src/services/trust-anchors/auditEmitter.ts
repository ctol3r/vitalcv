/**
 * Wave 197 — Trust Anchor Audit Emitter
 *
 * Writes deterministic artifacts to AuditScrapbook on every anchor lifecycle event.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { TrustAnchor } from './anchors/anchorRegistry';

const SCRAPBOOK_DIR = path.resolve(
  __dirname,
  '../../audit/scrapbook',
);

const METHODOLOGY_VERSION = '1.0.0';

export interface AnchorArtifact {
  version: 1;
  anchorId: string;
  name: string;
  rootType: string;
  action: 'registered' | 'revoked' | 'refreshed' | 'expired';
  chainHash: string;
  timestamp: string;
  methodologyVersion: string;
}

export function emitAnchorUpdateArtifact(
  anchor: TrustAnchor,
  action: AnchorArtifact['action'],
): void {
  const timestamp = new Date().toISOString();
  const artifact: AnchorArtifact = {
    version: 1,
    anchorId: anchor.id,
    name: anchor.name,
    rootType: anchor.rootType,
    action,
    chainHash: anchor.chainHash,
    timestamp,
    methodologyVersion: METHODOLOGY_VERSION,
  };

  try {
    if (!fs.existsSync(SCRAPBOOK_DIR)) {
      fs.mkdirSync(SCRAPBOOK_DIR, { recursive: true });
    }

    const safeId = anchor.id.replace(/[^a-zA-Z0-9-_]/g, '_');
    const safeTs = timestamp.replace(/[:.]/g, '-');
    const filename = `trust-anchor-${safeId}-${action}-${safeTs}.json`;
    const filepath = path.join(SCRAPBOOK_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(artifact, null, 2));
  } catch {
    // Non-fatal — audit write failure should not block anchor operations
  }
}

export function computeArtifactHash(artifact: AnchorArtifact): string {
  return createHash('sha256')
    .update(JSON.stringify(artifact))
    .digest('hex');
}
