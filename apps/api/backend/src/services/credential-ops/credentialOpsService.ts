import { createHash, randomUUID } from 'node:crypto';
import {
  CredentialOpsCaseState,
  CredentialOpsTemplateStatus,
  CredentialOpsTaskState,
  Prisma,
  VcvEntityType,
  type CredentialOpsCaseType,
  type CredentialOpsDataHandling,
  type CredentialOpsTargetKind,
  type CredentialOpsTaskCategory,
  type CredentialOpsTaskNecessity,
  type CredentialOpsTaskOwner,
} from '@prisma/client';

import prisma from '../../graphql/prisma_client';
import type { AuditEventType } from '../../types/auditEventTypes';
import { HttpError } from '../../utils/httpError';
import type { CredentialOpsViewer } from './credentialOpsAuthorization';
import { assertNoRestrictedCredentialOpsData } from './restrictedData';

type JsonObject = Record<string, unknown>;

export interface TemplateRequirementInput {
  requirementKey: string;
  label: string;
  category: CredentialOpsTaskCategory;
  owner: CredentialOpsTaskOwner;
  necessity?: CredentialOpsTaskNecessity;
  evidenceRule?: JsonObject;
  dependencyKeys?: string[];
  dueOffsetDays?: number | null;
  dataHandling?: CredentialOpsDataHandling;
  sortOrder?: number;
}

export interface CreateTemplateInput {
  organizationId?: string | null;
  templateKey: string;
  version: number;
  caseType: CredentialOpsCaseType;
  targetKind: CredentialOpsTargetKind;
  targetAuthorityName: string;
  jurisdiction?: string | null;
  professionCodes: string[];
  sourceReferences: JsonObject[];
  effectiveAt: Date;
  expiresAt?: Date | null;
  requirements: TemplateRequirementInput[];
}

export interface CreateCaseInput {
  workflowTemplateId: string;
  subjectEntityId: string;
  professionCode: string;
  idempotencyKey: string;
  applicationId?: string | null;
  activationRequirementId?: string | null;
  startActivationId?: string | null;
  targetDueAt?: Date | null;
  metadata?: JsonObject;
}

const TEMPLATE_INCLUDE = {
  requirements: { orderBy: [{ sortOrder: 'asc' as const }, { requirementKey: 'asc' as const }] },
} satisfies Prisma.CredentialOpsWorkflowTemplateInclude;

const CASE_INCLUDE = {
  tasks: { orderBy: [{ sortOrder: 'asc' as const }, { requirementKey: 'asc' as const }] },
  workflowTemplate: {
    select: {
      id: true,
      templateKey: true,
      version: true,
      targetAuthorityName: true,
      jurisdiction: true,
      sourceReferences: true,
      effectiveAt: true,
      expiresAt: true,
    },
  },
} satisfies Prisma.CredentialOperationsCaseInclude;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as JsonObject)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new HttpError(400, `${label} is required.`);
  return normalized;
}

function normalizeKey(value: string, label: string): string {
  const key = requiredText(value, label).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,99}$/.test(key)) {
    throw new HttpError(400, `${label} must be 2-100 lowercase letters, numbers, dots, dashes, or underscores.`);
  }
  return key;
}

