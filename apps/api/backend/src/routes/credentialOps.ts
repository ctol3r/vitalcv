import {
  CredentialOpsCaseType,
  CredentialOpsDataHandling,
  CredentialOpsTargetKind,
  CredentialOpsTaskCategory,
  CredentialOpsTaskNecessity,
  CredentialOpsTaskOwner,
} from '@prisma/client';
import type { Express, NextFunction, Request, Response } from 'express';

import { ensurePlatformAdmin } from '../middleware/platformAdmin';
import type { VerifiedAuth } from '../middleware/verifiedIdentity';
import {
  requireCredentialOpsOperator,
  resolveCredentialOpsViewer,
} from '../services/credential-ops/credentialOpsAuthorization';
import {
  activateCredentialOpsTemplate,
  createCredentialOperationsCase,
  createCredentialOpsTemplate,
  listCredentialOperationsCases,
  listCredentialOpsTemplates,
  readCredentialOperationsCase,
  type CreateCaseInput,
  type CreateTemplateInput,
  type TemplateRequirementInput,
} from '../services/credential-ops/credentialOpsService';
import { HttpError } from '../utils/httpError';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value.trim())) throw new HttpError(404, `${label} not found.`);
  return value.trim();
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `${label} is required.`);
  return value.trim();
}

function optionalText(value: unknown, label: string): string | null | undefined {
  if (value == null) return value as null | undefined;
  return text(value, label);
}

function enumValue<T extends Record<string, string>>(definition: T, value: unknown, label: string): T[keyof T] {
  if (typeof value !== 'string' || !Object.values(definition).includes(value)) {
    throw new HttpError(400, `${label} is invalid.`);
  }
  return value as T[keyof T];
}

