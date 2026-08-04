import { Prisma, type PrismaClient } from '@prisma/client';

import prisma from '../../graphql/prisma_client';
import { sha256ForPayload } from '../../utils/deterministic';

export type ConsentScope = Readonly<Record<string, unknown>> | readonly unknown[];

export interface CreateConsentGrantInput {
  clinicianUserId: string;
  clinicianNpi: string;
  organizationId: string;
  recipient: string;
  purpose: string;
  action: string;
  scope: ConsentScope;
  packetId?: string | null;
  packetHash?: string | null;
  applicationId?: string | null;
  startActivationId?: string | null;
  verificationRequestId?: string | null;
  authenticationMethod: string;
  authenticationRef?: string | null;
  grantedAt?: Date;
  validUntil?: Date | null;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface ConsentGrantRecord {
  id: string;
  grantHash: string;
  auditEventId: string;
  grantedAt: Date;
  validUntil: Date | null;
  revokedAt: Date | null;
}

export interface ConsentGrantTransaction {
  auditEvent: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
  consentGrant: {
    create(args: { data: Record<string, unknown> }): Promise<ConsentGrantRecord>;
  };
}

const NPI_RE = /^\d{10}$/;

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function requireNpi(value: string): string {
  const normalized = value.trim();
  if (!NPI_RE.test(normalized)) throw new Error('clinicianNpi must be exactly 10 digits');
  return normalized;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function canonicalGrant(input: CreateConsentGrantInput, grantedAt: Date) {
  return {
    version: '1',
    clinicianUserId: requireText(input.clinicianUserId, 'clinicianUserId'),
    clinicianNpi: requireNpi(input.clinicianNpi),
    organizationId: requireText(input.organizationId, 'organizationId'),
    recipient: requireText(input.recipient, 'recipient'),
    purpose: requireText(input.purpose, 'purpose'),
    action: requireText(input.action, 'action'),
    scope: input.scope,
    packetId: input.packetId ?? null,
    packetHash: input.packetHash ?? null,
    applicationId: input.applicationId ?? null,
    startActivationId: input.startActivationId ?? null,
    verificationRequestId: input.verificationRequestId ?? null,
    authenticationMethod: requireText(input.authenticationMethod, 'authenticationMethod'),
    authenticationRef: input.authenticationRef ?? null,
    grantedAt: grantedAt.toISOString(),
    validUntil: input.validUntil?.toISOString() ?? null,
  } as const;
}

/**
 * Audit is inserted first inside the caller's transaction. A failed grant insert
 * rolls the audit row back; no function returns success unless both writes commit.
 */
export async function createConsentGrantInTransaction(
  tx: ConsentGrantTransaction,
  input: CreateConsentGrantInput,
): Promise<ConsentGrantRecord> {
  const grantedAt = input.grantedAt ?? new Date();
  const canonical = canonicalGrant(input, grantedAt);
  const grantHash = sha256ForPayload(canonical);

  const audit = await tx.auditEvent.create({
    data: {
      type: 'consent_grant_created',
      hash: grantHash,
      referenceId: canonical.applicationId
        ?? canonical.verificationRequestId
        ?? canonical.startActivationId
        ?? grantHash,
      clinicianId: canonical.clinicianUserId,
      organizationId: canonical.organizationId,
      metadata: asJson({
        entity_type: 'consent_grant',
        action: canonical.action,
        recipient: canonical.recipient,
        purpose: canonical.purpose,
        scope: canonical.scope,
        packet_id: canonical.packetId,
        packet_hash: canonical.packetHash,
        application_id: canonical.applicationId,
        start_activation_id: canonical.startActivationId,
        verification_request_id: canonical.verificationRequestId,
        authentication_method: canonical.authenticationMethod,
        valid_until: canonical.validUntil,
      }),
      createdAt: grantedAt,
    },
  });

  return tx.consentGrant.create({
    data: {
      clinicianUserId: canonical.clinicianUserId,
      clinicianNpi: canonical.clinicianNpi,
      organizationId: canonical.organizationId,
      recipient: canonical.recipient,
      purpose: canonical.purpose,
      action: canonical.action,
      scope: asJson(canonical.scope),
      packetId: canonical.packetId,
      packetHash: canonical.packetHash,
      applicationId: canonical.applicationId,
      startActivationId: canonical.startActivationId,
      verificationRequestId: canonical.verificationRequestId,
      authenticationMethod: canonical.authenticationMethod,
      authenticationRef: canonical.authenticationRef,
      grantedAt,
      validUntil: input.validUntil ?? null,
      grantHash,
      auditEventId: audit.id,
      metadata: asJson(input.metadata ?? {}),
    },
  });
}

export async function createConsentGrant(
  input: CreateConsentGrantInput,
  client: PrismaClient = prisma,
): Promise<ConsentGrantRecord> {
  const grantedAt = input.grantedAt ?? new Date();
  const grantHash = sha256ForPayload(canonicalGrant(input, grantedAt));
  const existing = await client.consentGrant.findUnique({
    where: { grantHash },
    select: {
      id: true,
      grantHash: true,
      auditEventId: true,
      grantedAt: true,
      validUntil: true,
      revokedAt: true,
    },
  });
  if (existing) return existing;

  try {
    return await client.$transaction((tx) => createConsentGrantInTransaction(
      tx as unknown as ConsentGrantTransaction,
      { ...input, grantedAt },
    ));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await client.consentGrant.findUnique({
        where: { grantHash },
        select: {
          id: true,
          grantHash: true,
          auditEventId: true,
          grantedAt: true,
          validUntil: true,
          revokedAt: true,
        },
      });
      if (raced) return raced;
    }
    throw error;
  }
}