function assertTemplateGraph(requirements: readonly {
  requirementKey: string;
  dependencyKeys?: readonly string[];
}[]): void {
  if (requirements.length === 0) throw new HttpError(400, 'At least one requirement is required.');
  const keys = requirements.map((requirement) => normalizeKey(requirement.requirementKey, 'requirementKey'));
  if (new Set(keys).size !== keys.length) throw new HttpError(400, 'Requirement keys must be unique.');
  const keySet = new Set(keys);
  const graph = new Map<string, string[]>();

  requirements.forEach((requirement, index) => {
    const key = keys[index];
    const dependencies = (requirement.dependencyKeys ?? []).map((item) => normalizeKey(item, 'dependencyKey'));
    if (new Set(dependencies).size !== dependencies.length) {
      throw new HttpError(400, `Requirement ${key} contains duplicate dependencies.`);
    }
    dependencies.forEach((dependency) => {
      if (!keySet.has(dependency)) throw new HttpError(400, `Requirement ${key} depends on unknown key ${dependency}.`);
      if (dependency === key) throw new HttpError(400, `Requirement ${key} cannot depend on itself.`);
    });
    graph.set(key, dependencies);
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (key: string): void => {
    if (visiting.has(key)) throw new HttpError(400, `Requirement dependency cycle includes ${key}.`);
    if (visited.has(key)) return;
    visiting.add(key);
    graph.get(key)?.forEach(visit);
    visiting.delete(key);
    visited.add(key);
  };
  keys.forEach(visit);
}

function assertSourceReferences(sourceReferences: readonly JsonObject[]): void {
  if (sourceReferences.length === 0) throw new HttpError(400, 'At least one source reference is required.');
  sourceReferences.forEach((source, index) => {
    requiredText(String(source.sourceId ?? ''), `sourceReferences[${index}].sourceId`);
    const sourceUrl = requiredText(String(source.sourceUrl ?? ''), `sourceReferences[${index}].sourceUrl`);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(sourceUrl);
    } catch {
      throw new HttpError(400, `sourceReferences[${index}].sourceUrl must be an HTTPS URL.`);
    }
    if (parsedUrl.protocol !== 'https:') {
      throw new HttpError(400, `sourceReferences[${index}].sourceUrl must be an HTTPS URL.`);
    }
    const observedAt = requiredText(String(source.observedAt ?? ''), `sourceReferences[${index}].observedAt`);
    if (Number.isNaN(new Date(observedAt).getTime())) {
      throw new HttpError(400, `sourceReferences[${index}].observedAt must be an ISO date-time.`);
    }
  });
}

function assertTargetMatchesCaseType(caseType: CredentialOpsCaseType, targetKind: CredentialOpsTargetKind): void {
  const requiredTarget: Partial<Record<CredentialOpsCaseType, CredentialOpsTargetKind>> = {
    CVO_CREDENTIALING: 'CREDENTIALING_PROGRAM',
    STATE_LICENSING: 'STATE_BOARD',
    PAYER_ENROLLMENT: 'PAYER',
    FACILITY_PRIVILEGING: 'FACILITY',
    DELEGATION_SETUP: 'DELEGATION_PROGRAM',
    DELEGATION_OVERSIGHT: 'DELEGATION_PROGRAM',
  };
  if (requiredTarget[caseType] && requiredTarget[caseType] !== targetKind) {
    throw new HttpError(400, `${caseType} templates require targetKind ${requiredTarget[caseType]}.`);
  }
}

function templateHashPayload(
  template: Prisma.CredentialOpsWorkflowTemplateGetPayload<{ include: typeof TEMPLATE_INCLUDE }>,
) {
  return {
    scopeKey: template.scopeKey,
    templateKey: template.templateKey,
    version: template.version,
    caseType: template.caseType,
    targetKind: template.targetKind,
    targetAuthorityName: template.targetAuthorityName,
    jurisdiction: template.jurisdiction,
    professionCodes: template.professionCodes,
    sourceReferences: template.sourceReferences,
    effectiveAt: template.effectiveAt.toISOString(),
    expiresAt: template.expiresAt?.toISOString() ?? null,
    requirements: template.requirements.map((requirement) => ({
      requirementKey: requirement.requirementKey,
      label: requirement.label,
      category: requirement.category,
      owner: requirement.owner,
      necessity: requirement.necessity,
      evidenceRule: requirement.evidenceRule,
      dependencyKeys: requirement.dependencyKeys,
      dueOffsetDays: requirement.dueOffsetDays,
      dataHandling: requirement.dataHandling,
      sortOrder: requirement.sortOrder,
    })),
  };
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  type: AuditEventType,
  referenceId: string,
  actorId: string,
  organizationId: string | null,
  metadata: JsonObject,
): Promise<void> {
  await tx.auditEvent.create({
    data: {
      id: randomUUID(),
      type,
      hash: hash({ type, referenceId, actorId, organizationId, metadata }),
      referenceId,
      clinicianId: actorId,
      organizationId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

export async function createCredentialOpsTemplate(actorId: string, input: CreateTemplateInput) {
  assertNoRestrictedCredentialOpsData(input.sourceReferences, 'sourceReferences');
  input.requirements.forEach((requirement, index) => {
    assertNoRestrictedCredentialOpsData(requirement.evidenceRule ?? {}, `requirements[${index}].evidenceRule`);
  });
  assertTemplateGraph(input.requirements);
  assertSourceReferences(input.sourceReferences);
  assertTargetMatchesCaseType(input.caseType, input.targetKind);
  if (!Number.isInteger(input.version) || input.version < 1) {
    throw new HttpError(400, 'version must be a positive integer.');
  }
  if (input.professionCodes.length === 0) throw new HttpError(400, 'At least one professionCode is required.');
  if (input.expiresAt && input.expiresAt <= input.effectiveAt) {
    throw new HttpError(400, 'expiresAt must be after effectiveAt.');
  }
  input.requirements.forEach((requirement, index) => {
    if (requirement.dueOffsetDays != null && (
      !Number.isInteger(requirement.dueOffsetDays) ||
      requirement.dueOffsetDays < 0 ||
      requirement.dueOffsetDays > 3650
    )) {
      throw new HttpError(400, `requirements[${index}].dueOffsetDays must be an integer from 0 to 3650.`);
    }
    if (requirement.sortOrder != null && (!Number.isInteger(requirement.sortOrder) || requirement.sortOrder < 0)) {
      throw new HttpError(400, `requirements[${index}].sortOrder must be a non-negative integer.`);
    }
  });

  const organizationId = input.organizationId ?? null;
  const scopeKey = organizationId ? `org:${organizationId}` : 'system';
  const templateKey = normalizeKey(input.templateKey, 'templateKey');
  try {
    return await prisma.$transaction(async (tx) => {
      if (organizationId) {
        const organization = await tx.organization.findUnique({
          where: { id: organizationId },
          select: { id: true },
        });
        if (!organization) throw new HttpError(404, 'Organization not found.');
      }
      const template = await tx.credentialOpsWorkflowTemplate.create({
        data: {
          scopeKey,
          organizationId,
          templateKey,
          version: input.version,
          caseType: input.caseType,
          targetKind: input.targetKind,
          targetAuthorityName: requiredText(input.targetAuthorityName, 'targetAuthorityName'),
          jurisdiction: input.jurisdiction?.trim() || null,
          professionCodes: [...new Set(input.professionCodes.map((value) => (
            requiredText(value, 'professionCode').toUpperCase()
          )))],
          sourceReferences: input.sourceReferences as Prisma.InputJsonValue,
          effectiveAt: input.effectiveAt,
          expiresAt: input.expiresAt ?? null,
          createdBy: actorId,
          requirements: {
            create: input.requirements.map((requirement, index) => ({
              requirementKey: normalizeKey(requirement.requirementKey, 'requirementKey'),
              label: requiredText(requirement.label, 'requirement label'),
              category: requirement.category,
              owner: requirement.owner,
              necessity: requirement.necessity,
              evidenceRule: (requirement.evidenceRule ?? {}) as Prisma.InputJsonValue,
              dependencyKeys: (requirement.dependencyKeys ?? []).map((key) => (
                normalizeKey(key, 'dependencyKey')
              )),
              dueOffsetDays: requirement.dueOffsetDays ?? null,
              dataHandling: requirement.dataHandling,
              sortOrder: requirement.sortOrder ?? index,
            })),
          },
        },
        include: TEMPLATE_INCLUDE,
      });
      await writeAudit(tx, 'CREDENTIAL_OPS_TEMPLATE_DRAFTED', template.id, actorId, organizationId, {
        templateKey,
        version: input.version,
      });
      return template;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'That template version already exists in this scope.');
    }
    throw error;
  }
}

export async function activateCredentialOpsTemplate(actorId: string, templateId: string) {
  return prisma.$transaction(async (tx) => {
    const template = await tx.credentialOpsWorkflowTemplate.findUnique({
      where: { id: templateId },
      include: TEMPLATE_INCLUDE,
    });
    if (!template) throw new HttpError(404, 'Credential-operations template not found.');
    if (template.status !== CredentialOpsTemplateStatus.DRAFT) {
      throw new HttpError(409, 'Only a draft template can be activated.');
    }
    assertTemplateGraph(template.requirements);
    assertNoRestrictedCredentialOpsData(template.sourceReferences, 'sourceReferences');
    assertSourceReferences(template.sourceReferences as JsonObject[]);
    assertTargetMatchesCaseType(template.caseType, template.targetKind);
    const contentHash = hash(templateHashPayload(template));
    const reviewedAt = new Date();
    const updated = await tx.credentialOpsWorkflowTemplate.updateMany({
      where: { id: template.id, status: CredentialOpsTemplateStatus.DRAFT },
      data: {
        status: CredentialOpsTemplateStatus.ACTIVE,
        reviewedBy: actorId,
        reviewedAt,
        contentHash,
      },
    });
    if (updated.count !== 1) throw new HttpError(409, 'Only a draft template can be activated.');
    await writeAudit(tx, 'CREDENTIAL_OPS_TEMPLATE_ACTIVATED', template.id, actorId, template.organizationId, {
      contentHash,
      reviewedAt: reviewedAt.toISOString(),
    });
    return tx.credentialOpsWorkflowTemplate.findUniqueOrThrow({
      where: { id: template.id },
      include: TEMPLATE_INCLUDE,
    });
  });
}

function dueAt(openedAt: Date, offsetDays: number | null): Date | null {
  if (offsetDays == null) return null;
  return new Date(openedAt.getTime() + offsetDays * 86_400_000);
}

export async function createCredentialOperationsCase(
  actorId: string,
  organizationId: string,
  input: CreateCaseInput,
) {
  assertNoRestrictedCredentialOpsData(input.metadata ?? {}, 'metadata');
  const professionCode = requiredText(input.professionCode, 'professionCode').toUpperCase();
  const idempotencyKey = requiredText(input.idempotencyKey, 'idempotencyKey');

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.credentialOperationsCase.findUnique({
        where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } },
        include: CASE_INCLUDE,
      });
      if (existing) {
        if (
          existing.subjectEntityId !== input.subjectEntityId ||
          existing.workflowTemplateId !== input.workflowTemplateId
        ) {
          throw new HttpError(409, 'Idempotency key is already bound to a different credential-operations case.');
        }
        return { created: false, case: existing };
      }

      const now = new Date();
      const template = await tx.credentialOpsWorkflowTemplate.findUnique({
        where: { id: input.workflowTemplateId },
        include: TEMPLATE_INCLUDE,
      });
      if (
        !template ||
        template.status !== CredentialOpsTemplateStatus.ACTIVE ||
        !template.contentHash ||
        (template.organizationId && template.organizationId !== organizationId)
      ) throw new HttpError(404, 'Active credential-operations template not found.');
      if (template.effectiveAt > now || (template.expiresAt && template.expiresAt <= now)) {
        throw new HttpError(409, 'Template is outside its effective period.');
      }
      if (!template.professionCodes.includes(professionCode)) {
        throw new HttpError(409, `Template does not support profession ${professionCode}.`);
      }
      if (hash(templateHashPayload(template)) !== template.contentHash) {
        throw new HttpError(409, 'Template integrity check failed.');
      }

      const subject = await tx.vcvEntity.findUnique({ where: { id: input.subjectEntityId } });
      if (!subject || subject.entityType !== VcvEntityType.PERSON) {
        throw new HttpError(404, 'Clinician subject not found.');
      }

      if (input.applicationId) {
        const application = await tx.application.findUnique({
          where: { id: input.applicationId },
          select: { opportunity: { select: { organizationId: true } } },
        });
        if (!application || application.opportunity.organizationId !== organizationId) {
          throw new HttpError(404, 'Linked application not found.');
        }
      }
      if (input.activationRequirementId) {
        const requirement = await tx.activationRequirement.findUnique({
          where: { id: input.activationRequirementId },
        });
        if (!requirement || requirement.organizationId !== organizationId) {
          throw new HttpError(404, 'Linked activation requirement not found.');
        }
        if (input.applicationId && requirement.applicationId !== input.applicationId) {
          throw new HttpError(409, 'Activation requirement does not belong to the linked application.');
        }
      }
      if (input.startActivationId) {
        const activation = await tx.startActivation.findUnique({ where: { id: input.startActivationId } });
        if (!activation || activation.orgId !== organizationId) {
          throw new HttpError(404, 'Linked start activation not found.');
        }
        if (input.applicationId && activation.applicationId !== input.applicationId) {
          throw new HttpError(409, 'Start activation does not belong to the linked application.');
        }
      }

      const targetAuthoritySnapshot = {
        kind: template.targetKind,
        name: template.targetAuthorityName,
        jurisdiction: template.jurisdiction,
      };
      const created = await tx.credentialOperationsCase.create({
        data: {
          organizationId,
          subjectEntityId: subject.id,
          subjectNpiSnapshot: subject.npi,
          workflowTemplateId: template.id,
          workflowTemplateHash: template.contentHash,
          caseType: template.caseType,
          professionCode,
          targetKind: template.targetKind,
          targetAuthoritySnapshot,
          state: CredentialOpsCaseState.INTAKE,
          applicationId: input.applicationId ?? null,
          activationRequirementId: input.activationRequirementId ?? null,
          startActivationId: input.startActivationId ?? null,
          idempotencyKey,
          createdBy: actorId,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          openedAt: now,
          targetDueAt: input.targetDueAt ?? null,
          tasks: {
            create: template.requirements.map((requirement) => ({
              requirementKey: requirement.requirementKey,
              label: requirement.label,
              category: requirement.category,
              owner: requirement.owner,
              necessity: requirement.necessity,
              state: requirement.dependencyKeys.length === 0
                ? CredentialOpsTaskState.READY
                : CredentialOpsTaskState.NOT_STARTED,
              evidenceRule: requirement.evidenceRule as Prisma.InputJsonValue,
              dependencyKeys: requirement.dependencyKeys,
              dataHandling: requirement.dataHandling,
              dueAt: dueAt(now, requirement.dueOffsetDays),
              sortOrder: requirement.sortOrder,
            })),
          },
        },
        include: CASE_INCLUDE,
      });
      await writeAudit(tx, 'CREDENTIAL_OPS_CASE_CREATED', created.id, actorId, organizationId, {
        subjectEntityId: subject.id,
        workflowTemplateId: template.id,
        workflowTemplateHash: template.contentHash,
        taskCount: template.requirements.length,
      });
      return { created: true, case: created };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.credentialOperationsCase.findUnique({
        where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } },
        include: CASE_INCLUDE,
      });
      if (existing) {
        if (
          existing.subjectEntityId !== input.subjectEntityId ||
          existing.workflowTemplateId !== input.workflowTemplateId
        ) {
          throw new HttpError(409, 'Idempotency key is already bound to a different credential-operations case.');
        }
        return { created: false, case: existing };
      }
    }
    throw error;
  }
}

