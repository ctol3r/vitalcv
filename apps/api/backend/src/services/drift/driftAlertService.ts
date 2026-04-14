import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

const DRIFT_RESPONSE_AUDIT_EVENT = 'drift.response.recorded';

export type DriftAlertAction = 'request_refresh' | 'route_to_review' | 'pause_candidate';

export interface DriftAlertView {
  alertId: string;
  subjectNpi: string;
  driftId: string;
  severity: 'medium' | 'high';
  createdAt: string;
  resolvedAt: string | null;
  title: string;
  message: string;
  reasons: string[];
}

type AuditEventRecord = {
  id: string;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
};

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readRecord(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as Record<string, Prisma.JsonValue>;
}

function readString(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readStringArray(value: Prisma.JsonValue | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function readReasons(auditEvent: AuditEventRecord | null): string[] {
  if (!auditEvent) {
    return [];
  }

  const metadata = readRecord(auditEvent.metadata);
  const payload = readRecord(metadata.payload);
  return readStringArray(payload.reasons);
}

function buildAlertTitle(reasons: readonly string[]): string {
  const normalized = reasons.join(' ').toLowerCase();
  if (normalized.includes('exclusion')) {
    return 'New exclusion detected';
  }
  if (normalized.includes('licensure') || normalized.includes('license')) {
    return 'License status changed';
  }
  return 'Verification status changed';
}

function buildAlertMessage(reasons: readonly string[]): string {
  if (reasons.length > 0) {
    return reasons[0]!;
  }
  return 'VitalCV detected a source-backed change that needs employer follow-up.';
}

function normalizeAlertSeverity(value: string | null | undefined): 'medium' | 'high' {
  return value?.toLowerCase() === 'high' ? 'high' : 'medium';
}

export async function createDriftAlert(input: {
  subjectNpi: string;
  driftId: string;
  severity: string;
  createdAt?: string | Date | null;
}): Promise<void> {
  if (!input.subjectNpi || !input.driftId) {
    return;
  }

  const createdAt =
    input.createdAt instanceof Date
      ? input.createdAt
      : typeof input.createdAt === 'string'
        ? new Date(input.createdAt)
        : new Date();
  const safeCreatedAt = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;

  try {
    await prisma.driftAlert.upsert({
      where: { driftId: input.driftId },
      update: {},
      create: {
        subjectNpi: input.subjectNpi,
        driftId: input.driftId,
        severity: normalizeAlertSeverity(input.severity),
        createdAt: safeCreatedAt,
      },
    });
  } catch (error) {
    log('warn', 'drift_alert_write_failed', {
      subjectNpi: input.subjectNpi,
      driftId: input.driftId,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export async function listOpenDriftAlerts(subjectNpi: string): Promise<DriftAlertView[]> {
  if (!subjectNpi) {
    return [];
  }

  const rows = await prisma.driftAlert.findMany({
    where: {
      subjectNpi,
      resolvedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (rows.length === 0) {
    return [];
  }

  const driftEvents = await prisma.auditEvent.findMany({
    where: {
      id: { in: rows.map((row) => row.driftId) },
    },
    select: {
      id: true,
      createdAt: true,
      metadata: true,
    },
  });
  const byId = new Map(driftEvents.map((row) => [row.id, row] as const));

  return rows.map((row) => {
    const auditEvent = byId.get(row.driftId) ?? null;
    const reasons = readReasons(auditEvent);
    return {
      alertId: row.alertId,
      subjectNpi: row.subjectNpi,
      driftId: row.driftId,
      severity: normalizeAlertSeverity(row.severity),
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
      title: buildAlertTitle(reasons),
      message: buildAlertMessage(reasons),
      reasons,
    };
  });
}

export async function resolveOpenDriftAlerts(input: {
  subjectNpi: string;
  action: DriftAlertAction;
  actionAuditEventId: string;
  resolvedAt?: Date;
}): Promise<void> {
  if (!input.subjectNpi || !input.actionAuditEventId) {
    return;
  }

  const resolvedAt = input.resolvedAt ?? new Date();

  try {
    const openAlerts = await prisma.driftAlert.findMany({
      where: {
        subjectNpi: input.subjectNpi,
        resolvedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (openAlerts.length === 0) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.driftAlert.updateMany({
        where: {
          alertId: { in: openAlerts.map((alert) => alert.alertId) },
        },
        data: { resolvedAt },
      });

      for (const alert of openAlerts) {
        const driftResponseTimeMs = Math.max(0, resolvedAt.getTime() - alert.createdAt.getTime());
        const reverificationLatencyMs =
          input.action === 'request_refresh' ? driftResponseTimeMs : null;
        const metadata = {
          alertId: alert.alertId,
          subjectNpi: input.subjectNpi,
          driftId: alert.driftId,
          severity: normalizeAlertSeverity(alert.severity),
          action: input.action,
          actionAuditEventId: input.actionAuditEventId,
          driftResponseTimeMs,
          reverificationLatencyMs,
          createdAt: alert.createdAt.toISOString(),
          resolvedAt: resolvedAt.toISOString(),
        };
        const serialized = JSON.stringify({
          type: DRIFT_RESPONSE_AUDIT_EVENT,
          referenceId: alert.alertId,
          metadata,
        });

        await tx.auditEvent.create({
          data: {
            type: DRIFT_RESPONSE_AUDIT_EVENT,
            hash: sha256Hex(serialized),
            referenceId: alert.alertId,
            clinicianId: input.subjectNpi,
            metadata: toJsonValue(metadata),
          },
        });
      }
    });
  } catch (error) {
    log('warn', 'drift_alert_resolution_failed', {
      subjectNpi: input.subjectNpi,
      action: input.action,
      actionAuditEventId: input.actionAuditEventId,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}
