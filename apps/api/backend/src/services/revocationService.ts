import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import { createHashChain } from '../utils/deterministic';
import { isStrictTransitionMode } from '../utils/environment';
import { appendArtifactLifecycleEntry } from './transparencyLedger';
import { computeCredentialState } from './credentialStatusEngine';
import { CredentialLifecycleState } from '../utils/lifecycleState';
import { runIndependentCrossCheck } from './crossCheckEngine';

type ArtifactWithLifecycleState = {
  id: string;
  organizationId: string | null;
  checksum: string;
  merkleRoot: string | null;
  revokedAt: Date | null;
  suspendedAt: Date | null;
  revocationReason: string | null;
  status: string;
  lifecycleState: string;
  expiresAt: Date | null;
  statusLastChecked: Date;
};

type RevocationAction = 'revoke' | 'suspend' | 'reinstate' | 'expire';
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

function nowSeconds(): string {
  return now().toISOString();
}

function artifactInputForState(
  artifact: ArtifactWithLifecycleState,
): Parameters<typeof computeCredentialState>[0] {
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

  if (typeof artifact.checksum !== 'string' || artifact.checksum.length === 0) {
    throw new Error('artifact checksum missing for lifecycle transition.');
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
      hash: createHashChain({
        artifactId,
        action,
        ...details,
        createdAt: createdAt.toISOString(),
      }),
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

async function assertCrossCheckPass(
  artifactId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const result = await runIndependentCrossCheck(artifactId, tx);
  if (!result.passed) {
    throw new Error(`Strict mode cross-check failed: ${result.failures.join(', ') || 'unknown'}`);
  }
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
  const strictMode = isStrictTransitionMode();

  const updated = await prisma.$transaction(async (tx) => {
    const updatedArtifact = (await tx.verificationArtifact.update({
      where: { id: artifactId },
      data: {
        revokedAt,
        revocationReason: revocationReason || null,
        suspendedAt: null,
        statusLastChecked: revokedAt,
        lifecycleState: CredentialLifecycleState.REVOKED,
      },
    })) as ArtifactWithLifecycleState;

    if (strictMode) {
      await appendArtifactLifecycleEntry(
        {
          id: updatedArtifact.id,
          checksum: updatedArtifact.checksum,
          merkleRoot: updatedArtifact.merkleRoot ?? '',
          lifecycleState: CredentialLifecycleState.REVOKED,
          organizationId: updatedArtifact.organizationId,
        },
        {
          tx,
          strict: true,
        },
      );
      await assertCrossCheckPass(updatedArtifact.id, tx);
    }

    return updatedArtifact;
  });

  if (!strictMode) {
    await appendArtifactLifecycleEntry({
      id: updated.id,
      checksum: updated.checksum,
      merkleRoot: updated.merkleRoot,
      lifecycleState: CredentialLifecycleState.REVOKED,
      organizationId: updated.organizationId,
    });
  }

  await appendTrustLedgerEvent(artifactId, 'revoke', {
    status: updated.lifecycleState,
    reason: revocationReason || null,
    previousLifecycle: artifactInputForState(artifact),
    nextLifecycle: computeCredentialState(updated),
  });
}

export async function suspendCredential(
  artifactId: string,
  reason: RevocationReason,
): Promise<void> {
  const artifact = await ensureArtifact(artifactId);
  if (artifact.revokedAt) {
    throw new Error('cannot suspend revoked credential');
  }

  const suspendedAt = artifact.suspendedAt ?? now();
  const suspensionReason = normalizeReason(reason);
  const strictMode = isStrictTransitionMode();

  const updated = await prisma.$transaction(async (tx) => {
    const updatedArtifact = (await tx.verificationArtifact.update({
      where: { id: artifactId },
      data: {
        suspendedAt,
        revocationReason: suspensionReason || artifact.revocationReason,
        statusLastChecked: now(),
        lifecycleState: CredentialLifecycleState.SUSPENDED,
      },
    })) as ArtifactWithLifecycleState;

    if (strictMode) {
      await appendArtifactLifecycleEntry(
        {
          id: updatedArtifact.id,
          checksum: updatedArtifact.checksum,
          merkleRoot: updatedArtifact.merkleRoot ?? '',
          lifecycleState: CredentialLifecycleState.SUSPENDED,
          organizationId: updatedArtifact.organizationId,
        },
        {
          tx,
          strict: true,
        },
      );
      await assertCrossCheckPass(updatedArtifact.id, tx);
    }

    return updatedArtifact;
  });

  if (!strictMode) {
    await appendArtifactLifecycleEntry({
      id: updated.id,
      checksum: updated.checksum,
      merkleRoot: updated.merkleRoot,
      lifecycleState: CredentialLifecycleState.SUSPENDED,
      organizationId: updated.organizationId,
    });
  }

  await appendTrustLedgerEvent(artifactId, 'suspend', {
    status: updated.lifecycleState,
    reason: suspensionReason || null,
    nextLifecycle: computeCredentialState(updated),
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
  const strictMode = isStrictTransitionMode();
  const lifecycleState = computeCredentialState(
    {
      revokedAt: artifact.revokedAt,
      suspendedAt: null,
      expiresAt: artifact.expiresAt,
      status: artifact.status,
    },
    nowChecked,
  );

  const updated = await prisma.$transaction(async (tx) => {
    const updatedArtifact = (await tx.verificationArtifact.update({
      where: { id: artifactId },
      data: {
        suspendedAt: null,
        statusLastChecked: nowChecked,
        lifecycleState,
      },
    })) as ArtifactWithLifecycleState;

    if (strictMode) {
      await appendArtifactLifecycleEntry(
        {
          id: updatedArtifact.id,
          checksum: updatedArtifact.checksum,
          merkleRoot: updatedArtifact.merkleRoot ?? '',
          lifecycleState: lifecycleState,
          organizationId: updatedArtifact.organizationId,
        },
        {
          tx,
          strict: true,
        },
      );
      await assertCrossCheckPass(updatedArtifact.id, tx);
    }

    return updatedArtifact;
  });

  if (!strictMode) {
    await appendArtifactLifecycleEntry({
      id: updated.id,
      checksum: updated.checksum,
      merkleRoot: updated.merkleRoot,
      lifecycleState,
      organizationId: updated.organizationId,
    });
  }

  if (!wasSuspended) {
    await appendTrustLedgerEvent(artifactId, 'reinstate', {
      status: lifecycleState,
      reinstatedAt: nowSeconds(),
      alreadyActive: true,
    });
    return;
  }

  await appendTrustLedgerEvent(artifactId, 'reinstate', {
    status: lifecycleState,
    reinstatedAt: nowSeconds(),
    previousLifecycle: artifactInputForState(artifact),
  });
}

export async function setCredentialExpiry(
  artifactId: string,
  expiresAt: Date | null,
  reason: RevocationReason = undefined,
): Promise<void> {
  const artifact = await ensureArtifact(artifactId);
  const strictMode = isStrictTransitionMode();

  const nowChecked = now();
  const lifecycleState = computeCredentialState(
    {
      revokedAt: artifact.revokedAt,
      suspendedAt: artifact.suspendedAt,
      expiresAt,
      status: artifact.status,
    },
    nowChecked,
  );

  const updated = await prisma.$transaction(async (tx) => {
    const updatedArtifact = (await tx.verificationArtifact.update({
      where: { id: artifactId },
      data: {
        expiresAt,
        statusLastChecked: nowChecked,
        lifecycleState,
      },
    })) as ArtifactWithLifecycleState;

    if (strictMode) {
      await appendArtifactLifecycleEntry(
        {
          id: updatedArtifact.id,
          checksum: updatedArtifact.checksum,
          merkleRoot: updatedArtifact.merkleRoot ?? '',
          lifecycleState: lifecycleState,
          organizationId: updatedArtifact.organizationId,
        },
        {
          tx,
          strict: true,
        },
      );
      await assertCrossCheckPass(updatedArtifact.id, tx);
    }

    return updatedArtifact;
  });

  if (!strictMode) {
    await appendArtifactLifecycleEntry({
      id: updated.id,
      checksum: updated.checksum,
      merkleRoot: updated.merkleRoot,
      lifecycleState,
      organizationId: updated.organizationId,
    });
  }

  await appendTrustLedgerEvent(artifactId, 'expire', {
    status: lifecycleState,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    previousLifecycle: artifactInputForState(artifact),
    reason: normalizeReason(reason),
  });
}
