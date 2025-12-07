import crypto from 'node:crypto';
import {
  DriftEventStatus,
  DriftResolutionType,
  DriftEventSeverity as PrismaDriftSeverity,
  PrismaClient,
} from '@prisma/client';
import { PrismaClient as DefaultPrismaClient } from '@prisma/client';
import { getServiceLogger } from '../logging/serviceLogger.js';
import {
  CredentialRiskFactors,
  CredentialRiskFactor,
} from '../credentialRisk/enums.js';
import { recordDriftSignalImpact, recordDriftResolutionImpact } from '../timeline/driftIntegration.js';
import { respondToPrivilegeDrift } from '../privileging/driftIntegration.js';
import { handlePayerDrift } from '../payer/driftIntegration.js';
import { createNotification } from '../notifications/notificationService.js';
import { enqueueJob } from '../queue/producer.js';
import type { DriftDetection, DriftSeverity } from './types.js';
import { DriftSignalType } from './types.js';

const prisma = new DefaultPrismaClient();
const log = getServiceLogger('drift/orchestrator');

type PrismaLike = PrismaClient;

export interface DriftRunResult {
  totalSignals: number;
  createdEvents: number;
  resolvedEvents: number;
  notificationsSent: number;
}

export interface ListDriftFilters {
  status?: DriftEventStatus[];
  severity?: PrismaDriftSeverity[];
  orgId?: string;
}

interface PersistResult {
  eventId: string;
  isNew: boolean;
  clinicianId?: string;
}

type DriftDetector = (ctx: { prisma: PrismaLike; now: Date }) => Promise<DriftDetection[]>;

const detectors: DriftDetector[] = [detectPrivilegeDrift, detectPayerDrift];

export async function runDriftSweep(
  options: { prisma?: PrismaLike; now?: Date } = {}
): Promise<DriftRunResult> {
  const client = options.prisma ?? prisma;
  const now = options.now ?? new Date();
  const fingerprints = new Set<string>();
  let createdEvents = 0;
  let notificationsSent = 0;

  const detections = (
    await Promise.all(detectors.map((detector) => detector({ prisma: client, now })))
  ).flat();

  for (const detection of detections) {
    const { eventId, isNew, clinicianId } = await persistDriftEvent(client, detection, now);
    fingerprints.add(buildFingerprint(detection));

    if (isNew) {
      createdEvents += 1;
      await recordDriftSignalImpact({
        driftEventId: eventId,
        clinicianId,
        severity: detection.severity,
        summary: detection.summary,
        metadata: detection.payload,
        factor: mapRiskFactor(detection.category),
      });

      notificationsSent += await sendNotificationForSignal(client, detection, eventId);
    }

    const mitigationDetails = await runMitigations(client, detection);
    if (mitigationDetails) {
      await client.driftEvent.update({
        where: { id: eventId },
        data: {
          metadata: {
            ...(detection.payload ?? {}),
            mitigation: mitigationDetails,
          },
        },
      });
    }
  }

  const resolvedEvents = await resolveInactiveEvents(client, fingerprints, now);

  return {
    totalSignals: detections.length,
    createdEvents,
    resolvedEvents,
    notificationsSent,
  };
}

export async function enqueueDriftSweep(reason: string): Promise<{ jobId: string }> {
  const jobId = await enqueueJob('DRIFT_SWEEP', { reason });
  return { jobId };
}

export async function listDriftEvents(filters: ListDriftFilters = {}) {
  return prisma.driftEvent.findMany({
    where: {
      ...(filters.status ? { status: { in: filters.status } } : {}),
      ...(filters.severity ? { severity: { in: filters.severity } } : {}),
      ...(filters.orgId ? { orgId: filters.orgId } : {}),
    },
    orderBy: { lastDetectedAt: 'desc' },
  });
}

export async function getDriftEvent(eventId: string) {
  return prisma.driftEvent.findUnique({ where: { id: eventId } });
}

export async function resolveDriftEvent(
  eventId: string,
  input: { resolutionType: DriftResolutionType; notes?: string }
) {
  const event = await prisma.driftEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new Error('Drift event not found');
  }

  if (event.status === DriftEventStatus.RESOLVED) {
    return event;
  }

  const updated = await prisma.driftEvent.update({
    where: { id: eventId },
    data: {
      status: DriftEventStatus.RESOLVED,
      resolutionType: input.resolutionType,
      resolutionNotes: input.notes,
      resolvedAt: new Date(),
    },
  });

  await recordDriftResolutionImpact({
    driftEventId: updated.id,
    clinicianId: updated.clinicianId ?? undefined,
    severity: toRiskSeverity(updated.severity),
    summary: updated.summary,
    metadata: updated.metadata as Record<string, unknown> | undefined,
    factor: mapRiskFactor(updated.category.toLowerCase()),
    notes: input.notes,
  });

  return updated;
}

