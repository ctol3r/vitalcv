import { randomUUID } from 'node:crypto';
import {
  CredentialOpsCaseType,
  CredentialOpsDataHandling,
  CredentialOpsTargetKind,
  CredentialOpsTaskCategory,
  CredentialOpsTaskOwner,
  PrismaClient,
  VcvEntityType,
  VcvVerificationLevel,
} from '@prisma/client';

import {
  activateCredentialOpsTemplate,
  createCredentialOperationsCase,
  createCredentialOpsTemplate,
  readCredentialOperationsCase,
} from '../credentialOpsService';

const prisma = new PrismaClient();
const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
const actorId = `credential-ops-admin-${suffix}`;
const clinicianUserId = `credential-ops-clinician-${suffix}`;
const outsiderId = `credential-ops-outsider-${suffix}`;
const createdAuditReferenceIds: string[] = [];
let organizationId: string;
let otherOrganizationId: string;
let subjectEntityId: string;
let templateId: string;
let caseId: string;

function templateInput(organizationIdOverride: string | null = null) {
  return {
    organizationId: organizationIdOverride,
    templateKey: `ca-licensing-${suffix}`,
    version: 1,
    caseType: CredentialOpsCaseType.STATE_LICENSING,
    targetKind: CredentialOpsTargetKind.STATE_BOARD,
    targetAuthorityName: 'Synthetic California Board',
    jurisdiction: 'CA',
    professionCodes: ['MD', 'NP'],
    sourceReferences: [{
      sourceId: 'synthetic-board-rules',
      sourceUrl: 'https://example.test/rules',
      observedAt: '2026-08-14T00:00:00.000Z',
    }],
    effectiveAt: new Date(Date.now() - 60_000),
    requirements: [
      {
        requirementKey: 'identity-evidence',
        label: 'Identity evidence receipt',
        category: CredentialOpsTaskCategory.EVIDENCE,
        owner: CredentialOpsTaskOwner.CLINICIAN,
        dataHandling: CredentialOpsDataHandling.REFERENCE_ONLY,
        evidenceRule: { receiptType: 'identity-reference' },
      },
      {
        requirementKey: 'human-approved-submission',
        label: 'Human-approved board submission',
        category: CredentialOpsTaskCategory.SUBMISSION,
        owner: CredentialOpsTaskOwner.VITALCV_OPERATOR,
        dataHandling: CredentialOpsDataHandling.EXTERNAL_ONLY,
        evidenceRule: { approvalRequired: true },
        dependencyKeys: ['identity-evidence'],
      },
    ],
  };
}

beforeAll(async () => {
  const [organization, otherOrganization, subject] = await Promise.all([
    prisma.organization.create({ data: { name: `Credential Ops Org ${suffix}`, slug: `credential-ops-${suffix}` } }),
    prisma.organization.create({ data: { name: `Other Credential Ops Org ${suffix}`, slug: `credential-ops-other-${suffix}` } }),
    prisma.vcvEntity.create({
      data: {
        entityType: VcvEntityType.PERSON,
        canonicalId: `credential-ops-person:${suffix}`,
        displayName: 'Synthetic Clinician',
        npi: '1558302470',
        sourceIds: ['synthetic-test'],
      },
    }),
  ]);
  organizationId = organization.id;
  otherOrganizationId = otherOrganization.id;
  subjectEntityId = subject.id;

  await prisma.vcvUserEntityClaim.create({
    data: {
      clerkUserId: clinicianUserId,
      entityId: subjectEntityId,
      verificationLevel: VcvVerificationLevel.SOURCE_MATCHED,
      verifiedAt: new Date(),
    },
  });

  const draft = await createCredentialOpsTemplate(actorId, templateInput());
  templateId = draft.id;
  createdAuditReferenceIds.push(draft.id);
  await activateCredentialOpsTemplate(actorId, templateId);
});

afterAll(async () => {
  if (caseId) await prisma.credentialOperationsCase.deleteMany({ where: { id: caseId } });
  await prisma.credentialOpsWorkflowTemplate.deleteMany({
    where: { templateKey: { contains: suffix } },
  });
  await prisma.vcvUserEntityClaim.deleteMany({ where: { clerkUserId: { in: [clinicianUserId, outsiderId] } } });
  await prisma.vcvEntity.deleteMany({ where: { canonicalId: `credential-ops-person:${suffix}` } });
  await prisma.auditEvent.deleteMany({
    where: {
      OR: [
        { referenceId: { in: [...createdAuditReferenceIds, caseId].filter(Boolean) } },
        { clinicianId: { in: [actorId, clinicianUserId, outsiderId] } },
      ],
    },
  });
  await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } });
  await prisma.$disconnect();
});

