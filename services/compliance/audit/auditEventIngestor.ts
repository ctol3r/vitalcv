/**
 * B239B-COM-012: AuditEventIngestor
 *
 * Collects events from various modules (credential issue, contract sign, data export),
 * normalizes them, and writes them to UnifiedAuditTrail.
 * Ensures minimal performance impact through async processing and batching.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import type { AuditEventInput } from '../models/UnifiedAuditTrail.js';

const prisma = new PrismaClient();
const log = getServiceLogger('compliance/audit/ingestor');

interface EventSource {
  module: string;
  eventType: string;
  data: Record<string, unknown>;
}

/**
 * Normalizes events from different modules into UnifiedAuditTrail format
 */
function normalizeEvent(
  source: EventSource,
  actorId?: string,
  jurisdiction?: string,
  obligationId?: string
): AuditEventInput | null {
  try {
    const { module, eventType, data } = source;

    // Map module-specific events to unified format
    let entityType: string;
    let entityId: string;
    let action: string;
    let details: Record<string, unknown> = { ...data, sourceModule: module, sourceEventType: eventType };

    switch (module) {
      case 'credential':
        entityType = 'credential';
        entityId = (data.credentialId as string) || (data.id as string) || 'unknown';
        action = mapCredentialAction(eventType);
        break;

      case 'contract':
        entityType = 'contract';
        entityId = (data.contractId as string) || (data.id as string) || 'unknown';
        action = mapContractAction(eventType);
        break;

      case 'data_export':
        entityType = 'data_export';
        entityId = (data.exportId as string) || (data.id as string) || `export_${Date.now()}`;
        action = 'export';
        // GDPR-specific: track data exports
        if (!obligationId && jurisdiction === 'EU') {
          obligationId = 'GDPR';
        }
        break;

      case 'user':
        entityType = 'user';
        entityId = (data.userId as string) || (data.id as string) || 'unknown';
        action = mapUserAction(eventType);
        break;

      case 'org':
        entityType = 'org';
        entityId = (data.orgId as string) || (data.id as string) || 'unknown';
        action = mapOrgAction(eventType);
        break;

      default:
        // Generic fallback
        entityType = module;
        entityId = (data.id as string) || (data.entityId as string) || 'unknown';
        action = eventType.toLowerCase().replace(/_/g, '_');
    }

    return {
      entityType,
      entityId,
      action,
      actorId: actorId || (data.actorId as string) || (data.userId as string),
      details,
      jurisdiction,
      obligationId,
    };
  } catch (error) {
    log.error('[normalizeEvent] Failed to normalize event', { error, source });
    return null;
  }
}

function mapCredentialAction(eventType: string): string {
  const mapping: Record<string, string> = {
    CREDENTIAL_ISSUED: 'issue',
    CREDENTIAL_VERIFIED: 'verify',
    CREDENTIAL_REVOKED: 'revoke',
    CREDENTIAL_ACCESSED: 'access',
    CREDENTIAL_MODIFIED: 'modify',
  };
  return mapping[eventType] || eventType.toLowerCase();
}

function mapContractAction(eventType: string): string {
  const mapping: Record<string, string> = {
    CONTRACT_SIGNED: 'sign',
    CONTRACT_APPROVED: 'approve',
    CONTRACT_REJECTED: 'reject',
    CONTRACT_MODIFIED: 'modify',
  };
  return mapping[eventType] || eventType.toLowerCase();
}

function mapUserAction(eventType: string): string {
  const mapping: Record<string, string> = {
    USER_CREATED: 'create',
    USER_MODIFIED: 'modify',
    USER_DELETED: 'delete',
    USER_ACCESSED: 'access',
  };
  return mapping[eventType] || eventType.toLowerCase();
}

function mapOrgAction(eventType: string): string {
  const mapping: Record<string, string> = {
    ORG_CREATED: 'create',
    ORG_MODIFIED: 'modify',
    ORG_DELETED: 'delete',
  };
  return mapping[eventType] || eventType.toLowerCase();
}

/**
 * Event queue for batching writes
 */
class EventQueue {
  private queue: AuditEventInput[] = [];
  private batchSize = 50;
  private flushInterval = 5000; // 5 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.startFlushTimer();
  }

  add(event: AuditEventInput) {
    this.queue.push(event);
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  private async flush() {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.batchSize);

    try {
      await prisma.unifiedAuditTrail.createMany({
        data: batch.map((event) => ({
          entityType: event.entityType,
          entityId: event.entityId,
          action: event.action,
          actorId: event.actorId,
          timestamp: event.timestamp || new Date(),
          details: event.details as Prisma.InputJsonValue,
          jurisdiction: event.jurisdiction,
          obligationId: event.obligationId,
        })),
        skipDuplicates: true,
      });

      log.debug(`[EventQueue] Flushed ${batch.length} events to audit trail`);
    } catch (error) {
      log.error('[EventQueue] Failed to flush events', { error, batchSize: batch.length });
      // Re-queue failed events (simple retry - in production, use a proper queue)
      this.queue.unshift(...batch);
    }
  }

  async shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}

const eventQueue = new EventQueue();

/**
 * Ingests an audit event from any module
 */
export async function ingestAuditEvent(
  source: EventSource,
  options?: {
    actorId?: string;
    jurisdiction?: string;
    obligationId?: string;
  }
): Promise<void> {
  try {
    const normalized = normalizeEvent(
      source,
      options?.actorId,
      options?.jurisdiction,
      options?.obligationId
    );

    if (!normalized) {
      log.warn('[ingestAuditEvent] Event normalization failed, skipping', { source });
      return;
    }

    // Add to queue for async batch processing
    eventQueue.add(normalized);

    log.debug('[ingestAuditEvent] Event queued', {
      entityType: normalized.entityType,
      entityId: normalized.entityId,
      action: normalized.action,
    });
  } catch (error) {
    log.error('[ingestAuditEvent] Failed to ingest event', { error, source });
    // Don't throw - audit logging should never break the main flow
  }
}

/**
 * Synchronously write an event (use sparingly for critical events)
 */
export async function ingestAuditEventSync(
  source: EventSource,
  options?: {
    actorId?: string;
    jurisdiction?: string;
    obligationId?: string;
  }
): Promise<string | null> {
  try {
    const normalized = normalizeEvent(
      source,
      options?.actorId,
      options?.jurisdiction,
      options?.obligationId
    );

    if (!normalized) {
      return null;
    }

    const record = await prisma.unifiedAuditTrail.create({
      data: {
        entityType: normalized.entityType,
        entityId: normalized.entityId,
        action: normalized.action,
        actorId: normalized.actorId,
        timestamp: normalized.timestamp || new Date(),
        details: normalized.details as Prisma.InputJsonValue,
        jurisdiction: normalized.jurisdiction,
        obligationId: normalized.obligationId,
      },
    });

    return record.id;
  } catch (error) {
    log.error('[ingestAuditEventSync] Failed to ingest event', { error, source });
    return null;
  }
}

/**
 * Shutdown hook - flush remaining events
 */
export async function shutdownIngestor(): Promise<void> {
  await eventQueue.shutdown();
}