async function persistDriftEvent(
  client: PrismaLike,
  detection: DriftDetection,
  now: Date
): Promise<PersistResult> {
  const fingerprint = buildFingerprint(detection);
  const severity = mapSeverity(detection.severity);
  const existing = await client.driftEvent.findUnique({ where: { fingerprint } });

  const baseData = {
    clinicianId: detection.clinicianId ?? undefined,
    clinicianDid: detection.clinicianDid ?? undefined,
    orgId: detection.orgId ?? undefined,
    detectorId: detection.detectorId,
    type: detection.type,
    category: detection.category.toUpperCase(),
    severity,
    summary: detection.summary,
    recommendation: detection.recommendation,
    payload: detection.payload ?? null,
    metadata: detection.payload ?? null,
    lastDetectedAt: now,
  };

  if (existing) {
    const updated = await client.driftEvent.update({
      where: { id: existing.id },
      data: {
        ...baseData,
        status: DriftEventStatus.OPEN,
      },
    });
    return { eventId: updated.id, isNew: false, clinicianId: updated.clinicianId ?? undefined };
  }

  const created = await client.driftEvent.create({
    data: {
      ...baseData,
      fingerprint,
      status: DriftEventStatus.OPEN,
      triggeredAt: now,
    },
  });
  return { eventId: created.id, isNew: true, clinicianId: created.clinicianId ?? undefined };
}

async function runMitigations(
  client: PrismaLike,
  detection: DriftDetection
): Promise<Record<string, unknown> | null> {
  if (detection.category === 'privilege' && detection.targets?.privilegeGrantedId) {
    const result = await respondToPrivilegeDrift(
      {
        type: detection.type,
        severity: detection.severity,
        privilegeGrantedId: detection.targets.privilegeGrantedId,
        clinicianDid: detection.clinicianDid ?? '',
        orgId: detection.orgId,
        detectedAt: new Date(detection.payload?.detectedAt as string | undefined ?? Date.now()),
        metadata: detection.payload,
      },
      { prisma: client }
    );
    return result
      ? {
          type: 'privilege',
          actions: result.actions,
          privilegeGrantedId: result.privilegeGrantedId,
        }
      : null;
  }

  if (detection.category === 'payer' && detection.targets?.payerEnrollmentId) {
    const outcome = await handlePayerDrift(
      {
        type: detection.type,
        severity: detection.severity,
        enrollmentId: detection.targets.payerEnrollmentId,
      },
      { prisma: client }
    );

    return outcome
      ? {
          type: 'payer',
          eligibility: outcome.eligibility,
          discrepancies: outcome.discrepancies,
        }
      : null;
  }

  return null;
}

async function resolveInactiveEvents(
  client: PrismaLike,
  activeFingerprints: Set<string>,
  now: Date
): Promise<number> {
  const staleEvents = await client.driftEvent.findMany({
    where: {
      status: DriftEventStatus.OPEN,
    },
  });

  let resolvedCount = 0;
  for (const event of staleEvents) {
    if (activeFingerprints.has(event.fingerprint)) {
      continue;
    }

    await client.driftEvent.update({
      where: { id: event.id },
      data: {
        status: DriftEventStatus.RESOLVED,
        resolutionType: DriftResolutionType.ACKNOWLEDGED,
        resolutionNotes: 'Auto-resolved: signal not detected in last sweep',
        resolvedAt: now,
      },
    });

    await recordDriftResolutionImpact({
      driftEventId: event.id,
      clinicianId: event.clinicianId ?? undefined,
      severity: toRiskSeverity(event.severity),
      summary: event.summary,
      metadata: event.metadata as Record<string, unknown> | undefined,
      factor: mapRiskFactor(event.category.toLowerCase()),
      notes: 'Auto-resolved',
    });

    resolvedCount += 1;
  }

  return resolvedCount;
}

async function sendNotificationForSignal(
  client: PrismaLike,
  detection: DriftDetection,
  eventId: string
): Promise<number> {
  const userId = await resolveUserId(client, detection);
  if (!userId) {
    return 0;
  }

  await createNotification(userId, 'drift.event', {
    eventId,
    summary: detection.summary,
    severity: detection.severity,
    category: detection.category,
  });
  return 1;
}

async function resolveUserId(client: PrismaLike, detection: DriftDetection): Promise<string | null> {
  if (detection.clinicianId) {
    const profile = await client.clinicianProfile.findUnique({
      where: { id: detection.clinicianId },
      include: { user: true },
    });
    return profile?.userId ?? null;
  }

  if (detection.clinicianDid) {
    const profile = await client.clinicianProfile.findFirst({
      where: { user: { did: detection.clinicianDid } },
    });
    if (profile) {
      return profile.userId;
    }
  }
  return null;
}

