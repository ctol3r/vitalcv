import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { loadWitnessSigningKey, submitRootToRekor } from './witness/rekor';
import { obtainTimestampToken } from './witness/tsa';

/**
 * Anchor witness orchestrator.
 *
 * Every guard-passed Merkle root is persisted to `anchor_roots` unconditionally
 * (recordAnchorRoot). Witnessing — publishing the root to external,
 * append-only observers — is a separate, env-gated step with two independent
 * legs:
 *
 *   - Rekor  (public transparency log; proves existence + append-only history)
 *   - RFC 3161 TSA (court-tested countersignature; proves time)
 *
 * Design rules:
 *   - A witness failure NEVER breaks the anchor cycle. Legs fail
 *     independently, are retried on later cycles, and give up after
 *     MAX_WITNESS_ATTEMPTS so a dead endpoint cannot grow an infinite queue.
 *   - Until ANCHOR_WITNESS_ENABLED=true, behavior is dark: roots are
 *     recorded, nothing leaves the platform (deploy pattern: vars unset in
 *     Railway keep the integration inert).
 *   - Only bare hex root strings cross this boundary — the zero-PHI guard
 *     (assertHashOnlyAnchor) has already run in the worker before we are
 *     called.
 */

export const DEFAULT_REKOR_URL = 'https://rekor.sigstore.dev';
export const DEFAULT_TSA_URL = 'http://timestamp.digicert.com';
const MAX_WITNESS_ATTEMPTS = 10;
const WITNESS_BATCH_LIMIT = 20;

export function witnessEnabled(): boolean {
  return process.env.ANCHOR_WITNESS_ENABLED === 'true';
}

export function rekorUrl(): string {
  return process.env.ANCHOR_WITNESS_REKOR_URL?.trim() || DEFAULT_REKOR_URL;
}

export function tsaUrl(): string {
  return process.env.ANCHOR_WITNESS_TSA_URL?.trim() || DEFAULT_TSA_URL;
}

export async function recordAnchorRoot(merkleRoot: string, eventCount: number): Promise<void> {
  await prisma.anchorRoot.upsert({
    where: { merkleRoot },
    create: { merkleRoot, eventCount },
    update: {},
  });
}

interface WitnessableRoot {
  id: string;
  merkleRoot: string;
  rekorStatus: string;
  tsaStatus: string;
  witnessedAt: Date | null;
}

async function witnessRoot(root: WitnessableRoot, fetchImpl: typeof fetch): Promise<void> {
  const updates: Record<string, unknown> = { witnessAttempts: { increment: 1 } };
  let rekorWitnessed = root.rekorStatus === 'witnessed';
  let tsaWitnessed = root.tsaStatus === 'witnessed';

  if (!rekorWitnessed) {
    try {
      const key = loadWitnessSigningKey();
      if (!key) throw new Error('rekor_no_signing_key');
      const entry = await submitRootToRekor(rekorUrl(), root.merkleRoot, key, fetchImpl);
      updates.rekorStatus = 'witnessed';
      updates.rekorUuid = entry.uuid;
      if (entry.logIndex !== null) updates.rekorLogIndex = entry.logIndex;
      rekorWitnessed = true;
    } catch (err) {
      updates.rekorStatus = 'failed';
      log('error', '[ANCHOR WITNESS] Rekor leg failed', {
        root: root.merkleRoot.slice(0, 16),
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!tsaWitnessed) {
    try {
      const token = await obtainTimestampToken(tsaUrl(), root.merkleRoot, fetchImpl);
      updates.tsaStatus = 'witnessed';
      updates.tsaToken = token;
      updates.tsaUrl = tsaUrl();
      tsaWitnessed = true;
    } catch (err) {
      updates.tsaStatus = 'failed';
      log('error', '[ANCHOR WITNESS] TSA leg failed', {
        root: root.merkleRoot.slice(0, 16),
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (rekorWitnessed && tsaWitnessed && !root.witnessedAt) {
    updates.witnessedAt = new Date();
  }

  await prisma.anchorRoot.update({ where: { id: root.id }, data: updates });

  if (rekorWitnessed && tsaWitnessed) {
    log('info', '[ANCHOR WITNESS] Root witnessed (Rekor + TSA)', {
      root: root.merkleRoot.slice(0, 16),
    });
  }
}

/**
 * Witness every root that still has an unwitnessed leg. Called each anchor
 * cycle, so a transient outage self-heals on the next 5-minute tick.
 */
export async function witnessPendingRoots(fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!witnessEnabled()) {
    log('info', '[ANCHOR WITNESS] Disabled — roots recorded locally, not witnessed');
    return;
  }

  const pending = (await prisma.anchorRoot.findMany({
    where: {
      OR: [{ rekorStatus: { not: 'witnessed' } }, { tsaStatus: { not: 'witnessed' } }],
      witnessAttempts: { lt: MAX_WITNESS_ATTEMPTS },
    },
    orderBy: { createdAt: 'asc' },
    take: WITNESS_BATCH_LIMIT,
  })) as WitnessableRoot[];

  for (const root of pending) {
    // Sequential on purpose: the TSA and Rekor are external free services;
    // twenty parallel submissions from one worker is impolite and gains
    // nothing at a 5-minute cadence.
    await witnessRoot(root, fetchImpl);
  }
}