it('activates a reviewed template with a stable content hash and audit receipt', async () => {
  const template = await prisma.credentialOpsWorkflowTemplate.findUniqueOrThrow({ where: { id: templateId } });
  expect(template.status).toBe('ACTIVE');
  expect(template.reviewedBy).toBe(actorId);
  expect(template.contentHash).toMatch(/^[a-f0-9]{64}$/);
  expect(await prisma.auditEvent.count({
    where: { referenceId: templateId, type: 'CREDENTIAL_OPS_TEMPLATE_ACTIVATED' },
  })).toBe(1);
});

it('allows only one winner when two reviewers activate the same draft concurrently', async () => {
  const draft = await createCredentialOpsTemplate(actorId, {
    ...templateInput(),
    templateKey: `concurrent-activation-${suffix}`,
  });
  createdAuditReferenceIds.push(draft.id);
  const outcomes = await Promise.allSettled([
    activateCredentialOpsTemplate(`${actorId}-one`, draft.id),
    activateCredentialOpsTemplate(`${actorId}-two`, draft.id),
  ]);
  expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
  expect(await prisma.auditEvent.count({
    where: { referenceId: draft.id, type: 'CREDENTIAL_OPS_TEMPLATE_ACTIVATED' },
  })).toBe(1);
});

it('freezes template requirements into an idempotent tenant-owned case', async () => {
  const first = await createCredentialOperationsCase(actorId, organizationId, {
    workflowTemplateId: templateId,
    subjectEntityId,
    professionCode: 'md',
    idempotencyKey: `case-${suffix}`,
    metadata: { partnerRecordRef: 'partner-record-1' },
  });
  caseId = first.case.id;
  createdAuditReferenceIds.push(caseId);
  expect(first.created).toBe(true);
  expect(first.case.workflowTemplateHash).toMatch(/^[a-f0-9]{64}$/);
  expect(first.case.tasks.map((task) => [task.requirementKey, task.state])).toEqual([
    ['identity-evidence', 'READY'],
    ['human-approved-submission', 'NOT_STARTED'],
  ]);

  const retry = await createCredentialOperationsCase(actorId, organizationId, {
    workflowTemplateId: templateId,
    subjectEntityId,
    professionCode: 'MD',
    idempotencyKey: `case-${suffix}`,
  });
  expect(retry.created).toBe(false);
  expect(retry.case.id).toBe(caseId);
  expect(await prisma.credentialOpsCaseTask.count({ where: { caseId } })).toBe(2);
  expect(await prisma.auditEvent.count({
    where: { referenceId: caseId, type: 'CREDENTIAL_OPS_CASE_CREATED' },
  })).toBe(1);
});

it('denies an organization-scoped template to a different tenant', async () => {
  const draft = await createCredentialOpsTemplate(actorId, {
    ...templateInput(organizationId),
    templateKey: `tenant-only-${suffix}`,
  });
  createdAuditReferenceIds.push(draft.id);
  await activateCredentialOpsTemplate(actorId, draft.id);
  await expect(createCredentialOperationsCase(actorId, otherOrganizationId, {
    workflowTemplateId: draft.id,
    subjectEntityId,
    professionCode: 'MD',
    idempotencyKey: `wrong-tenant-${suffix}`,
  })).rejects.toMatchObject({ status: 404 });
});

it('fails closed when an active template is changed after review', async () => {
  const draft = await createCredentialOpsTemplate(actorId, {
    ...templateInput(),
    templateKey: `tampered-${suffix}`,
  });
  createdAuditReferenceIds.push(draft.id);
  await activateCredentialOpsTemplate(actorId, draft.id);
  await prisma.credentialOpsWorkflowTemplate.update({
    where: { id: draft.id },
    data: { targetAuthorityName: 'Changed after review' },
  });
  await expect(createCredentialOperationsCase(actorId, organizationId, {
    workflowTemplateId: draft.id,
    subjectEntityId,
    professionCode: 'MD',
    idempotencyKey: `tamper-${suffix}`,
  })).rejects.toMatchObject({ status: 409 });
});

it('allows the verified clinician subject to read but uses uniform 404 for an outsider', async () => {
  const clinicianView = await readCredentialOperationsCase(caseId, {
    clerkUserId: clinicianUserId,
    isPlatformAdmin: false,
    activeOrganizationId: null,
    activeMembershipRole: null,
    activeOrganizationIds: [],
  });
  expect(clinicianView.id).toBe(caseId);
  await expect(readCredentialOperationsCase(caseId, {
    clerkUserId: outsiderId,
    isPlatformAdmin: false,
    activeOrganizationId: null,
    activeMembershipRole: null,
    activeOrganizationIds: [],
  })).rejects.toMatchObject({ status: 404 });
});
