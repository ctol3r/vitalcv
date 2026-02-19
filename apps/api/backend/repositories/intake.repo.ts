import { Prisma } from '@prisma/client';
import type {
  CredentialCandidate as CandidateCredential,
  ClinicianIdentity,
  IngestConflictRecord,
} from '../../../../packages/shared/credentials';
import prisma from '../src/graphql/prisma_client';

export type IntakeSummary = Readonly<{
  clinician_id: string;
  identities_count: number;
  candidate_credentials_count: number;
  unverified_credentials_count: number;
}>;

type IdempotentResponse = Readonly<{
  audit_ref: string;
  payload: Readonly<Record<string, unknown>>;
}>;

// ─── Identity ───────────────────────────────────────────────

export async function upsertClinicianIdentity(identity: ClinicianIdentity): Promise<ClinicianIdentity> {
  const clinicianId = identity.clinician_id.trim();
  await prisma.clinicianIdentity.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      data: identity as unknown as Prisma.InputJsonValue,
    },
    update: {
      data: identity as unknown as Prisma.InputJsonValue,
    },
  });
  return Object.freeze({ ...identity });
}

export async function getClinicianIdentity(clinicianId: string): Promise<ClinicianIdentity | null> {
  const row = await prisma.clinicianIdentity.findUnique({
    where: { clinicianId: clinicianId.trim() },
  });
  if (!row) return null;
  return row.data as unknown as ClinicianIdentity;
}

// ─── Credentials ────────────────────────────────────────────

export async function appendCandidateCredentials(
  clinicianId: string,
  credentials: readonly CandidateCredential[],
): Promise<readonly CandidateCredential[]> {
  const normalized = clinicianId.trim();

  for (const credential of credentials) {
    await prisma.candidateCredential.upsert({
      where: { candidateCredentialId: credential.candidate_credential_id },
      create: {
        candidateCredentialId: credential.candidate_credential_id,
        clinicianId: normalized,
        data: credential as unknown as Prisma.InputJsonValue,
        status: credential.status ?? 'UNVERIFIED',
      },
      update: {
        data: credential as unknown as Prisma.InputJsonValue,
        status: credential.status ?? 'UNVERIFIED',
      },
    });
  }

  return listCandidateCredentials(normalized);
}

export async function listCandidateCredentials(
  clinicianId: string,
): Promise<readonly CandidateCredential[]> {
  const rows = await prisma.candidateCredential.findMany({
    where: { clinicianId: clinicianId.trim() },
    orderBy: { candidateCredentialId: 'asc' },
  });
  return Object.freeze(rows.map((r) => r.data as unknown as CandidateCredential));
}

// ─── Conflicts ──────────────────────────────────────────────

export async function setIntakeConflicts(
  clinicianId: string,
  conflicts: readonly IngestConflictRecord[],
): Promise<readonly IngestConflictRecord[]> {
  const normalized = clinicianId.trim();

  // Upsert each conflict
  for (const conflict of conflicts) {
    await prisma.ingestConflict.upsert({
      where: { conflictId: conflict.conflict_id },
      create: {
        conflictId: conflict.conflict_id,
        clinicianId: normalized,
        status: conflict.status,
        data: conflict as unknown as Prisma.InputJsonValue,
      },
      update: {
        status: conflict.status,
        data: conflict as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return listIntakeConflicts(normalized);
}

export async function listIntakeConflicts(
  clinicianId: string,
): Promise<readonly IngestConflictRecord[]> {
  const rows = await prisma.ingestConflict.findMany({
    where: { clinicianId: clinicianId.trim() },
    orderBy: { conflictId: 'asc' },
  });
  return Object.freeze(rows.map((r) => r.data as unknown as IngestConflictRecord));
}

export async function hasUnresolvedIntakeConflicts(clinicianId: string): Promise<boolean> {
  const count = await prisma.ingestConflict.count({
    where: { clinicianId: clinicianId.trim(), status: 'UNRESOLVED' },
  });
  return count > 0;
}

// ─── Summary ────────────────────────────────────────────────

export async function getIntakeSummary(clinicianId: string): Promise<IntakeSummary> {
  const normalized = clinicianId.trim();

  const [identity, totalCreds, unverifiedCreds] = await Promise.all([
    prisma.clinicianIdentity.findUnique({ where: { clinicianId: normalized } }),
    prisma.candidateCredential.count({ where: { clinicianId: normalized } }),
    prisma.candidateCredential.count({ where: { clinicianId: normalized, status: 'UNVERIFIED' } }),
  ]);

  return Object.freeze({
    clinician_id: normalized,
    identities_count: identity ? 1 : 0,
    candidate_credentials_count: totalCreds,
    unverified_credentials_count: unverifiedCreds,
  });
}

export async function hasIntakeData(clinicianId: string): Promise<boolean> {
  const summary = await getIntakeSummary(clinicianId);
  return summary.identities_count > 0 || summary.candidate_credentials_count > 0;
}

// ─── Idempotent Responses ───────────────────────────────────

export async function readIdempotentResponse(
  routeKey: string,
  requestHash: string,
): Promise<IdempotentResponse | null> {
  const key = `${routeKey}:${requestHash}`;
  const row = await prisma.idempotentResponse.findUnique({ where: { key } });
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    // Expired — clean up and return null
    await prisma.idempotentResponse.delete({ where: { key } }).catch(() => {});
    return null;
  }
  return { audit_ref: row.auditRef, payload: row.payload as Record<string, unknown> };
}

export async function writeIdempotentResponse(
  routeKey: string,
  requestHash: string,
  response: IdempotentResponse,
): Promise<void> {
  const key = `${routeKey}:${requestHash}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h TTL

  await prisma.idempotentResponse.upsert({
    where: { key },
    create: {
      key,
      auditRef: response.audit_ref,
      payload: response.payload as Prisma.InputJsonValue,
      expiresAt,
    },
    update: {
      auditRef: response.audit_ref,
      payload: response.payload as Prisma.InputJsonValue,
      expiresAt,
    },
  });
}
