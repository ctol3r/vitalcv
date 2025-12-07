import { randomUUID, createHash } from 'crypto';
import { addDays, differenceInCalendarDays, differenceInCalendarYears } from 'date-fns';
import type { Prisma, PrismaClient, ProviderLifecycle, ReadinessSignal } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { collectReadinessSignals } from '../readiness/signals';
import {
  ResidencyTemplateImporter,
  type PgyLevel,
} from '../onboarding/residency-template';
import { RetirementWorkflow } from './retirement';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export type ProviderLifecyclePhase =
  | 'training'
  | 'resident'
  | 'attending'
  | 'multi-state'
  | 'senior'
  | 'retired';

export interface LicenseReadinessTask {
  id: string;
  clinicianId: string;
  state?: string | null;
  task: string;
  reason: string;
  dueDate?: string;
  status: 'pending' | 'scheduled';
  createdAt: string;
}

interface ProviderLifecycleSignals {
  clinicianId: string;
  now: Date;
  graduationYear: number | null;
  yearsSinceGraduation: number | null;
  activeLicenseCount: number;
  activeLicenseStates: string[];
  expiringLicenses: Array<{ state: string | null; licenseNumber: string | null; expiresAt: string }>;
  hasHistoricalLicenses: boolean;
  homeState: string | null;
  compactEligibleStates: string[];
  readinessScore: number | null;
  highRiskAlerts: LifecycleAlert[];
}

export interface ProviderLifecycleResult {
  clinicianId: string;
  phase: ProviderLifecyclePhase;
  changed: boolean;
  graduationDetected: boolean;
  tasks: LicenseReadinessTask[];
  record: ProviderLifecycle;
}

interface LifecycleAlert {
  level: '90_day' | '60_day' | '30_day';
  state: string | null;
  licenseNumber: string | null;
  expiresAt: string;
  daysRemaining: number;
}

export class ProviderLifecycleEngine {
  private readonly residencyImporter: ResidencyTemplateImporter;
  private readonly retirementWorkflow: RetirementWorkflow;

  constructor(
    private readonly db: PrismaClient = prisma,
    residencyImporter?: ResidencyTemplateImporter,
    retirementWorkflow?: RetirementWorkflow,
  ) {
    this.residencyImporter = residencyImporter ?? new ResidencyTemplateImporter(db);
    this.retirementWorkflow = retirementWorkflow ?? new RetirementWorkflow(db);
  }

  async evaluateAndTransition(clinicianId: string): Promise<ProviderLifecycleResult | null> {
    if (!clinicianId) {
      throw new Error('clinicianId is required for provider lifecycle evaluation');
    }

    const context = await this.collectSignals(clinicianId);
    if (!context) {
      return null;
    }

    const nextPhase = this.derivePhase(context);
    const previous = await this.db.providerLifecycle.findFirst({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    });

    const changed = !previous || previous.phase !== nextPhase;
    const graduationDetected = Boolean(previous && previous.phase === 'training' && nextPhase !== 'training');

    let tasks: LicenseReadinessTask[] = [];
    if (graduationDetected) {
      tasks = await this.initLicenseReadinessTasks(context);
      await this.maybeImportResidencyTemplate(context);
    }

    const record = changed
      ? await this.db.providerLifecycle.create({
          data: {
            clinicianId,
            phase: nextPhase,
            metadata: this.buildMetadataSnapshot(context, tasks, previous),
          },
        })
      : previous!;

    if (!changed && tasks.length > 0) {
      await this.appendLifecycleMetadata(record.id, { licenseTasks: tasks });
    }

    if (changed && nextPhase === 'retired') {
      try {
        await this.retirementWorkflow.run(clinicianId, { prisma: this.db });
      } catch (error) {
        console.warn('[lifecycle][provider] retirement workflow failed', {
          clinicianId,
          error,
        });
      }
    }

    try {
      anchorEvent('providerLifecycleAnchored', {
        clinicianId,
        phase: nextPhase,
        recordId: record.id,
        changed,
        metadataHash: hashRecord(record.metadata),
        updatedAt: record.updatedAt.toISOString(),
        tasksIssued: tasks.length,
      });
    } catch (error) {
      console.warn('[lifecycle][provider] failed to anchor lifecycle snapshot', {
        clinicianId,
        error,
      });
    }

    return {
      clinicianId,
      phase: nextPhase,
      changed,
      graduationDetected,
      tasks,
      record: changed ? record : (await this.db.providerLifecycle.findUnique({ where: { id: record.id } })) ?? record,
    };
  }