function dateValue(value: unknown, label: string, required: true): Date;
function dateValue(value: unknown, label: string, required?: false): Date | null | undefined;
function dateValue(value: unknown, label: string, required = false): Date | null | undefined {
  if (value == null && !required) return value as null | undefined;
  if (typeof value !== 'string') throw new HttpError(400, `${label} must be an ISO date-time.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, `${label} must be an ISO date-time.`);
  return parsed;
}

function jsonObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, `${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function templateBody(body: unknown): CreateTemplateInput {
  const record = jsonObject(body, 'body');
  if (!Array.isArray(record.professionCodes) || !record.professionCodes.every((item) => typeof item === 'string')) {
    throw new HttpError(400, 'professionCodes must be a string array.');
  }
  if (!Array.isArray(record.sourceReferences)) throw new HttpError(400, 'sourceReferences must be an array.');
  if (!Array.isArray(record.requirements)) throw new HttpError(400, 'requirements must be an array.');

  const requirements: TemplateRequirementInput[] = record.requirements.map((raw, index) => {
    const requirement = jsonObject(raw, `requirements[${index}]`);
    if (requirement.dependencyKeys != null && (
      !Array.isArray(requirement.dependencyKeys) ||
      !requirement.dependencyKeys.every((item) => typeof item === 'string')
    )) throw new HttpError(400, `requirements[${index}].dependencyKeys must be a string array.`);
    return {
      requirementKey: text(requirement.requirementKey, `requirements[${index}].requirementKey`),
      label: text(requirement.label, `requirements[${index}].label`),
      category: enumValue(CredentialOpsTaskCategory, requirement.category, `requirements[${index}].category`),
      owner: enumValue(CredentialOpsTaskOwner, requirement.owner, `requirements[${index}].owner`),
      necessity: requirement.necessity == null ? undefined : enumValue(
        CredentialOpsTaskNecessity,
        requirement.necessity,
        `requirements[${index}].necessity`,
      ),
      evidenceRule: requirement.evidenceRule == null
        ? undefined
        : jsonObject(requirement.evidenceRule, `requirements[${index}].evidenceRule`),
      dependencyKeys: requirement.dependencyKeys as string[] | undefined,
      dueOffsetDays: requirement.dueOffsetDays == null ? undefined : Number(requirement.dueOffsetDays),
      dataHandling: requirement.dataHandling == null ? undefined : enumValue(
        CredentialOpsDataHandling,
        requirement.dataHandling,
        `requirements[${index}].dataHandling`,
      ),
      sortOrder: requirement.sortOrder == null ? undefined : Number(requirement.sortOrder),
    };
  });

  return {
    organizationId: record.organizationId == null ? null : uuid(record.organizationId, 'Organization'),
    templateKey: text(record.templateKey, 'templateKey'),
    version: Number(record.version),
    caseType: enumValue(CredentialOpsCaseType, record.caseType, 'caseType'),
    targetKind: enumValue(CredentialOpsTargetKind, record.targetKind, 'targetKind'),
    targetAuthorityName: text(record.targetAuthorityName, 'targetAuthorityName'),
    jurisdiction: optionalText(record.jurisdiction, 'jurisdiction'),
    professionCodes: record.professionCodes as string[],
    sourceReferences: record.sourceReferences.map((value, index) => jsonObject(value, `sourceReferences[${index}]`)),
    effectiveAt: dateValue(record.effectiveAt, 'effectiveAt', true),
    expiresAt: dateValue(record.expiresAt, 'expiresAt'),
    requirements,
  };
}

function caseBody(body: unknown): CreateCaseInput {
  const record = jsonObject(body, 'body');
  return {
    workflowTemplateId: uuid(record.workflowTemplateId, 'Template'),
    subjectEntityId: uuid(record.subjectEntityId, 'Clinician subject'),
    professionCode: text(record.professionCode, 'professionCode'),
    idempotencyKey: text(record.idempotencyKey, 'idempotencyKey'),
    applicationId: record.applicationId == null ? null : uuid(record.applicationId, 'Application'),
    activationRequirementId: record.activationRequirementId == null
      ? null
      : uuid(record.activationRequirementId, 'Activation requirement'),
    startActivationId: record.startActivationId == null
      ? null
      : uuid(record.startActivationId, 'Start activation'),
    targetDueAt: dateValue(record.targetDueAt, 'targetDueAt'),
    metadata: record.metadata == null ? {} : jsonObject(record.metadata, 'metadata'),
  };
}

function verifiedActor(req: Request): string {
  const actor = (req as Request & { verifiedAuth?: VerifiedAuth }).verifiedAuth?.verifiedUserId?.trim();
  if (!actor) throw new HttpError(401, 'Verified Clerk session required.');
  return actor;
}

export function registerCredentialOpsRoutes(app: Express): void {
  app.post('/api/credential-ops/templates', asyncHandler(async (req, res) => {
    if (!(await ensurePlatformAdmin(req, res))) return;
    const template = await createCredentialOpsTemplate(verifiedActor(req), templateBody(req.body));
    res.status(201).json({ template });
  }));

  app.post('/api/credential-ops/templates/:templateId/activate', asyncHandler(async (req, res) => {
    if (!(await ensurePlatformAdmin(req, res))) return;
    const template = await activateCredentialOpsTemplate(
      verifiedActor(req),
      uuid(req.params.templateId, 'Credential-operations template'),
    );
    res.json({ template });
  }));

  app.get('/api/credential-ops/templates', asyncHandler(async (req, res) => {
    const operator = await requireCredentialOpsOperator(req);
    const templates = await listCredentialOpsTemplates(operator.activeOrganizationId);
    res.json({ templates });
  }));

  app.post('/api/credential-ops/cases', asyncHandler(async (req, res) => {
    const operator = await requireCredentialOpsOperator(req);
    const result = await createCredentialOperationsCase(
      operator.clerkUserId,
      operator.activeOrganizationId,
      caseBody(req.body),
    );
    res.status(result.created ? 201 : 200).json(result);
  }));

  app.get('/api/credential-ops/cases', asyncHandler(async (req, res) => {
    const operator = await requireCredentialOpsOperator(req);
    const cases = await listCredentialOperationsCases(operator.activeOrganizationId);
    res.json({ cases });
  }));

  app.get('/api/credential-ops/cases/:caseId', asyncHandler(async (req, res) => {
    const viewer = await resolveCredentialOpsViewer(req);
    const record = await readCredentialOperationsCase(
      uuid(req.params.caseId, 'Credential-operations case'),
      viewer,
    );
    res.json({ case: record });
  }));
}