function mapSeverity(severity: DriftSeverity): PrismaDriftSeverity {
  switch (severity) {
    case 'critical':
      return PrismaDriftSeverity.CRITICAL;
    case 'warning':
      return PrismaDriftSeverity.WARNING;
    default:
      return PrismaDriftSeverity.INFO;
  }
}

function toRiskSeverity(severity: PrismaDriftSeverity): DriftSeverity {
  switch (severity) {
    case PrismaDriftSeverity.CRITICAL:
      return 'critical';
    case PrismaDriftSeverity.WARNING:
      return 'warning';
    default:
      return 'info';
  }
}

function mapRiskFactor(category: string): CredentialRiskFactor {
  switch (category) {
    case 'privilege':
      return CredentialRiskFactors.PRIVILEGE_DRIFT;
    case 'payer':
      return CredentialRiskFactors.PAYER_DRIFT;
    default:
      return CredentialRiskFactors.ACCESS_DRIFT;
  }
}

function buildFingerprint(detection: DriftDetection): string {
  const key = [
    detection.detectorId,
    detection.type,
    detection.clinicianId ?? detection.clinicianDid ?? 'unknown',
    detection.targets?.privilegeGrantedId ?? '',
    detection.targets?.payerEnrollmentId ?? '',
  ].join(':');
  return crypto.createHash('sha1').update(key).digest('hex');
}

async function detectPrivilegeDrift({ prisma, now }: { prisma: PrismaLike; now: Date }) {
  const results: DriftDetection[] = [];
  const privileges = await prisma.privilegeGranted.findMany({
    where: {
      status: 'ACTIVE',
    },
    take: 200,
  });

  for (const privilege of privileges) {
    if (privilege.expiresAt && privilege.expiresAt < now) {
      results.push({
        detectorId: 'privilege-expiration',
        type: 'PRIVILEGE_EXPIRED',
        category: 'privilege',
        severity: 'critical',
        clinicianDid: privilege.clinicianDid,
        orgId: privilege.orgId,
        summary: `Privilege ${privilege.id} expired on ${privilege.expiresAt.toISOString()}`,
        targets: { privilegeGrantedId: privilege.id },
        payload: { expiresAt: privilege.expiresAt.toISOString() },
      });
      continue;
    }

    if (privilege.renewalDue && privilege.renewalDue < now) {
      results.push({
        detectorId: 'privilege-renewal',
        type: 'PRIVILEGE_RENEWAL_OVERDUE',
        category: 'privilege',
        severity: 'critical',
        clinicianDid: privilege.clinicianDid,
        orgId: privilege.orgId,
        summary: `Privilege ${privilege.id} renewal overdue`,
        targets: { privilegeGrantedId: privilege.id },
        payload: { renewalDue: privilege.renewalDue.toISOString() },
      });
    }

    if (privilege.fppeStatus === 'FAILED') {
      results.push({
        detectorId: 'privilege-fppe',
        type: 'PRIVILEGE_FPPE_FAILED',
        category: 'privilege',
        severity: 'critical',
        clinicianDid: privilege.clinicianDid,
        orgId: privilege.orgId,
        summary: `FPPE failed for privilege ${privilege.id}`,
        targets: { privilegeGrantedId: privilege.id },
      });
    }
  }

  return results;
}

async function detectPayerDrift({ prisma }: { prisma: PrismaLike; now: Date }) {
  const results: DriftDetection[] = [];
  const enrollments = await prisma.payerEnrollmentV2.findMany({
    where: {
      status: { in: ['REVALIDATION_DUE', 'REJECTED', 'PANEL_FULL'] },
    },
    take: 200,
  });

  for (const enrollment of enrollments) {
    if (enrollment.status === 'REVALIDATION_DUE') {
      results.push({
        detectorId: 'payer-revalidation',
        type: 'PAYER_REVALIDATION_DUE',
        category: 'payer',
        severity: 'critical',
        clinicianId: enrollment.clinicianId,
        summary: `Payer ${enrollment.payerId} revalidation overdue`,
        targets: { payerEnrollmentId: enrollment.id },
        payload: { panelType: enrollment.panelType },
      });
      continue;
    }

    results.push({
      detectorId: 'payer-status-mismatch',
      type: 'PAYER_STATUS_MISMATCH',
      category: 'payer',
      severity: 'critical',
      clinicianId: enrollment.clinicianId,
      summary: `Payer ${enrollment.payerId} enrollment status ${enrollment.status}`,
      targets: { payerEnrollmentId: enrollment.id },
      payload: { status: enrollment.status },
    });
  }

  return results;
}

