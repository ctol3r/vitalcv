import crypto from 'node:crypto';
import {
  CredentialTimelineEventType,
  DriftEventCategory,
  DriftEventSeverity,
  OrgMembershipRole,
  Prisma,
  PrismaClient as DefaultPrismaClient,
  type PrismaClient,
  type TJCComplianceRecord as PrismaTJCComplianceRecord,
  TimelineEventSeverity,
} from '@prisma/client';
import { getServiceLogger } from '../logging/serviceLogger.js';
import { createNotification } from '../notifications/notificationService.js';

const prisma = new DefaultPrismaClient();
const log = getServiceLogger('compliance/tjc/drift');
const DETECTOR_ID = 'TJCComplianceDriftDetector';

interface PrismaLike extends Pick<
  PrismaClient,
  'tJCComplianceRecord' | 'driftEvent' | 'credentialTimelineEvent' | 'orgMembership'
> {}

const STATUS_RANK: Record<string, number> = {
  PASS: 0,
  PENDING: 1,
  WARN: 2,
  FAIL: 3,
};

export interface DetectComplianceDriftInput {
  record: PrismaTJCComplianceRecord;
  previousRecord?: PrismaTJCComplianceRecord | null;
  clinicianDid?: string;
  prisma?: PrismaLike;
}

export interface DetectComplianceDriftResult {
  driftEventId?: string;
  timelineEventId?: string;
  notificationsSent: number;
}

export async function detectTJCComplianceDrift(
  input: DetectComplianceDriftInput
): Promise<DetectComplianceDriftResult | null> {
  const client = input.prisma ?? prisma;
  const currentRecord = input.record;
  const previous =
    input.previousRecord ??
    (await client.tJCComplianceRecord.findFirst({
      where: {
        clinicianId: currentRecord.clinicianId,
        orgId: currentRecord.orgId,
        evaluationDate: { lt: currentRecord.evaluationDate },
      },
      orderBy: { evaluationDate: 'desc' },
    }));

  if (!previous) {
    return null;
  }

  const delta =
    (STATUS_RANK[currentRecord.overallStatus] ?? 0) -
    (STATUS_RANK[previous.overallStatus] ?? 0);

  if (delta <= 0) {
    return null;
  }

  const changedStandards = diffStandardStatuses(
    currentRecord.standardResults,
    previous.standardResults
  );

  if (!changedStandards.length) {
    return null;
  }

  const severity: DriftEventSeverity =
    delta >= 2 || currentRecord.overallStatus === 'FAIL' ? 'CRITICAL' : 'WARNING';
  const timelineSeverity: TimelineEventSeverity =
    severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING';

  const fingerprint = crypto
    .createHash('sha256')
    .update(`${currentRecord.id}:${previous.id}:${currentRecord.overallStatus}`)
    .digest('hex');

  const payload = {
    recordId: currentRecord.id,
    previousStatus: previous.overallStatus,
    currentStatus: currentRecord.overallStatus,
    changedStandards,
  };

  const driftEvent = await client.driftEvent.upsert({
    where: { fingerprint },
    update: {
      severity,
      lastDetectedAt: new Date(),
      payload: payload as Prisma.InputJsonValue,
    },
    create: {
      clinicianId: currentRecord.clinicianId,
      clinicianDid: input.clinicianDid,
      orgId: currentRecord.orgId ?? undefined,
      detectorId: DETECTOR_ID,
      type: 'TJC_COMPLIANCE',
      category: DriftEventCategory.PRIVILEGE,
      severity,
      summary: `TJC compliance degraded ${previous.overallStatus} → ${currentRecord.overallStatus}`,
      recommendation: `Review standards: ${changedStandards.map((entry) => entry.standard).join(', ')}`,
      fingerprint,
      payload: payload as Prisma.InputJsonValue,
    },
  });

  const timelineEvent = await client.credentialTimelineEvent.create({
    data: {
      clinicianId: currentRecord.clinicianId,
      eventType: CredentialTimelineEventType.DISCREPANCY_FOUND,
      severity: timelineSeverity,
      timestamp: new Date(),
      metadata: {
        source: 'tjc-compliance',
        recordId: currentRecord.id,
        previousStatus: previous.overallStatus,
        currentStatus: currentRecord.overallStatus,
        changedStandards,
      } as Prisma.InputJsonValue,
      auditHash: crypto
        .createHash('sha256')
        .update(`tjc-drift:${currentRecord.id}:${Date.now()}`)
        .digest('hex'),
    },
  });

  const notificationsSent = await notifyOrgAdmins(client, currentRecord, payload);

  log.warn('[TJCComplianceDrift] Detected degradation', {
    clinicianId: currentRecord.clinicianId,
    orgId: currentRecord.orgId,
    previousStatus: previous.overallStatus,
    currentStatus: currentRecord.overallStatus,
    changedStandards,
    severity,
  });

  return {
    driftEventId: driftEvent.id,
    timelineEventId: timelineEvent.id,
    notificationsSent,
  };
}

function diffStandardStatuses(
  current: Prisma.JsonValue | null,
  previous: Prisma.JsonValue | null
) {
  const currentMap = parseStandardResult(current);
  const previousMap = parseStandardResult(previous);
  const standards = new Set([...Object.keys(currentMap), ...Object.keys(previousMap)]);

  const changes: Array<{ standard: string; previousStatus: string; currentStatus: string }> = [];

  for (const standard of standards) {
    const currentStatus = currentMap[standard] ?? 'PENDING';
    const previousStatus = previousMap[standard] ?? 'PENDING';
    if (currentStatus !== previousStatus) {
      changes.push({ standard, previousStatus, currentStatus });
    }
  }

  return changes;
}

function parseStandardResult(data: Prisma.JsonValue | null | undefined): Record<string, string> {
  if (!data || typeof data !== 'object') {
    return {};
  }
  const source = data as Record<string, { status?: string }>;
  return Object.fromEntries(
    Object.entries(source)
      .filter(([, value]) => typeof value?.status === 'string')
      .map(([key, value]) => [key, value.status as string])
  );
}

async function notifyOrgAdmins(
  client: PrismaLike,
  record: PrismaTJCComplianceRecord,
  payload: Record<string, unknown>
): Promise<number> {
  if (!record.orgId) {
    return 0;
  }

  const members = await client.orgMembership.findMany({
    where: { orgId: record.orgId, role: OrgMembershipRole.ADMIN },
    select: { userId: true },
  });

  const uniqueUserIds = Array.from(new Set(members.map((member) => member.userId)));
  let sent = 0;

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      await createNotification(userId, 'compliance.tjc.drift', {
        ...payload,
        orgId: record.orgId,
      });
      sent += 1;
    })
  );

  return sent;
}
