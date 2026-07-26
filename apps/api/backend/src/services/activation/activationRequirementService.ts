/**
 * ACT-1.3 — the activation requirement ledger service.
 *
 * Persists the per-application "remaining work to a qualified start". Reuses the
 * pure requirementLifecycle for every transition and the readiness predicate, so
 * persistence can never disagree with the rules. Audit-before-success on every
 * consequential write. Requirements are instantiated only after an employer
 * decision, and evidence already accepted as a head start is marked `met` so a
 * clinician never re-enters it.
 */

import { createHash } from 'crypto';
import { randomUUID } from 'crypto';

import prisma from '../../graphql/prisma_client';
import type { AuditEventType } from '../../types/auditEventTypes';
import {
  canTransition,
  deriveActivationReadiness,
  isRequirementResolved,
  type ActivationReadiness,
  type ActivationRequirementCategory,
  type ActivationRequirementNecessity,
  type ActivationRequirementOwner,
  type ActivationRequirementStatus,
  type RequirementView,
} from './requirementLifecycle';

function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function writeActivationAudit(
  type: AuditEventType,
  referenceId: string,
  clinicianId: string | null,
  organizationId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      id: randomUUID(),
      type,
      referenceId,
      clinicianId,
      organizationId,
      hash: hashPayload({ type, referenceId, organizationId, metadata }),
      metadata: metadata as object,
    },
  });
}

export interface RequirementSeed {
  readonly sourceRequirementId?: string;
  readonly category: ActivationRequirementCategory;
  readonly label: string;
  readonly necessity: ActivationRequirementNecessity;
  readonly owner: ActivationRequirementOwner;
  readonly evidenceRule?: string;
  readonly dependencyIds?: readonly string[];
  readonly policyVersion?: string;
}

/**
 * Instantiate the remaining requirements for an application, once, after a
 * decision. A seed whose key is in `acceptedEvidenceKeys` is created already
 * `met` (accepted as a head start — never re-requested). No-op if requirements
 * already exist for the application (idempotent).
 */
export async function instantiateActivationRequirements(input: {
  applicationId: string;
  organizationId: string;
  clinicianNpi?: string | null;
  requirements: readonly RequirementSeed[];
  acceptedEvidenceKeys?: readonly string[];
}): Promise<{ created: number; skipped: boolean }> {
  const existing = await prisma.activationRequirement.findFirst({
    where: { applicationId: input.applicationId },
    select: { id: true },
  });
  if (existing) return { created: 0, skipped: true };

  const accepted = new Set(input.acceptedEvidenceKeys ?? []);
  const now = new Date();
  const rows = input.requirements.map((seed) => {
    const preMet = seed.sourceRequirementId != null && accepted.has(seed.sourceRequirementId);
    return {
      id: randomUUID(),
      applicationId: input.applicationId,
      organizationId: input.organizationId,
      sourceRequirementId: seed.sourceRequirementId ?? null,
      category: seed.category,
      label: seed.label,
      necessity: seed.necessity,
      status: (preMet ? 'met' : 'not_started') satisfies ActivationRequirementStatus as string,
      owner: seed.owner,
      evidenceRule: seed.evidenceRule ?? null,
      dependencyIds: [...(seed.dependencyIds ?? [])],
      policyVersion: seed.policyVersion ?? null,
      resolvedBy: preMet ? 'system:head_start' : null,
      resolvedAt: preMet ? now : null,
    };
  });

  await prisma.activationRequirement.createMany({ data: rows });
  await writeActivationAudit('ACTIVATION_REQUIREMENTS_INSTANTIATED', input.applicationId, input.clinicianNpi ?? null, input.organizationId, {
    count: rows.length,
    preMet: rows.filter((r) => r.status === 'met').length,
  });
  return { created: rows.length, skipped: false };
}

export type ResolveRequirementResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'wrong_tenant' | 'invalid_transition' };

/**
 * Move one requirement to a new status. Only its own transition changes — never
 * another requirement's (single-id update). Rejects a transition the state
 * machine forbids, and a requirement outside the acting organization.
 */
export async function resolveActivationRequirement(input: {
  requirementId: string;
  organizationId: string;
  toStatus: ActivationRequirementStatus;
  actorId: string;
  reason?: string;
  policyVersion?: string;
}): Promise<ResolveRequirementResult> {
  const row = await prisma.activationRequirement.findUnique({ where: { id: input.requirementId } });
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.organizationId !== input.organizationId) return { ok: false, reason: 'wrong_tenant' };

  const from = row.status as ActivationRequirementStatus;
  if (!canTransition(from, input.toStatus)) return { ok: false, reason: 'invalid_transition' };

  const resolved = isRequirementResolved(input.toStatus);
  const now = new Date();

  // Audit before success.
  await writeActivationAudit('ACTIVATION_REQUIREMENT_RESOLVED', input.requirementId, null, input.organizationId, {
    applicationId: row.applicationId,
    priorStatus: from,
    nextStatus: input.toStatus,
    actorId: input.actorId,
    reason: input.reason ?? null,
    policyVersion: input.policyVersion ?? row.policyVersion ?? null,
  });

  await prisma.activationRequirement.update({
    where: { id: input.requirementId },
    data: {
      status: input.toStatus,
      resolvedBy: resolved ? input.actorId : null,
      resolvedAt: resolved ? now : null,
      policyVersion: input.policyVersion ?? row.policyVersion ?? null,
    },
  });
  return { ok: true };
}

/** Read an application's requirements and derive its start-readiness. */
export async function getApplicationActivation(applicationId: string): Promise<{
  requirements: RequirementView[];
  readiness: ActivationReadiness;
}> {
  const rows = await prisma.activationRequirement.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'asc' },
  });
  const requirements: RequirementView[] = rows.map((r) => ({
    id: r.id,
    necessity: r.necessity as ActivationRequirementNecessity,
    status: r.status as ActivationRequirementStatus,
  }));
  return { requirements, readiness: deriveActivationReadiness(requirements) };
}
