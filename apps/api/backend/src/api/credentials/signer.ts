import crypto from 'crypto';
import jwt, { type Algorithm, type JwtPayload } from 'jsonwebtoken';
import prisma from '../../graphql/prisma_client';
import type { Credential, CredentialStatus } from './models';
import { logAuditEvent } from '../audit/service';

function resolveSigningKey(): { key: string; algorithm: Algorithm } {
  const key =
    process.env.ISSUER_PRIVATE_KEY ||
    process.env.CREDENTIAL_SIGNING_KEY ||
    process.env.JWT_SECRET ||
    '';
  if (!key) {
    throw new Error('Issuer signing key is not configured (set ISSUER_PRIVATE_KEY or JWT_SECRET)');
  }

  const algorithm = (process.env.CREDENTIAL_JWT_ALG as Algorithm | undefined) || 'RS256';
  const usesSymmetric = !key.includes('BEGIN');

  return { key, algorithm: usesSymmetric ? 'HS256' : algorithm };
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export interface IssueParams {
  subjectId: string;
  issuerId: string;
  claims?: Record<string, unknown>;
  expiresAt?: string | Date | null;
  credentialId?: string;
  requestId?: string;
}

export interface IssueResult {
  credential: Credential;
  auditRef: string;
}

export async function issueCredential(params: IssueParams): Promise<IssueResult> {
  const { key, algorithm } = resolveSigningKey();
  const now = new Date();
  const credentialId = params.credentialId || crypto.randomUUID();
  const expiresAtDate = params.expiresAt ? new Date(params.expiresAt) : undefined;

  const payload: JwtPayload = {
    jti: credentialId,
    iss: params.issuerId,
    sub: params.subjectId,
    iat: Math.floor(now.getTime() / 1000),
    exp: expiresAtDate ? Math.floor(expiresAtDate.getTime() / 1000) : undefined,
    vc: {
      type: ['VerifiableCredential'],
      credentialSubject: params.claims ?? {},
    },
  };

  const token = jwt.sign(payload, key, {
    algorithm,
    keyid: process.env.ISSUER_KEY_ID,
  });

  const proofHash = sha256Hex(token);
  const status: CredentialStatus = 'active';

  await prisma.verifiableCredential.upsert({
    where: { id: credentialId },
    create: {
      id: credentialId,
      subjectId: params.subjectId,
      issuerId: params.issuerId,
      jwt: token,
      proofHash,
      status,
      issuedAt: now,
      expiresAt: expiresAtDate,
    },
    update: {
      subjectId: params.subjectId,
      issuerId: params.issuerId,
      jwt: token,
      proofHash,
      status,
      issuedAt: now,
      expiresAt: expiresAtDate,
    },
  });

  const audit = await logAuditEvent({
    type: 'ISSUE',
    credentialId,
    metadata: {
      issuerId: params.issuerId,
      subjectId: params.subjectId,
      expiresAt: expiresAtDate?.toISOString() ?? null,
      proofHash,
    },
    requestId: params.requestId,
  });

  return {
    credential: {
      id: credentialId,
      subjectId: params.subjectId,
      issuerId: params.issuerId,
      jwt: token,
      proofHash,
      status,
      issuedAt: now.toISOString(),
      expiresAt: expiresAtDate?.toISOString() ?? null,
    },
    auditRef: audit.hash,
  };
}
