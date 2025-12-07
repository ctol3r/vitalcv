import { differenceInCalendarDays, subDays } from 'date-fns';
import {
  Prisma,
  PrismaClient,
  ProviderLifecycle,
  StateLicenseVerification,
  DEACredential,
} from '@prisma/client';
import { PrismaClient as DefaultClient } from '@prisma/client';
import { LifecycleWatcher, type LifecycleWatchFinding } from './watcher';

const prisma = new DefaultClient();

export type RenewalTimelineCategory = 'license' | 'cme' | 'dea' | 'readiness';

export type RenewalTimelineSeverity = 'low' | 'medium' | 'high';

export type RenewalTimelineStatus = 'upcoming' | 'due_now' | 'overdue';

export interface RenewalTimelineEvent {
  id: string;
  clinicianId: string;
  category: RenewalTimelineCategory;
  label: string;
  dueDate: string;
  severity: RenewalTimelineSeverity;
  status: RenewalTimelineStatus;
  windowStart?: string | null;
  windowEnd?: string | null;
  metadata?: Record<string, unknown>;
}

export interface LifecycleAlert {
  id: string;
  clinicianId: string;
  level: '90_day' | '60_day' | '30_day' | 'overdue';
  component: RenewalTimelineCategory;
  label: string;
  dueDate: string;
  daysRemaining: number;
  severity: RenewalTimelineSeverity;
  metadata?: Record<string, unknown>;
}

export interface RenewalTimelineSnapshot {
  clinicianId: string;
  generatedAt: string;
  cycleSummary: {
    licenseCount: number;
    expiringWithin90: number;
    nextLicenseDue: string | null;
    cmeHoursRemaining: number | null;
    nextCmeDue: string | null;
    deaExpiresAt: string | null;
    lifecyclePhase: string | null;
  };
  events: RenewalTimelineEvent[];
  alerts: LifecycleAlert[];
}

interface BuildOptions {
  now?: Date;
  prisma?: PrismaClient;
}

export class RenewalTimelineBuilder {
  private readonly watcher: LifecycleWatcher;

  constructor(private readonly db: PrismaClient = prisma, watcher?: LifecycleWatcher) {
    this.watcher = watcher ?? new LifecycleWatcher(db);
  }

  async build(clinicianId: string, options: BuildOptions = {}): Promise<RenewalTimelineSnapshot> {
    const now = options.now ?? new Date();
    const client = options.prisma ?? this.db;

    const [licenses, deaCredential, lifecycleRecord, watcherFindings] = await Promise.all([
      client.stateLicenseVerification.findMany({
        where: { clinicianId },
        orderBy: { expiryDate: 'asc' },
        take: 75,
      }),
      client.dEACredential.findFirst({
        where: { clinicianId },
        orderBy: { updatedAt: 'desc' },
      }),
      client.providerLifecycle.findFirst({
        where: { clinicianId },
        orderBy: { updatedAt: 'desc' },
      }),
      this.watcher.run({ clinicianId, now }),
    ]);

    const events: RenewalTimelineEvent[] = [];
    const alerts: LifecycleAlert[] = [];

    const licenseEvents = this.buildLicenseEvents(clinicianId, licenses, now);
    events.push(...licenseEvents.events);
    alerts.push(...licenseEvents.alerts);

    const deaEvents = this.buildDeaEvents(clinicianId, deaCredential, now);
    events.push(...deaEvents.events);
    alerts.push(...deaEvents.alerts);

    const cmeEvent = this.buildCmeEvent(clinicianId, watcherFindings);
    if (cmeEvent) {
      events.push(cmeEvent.event);
      if (cmeEvent.alert) {
        alerts.push(cmeEvent.alert);
      }
    }

    const dedupedEvents = dedupeById(events).sort(sortByDueDate);
    const dedupedAlerts = dedupeById(alerts).sort((a, b) => a.daysRemaining - b.daysRemaining);

    const cycleSummary = this.buildCycleSummary({
      clinicianId,
      licenses,
      dea: deaCredential,
      lifecycle: lifecycleRecord,
      cmeEvent,
      now,
    });

    return {
      clinicianId,
      generatedAt: now.toISOString(),
      cycleSummary,
      events: dedupedEvents,
      alerts: dedupedAlerts,
    };
  }

