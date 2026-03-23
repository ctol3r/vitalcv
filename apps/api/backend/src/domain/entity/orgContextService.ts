/**
 * orgContextService.ts — Organization Context Service
 *
 * The canonical path for all org-entity interactions:
 *   applications, employment review, credentialing, privileging,
 *   training enrollment, issuer review, and monitoring.
 *
 * Every interaction between an org and a clinician entity flows
 * through an VcvOrganizationContext record — never ad-hoc.
 *
 * Wave S5 — Organization Context as first-class domain
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import {
  CONTEXT_REQUIRED_DOMAINS,
  ORG_CONTEXT_TYPE_LABELS,
  ORG_CONTEXT_STATUS_LABELS,
  isCredentialSatisfied,
  type OrgContextSummary,
} from './contracts';
import type {
  VcvOrgContextType,
  VcvOrgContextStatus,
} from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateOrgContextInput {
  requestorEntityId:  string;
  contextType:        VcvOrgContextType;
  title?:             string;
  description?:       string;
  dueAt?:             Date;
  webhookUrl?:        string;
  createdByUserId?:   string;
  externalRefId?:     string;
  metadata?:          Record<string, unknown>;
  /** Subjects to add immediately (clinician entity IDs) */
  subjectEntityIds?:  string[];
}

export interface AddSubjectInput {
  contextId:          string;
  subjectEntityId:    string;
  credentialId?:      string;
  invitedAt?:         Date;
  metadata?:          Record<string, unknown>;
}

