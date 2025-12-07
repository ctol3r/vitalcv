/**
 * B239B-COM-011: UnifiedAuditTrail model
 *
 * Type definitions and utilities for the UnifiedAuditTrail Prisma model.
 * This model provides a unified audit trail for all compliance-related events.
 */

import { Prisma } from '@prisma/client';

export type UnifiedAuditTrail = Prisma.UnifiedAuditTrailGetPayload<{}>;

export interface AuditEventInput {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  details?: Record<string, unknown>;
  jurisdiction?: string;
  obligationId?: string;
  timestamp?: Date;
}

export interface AuditEventFilter {
  entityType?: string;
  entityId?: string;
  action?: string;
  actorId?: string;
  jurisdiction?: string;
  obligationId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export const ENTITY_TYPES = {
  CREDENTIAL: 'credential',
  CONTRACT: 'contract',
  DATA_EXPORT: 'data_export',
  USER: 'user',
  ORG: 'org',
  PRIVILEGE: 'privilege',
  LICENSE: 'license',
  DOCUMENT: 'document',
} as const;

export const ACTIONS = {
  ISSUE: 'issue',
  SIGN: 'sign',
  EXPORT: 'export',
  ACCESS: 'access',
  MODIFY: 'modify',
  DELETE: 'delete',
  REVOKE: 'revoke',
  VERIFY: 'verify',
  APPROVE: 'approve',
  REJECT: 'reject',
} as const;

export const OBLIGATIONS = {
  GDPR: 'GDPR',
  HIPAA: 'HIPAA',
  SOC2: 'SOC2',
  ISO27001: 'ISO27001',
  CCPA: 'CCPA',
} as const;

