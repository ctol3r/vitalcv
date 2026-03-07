import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { computeCredentialState } from '../credentialStatusEngine';
import { computeTrustState } from '../trustState';
import type { VerifiableCredential } from './credentialModel';
import { sha256Hex } from '../../utils/deterministic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NPI_RE = /^\d{10}$/;

function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeOrganizationId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return UUID_RE.test(trimmed) ? trimmed : undefined;
}

function deriveNpi(credential: VerifiableCredential): string {
  if (NPI_RE.test(credential.subject)) {
    return credential.subject;
  }

  const claimNpi = credential.claims.npi;
  return typeof claimNpi === 'string' && NPI_RE.test(claimNpi) ? claimNpi : credential.subject;
}

function deriveClaimHashes(claims: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(claims).map(([key, value]) => [key, sha256Hex(JSON.stringify(value))]),
  );
}

function clonePayload(payload: unknown): Record<string, unknown> | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null;
  }

  return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
}

export async function upsertVerificationArtifactFromCredential(
  credential: VerifiableCredential,
  opts: {
    organizationId?: string;
    source?: string;
  } = {},
): Promise<{ id: string; npi: string; status: string } | null> {
  const verifiedAt = parseDate(credential.issuedAt) ?? new Date();
  const expiresAt = parseDate(credential.expiresAt);
  const organizationId = normalizeOrganizationId(opts.organizationId);
  const lifecycleState = computeCredentialState({
    revokedAt: credential.status === 'REVOKED' ? new Date() : null,
    suspendedAt: null,
    expiresAt,
    status: credential.status,
  }, verifiedAt);
  const trustState = computeTrustState({
    status: credential.status,
    expiresAt,
    monitoring: false,
  }, verifiedAt);

  try {
    const artifact = await prisma.verificationArtifact.upsert({
      where: { id: credential.credentialId },
      update: {
        npi: deriveNpi(credential),
        source: opts.source ?? credential.issuer,
        status: credential.status,
        rawPayload: JSON.parse(JSON.stringify(credential)),
        checksum: sha256Hex(credential.signature),
        claimHashes: deriveClaimHashes(credential.claims),
        lifecycleState,
        trustState,
        verifiedAt,
        expiresAt,
        statusLastChecked: new Date(),
        ...(organizationId ? { organizationId } : {}),
      },
      create: {
        id: credential.credentialId,
        npi: deriveNpi(credential),
        source: opts.source ?? credential.issuer,
        status: credential.status,
        rawPayload: JSON.parse(JSON.stringify(credential)),
        checksum: sha256Hex(credential.signature),
        claimHashes: deriveClaimHashes(credential.claims),
        lifecycleState,
        trustState,
        verifiedAt,
        expiresAt,
        monitoring: false,
        ...(organizationId ? { organizationId } : {}),
      },
      select: {
        id: true,
        npi: true,
        status: true,
      },
    });

    return artifact;
  } catch (error) {
    log('warn', 'credential_artifact_bridge_upsert_failed', {
      credentialId: credential.credentialId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

export async function revokeVerificationArtifact(
  credentialId: string,
  reason: string,
  revokedAt = new Date(),
  organizationId?: string,
): Promise<{ id: string; status: string; revokedAt: string } | null> {
  try {
    const existing = await prisma.verificationArtifact.findUnique({
      where: { id: credentialId },
      select: {
        id: true,
        rawPayload: true,
        expiresAt: true,
        monitoring: true,
      },
    });

    if (!existing) {
      return null;
    }

    const payload = clonePayload(existing.rawPayload) ?? {};
    payload.status = 'REVOKED';
    payload.revokedAt = revokedAt.toISOString();
    payload.revocationReason = reason;

    const nextLifecycleState = computeCredentialState({
      revokedAt,
      suspendedAt: null,
      expiresAt: existing.expiresAt,
      status: 'REVOKED',
    }, revokedAt);
    const nextTrustState = computeTrustState({
      status: 'REVOKED',
      expiresAt: existing.expiresAt,
      monitoring: existing.monitoring,
    }, revokedAt);
    const normalizedOrganizationId = normalizeOrganizationId(organizationId);

    const artifact = await prisma.verificationArtifact.update({
      where: { id: credentialId },
      data: {
        status: 'REVOKED',
        revokedAt,
        revocationReason: reason,
        rawPayload: payload as Prisma.InputJsonValue,
        lifecycleState: nextLifecycleState,
        trustState: nextTrustState,
        statusLastChecked: revokedAt,
        ...(normalizedOrganizationId ? { organizationId: normalizedOrganizationId } : {}),
      },
      select: {
        id: true,
        status: true,
        revokedAt: true,
      },
    });

    return {
      id: artifact.id,
      status: artifact.status,
      revokedAt: artifact.revokedAt?.toISOString() ?? revokedAt.toISOString(),
    };
  } catch (error) {
    log('warn', 'credential_artifact_bridge_revoke_failed', {
      credentialId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