export async function listCredentialOpsTemplates(organizationId: string) {
  const now = new Date();
  return prisma.credentialOpsWorkflowTemplate.findMany({
    where: {
      status: CredentialOpsTemplateStatus.ACTIVE,
      effectiveAt: { lte: now },
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: [{ organizationId: null }, { organizationId }] },
      ],
    },
    include: TEMPLATE_INCLUDE,
    orderBy: [{ caseType: 'asc' }, { targetAuthorityName: 'asc' }, { version: 'desc' }],
  });
}

export async function listCredentialOperationsCases(organizationId: string) {
  return prisma.credentialOperationsCase.findMany({
    where: { organizationId },
    include: CASE_INCLUDE,
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
}

export async function readCredentialOperationsCase(caseId: string, viewer: CredentialOpsViewer) {
  const record = await prisma.credentialOperationsCase.findUnique({
    where: { id: caseId },
    include: CASE_INCLUDE,
  });
  if (!record) throw new HttpError(404, 'Credential-operations case not found.');

  const isOrganizationMember = viewer.activeOrganizationIds.includes(record.organizationId);
  let isSubject = false;
  if (!isOrganizationMember && !viewer.isPlatformAdmin) {
    const claim = await prisma.vcvUserEntityClaim.findFirst({
      where: {
        clerkUserId: viewer.clerkUserId,
        entityId: record.subjectEntityId,
        verifiedAt: { not: null },
        verificationLevel: { not: 'SELF_REPORTED' },
        revokedAt: null,
      },
      select: { id: true },
    });
    isSubject = Boolean(claim);
  }
  if (!isOrganizationMember && !viewer.isPlatformAdmin && !isSubject) {
    throw new HttpError(404, 'Credential-operations case not found.');
  }

  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, 'CREDENTIAL_OPS_CASE_VIEWED', record.id, viewer.clerkUserId, record.organizationId, {
      accessPath: viewer.isPlatformAdmin
        ? 'platform_admin'
        : isOrganizationMember ? 'organization_member' : 'clinician_subject',
    });
  });
  return record;
}
