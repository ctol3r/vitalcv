/**
 * B197B-SAFETY-008: Auto-Hold trigger
 *
 * Persists CRITICAL safety signals, evaluates the restriction engine, and
 * records resulting HOLD states + timeline/notification artifacts.
 */

import {
  CredentialTimelineEventType,
  Prisma,
  PrismaClient,
  PrivilegeSafetySignalType,
  PrivilegeSafetyStateValue,
  SafetySignalSeverity,
} from '@prisma/client';
import { PrivilegeGraph } from '../../privyDep/buildGraph';
import { RestrictionEngine, fetchActiveSafetyStateMap, loadPrivilegeGraph } from '../restrictionEngine';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent';
import { getServiceLogger } from '../../logging/serviceLogger';
import type { PrivilegeSafetyStateRecord } from '../models/PrivilegeSafetyState';
import { notifyClinicianSafetyEvent } from './helpers';

const prismaSingleton = new PrismaClient();
const log = getServiceLogger('safety/triggers/autoHold');

export interface AutoHoldTriggerInput {
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
  detectedAt?: Date;
}

export interface AutoHoldTriggerOptions {
  prisma?: PrismaClient;
  engine?: RestrictionEngine;
  graph?: PrivilegeGraph;
}

export interface AutoHoldTriggerResult {
  signalId: string;
  createdStates: PrivilegeSafetyStateRecord[];
}

export async function runAutoHoldTrigger(
  input: AutoHoldTriggerInput,
  options: AutoHoldTriggerOptions = {},
): Promise<AutoHoldTriggerResult> {
  const prisma = options.prisma ?? prismaSingleton;
  const severity = input.severity ?? SafetySignalSeverity.CRITICAL;

  if (severity !== SafetySignalSeverity.CRITICAL) {
    log.warn('[autoHold] Received non-critical signal, coercing to CRITICAL', {
      severity,
      signalType: input.signalType,
    });
  }

  const signal = await prisma.privilegeSafetySignal.create({
    data: {
      clinicianId: input.clinicianId,
      orgId: input.orgId,
      privilegeCodes: input.privilegeCodes,
      privilegeGrantedId: input.privilegeGrantedId,
      signalType: input.signalType,
      severity: SafetySignalSeverity.CRITICAL,
      summary: input.summary,
      source: input.source,
      details: input.details as Prisma.InputJsonValue,
      evidence: input.evidence as Prisma.InputJsonValue,
      detectedAt: input.detectedAt ?? new Date(),
    },
  });

  const engine = options.engine ?? new RestrictionEngine();
  const graph = options.graph ?? (await loadPrivilegeGraph(prisma));
  const existingStates = await fetchActiveSafetyStateMap(prisma, input.clinicianId);

  const decisions = engine.evaluate({
    graph,
    signals: [
      {
        id: signal.id,
        privilegeCodes: input.privilegeCodes,
        severity: SafetySignalSeverity.CRITICAL,
        reasonCode: `SAFETY:${input.signalType}`,
        source: input.source,
        summary: input.summary,
        metadata: {
          signalType: input.signalType,
          details: input.details,
          evidence: input.evidence,
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

  if (createdStates.length > 0) {
    await logCredentialTimelineEvent({
      clinicianId: input.clinicianId,
      eventType: 'PRIVILEGE_AUTO_HOLD' as CredentialTimelineEventType,
      metadata: {
        signalId: signal.id,
        privilegeCodes: createdStates.map((state) => state.privilegeCode),
        reason: input.summary,
      },
    });

    await notifyClinicianSafetyEvent(prisma, input.clinicianId, 'PRIVILEGE_AUTO_HOLD', {
      signalId: signal.id,
      privilegeCodes: createdStates.map((state) => state.privilegeCode),
      orgId: input.orgId,
      summary: input.summary,
    });
  }

  if (createdStates.some((state) => state.state !== PrivilegeSafetyStateValue.HOLD)) {
    log.warn('[autoHold] Expecting HOLD states but found other transitions', {
      signalId: signal.id,
      states: createdStates.map((state) => state.state),
    });
  }

  return {
    signalId: signal.id,
    createdStates,
  };
}