export interface UpdateSubjectStatusInput {
  contextId:          string;
  subjectEntityId:    string;
  subjectStatus:      string;
  reviewNotes?:       string;
  reviewedByUserId?:  string;
  submissionData?:    Record<string, unknown>;
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Create a new organization context.
 * Optionally adds initial subjects in the same transaction.
 */
export async function createOrgContext(input: CreateOrgContextInput) {
  const {
    requestorEntityId, contextType, title, description, dueAt,
    webhookUrl, createdByUserId, externalRefId,
    metadata = {}, subjectEntityIds = [],
  } = input;

  const ctx = await prisma.$transaction(async tx => {
    const requestor = await tx.vcvEntity.findUnique({
      where: { id: requestorEntityId },
      select: { id: true },
    });
    if (!requestor) {
      throw new Error(`Requestor entity ${requestorEntityId} not found.`);
    }

    if (subjectEntityIds.includes(requestorEntityId)) {
      throw new Error('Requestor entity cannot also be added as a subject.');
    }

    if (subjectEntityIds.length > 0) {
      const subjects = await tx.vcvEntity.findMany({
        where: { id: { in: subjectEntityIds } },
        select: { id: true },
      });
      if (subjects.length !== new Set(subjectEntityIds).size) {
        throw new Error('One or more subject entities were not found.');
      }
    }

    const context = await tx.vcvOrganizationContext.create({
      data: {
        requestorId:      requestorEntityId,
        contextType,
        title,
        description,
        dueAt,
        webhookUrl,
        createdByUserId,
        externalRefId,
        metadata: metadata as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    if (subjectEntityIds.length > 0) {
      await tx.vcvOrgContextSubject.createMany({
        data: subjectEntityIds.map(sid => ({
          contextId:     context.id,
          subjectId:     sid,
          invitedAt:     new Date(),
        })),
        skipDuplicates: true,
      });
    }

    // Record initial status event
    await tx.vcvOrgContextStatusEvent.create({
      data: {
        contextId:   context.id,
        toStatus:    'PENDING',
        triggeredBy: createdByUserId ?? 'SYSTEM',
        reason:      'Context created',
      },
    });

    return context;
  });

  log('info', 'org_context_created', {
    id: ctx.id, contextType, requestorEntityId,
    subjects: subjectEntityIds.length,
  });

  return ctx;
}

/**
 * Transition an org context to a new status.
 * Records the transition in the audit trail.
 */
export async function transitionOrgContextStatus(
  contextId:    string,
  toStatus:     VcvOrgContextStatus,
  triggeredBy?: string,
  reason?:      string,
) {
  const ctx = await prisma.vcvOrganizationContext.findUniqueOrThrow({
    where: { id: contextId },
  });

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.vcvOrganizationContext.update({
      where: { id: contextId },
      data: {
        status:      toStatus,
        completedAt: toStatus === 'COMPLETED' ? new Date() : undefined,
        revokedAt:   toStatus === 'REVOKED'   ? new Date() : undefined,
        revokedReason: toStatus === 'REVOKED' ? reason     : undefined,
      },
    });

    await tx.vcvOrgContextStatusEvent.create({
      data: {
        contextId,
        fromStatus:  ctx.status,
        toStatus,
        triggeredBy: triggeredBy ?? 'SYSTEM',
        reason,
      },
    });

    return result;
  });

  log('info', 'org_context_status_changed', {
    id: contextId, from: ctx.status, to: toStatus, triggeredBy,
  });

  return updated;
}

/**
 * Add a subject to an existing org context.
 */
export async function addSubjectToContext(input: AddSubjectInput) {
  const { contextId, subjectEntityId, credentialId, invitedAt, metadata = {} } = input;

  const context = await prisma.vcvOrganizationContext.findUnique({
    where: { id: contextId },
    select: { id: true, requestorId: true },
  });
  if (!context) {
    throw new Error(`Organization context ${contextId} not found.`);
  }
  if (context.requestorId === subjectEntityId) {
    throw new Error('Requestor entity cannot also be attached as a subject.');
  }

  const subjectEntity = await prisma.vcvEntity.findUnique({
    where: { id: subjectEntityId },
    select: { id: true },
  });
  if (!subjectEntity) {
    throw new Error(`Subject entity ${subjectEntityId} not found.`);
  }

  const subject = await prisma.vcvOrgContextSubject.upsert({
    where: { contextId_subjectId: { contextId, subjectId: subjectEntityId } },
    create: {
      contextId,
      subjectId:    subjectEntityId,
      credentialId: credentialId ?? null,
      invitedAt:    invitedAt    ?? new Date(),
      metadata:     metadata     as import('@prisma/client').Prisma.InputJsonValue,
    },
    update: {
      credentialId: credentialId ?? undefined,
      invitedAt:    invitedAt    ?? new Date(),
    },
  });

  log('info', 'org_context_subject_added', { contextId, subjectEntityId });
  return subject;
}

/**
 * Update a subject's status within a context (review outcome).
 */
export async function updateSubjectStatus(input: UpdateSubjectStatusInput) {
  const { contextId, subjectEntityId, subjectStatus, reviewNotes, reviewedByUserId, submissionData } = input;

  const updated = await prisma.vcvOrgContextSubject.update({
    where: { contextId_subjectId: { contextId, subjectId: subjectEntityId } },
    data: {
      subjectStatus,
      reviewNotes,
      reviewedByUserId,
      reviewedAt:     ['APPROVED', 'DENIED'].includes(subjectStatus) ? new Date() : undefined,
      respondedAt:    ['SUBMITTED', 'APPROVED', 'DENIED'].includes(subjectStatus) ? new Date() : undefined,
      submissionData: submissionData
        ? (submissionData as import('@prisma/client').Prisma.InputJsonValue)
        : undefined,
    },
  });

  log('info', 'org_context_subject_status_updated', {
    contextId, subjectEntityId, subjectStatus,
  });

  return updated;
}

/**
 * Get a summary of all contexts for a requestor entity.
 */
export async function getContextsForRequestor(
  requestorEntityId: string,
  filters?: { status?: VcvOrgContextStatus; contextType?: VcvOrgContextType },
): Promise<OrgContextSummary[]> {
  const contexts = await prisma.vcvOrganizationContext.findMany({
    where: {
      requestorId: requestorEntityId,
      ...(filters?.status      ? { status:      filters.status }      : {}),
      ...(filters?.contextType ? { contextType: filters.contextType } : {}),
    },
    include: {
      requestor: true,
      subjects:  { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return contexts.map(c => ({
    id:            c.id,
    contextType:   c.contextType,
    typeLabel:     ORG_CONTEXT_TYPE_LABELS[c.contextType] ?? c.contextType,
    status:        c.status,
    statusLabel:   ORG_CONTEXT_STATUS_LABELS[c.status]    ?? c.status,
    requestorName: c.requestor.displayName,
    subjectCount:  c.subjects.length,
    dueAt:         c.dueAt?.toISOString(),
    completedAt:   c.completedAt?.toISOString(),
    createdAt:     c.createdAt.toISOString(),
  }));
}

/**
 * Get required credential domains for a given context type.
 * Used for gap analysis when a context is created.
 */
export function getRequiredDomainsForContext(contextType: VcvOrgContextType): string[] {
  return CONTEXT_REQUIRED_DOMAINS[contextType] ?? ['IDENTITY', 'LICENSURE'];
}

/**
 * Check whether all required credentials are present for a subject in a context.
 * Returns missing domain list.
 */
export async function getMissingCredentials(
  contextType:     VcvOrgContextType,
  subjectEntityId: string,
): Promise<string[]> {
  const required = getRequiredDomainsForContext(contextType);

  const present = await prisma.vcvCredential.findMany({
    where: {
      subjectId: subjectEntityId,
      status: { not: 'SUPERSEDED' },
      domain:    { in: required as import('@prisma/client').VcvCredentialDomain[] },
    },
    select: {
      domain: true,
      status: true,
      credentialType: true,
      expiresAt: true,
    },
  });

  const presentDomains = new Set(
    present
      .filter((credential) => isCredentialSatisfied({
        domain: credential.domain,
        status: credential.status,
      }))
      .map((credential) => credential.domain),
  );
  return required.filter(d => !presentDomains.has(d as import('@prisma/client').VcvCredentialDomain));
}
