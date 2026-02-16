import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import { computeCredentialState } from './credentialStatusEngine';
import { CredentialLifecycleState } from '../../../../../types/credentialLifecycle';

type ArtifactWithLifecycleState = {
  id: string;
  revokedAt: Date | null;
  suspendedAt: Date | null;
  revocationReason: string | null;
  status: string;
  expiresAt: Date | null;
  statusLastChecked: Date;
  lifecycleState: string;
};

type RevocationAction = 'revoke' | 'suspend' | 'reinstate';

type RevocationReason = string | undefined;

function normalizeReason(reason: RevocationReason): string {
  if (typeof reason === 'undefined') {
    return '';
  }
  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function now(): Date {
  return new Date();
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashLedgerEvent(parts: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(parts)).digest('hex');
}

function artifactInputForState(artifact: ArtifactWithLifecycleState): Parameters<typeof computeCredentialState>[0] {
  return {
    revokedAt: artifact.revokedAt,
    suspendedAt: artifact.suspendedAt,
    expiresAt: artifact.expiresAt,
    status: artifact.status,
  };
}

async function ensureArtifact(artifactId: string): Promise<ArtifactWithLifecycleState> {
  const artifact = await prisma.verificationArtifact.findUnique({
    where: { id: artifactId },
  });

  if (!artifact) {
    throw new Error(`artifact not found: ${artifactId}`);
  }

  return artifact as ArtifactWithLifecycleState;
}

async function appendTrustLedgerEvent(
  artifactId: string,
  action: RevocationAction,
  details: Record<string, unknown>,
): Promise<void> {
  const createdAt = now();

  await prisma.trustLedgerEntry.create({
    data: {
      artifactId,
      action,
      hash: hashLedgerEvent({ artifactId, action, ...details, createdAt: createdAt.toISOString() }),
      metadata: {
        artifactId,
        action,
        createdAt: createdAt.toISOString(),
        ...details,
      } as Prisma.InputJsonValue,
      createdAt,
    },
  });
}

export async function revokeCredential(
  artifactId: string,
  reason: RevocationReason,
): Promise<void> {
  const artifact = await ensureArtifact(artifactId);

  if (artifact.revokedAt) {
    throw new Error('credential already revoked');
  }

  const revokedAt = now();
  const revocationReason = normalizeReason(reason);

  const updated = await prisma.verificationArtifact.update({
    where: { id: artifactId },
    data: {
      revokedAt,
      revocationReason: revocationReason || null,
      suspendedAt: null,
      statusLastChecked: revokedAt,
      lifecycleState: CredentialLifecycleState.REVOKED,
    },
  });

  await appendTrustLedgerEvent(artifactId, 'revoke', {
    status: updated.lifecycleState,
    reason: revocationReason || null,
    previousLifecycle: artifactInputForState(artifact),
    nextLifecycle: computeCredentialState(updated as ArtifactWithLifecycleState),
  });
}

export async function suspendCredential(artifactId: string, reason: RevocationReason): Promise<void> {
  const artifact = await ensureArtifact(artifactId);

  if (artifact.revokedAt) {
    throw new Error('cannot suspend revoked credential');
  }

  const suspendedAt = artifact.suspendedAt ?? now();
  const suspensionReason = normalizeReason(reason);

  const updated = await prisma.verificationArtifact.update({
    where: { id: artifactId },
    data: {
      suspendedAt,
      revocationReason: suspensionReason || artifact.revocationReason,
      statusLastChecked: now(),
      lifecycleState: CredentialLifecycleState.SUSPENDED,
    },
  });

  await appendTrustLedgerEvent(artifactId, 'suspend', {
    status: updated.lifecycleState,
    reason: suspensionReason || null,
    nextLifecycle: computeCredentialState(updated as ArtifactWithLifecycleState),
    suspendedAt: updated.suspendedAt?.toISOString() ?? null,
  });
}

export async function reinstateCredential(artifactId: string): Promise<void> {
  const artifact = await ensureArtifact(artifactId);

  if (artifact.revokedAt) {
    throw new Error('cannot reinstate revoked credential');
  }

  const wasSuspended = Boolean(artifact.suspendedAt);

  const nowChecked = now();
  const lifecycleState = computeCredentialState({
    revokedAt: artifact.revokedAt,
    suspendedAt: null,
    expiresAt: artifact.expiresAt,
    status: artifact.status,
  }, nowChecked);

  await prisma.verificationArtifact.update({
    where: { id: artifactId },
    data: {
      suspendedAt: null,
      statusLastChecked: nowChecked,
      lifecycleState,
    },
  });

  if (!wasSuspended) {
    await appendTrustLedgerEvent(artifactId, 'reinstate', {
      status: lifecycleState,
      reinstatedAt: nowChecked.toISOString(),
      alreadyActive: true,
    });
    return;
  }

  await appendTrustLedgerEvent(artifactId, 'reinstate', {
    status: lifecycleState,
    reinstatedAt: nowChecked.toISOString(),
    previousLifecycle: artifactInputForState(artifact),
  });
}
