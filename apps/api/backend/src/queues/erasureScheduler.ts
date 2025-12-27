import crypto from 'crypto';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

const ERASURE_COOLING_DAYS = 7;
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REVOCATION_EVENT_TYPES = ['REVOKE_CREDENTIAL', 'CREDENTIAL_REVOKED'] as const;

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function privacyDigest(value: string): string {
  const pepper = process.env.WORLD_ID_PEPPER || process.env.WORLD_ID_NULLIFIER_PEPPER || '';
  return sha256Hex(`${pepper}:${value}`);
}

async function writeAuditEvent(event: {
  type: string;
  credentialId?: string;
  userId?: number;
  metadata?: any;
}): Promise<{ hash: string; createdAt: string }> {
  const createdAt = new Date();
  const hash = sha256Hex(
    JSON.stringify({
      type: event.type,
      credentialId: event.credentialId || null,
      userId: event.userId || null,
      createdAt: createdAt.toISOString(),
      metadata: event.metadata || null,
    }),
  );

  await prisma.auditEvent.create({
    data: {
      type: event.type,
      hash,
      credentialId: event.credentialId,
      userId: event.userId,
      metadata: event.metadata ?? undefined,
      createdAt,
    },
  });

  return { hash, createdAt: createdAt.toISOString() };
}

function credentialAuditHash(credential: {
  id: number;
  name: string;
  issuer: string;
  issuedAt: Date;
}): string {
  return sha256Hex(
    JSON.stringify({
      id: credential.id,
      name: credential.name,
      issuer: credential.issuer,
      issuedAt: credential.issuedAt.toISOString(),
    }),
  );
}

export async function runErasureSweep(): Promise<{ processed: number; skipped: number }> {
  const cutoff = new Date(Date.now() - ERASURE_COOLING_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await prisma.user.findMany({
    where: {
      deletionRequestedAt: { lte: cutoff },
      deletionErasedAt: null,
    },
  });

  let processed = 0;
  let skipped = 0;

  for (const user of candidates) {
    const credentials = await prisma.credential.findMany({ where: { userId: user.id } });
    const credentialIds = credentials.map((credential) => `CRED-${credential.id}`);

    const revokedEvent = credentialIds.length
      ? await prisma.auditEvent.findFirst({
          where: {
            type: { in: [...REVOCATION_EVENT_TYPES] },
            credentialId: { in: credentialIds },
          },
        })
      : null;

    if (revokedEvent) {
      skipped += 1;
      continue;
    }

    const credentialHashes = credentials.map((credential) => credentialAuditHash(credential));
    const anonymizedEmail = `erased+${privacyDigest(user.email)}@vitalcv.invalid`;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: 'Erased User',
        email: anonymizedEmail,
        passwordHash: null,
        deletionErasedAt: new Date(),
      },
    });

    await writeAuditEvent({
      type: 'ERASURE_CONFIRM',
      userId: user.id,
      metadata: {
        credentialCount: credentials.length,
        credentialHashes,
        retainedHashCount: credentialHashes.length,
      },
    });

    processed += 1;
  }

  return { processed, skipped };
}

export function startErasureScheduler(): void {
  if (process.env.ERASURE_CRON_ENABLED === 'false') return;
  const intervalMs = Number(process.env.ERASURE_SWEEP_INTERVAL_MS || DEFAULT_INTERVAL_MS);

  const run = async () => {
    try {
      const result = await runErasureSweep();
      log('info', 'erasure_sweep_complete', result);
    } catch (error) {
      log('error', 'erasure_sweep_failed', {
        error: String(error instanceof Error ? error.message : error),
      });
    }
  };

  void run();
  setInterval(() => {
    void run();
  }, Number.isFinite(intervalMs) ? intervalMs : DEFAULT_INTERVAL_MS);
}
