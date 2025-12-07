/**
 * B197B-SAFETY-009: Auto-FPPE trigger
 *
 * Handles HIGH severity procedure signals by restring privileges and spinning
 * up FPPE cases automatically.
 */

import {
  CredentialTimelineEventType,
  FPPECaseStatus,
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
import { normalizePrivilegeCode } from '../../privyDep/models/PrivilegeNode';

const prismaSingleton = new PrismaClient();

export interface AutoFPPETriggerInput {
  clinicianId: string;
  orgId: string;
  privilegeGrantedId: string;
  privilegeCodes: string[];
  signalType: PrivilegeSafetySignalType;
  summary: string;
  source: string;
  dueInDays?: number;
  severity?: SafetySignalSeverity;
  details?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
}

export interface AutoFPPETriggerOptions {
  prisma?: PrismaClient;
  engine?: RestrictionEngine;
  graph?: PrivilegeGraph;
}

export interface AutoFPPETriggerResult {
  signalId: string;
  createdStates: PrivilegeSafetyStateRecord[];
  fppeCaseIds: string[];
}

export async function runAutoFPPETrigger(
  input: AutoFPPETriggerInput,
  options: AutoFPPETriggerOptions = {},
): Promise<AutoFPPETriggerResult> {
  const prisma = options.prisma ?? prismaSingleton;
  const severity = input.severity ?? SafetySignalSeverity.HIGH;

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

  const fppeCaseIds: string[] = [];
  const dueDate = addDays(new Date(), input.dueInDays ?? 45);

  for (const privilegeCode of input.privilegeCodes) {
    const normalizedCode = normalizePrivilegeCode(privilegeCode);
    const existingCase = await prisma.fppeCase.findFirst({
      where: {
        privilegeGrantedId: input.privilegeGrantedId,
        privilegeCode: normalizedCode,
        status: { in: [FPPECaseStatus.OPEN, FPPECaseStatus.IN_REVIEW] },
      },
    });

    if (existingCase) {
      fppeCaseIds.push(existingCase.id);
      continue;
    }

    const created = await prisma.fppeCase.create({
      data: {
        clinicianId: input.clinicianId,
        orgId: input.orgId,
        privilegeGrantedId: input.privilegeGrantedId,
        privilegeCode: normalizedCode,
        startAt: new Date(),
        dueAt: dueDate,
        status: FPPECaseStatus.OPEN,
        notes: `Auto-FPPE triggered by ${input.signalType}: ${input.summary}`,
      },
    });

    fppeCaseIds.push(created.id);
  }

  if (createdStates.length > 0 || fppeCaseIds.length > 0) {
    await logCredentialTimelineEvent({
      clinicianId: input.clinicianId,
      eventType: 'PRIVILEGE_SAFETY_RESTRICTION' as CredentialTimelineEventType,
      metadata: {
        signalId: signal.id,
        fppeCaseIds,
        privilegeCodes: createdStates.map((state) => state.privilegeCode),
        summary: input.summary,
      },
    });

    await notifyClinicianSafetyEvent(prisma, input.clinicianId, 'PRIVILEGE_AUTO_FPPE', {
      signalId: signal.id,
      fppeCaseIds,
      privilegeCodes: input.privilegeCodes,
    });
  }

  return {
    signalId: signal.id,
    createdStates,
    fppeCaseIds,
  };
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

