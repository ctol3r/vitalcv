import {
  Prisma,
  PrismaClient,
  PrivilegeSafetyStateValue,
  SafetySignalSeverity,
} from '@prisma/client';
import type { SafetySignalResult } from './collectors/signalCollector.js';

const STATE_ORDER: Record<PrivilegeSafetyStateValue, number> = {
  FULL: 0,
  PENDING_REVIEW: 1,
  RESTRICTED: 2,
  HOLD: 3,
  SUSPENDED: 4,
};

const SEVERITY_STATE_MAP: Record<
  SafetySignalSeverity,
  PrivilegeSafetyStateValue
> = {
  LOW: PrivilegeSafetyStateValue.FULL,
  MED: PrivilegeSafetyStateValue.PENDING_REVIEW,
  HIGH: PrivilegeSafetyStateValue.HOLD,
  CRITICAL: PrivilegeSafetyStateValue.SUSPENDED,
};

export interface RestrictionDecision {
  stateId: string;
  clinicianId: string;
  privilegeCode: string;
  state: PrivilegeSafetyStateValue;
  severity: SafetySignalSeverity;
  signalId: string;
}

export class RestrictionEngine {
  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {}

  async apply(result: SafetySignalResult): Promise<RestrictionDecision[]> {
    const desiredState = SEVERITY_STATE_MAP[result.domain.severity];
    const privilegeCodes =
      result.domain.privilegeCodes.length > 0
        ? result.domain.privilegeCodes
        : ['GLOBAL'];

    if (desiredState === PrivilegeSafetyStateValue.FULL) {
      await this.resolveExistingStates(result.domain.clinicianId, privilegeCodes);
      return [];
    }

    const decisions: RestrictionDecision[] = [];

    for (const code of privilegeCodes) {
      const existing = await this.prisma.privilegeSafetyState.findFirst({
        where: {
          clinicianId: result.domain.clinicianId,
          privilegeCode: code,
          resolvedAt: null,
        },
        orderBy: { effectiveAt: 'desc' },
      });

      if (existing && compareState(existing.state, desiredState) >= 0) {
        continue;
      }

      if (existing) {
        await this.prisma.privilegeSafetyState.update({
          where: { id: existing.id },
          data: {
            resolvedAt: new Date(),
            resolutionNotes: 'Superseded by safety sweep',
            resolutionActor: 'safety-sweep',
          },
        });
      }

      const created = await this.prisma.privilegeSafetyState.create({
        data: {
          clinicianId: result.domain.clinicianId,
          orgId: result.domain.orgId ?? 'GLOBAL',
          privilegeCode: code,
          privilegeGrantedId: result.record.privilegeGrantedId ?? null,
          state: desiredState,
          reasonCode: result.domain.signalType,
          severity: result.domain.severity,
          source: result.domain.source ?? 'safety-sweep',
          signalIds: [result.record.id],
          metadata: (result.domain.details ?? undefined) as Prisma.JsonValue | undefined,
          effectiveAt: result.domain.detectedAt,
        },
      });

      decisions.push({
        stateId: created.id,
        clinicianId: created.clinicianId,
        privilegeCode: created.privilegeCode,
        state: created.state,
        severity: created.severity,
        signalId: result.record.id,
      });
    }

    return decisions;
  }

  private async resolveExistingStates(
    clinicianId: string,
    privilegeCodes: string[],
  ): Promise<void> {
    await this.prisma.privilegeSafetyState.updateMany({
      where: {
        clinicianId,
        privilegeCode: { in: privilegeCodes },
        resolvedAt: null,
      },
      data: {
        resolvedAt: new Date(),
        resolutionNotes: 'Cleared during safety sweep',
        resolutionActor: 'safety-sweep',
      },
    });
  }
}

function compareState(
  current: PrivilegeSafetyStateValue,
  next: PrivilegeSafetyStateValue,
): number {
  return STATE_ORDER[current] - STATE_ORDER[next];
}

