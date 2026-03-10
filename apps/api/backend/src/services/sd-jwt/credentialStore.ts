import type { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';

export interface PersistIssuedCredentialInput {
  credentialId: string;
  issuerDid: string;
  holderDid: string;
  credentialType: string;
  format: string;
  kid: string;
  claimDigests: Record<string, string>;
  disclosureDigests: string[];
  holderBindingHash: string;
  statusReference?: string;
  receiptId: string;
  auditEventId: string;
  issuedAt: string;
  expiresAt?: string;
}

export interface StoredIssuedCredentialRecord {
  credentialId: string;
  issuerDid: string;
  holderDid: string;
  credentialType: string;
  format: string;
  kid: string;
  claimDigests: Record<string, string>;
  disclosureDigests: string[];
  holderBindingHash: string;
  statusReference?: string;
  receiptId: string;
  auditEventId: string;
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function toClaimDigests(value: Prisma.JsonValue): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Issued credential claim digests are malformed');
  }

  return Object.entries(value).reduce<Record<string, string>>((accumulator, [key, digest]) => {
    if (typeof digest === 'string') {
      accumulator[key] = digest;
    }
    return accumulator;
  }, {});
}

function toDomainRecord(
  row: Awaited<ReturnType<typeof prisma.issuedCredentialRecord.findUnique>> extends infer T
    ? NonNullable<T>
    : never,
): StoredIssuedCredentialRecord {
  return {
    credentialId: row.credentialId,
    issuerDid: row.issuerDid,
    holderDid: row.holderDid,
    credentialType: row.credentialType,
    format: row.format,
    kid: row.kid,
    claimDigests: toClaimDigests(row.claimDigests),
    disclosureDigests: [...row.disclosureDigests],
    holderBindingHash: row.holderBindingHash,
    ...(row.statusReference ? { statusReference: row.statusReference } : {}),
    receiptId: row.receiptId,
    auditEventId: row.auditEventId,
    issuedAt: row.issuedAt.toISOString(),
    ...(row.expiresAt ? { expiresAt: row.expiresAt.toISOString() } : {}),
    ...(row.revokedAt ? { revokedAt: row.revokedAt.toISOString() } : {}),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function persistIssuedCredentialRecord(
  input: PersistIssuedCredentialInput,
): Promise<StoredIssuedCredentialRecord> {
  const row = await prisma.issuedCredentialRecord.create({
    data: {
      credentialId: input.credentialId,
      issuerDid: input.issuerDid,
      holderDid: input.holderDid,
      credentialType: input.credentialType,
      format: input.format,
      kid: input.kid,
      claimDigests: input.claimDigests as Prisma.InputJsonObject,
      disclosureDigests: input.disclosureDigests,
      holderBindingHash: input.holderBindingHash,
      statusReference: input.statusReference ?? null,
      receiptId: input.receiptId,
      auditEventId: input.auditEventId,
      issuedAt: new Date(input.issuedAt),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });

  return toDomainRecord(row);
}

export async function getIssuedCredentialRecord(
  credentialId: string,
): Promise<StoredIssuedCredentialRecord | null> {
  const row = await prisma.issuedCredentialRecord.findUnique({
    where: { credentialId },
  });

  return row ? toDomainRecord(row) : null;
}