  private buildLicenseEvents(
    clinicianId: string,
    licenses: StateLicenseVerification[],
    now: Date,
  ): { events: RenewalTimelineEvent[]; alerts: LifecycleAlert[] } {
    const events: RenewalTimelineEvent[] = [];
    const alerts: LifecycleAlert[] = [];

    for (const license of licenses) {
      if (!license.expiryDate) {
        continue;
      }
      const expiresAt = license.expiryDate;
      const daysRemaining = differenceInCalendarDays(expiresAt, now);
      const metadata = {
        state: license.state,
        licenseNumber: license.licenseNumber,
        status: license.status,
        source: license.source,
        expiresAt: expiresAt.toISOString(),
      };

      events.push({
        id: `license:${license.id}:expire`,
        clinicianId,
        category: 'license',
        label: `${license.state ?? 'License'} renewal deadline`,
        dueDate: expiresAt.toISOString(),
        severity: daysRemaining <= 30 ? 'high' : daysRemaining <= 60 ? 'medium' : 'low',
        status: resolveStatus(daysRemaining),
        metadata,
      });

      ([90, 60, 30] as const).forEach((window) => {
        const reminderDate = subDays(expiresAt, window);
        if (reminderDate.getTime() < 0) {
          return;
        }
        const reminderDays = differenceInCalendarDays(reminderDate, now);
        events.push({
          id: `license:${license.id}:${window}`,
          clinicianId,
          category: 'license',
          label: `${license.state ?? 'License'} packet (${window}d out)`,
          dueDate: reminderDate.toISOString(),
          severity: window <= 30 ? 'high' : window <= 60 ? 'medium' : 'low',
          status: resolveStatus(reminderDays),
          windowEnd: expiresAt.toISOString(),
          metadata: {
            ...metadata,
            windowDays: window,
          },
        });

        if (daysRemaining >= 0 && daysRemaining <= window) {
          alerts.push({
            id: `alert:license:${license.id}:${window}`,
            clinicianId,
            level: (`${window}_day` as LifecycleAlert['level']),
            component: 'license',
            label: `${license.state ?? 'License'} renewal due in ${daysRemaining} days`,
            dueDate: expiresAt.toISOString(),
            daysRemaining,
            severity: window <= 30 ? 'high' : window <= 60 ? 'medium' : 'low',
            metadata,
          });
        }
      });

      if (daysRemaining < 0) {
        alerts.push({
          id: `alert:license:${license.id}:overdue`,
          clinicianId,
          level: 'overdue',
          component: 'license',
          label: `${license.state ?? 'License'} renewal lapsed`,
          dueDate: expiresAt.toISOString(),
          daysRemaining,
          severity: 'high',
          metadata,
        });
      }
    }

    return { events, alerts };
  }

  private buildDeaEvents(
    clinicianId: string,
    dea: DEACredential | null,
    now: Date,
  ): { events: RenewalTimelineEvent[]; alerts: LifecycleAlert[] } {
    if (!dea) {
      return { events: [], alerts: [] };
    }

    const events: RenewalTimelineEvent[] = [];
    const alerts: LifecycleAlert[] = [];
    const metadata = {
      deaNumber: dea.deaNumber,
      mateHours: dea.mateHours,
      expiresAt: dea.expiration.toISOString(),
    };
    const daysRemaining = differenceInCalendarDays(dea.expiration, now);

    events.push({
      id: `dea:${dea.id}:expire`,
      clinicianId,
      category: 'dea',
      label: 'DEA renewal deadline',
      dueDate: dea.expiration.toISOString(),
      severity: daysRemaining <= 30 ? 'high' : daysRemaining <= 60 ? 'medium' : 'low',
      status: resolveStatus(daysRemaining),
      metadata,
    });

    ([90, 60, 30] as const).forEach((window) => {
      const reminderDate = subDays(dea.expiration, window);
      const reminderDays = differenceInCalendarDays(reminderDate, now);
      events.push({
        id: `dea:${dea.id}:${window}`,
        clinicianId,
        category: 'dea',
        label: `DEA renewal prep (${window}d)`,
        dueDate: reminderDate.toISOString(),
        severity: window <= 30 ? 'high' : window <= 60 ? 'medium' : 'low',
        status: resolveStatus(reminderDays),
        windowEnd: dea.expiration.toISOString(),
        metadata: {
          ...metadata,
          windowDays: window,
        },
      });

      if (daysRemaining >= 0 && daysRemaining <= window) {
        alerts.push({
          id: `alert:dea:${dea.id}:${window}`,
          clinicianId,
          level: (`${window}_day` as LifecycleAlert['level']),
          component: 'dea',
          label: `DEA renewal due in ${daysRemaining} days`,
          dueDate: dea.expiration.toISOString(),
          daysRemaining,
          severity: window <= 30 ? 'high' : window <= 60 ? 'medium' : 'low',
          metadata,
        });
      }
    });

    if (daysRemaining < 0) {
      alerts.push({
        id: `alert:dea:${dea.id}:overdue`,
        clinicianId,
        level: 'overdue',
        component: 'dea',
        label: 'DEA credential expired',
        dueDate: dea.expiration.toISOString(),
        daysRemaining,
        severity: 'high',
        metadata,
      });
    }

    return { events, alerts };
  }