  private async collectSignals(clinicianId: string): Promise<ProviderLifecycleSignals | null> {
    const now = new Date();
    const [clinician, fusionSnapshot, licenses, readiness, compactEligibility] = await Promise.all([
      this.db.clinicianProfile.findUnique({
        where: { id: clinicianId },
        select: {
          id: true,
          state: true,
        },
      }),
      this.db.identityFusionSnapshot.findFirst({
        where: { clinicianId },
        orderBy: { timestamp: 'desc' },
      }),
      this.db.stateLicenseVerification.findMany({
        where: { clinicianId },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      this.db.clinicianReadinessScore.findUnique({ where: { clinicianId } }),
      this.db.compactEligibility.findMany({
        where: { clinicianId, eligible: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    if (!clinician) {
      return null;
    }

    const fused = (fusionSnapshot?.fused as Prisma.JsonObject | null) ?? null;
    const graduationYear =
      typeof (fused as Record<string, unknown> | null)?.['graduationYear'] === 'number'
        ? ((fused as Record<string, unknown>)['graduationYear'] as number)
        : null;
    const yearsSinceGraduation =
      typeof graduationYear === 'number' ? differenceInCalendarYears(now, new Date(graduationYear, 0, 1)) : null;

    const activeLicenses = licenses.filter((license) => isActiveLicense(license.status));
    const activeLicenseStates = activeLicenses.map((license) => license.state).filter(Boolean) as string[];
    const expiringLicenses = licenses
      .filter((license) => {
        if (!license.expiryDate) return false;
        return isWithinDays(license.expiryDate, now, 120);
      })
      .map((license) => ({
        state: license.state,
        licenseNumber: license.licenseNumber ?? null,
        expiresAt: license.expiryDate!.toISOString(),
      }));

    const hasHistoricalLicenses = licenses.length > 0;

    return {
      clinicianId,
      now,
      graduationYear,
      yearsSinceGraduation,
      activeLicenseCount: activeLicenses.length,
      activeLicenseStates,
      expiringLicenses,
      hasHistoricalLicenses,
      homeState: clinician.state,
      compactEligibleStates: compactEligibility.map((record) => record.compact),
      readinessScore: readiness?.score ?? null,
      highRiskAlerts: buildHighRiskAlerts(licenses, now),
    };
  }

  private derivePhase(context: ProviderLifecycleSignals): ProviderLifecyclePhase {
    if (context.activeLicenseCount === 0) {
      if (context.yearsSinceGraduation === null || context.yearsSinceGraduation <= 1) {
        return 'training';
      }
      if (context.hasHistoricalLicenses && context.yearsSinceGraduation >= 10) {
        return 'retired';
      }
      return 'resident';
    }

    if (context.yearsSinceGraduation !== null && context.yearsSinceGraduation < 4) {
      return 'resident';
    }

    let phase: ProviderLifecyclePhase = 'attending';
    if (
      context.activeLicenseCount >= 3 ||
      context.compactEligibleStates.length > 0 ||
      context.activeLicenseStates.includes('IMLC')
    ) {
      phase = 'multi-state';
    }

    if (context.yearsSinceGraduation !== null && context.yearsSinceGraduation >= 25) {
      phase = 'senior';
    }

    return phase;
  }

  private async initLicenseReadinessTasks(context: ProviderLifecycleSignals): Promise<LicenseReadinessTask[]> {
    const tasks: LicenseReadinessTask[] = [];

    const now = context.now;
    if (context.homeState && !context.activeLicenseStates.includes(context.homeState)) {
      tasks.push({
        id: randomUUID(),
        clinicianId: context.clinicianId,
        state: context.homeState,
        task: `Prepare ${context.homeState} medical license application`,
        reason: 'home_state_license_missing',
        dueDate: addDays(now, 30).toISOString(),
        status: 'pending',
        createdAt: now.toISOString(),
      });
    }

    context.expiringLicenses.forEach((license) => {
      tasks.push({
        id: randomUUID(),
        clinicianId: context.clinicianId,
        state: license.state,
        task: `Renew ${license.state ?? 'primary'} license ${license.licenseNumber ?? ''}`.trim(),
        reason: 'license_expiring',
        dueDate: addDays(new Date(license.expiresAt), -14).toISOString(),
        status: 'scheduled',
        createdAt: now.toISOString(),
      });
    });

    if (context.activeLicenseCount === 0) {
      tasks.push({
        id: randomUUID(),
        clinicianId: context.clinicianId,
        state: context.homeState,
        task: 'Complete primary source verification packet',
        reason: 'psv_required',
        dueDate: addDays(now, 21).toISOString(),
        status: 'pending',
        createdAt: now.toISOString(),
      });
    }

    if (context.compactEligibleStates.length === 0 && context.activeLicenseCount >= 1) {
      tasks.push({
        id: randomUUID(),
        clinicianId: context.clinicianId,
        task: 'Start compact eligibility screening',
        reason: 'compact_expansion',
        dueDate: addDays(now, 45).toISOString(),
        status: 'pending',
        createdAt: now.toISOString(),
      });
    }

    if (tasks.length === 0) {
      return tasks;
    }

    await collectReadinessSignals(context.clinicianId, {
      prisma: this.db,
      refresh: true,
      types: ['license'],
    });
    await this.persistLicenseTasks(context.clinicianId, tasks);

    return tasks;
  }

  private async persistLicenseTasks(clinicianId: string, tasks: LicenseReadinessTask[]): Promise<void> {
    const signal = await this.db.readinessSignal.findUnique({
      where: {
        clinicianId_type: {
          clinicianId,
          type: 'license',
        },
      },
    });

    const metadata = mergeSignalMetadata(signal, {
      licenseTasks: tasks,
    });

    if (signal) {
      await this.db.readinessSignal.update({
        where: { id: signal.id },
        data: { metadata: metadata as Prisma.JsonValue },
      });
    } else {
      await this.db.readinessSignal.create({
        data: {
          clinicianId,
          type: 'license',
          score: 0.5,
          metadata: metadata as Prisma.JsonValue,
          updatedAt: new Date(),
        },
      });
    }
  }

  private async maybeImportResidencyTemplate(context: ProviderLifecycleSignals): Promise<void> {
    const level = this.estimatePgyLevel(context);
    if (!level) {
      return;
    }
    try {
      await this.residencyImporter.importTemplate({
        clinicianId: context.clinicianId,
        programName: 'Residency Automation',
        pgyLevel: level,
        prisma: this.db,
      });
    } catch (error) {
      console.warn('[lifecycle][provider] residency template import failed', {
        clinicianId: context.clinicianId,
        error,
      });
    }
  }

  private estimatePgyLevel(context: ProviderLifecycleSignals): PgyLevel | null {
    if (context.yearsSinceGraduation === null) {
      return null;
    }
    if (context.yearsSinceGraduation < 1) return 1;
    if (context.yearsSinceGraduation < 2) return 2;
    if (context.yearsSinceGraduation < 3) return 3;
    if (context.yearsSinceGraduation < 4) return 4;
    return null;
  }

  private buildMetadataSnapshot(
    context: ProviderLifecycleSignals,
    tasks: LicenseReadinessTask[],
    previous?: ProviderLifecycle | null,
  ): Prisma.JsonObject {
    return {
      evaluatedAt: context.now.toISOString(),
      graduationYear: context.graduationYear,
      yearsSinceGraduation: context.yearsSinceGraduation,
      activeLicenseCount: context.activeLicenseCount,
      activeLicenseStates: context.activeLicenseStates,
      expiringLicenses: context.expiringLicenses,
      compactEligibleStates: context.compactEligibleStates,
      readinessScore: context.readinessScore,
      previousPhase: previous?.phase ?? null,
      licenseTasks: tasks,
      highRiskAlerts: context.highRiskAlerts,
    };
  }

  private async appendLifecycleMetadata(
    lifecycleId: string,
    patch: Record<string, unknown>,
  ): Promise<ProviderLifecycle | null> {
    const record = await this.db.providerLifecycle.findUnique({ where: { id: lifecycleId } });
    if (!record) {
      return null;
    }
    const metadata = mergeSignalMetadata(record, patch);
    return this.db.providerLifecycle.update({
      where: { id: lifecycleId },
      data: { metadata: metadata as Prisma.JsonValue },
    });
  }
}

function isActiveLicense(status?: string | null): boolean {
  if (!status) return false;
  const normalized = status.toUpperCase();
  return ['ACTIVE', 'CLEAR', 'CURRENT', 'VERIFIED'].some((value) => normalized.includes(value));
}

function isWithinDays(target: Date, now: Date, windowDays: number): boolean {
  const diff = differenceInCalendarDays(target, now);
  return diff >= 0 && diff <= windowDays;
}

function mergeSignalMetadata(
  record: Pick<ReadinessSignal, 'metadata'> | ProviderLifecycle | null,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    record && record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
      ? (record.metadata as Record<string, unknown>)
      : {};
  return {
    ...base,
    ...patch,
  };
}

function buildHighRiskAlerts(
  licenses: Array<{ expiryDate: Date | null; state: string | null; licenseNumber: string | null }>,
  now: Date,
): LifecycleAlert[] {
  const alerts: LifecycleAlert[] = [];
  const thresholds: Array<{ days: 90 | 60 | 30; level: LifecycleAlert['level'] }> = [
    { days: 90, level: '90_day' },
    { days: 60, level: '60_day' },
    { days: 30, level: '30_day' },
  ];

  licenses.forEach((license) => {
    if (!license.expiryDate) return;
    const daysRemaining = differenceInCalendarDays(license.expiryDate, now);
    thresholds.forEach((threshold) => {
      if (daysRemaining >= 0 && daysRemaining <= threshold.days) {
        alerts.push({
          level: threshold.level,
          state: license.state,
          licenseNumber: license.licenseNumber,
          expiresAt: license.expiryDate!.toISOString(),
          daysRemaining,
        });
      }
    });
  });

  return alerts;
}

function hashRecord(metadata: Prisma.JsonValue | null): string {
  return createHash('sha256').update(JSON.stringify(metadata ?? {})).digest('hex');
}


