/**
 * B197B-SAFETY-010: Auto-review trigger
 *
 * Escalates privileges to PENDING_REVIEW when repeated MEDIUM signals are
 * detected and generates a committee packet.
 */

import {
  CredentialTimelineEventType,
  Prisma,
  PrismaClient,
  PrivilegeSafetySignalType,
  SafetySignalSeverity,
} from '@prisma/client';
import { PrivilegeGraph } from '../../privyDep/buildGraph';
import { RestrictionEngine, fetchActiveSafetyStateMap, loadPrivilegeGraph } from '../restrictionEngine';
import type { PrivilegeSafetyStateRecord } from '../models/PrivilegeSafetyState';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent';
import { notifyClinicianSafetyEvent } from './helpers';
import { generateCommitteePacketSnapshot } from '../../committeePacket/assemble';
import { CommitteePacketStatus } from '../../committeePacket/models/CommitteePacket';

const prismaSingleton = new PrismaClient();

export interface AutoReviewTriggerInput {
  clinicianId: string;
  orgId: string;
  privilegeCodes: string[];
  privilegeGrantedId?: string;
  signalType: PrivilegeSafetySignalType;
  summary: string;
  source: string;
  details?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  severity?: SafetySignalSeverity;
  windowHours?: number;
  threshold?: number;
  sendCommitteePacket?: boolean;
}

export interface AutoReviewTriggerOptions {
  prisma?: PrismaClient;
  engine?: RestrictionEngine;
  graph?: PrivilegeGraph;
}

export interface AutoReviewTriggerResult {
  signalId: string;
  escalated: boolean;
  createdStates: PrivilegeSafetyStateRecord[];
  committeePacketId?: string;
}

const ESCALATION_SEVERITIES = [
  SafetySignalSeverity.MEDIUM,
  SafetySignalSeverity.HIGH,
  SafetySignalSeverity.CRITICAL,
];

export async function runAutoReviewTrigger(
  input: AutoReviewTriggerInput,
  options: AutoReviewTriggerOptions = {},
): Promise<AutoReviewTriggerResult> {
  const prisma = options.prisma ?? prismaSingleton;
  const severity = input.severity ?? SafetySignalSeverity.MEDIUM;

  const signal = await prisma.privilegeSafetySignal.create({
    data: {
      clinicianId: input.clinicianId,
      orgId: input.orgId,
      privilegeCodes: input.privilegeCodes,
      privilegeGrantedId: input.privilegeGrantedId,
      signalType: input.signalType,
      severity,
      summary: input.summary,
      source: input.source,
      details: input.details as Prisma.InputJsonValue,
      evidence: input.evidence as Prisma.InputJsonValue,
    },
  });

  const windowHours = input.windowHours ?? 72;
  const threshold = input.threshold ?? 3;
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const recentCount = await prisma.privilegeSafetySignal.count({
    where: {
      clinicianId: input.clinicianId,
      signalType: input.signalType,
      severity: { in: ESCALATION_SEVERITIES },
      detectedAt: { gte: windowStart },
    },
  });

  if (recentCount < threshold) {
    return {
      signalId: signal.id,
      escalated: false,
      createdStates: [],
    };
  }

  const engine = options.engine ?? new RestrictionEngine();
  const graph = options.graph ?? (await loadPrivilegeGraph(prisma));
  const existingStates = await fetchActiveSafetyStateMap(prisma, input.clinicianId);

  const decisions = engine.evaluate({
    graph,
    signals: [
      {
        id: signal.id,
        privilegeCodes: input.privilegeCodes,
        severity,
        reasonCode: `SAFETY:${input.signalType}`,
        source: input.source,
        summary: input.summary,
        metadata: {
          signalType: input.signalType,
          details: input.details,
          evidence: input.evidence,
          withinWindowHours: windowHours,
          threshold,
        },
      },
    ],
    existingStates,
  });

  const createdStates = await Promise.all(
    decisions.map((decision) =>
      prisma.privilegeSafetyState.create({
        data: {
          privilegeGrantedId: input.privilegeGrantedId,
          clinicianId: input.clinicianId,
          orgId: input.orgId,
          privilegeCode: decision.privilegeCode,
          state: decision.state,
          reasonCode: decision.reasonCode,
          severity: decision.severity,
          source: decision.source,
          signalIds: decision.signalIds,
          cascadeScope: decision.cascadeScope as Prisma.InputJsonValue,
          metadata: decision.metadata as Prisma.InputJsonValue,
        },
      }),
    ),
  );

  let committeePacketId: string | undefined;
  if (input.sendCommitteePacket !== false) {
    try {
      const packet = await generateCommitteePacketSnapshot({
        clinicianId: input.clinicianId,
        statusOverride: CommitteePacketStatus.SUBMITTED,
      });
      committeePacketId = packet.packetId;
    } catch (error) {
      // Key may be missing locally; log and continue.
      console.warn('[autoReview] Failed to generate committee packet snapshot', error);
    }
  }

  await logCredentialTimelineEvent({
    clinicianId: input.clinicianId,
    eventType: 'PRIVILEGE_PENDING_REVIEW' as CredentialTimelineEventType,
    metadata: {
      signalId: signal.id,
      privilegeCodes: createdStates.map((state) => state.privilegeCode),
      committeePacketId,
      windowHours,
      threshold,
    },
  });

  await notifyClinicianSafetyEvent(prisma, input.clinicianId, 'PRIVILEGE_PENDING_REVIEW', {
    signalId: signal.id,
    privilegeCodes: input.privilegeCodes,
    committeePacketId,
    summary: input.summary,
  });

  return {
    signalId: signal.id,
    escalated: true,
    createdStates,
    committeePacketId,
  };
}

