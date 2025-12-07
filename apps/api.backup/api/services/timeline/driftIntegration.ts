import crypto from 'node:crypto';
import {
  CredentialTimelineEventType,
  PrismaClient,
  TimelineEventSeverity,
} from '@prisma/client';
import { getServiceLogger } from '../logging/serviceLogger.js';
import {
  applyRiskAdjustment,
  resolveRiskFactor,
  RiskSeverity,
} from '../credentialRisk/index.js';
import { CredentialRiskFactors } from '../credentialRisk/enums.js';

const prisma = new PrismaClient();
const log = getServiceLogger('timeline/drift');

export interface DriftTimelineInput {
  driftEventId: string;
  clinicianId?: string;
  severity: RiskSeverity;
  summary: string;
  metadata?: Record<string, unknown>;
  factor?: CredentialRiskFactors;
  timestamp?: Date;
}

export interface DriftResolutionInput extends DriftTimelineInput {
  notes?: string;
}

function toTimelineSeverity(level: RiskSeverity): TimelineEventSeverity {
  switch (level) {
    case 'critical':
      return TimelineEventSeverity.CRITICAL;
    case 'warning':
      return TimelineEventSeverity.WARNING;
    default:
      return TimelineEventSeverity.INFO;
  }
}

function buildAuditHash(payload: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export class ChronoTimeline {
  private client: PrismaClient;

  constructor(client: PrismaClient = prisma) {
    this.client = client;
  }

  async recordSignal(input: DriftTimelineInput): Promise<void> {
    if (!input.clinicianId) {
      log.debug('[ChronoTimeline] Skipping drift signal without clinicianId', {
        driftEventId: input.driftEventId,
      });
      return;
    }

    const metadata = {
      driftEventId: input.driftEventId,
      summary: input.summary,
      ...input.metadata,
    };

    await this.client.credentialTimelineEvent.create({
      data: {
        clinicianId: input.clinicianId,
        eventType: CredentialTimelineEventType.DRIFT_SIGNAL,
        severity: toTimelineSeverity(input.severity),
        timestamp: input.timestamp ?? new Date(),
        metadata,
        auditHash: buildAuditHash(metadata),
      },
    });

    if (input.factor) {
      await applyRiskAdjustment(
        {
          clinicianId: input.clinicianId,
          factor: input.factor,
          severity: input.severity,
          details: input.metadata,
          reason: input.summary,
        },
        { prisma: this.client }
      );
    }
  }

  async recordResolution(input: DriftResolutionInput): Promise<void> {
    if (!input.clinicianId) {
      return;
    }

    const metadata = {
      driftEventId: input.driftEventId,
      summary: input.summary,
      notes: input.notes,
      ...input.metadata,
    };

    await this.client.credentialTimelineEvent.create({
      data: {
        clinicianId: input.clinicianId,
        eventType: CredentialTimelineEventType.DRIFT_RESOLVED,
        severity: toTimelineSeverity(input.severity),
        timestamp: input.timestamp ?? new Date(),
        metadata,
        auditHash: buildAuditHash(metadata),
      },
    });

    if (input.factor) {
      await resolveRiskFactor(
        {
          clinicianId: input.clinicianId,
          factor: input.factor,
          severity: input.severity,
          notes: input.notes,
        },
        { prisma: this.client }
      );
    }
  }
}

export async function recordDriftSignalImpact(input: DriftTimelineInput) {
  const chrono = new ChronoTimeline();
  await chrono.recordSignal(input);
}

export async function recordDriftResolutionImpact(input: DriftResolutionInput) {
  const chrono = new ChronoTimeline();
  await chrono.recordResolution(input);
}