  private buildCmeEvent(
    clinicianId: string,
    findings: LifecycleWatchFinding[],
  ):
    | { event: RenewalTimelineEvent; alert?: LifecycleAlert }
    | null {
    const cmeFinding =
      findings.find((finding) => finding.type === 'cme_overdue') ??
      findings.find((finding) => finding.type === 'cme_due');

    if (!cmeFinding) {
      return null;
    }

    const severity = cmeFinding.type === 'cme_overdue' ? 'high' : 'medium';
    const status = cmeFinding.type === 'cme_overdue' ? 'overdue' : 'upcoming';
    const hoursRemaining =
      typeof cmeFinding.metadata?.hoursRemaining === 'number'
        ? cmeFinding.metadata.hoursRemaining
        : null;

    const event: RenewalTimelineEvent = {
      id: `cme:${cmeFinding.credentialId ?? cmeFinding.occursAt}`,
      clinicianId,
      category: 'cme',
      label:
        cmeFinding.type === 'cme_overdue'
          ? 'CME attestation overdue'
          : 'CME attestation window',
      dueDate: cmeFinding.occursAt,
      severity,
      status,
      metadata: {
        hoursRemaining,
        category: cmeFinding.metadata?.category ?? null,
        findingId: cmeFinding.credentialId,
      },
    };

    const alert: LifecycleAlert | undefined =
      hoursRemaining !== null
        ? {
            id: `alert:cme:${cmeFinding.credentialId ?? cmeFinding.occursAt}`,
            clinicianId,
            level: cmeFinding.type === 'cme_overdue' ? 'overdue' : '30_day',
            component: 'cme',
            label:
              cmeFinding.type === 'cme_overdue'
                ? `CME overdue (${hoursRemaining} hrs remaining)`
                : `CME due soon (${hoursRemaining} hrs remaining)`,
            dueDate: cmeFinding.occursAt,
            daysRemaining:
              typeof cmeFinding.metadata?.daysRemaining === 'number'
                ? cmeFinding.metadata.daysRemaining
                : typeof cmeFinding.metadata?.daysOverdue === 'number'
                  ? -Math.abs(cmeFinding.metadata.daysOverdue)
                  : 0,
            severity,
            metadata: event.metadata,
          }
        : undefined;

    return { event, alert };
  }

  private buildCycleSummary(params: {
    clinicianId: string;
    licenses: StateLicenseVerification[];
    dea: DEACredential | null;
    lifecycle: ProviderLifecycle | null;
    cmeEvent: ReturnType<RenewalTimelineBuilder['buildCmeEvent']>;
    now: Date;
  }): RenewalTimelineSnapshot['cycleSummary'] {
    const { licenses, dea, lifecycle, cmeEvent, now } = params;
    const upcomingLicenses = licenses
      .filter((license) => license.expiryDate)
      .map((license) => ({
        expiresAt: license.expiryDate!,
        daysRemaining: differenceInCalendarDays(license.expiryDate!, now),
      }))
      .filter((entry) => entry.daysRemaining >= -365)
      .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());

    const nextLicenseDue = upcomingLicenses[0]?.expiresAt ?? null;
    const expiringWithin90 = upcomingLicenses.filter((entry) => entry.daysRemaining <= 90 && entry.daysRemaining >= 0)
      .length;
    const cmeHoursRemaining =
      (cmeEvent?.event.metadata?.hoursRemaining as number | null | undefined) ?? null;

    return {
      licenseCount: licenses.length,
      expiringWithin90,
      nextLicenseDue: nextLicenseDue ? nextLicenseDue.toISOString() : null,
      cmeHoursRemaining,
      nextCmeDue: cmeEvent?.event.dueDate ?? null,
      deaExpiresAt: dea ? dea.expiration.toISOString() : null,
      lifecyclePhase: lifecycle?.phase ?? null,
    };
  }
}

function resolveStatus(daysRemaining: number): RenewalTimelineStatus {
  if (daysRemaining < 0) {
    return 'overdue';
  }
  if (daysRemaining === 0) {
    return 'due_now';
  }
  return 'upcoming';
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.set(item.id, item);
    }
  }
  return Array.from(seen.values());
}

function sortByDueDate(a: RenewalTimelineEvent, b: RenewalTimelineEvent): number {
  const delta = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  if (delta === 0) {
    return a.id.localeCompare(b.id);
  }
  return delta;
}


