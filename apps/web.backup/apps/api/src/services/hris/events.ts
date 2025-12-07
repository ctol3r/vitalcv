import { EventEmitter } from 'node:events';
import { PrismaClient } from '@prisma/client';
import { WorkdayOnboardingConnectorV2 } from './workday';
import { UkgShiftEligibilitySync } from './ukg';
import { AdpProfileSyncService } from './adp';
import { OracleIdentityProvisioner } from './oracle';
import type { HrisConnectorOptions, HrisConnectionRecord } from './types';
import { normalizeVendorType } from './types';
import { recordHrisSyncLog } from './logs';

export type HrisDomainEvent =
  | {
      type: 'hiring';
      clinicianId: string;
      orgId: string;
      metadata?: Record<string, unknown>;
    }
  | {
    type: 'termination';
    clinicianId: string;
    orgId: string;
    metadata?: Record<string, unknown>;
  };

type HrisEventHandler = (event: HrisDomainEvent) => void;

const emitter = new EventEmitter();

export function emitHrisEvent(event: HrisDomainEvent) {
  emitter.emit('hris:event', event);
}

export function onHrisEvent(handler: HrisEventHandler) {
  emitter.on('hris:event', handler);
  return () => emitter.off('hris:event', handler);
}

export class HrisEventListener {
  private readonly prisma: PrismaClient;

  private readonly options: HrisConnectorOptions;

  private unsubscribe?: () => void;

  constructor(options: HrisConnectorOptions = {}) {
    this.prisma = options.prisma ?? new PrismaClient();
    this.options = { ...options, prisma: this.prisma };
  }

  start() {
    if (this.unsubscribe) {
      return;
    }
    const handler: HrisEventHandler = (event) => {
      void this.handleEvent(event).catch((error) => console.warn('[hris][listener] failed', error));
    };
    this.unsubscribe = onHrisEvent(handler);
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  private async handleEvent(event: HrisDomainEvent) {
    const profile = await this.prisma.clinicianProfile.findUnique({
      where: { id: event.clinicianId },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!profile) {
      console.warn('[hris][listener] clinician missing', event.clinicianId);
      return;
    }

    if (event.type === 'hiring') {
      await this.handleHiringEvent(event, profile);
    } else {
      await this.handleTerminationEvent(event);
    }
  }

  private async handleHiringEvent(
    event: Extract<HrisDomainEvent, { type: 'hiring' }>,
    profile: { id: string; user?: { name?: string | null; email?: string | null } | null; orgId?: string | null; specialty?: string | null; location?: string | null },
  ) {
    const [workday, ukg, adp, oracle] = await Promise.all([
      this.findConnection(event.orgId, 'workday'),
      this.findConnection(event.orgId, 'ukg'),
      this.findConnection(event.orgId, 'adp'),
      this.findConnection(event.orgId, 'oracle'),
    ]);

    const onboardingTasks: Promise<unknown>[] = [];

    if (workday) {
      const connector = new WorkdayOnboardingConnectorV2(workday, this.options);
      onboardingTasks.push(
        connector.onboardWorker({
          clinicianId: profile.id,
          orgId: event.orgId,
          jobId: typeof event.metadata?.jobId === 'string' ? event.metadata.jobId : undefined,
          profile: {
            fullName: profile.user?.name ?? profile.id,
            email: profile.user?.email ?? undefined,
            specialty: profile.specialty ?? undefined,
            location: profile.location ?? undefined,
          },
          access: {
            ehrRole: typeof event.metadata?.ehrRole === 'string' ? event.metadata.ehrRole : undefined,
            badgeLevel: deriveBadgeLevel(event.metadata?.badgeLevel),
          },
          metadata: event.metadata ?? {},
        }),
      );
    }

    if (adp) {
      const connector = new AdpProfileSyncService(adp, this.options);
      onboardingTasks.push(connector.syncProfile({ clinicianId: profile.id, orgId: event.orgId }));
    }

    if (oracle) {
      const connector = new OracleIdentityProvisioner(oracle, this.options);
      onboardingTasks.push(
        connector.provision({
          clinicianId: profile.id,
          orgId: event.orgId,
          roles: Array.isArray(event.metadata?.roles)
            ? (event.metadata?.roles as string[])
            : ['clinician'],
          location: profile.location ?? undefined,
        }),
      );
    }

    if (ukg && typeof event.metadata?.shiftId === 'string') {
      const connector = new UkgShiftEligibilitySync(ukg, this.options);
      onboardingTasks.push(
        connector.syncCompactEligibility({
          shiftId: event.metadata.shiftId,
          orgId: event.orgId,
        }),
      );
    }

    await Promise.allSettled(onboardingTasks);
  }

  private async handleTerminationEvent(event: Extract<HrisDomainEvent, { type: 'termination' }>) {
    recordHrisSyncLog({
      orgId: event.orgId,
      vendor: 'workday',
      action: 'hris.termination',
      status: 'partial',
      attempts: 1,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      message: 'Termination event captured; downstream deprovision pending',
      metadata: {
        clinicianId: event.clinicianId,
      },
    });
  }

  private async findConnection(orgId: string, vendor: string): Promise<HrisConnectionRecord | null> {
    const record = await this.prisma.hRISConnection.findFirst({
      where: {
        orgId,
        type: {
          equals: vendor,
          mode: 'insensitive',
        },
      },
    });
    if (!record) {
      return null;
    }
    return {
      id: record.id,
      orgId: record.orgId,
      type: normalizeVendorType(record.type),
      endpoint: record.endpoint,
      secret: record.secret,
    };
  }
}

function deriveBadgeLevel(value: unknown): 'visitor' | 'contractor' | 'employee' | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (normalized === 'visitor' || normalized === 'contractor' || normalized === 'employee') {
    return normalized;
  }
  return undefined;
}



