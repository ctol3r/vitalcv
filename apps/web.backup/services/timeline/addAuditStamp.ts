import { createHash } from 'crypto';
import type { CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import { AuditScrapbook } from '../../backend/src/blockchain/audit_scrapbook';
import { PolkadotService } from '../../backend/src/blockchain/polkadot_service';
import { getServiceLogger } from '../logging/serviceLogger';

const log = getServiceLogger('timeline/addAuditStamp');

const defaultPolkadot = new PolkadotService();
const defaultAuditScrapbook = new AuditScrapbook(defaultPolkadot);

export interface AuditStampInput {
  clinicianId: string;
  eventType: CredentialTimelineEventType;
  severity: TimelineEventSeverity;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AuditStampResult {
  auditHash: string;
  anchorTxId?: string;
}

export interface AuditStampDependencies {
  auditScrapbook?: Pick<AuditScrapbook, 'anchorEvidenceHash'>;
}

function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, canonicalize(v)]);
    return Object.fromEntries(entries);
  }
  return value;
}

export function buildCanonicalEventPayload(input: AuditStampInput): Record<string, unknown> {
  return {
    clinicianId: input.clinicianId,
    eventType: input.eventType,
    severity: input.severity,
    timestamp: input.timestamp.toISOString(),
    metadata: canonicalize(input.metadata ?? {}),
  };
}

export async function addAuditStamp(
  input: AuditStampInput,
  deps: AuditStampDependencies = {}
): Promise<AuditStampResult> {
  const auditScrapbook = deps.auditScrapbook ?? defaultAuditScrapbook;
  const canonicalPayload = buildCanonicalEventPayload(input);
  const serialized = JSON.stringify(canonicalPayload);
  const auditHash = createHash('sha256').update(serialized).digest('hex');

  try {
    const anchorTxId = await auditScrapbook.anchorEvidenceHash(auditHash, [], {
      clinicianId: input.clinicianId,
      eventType: input.eventType,
      severity: input.severity,
      timestamp: canonicalPayload.timestamp,
    });

    return { auditHash, anchorTxId };
  } catch (error) {
    log.error('[timeline:addAuditStamp] Failed to anchor audit hash', error);
    return { auditHash };
  }
}
/**
 * B182A-TIMELINE-003: Attach immutable audit hash for each timeline event
 */

import { createHash } from 'crypto';
import { AuditScrapbook } from '../../backend/src/blockchain/audit_scrapbook';
import { PolkadotService } from '../../backend/src/blockchain/polkadot_service';
import {
  CredentialTimelineEventType,
  TimelineEventSeverity,
  type CredentialTimelineEventMetadata,
} from './models/CredentialTimelineEvent';

const defaultScrapbook = new AuditScrapbook(new PolkadotService());

export interface AuditStampInput {
  clinicianId: string;
  eventType: CredentialTimelineEventType;
  severity: TimelineEventSeverity;
  timestamp: Date;
  metadata?: CredentialTimelineEventMetadata;
}

export interface AddAuditStampOptions {
  scrapbook?: AuditScrapbook;
  reviewers?: string[];
}

export interface AuditStampResult {
  auditHash: string;
  anchorTxId?: string;
}

function hashReviewerId(value: string): { originalId: string; hash: string } {
  return {
    originalId: value,
    hash: createHash('sha256').update(value).digest('hex'),
  };
}

export async function addAuditStamp(
  event: AuditStampInput,
  options: AddAuditStampOptions = {}
): Promise<AuditStampResult> {
  const payload = {
    clinicianId: event.clinicianId,
    eventType: event.eventType,
    severity: event.severity,
    timestamp: event.timestamp.toISOString(),
    metadata: event.metadata ?? null,
  };

  const auditHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const scrapbook = options.scrapbook ?? defaultScrapbook;
  const reviewers = (options.reviewers ?? []).map(hashReviewerId);

  let anchorTxId: string | undefined;
  try {
    anchorTxId = await scrapbook.anchorEvidenceHash(auditHash, reviewers, {
      timelineEventType: event.eventType,
      clinicianId: event.clinicianId,
      severity: event.severity,
    });
  } catch (error) {
    console.error('[TimelineAudit] Failed to anchor audit hash', error);
  }

  return { auditHash, anchorTxId };
}


