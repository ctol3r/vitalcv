import type { Express, Request, Response } from 'express';

import prisma from '../graphql/prisma_client';
import { buildLeafProof, buildTreeForBatch, computeLeafHashes } from '../services/ledger/anchorProof';
import { loadWitnessSigningKey, witnessPublicKeyPem } from '../services/ledger/witness/rekor';

/**
 * Public ledger-proof routes.
 *
 * Deliberately anonymous: the entire point of witnessing is that an outside
 * auditor can verify VitalCV's receipt history WITHOUT trusting VitalCV's
 * word. Every value served here is a hash, a status string, an opaque
 * signed token, or a public key — never event metadata, never PII, never
 * note or receipt content. A witnessed root is only as public as the
 * witness log it is already published to.
 *
 *   GET /api/ledger/anchors/:root      → witness evidence for one batch root
 *   GET /api/ledger/events/:id/proof   → Merkle inclusion proof for one event
 *
 * Verification procedure (also returned inline by the anchors route):
 *  1. Recompute: walk proofPath from leafHash with the parity rule
 *     (even index → H(current+sibling), odd → H(sibling+current)) and
 *     confirm the result equals merkleRoot.
 *  2. Rekor: fetch the entry by uuid from the public log and confirm the
 *     signed artifact is the UTF-8 bytes of the lowercase hex root string.
 *  3. TSA: `openssl ts -verify` the returned token against the root digest.
 */

const HEX64 = /^[0-9a-f]{64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VERIFY_INSTRUCTIONS = {
  artifact: 'UTF-8 bytes of the lowercase hex merkleRoot string',
  proofRule:
    'level i: even leafIndex → sha256(current + sibling), odd → sha256(sibling + current); index = floor(index / 2)',
  rekor: 'GET {rekorUrl}/api/v1/log/entries/{rekorUuid} — verify signature over the artifact with the embedded public key',
  tsa: 'openssl ts -verify -digest <sha256(artifact) hex> -in <tsaToken, base64-decoded> -CAfile <TSA CA chain>',
} as const;

function anchorSummary(row: {
  merkleRoot: string;
  eventCount: number;
  rekorStatus: string;
  rekorUuid: string | null;
  rekorLogIndex: string | null;
  tsaStatus: string;
  tsaToken: Uint8Array | null;
  tsaUrl: string | null;
  witnessedAt: Date | null;
  createdAt: Date;
}) {
  return {
    merkleRoot: row.merkleRoot,
    eventCount: row.eventCount,
    createdAt: row.createdAt,
    witnessedAt: row.witnessedAt,
    rekor: {
      status: row.rekorStatus,
      uuid: row.rekorUuid,
      logIndex: row.rekorLogIndex,
      searchUrl: row.rekorUuid ? `https://search.sigstore.dev/?uuid=${row.rekorUuid}` : null,
    },
    tsa: {
      status: row.tsaStatus,
      url: row.tsaUrl,
      tokenBase64: row.tsaToken ? Buffer.from(row.tsaToken).toString('base64') : null,
    },
  };
}

function witnessPublicKey(): string | null {
  try {
    const key = loadWitnessSigningKey();
    return key ? witnessPublicKeyPem(key) : null;
  } catch {
    return null;
  }
}

export function registerLedgerProofRoutes(app: Express): void {
  app.get('/api/ledger/anchors/:root', async (req: Request, res: Response) => {
    const root = String(req.params.root ?? '').toLowerCase();
    if (!HEX64.test(root)) {
      res.status(400).json({ error: 'invalid_root', detail: 'expected 64 hex chars' });
      return;
    }

    const row = await prisma.anchorRoot.findUnique({ where: { merkleRoot: root } });
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    res.json({
      anchor: anchorSummary(row),
      witnessPublicKeyPem: witnessPublicKey(),
      verify: VERIFY_INSTRUCTIONS,
    });
  });

  app.get('/api/ledger/events/:eventId/proof', async (req: Request, res: Response) => {
    const eventId = String(req.params.eventId ?? '');
    if (!UUID_RE.test(eventId)) {
      res.status(400).json({ error: 'invalid_event_id' });
      return;
    }

    const event = await prisma.auditEvent.findUnique({
      where: { id: eventId },
      select: { id: true, hash: true, anchored: true, merkleRoot: true },
    });
    if (!event || !event.anchored || !event.merkleRoot) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Rebuild the batch with the batcher's exact ordering and dedup rule.
    const batch = await prisma.auditEvent.findMany({
      where: { merkleRoot: event.merkleRoot },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, hash: true },
    });

    const leafByEventId = computeLeafHashes(batch);
    const leafHash = leafByEventId.get(event.id);
    if (!leafHash) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const tree = buildTreeForBatch([...leafByEventId.values()]);
    if (tree.root !== event.merkleRoot) {
      // Honest degrade: batches anchored before deterministic ordering can,
      // in rare same-timestamp duplicate-hash cases, fail to reproduce. We
      // say so rather than serving a proof that does not verify.
      res.status(409).json({
        error: 'proof_unavailable',
        detail: 'batch_recomputation_mismatch',
      });
      return;
    }

    const proof = buildLeafProof(tree, leafHash);
    const anchor = await prisma.anchorRoot.findUnique({ where: { merkleRoot: event.merkleRoot } });

    res.json({
      eventId: event.id,
      leafHash: proof.leafHash,
      leafIndex: proof.leafIndex,
      proofPath: proof.proofPath,
      merkleRoot: proof.root,
      anchor: anchor ? anchorSummary(anchor) : null,
      verify: VERIFY_INSTRUCTIONS,
    });
  });
}
