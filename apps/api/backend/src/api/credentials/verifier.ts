import crypto from 'crypto';
import jwt, { type Algorithm, type JwtPayload } from 'jsonwebtoken';
import prisma from '../../graphql/prisma_client';
import type { VerificationResult, VerificationStatus } from './models';
import { logAuditEvent } from '../audit/service';

function resolveVerifyKey(headerAlg?: string): { key: string; algorithms?: Algorithm[] } {
  const key =
    process.env.ISSUER_PUBLIC_KEY ||
    process.env.CREDENTIAL_VERIFY_KEY ||
    process.env.ISSUER_PRIVATE_KEY ||
    process.env.JWT_SECRET ||
    '';
  if (!key) {
    throw new Error('No verification key configured (ISSUER_PUBLIC_KEY or JWT_SECRET required)');
  }

  const algorithms = headerAlg ? ([headerAlg as Algorithm]) : undefined;

  if (key.includes('BEGIN')) {
    return { key, algorithms };
  }
  return { key, algorithms: algorithms ?? ['HS256'] };
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function resolveStatus({
  expiresAt,
  revoked,
  currentStatus,
}: {
  expiresAt?: Date | null;
  revoked: boolean;
  currentStatus?: string | null;
}): VerificationStatus {
  if (revoked) return 'revoked';
  if (expiresAt && expiresAt.getTime() <= Date.now()) return 'expired';
  if (currentStatus === 'revoked' || currentStatus === 'expired') return currentStatus as VerificationStatus;
  return 'active';
}

export async function verifyCredentialJwt(
  token: string,
  requestId?: string,
): Promise<VerificationResult> {
  const decodedHeader = jwt.decode(token, { complete: true });
  const headerAlg = decodedHeader && typeof decodedHeader === 'object' ? decodedHeader.header?.alg : undefined;
  const proofHash = sha256Hex(token);

  let payload: JwtPayload;
  try {
    const { key, algorithms } = resolveVerifyKey(headerAlg);
    payload = jwt.verify(token, key, { algorithms }) as JwtPayload;
  } catch (err) {
    const audit = await logAuditEvent({
      type: 'VERIFY',
      metadata: { status: 'invalid', proofHash, error: err instanceof Error ? err.message : String(err) },
      requestId,
    });
    return {
      valid: false,
      proofHash,
      auditRef: audit.hash,
      status: 'invalid',
      reason: err instanceof Error ? err.message : 'Invalid signature',
    };
  }

  const credentialId = (payload.jti || (payload as Record<string, unknown>).credentialId) as
    | string
    | undefined;
  const expiresAt = payload.exp ? new Date(payload.exp * 1000) : undefined;

  const credentialRecord = credentialId
    ? await prisma.verifiableCredential.findUnique({ where: { id: credentialId } })
    : null;

  const revocation = credentialId
    ? await prisma.credentialRevocation.findFirst({
        where: { credentialId },
        orderBy: { revokedAt: 'desc' },
      })
    : null;

  const status: VerificationStatus =
    !credentialId || !credentialRecord
      ? 'unknown'
      : resolveStatus({
          expiresAt: credentialRecord?.expiresAt ?? expiresAt,
          revoked: Boolean(revocation),
          currentStatus: credentialRecord?.status,
        });
  const valid = status === 'active' && Boolean(credentialRecord);

  if (credentialRecord && status !== credentialRecord.status && status !== 'unknown') {
    await prisma.verifiableCredential.update({
      where: { id: credentialRecord.id },
      data: { status },
    });
  }

  const audit = await logAuditEvent({
    type: 'VERIFY',
    credentialId,
    metadata: {
      status,
      proofHash,
      expiresAt: credentialRecord?.expiresAt?.toISOString() ?? expiresAt?.toISOString() ?? null,
      revocation: revocation
        ? {
            reason: revocation.reason,
            revokedAt: revocation.revokedAt.toISOString(),
            revokedBy: revocation.revokedBy,
          }
        : null,
      credentialFound: Boolean(credentialRecord),
    },
    requestId,
  });

  return {
    valid,
    proofHash,
    auditRef: audit.hash,
    status,
    reason:
      status === 'active'
        ? undefined
        : status === 'revoked'
          ? 'Credential revoked'
          : status === 'expired'
            ? 'Credential expired'
            : 'Credential not found',
  };
}
