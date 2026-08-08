/**
 * Clinician notification preferences — routing, never permission.
 *
 * Shape mirrors what `Watchlist` already established for org-scoped alerting
 * (channels + severity floor + suppression window) rather than inventing a
 * second vocabulary for the same idea.
 *
 * The distinction that must not blur: a preference decides *which* permitted
 * messages get routed and how often. Whether VitalCV may contact this person
 * at all lives only in the consent ledger. Turning the severity floor down to
 * INFO is not permission; revoking consent is not a preference.
 */
import { prisma } from '@/lib/db';

export const NOTIFICATION_SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

/** Ordering for floor comparisons. Higher wins. */
export const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export interface ClinicianNotificationPreferenceView {
  channels: string[];
  severityFloor: NotificationSeverity;
  suppressionWindowMinutes: number;
  active: boolean;
  /** True when no row exists yet and these are the defaults. */
  isDefault: boolean;
}

/**
 * Defaults chosen so an absent row is conservative: HIGH floor means routine
 * informational churn never reaches anyone, and a 24h suppression window
 * means a daily sweep cannot mail the same finding daily.
 */
export const DEFAULT_PREFERENCE: ClinicianNotificationPreferenceView = {
  channels: ['EMAIL'],
  severityFloor: 'HIGH',
  suppressionWindowMinutes: 1440,
  active: true,
  isDefault: true,
};

const MIN_SUPPRESSION_MINUTES = 60;
const MAX_SUPPRESSION_MINUTES = 20160; // 14 days

export function isNotificationSeverity(value: unknown): value is NotificationSeverity {
  return typeof value === 'string' && (NOTIFICATION_SEVERITIES as readonly string[]).includes(value);
}

/**
 * Clamp rather than reject: a preference is a comfort setting, and a caller
 * asking for a 5-minute window gets the floor instead of an error. The
 * bounds exist so a preference cannot turn the sweep into a mail loop.
 */
export function clampSuppressionMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PREFERENCE.suppressionWindowMinutes;
  return Math.min(MAX_SUPPRESSION_MINUTES, Math.max(MIN_SUPPRESSION_MINUTES, Math.round(value)));
}

export async function readNotificationPreference(
  clinicianNpi: string,
): Promise<ClinicianNotificationPreferenceView> {
  const row = await prisma.clinicianNotificationPreference.findUnique({
    where: { clinicianNpi },
  });
  if (!row) return { ...DEFAULT_PREFERENCE };
  return {
    channels: row.channels,
    severityFloor: isNotificationSeverity(row.severityFloor)
      ? row.severityFloor
      : DEFAULT_PREFERENCE.severityFloor,
    suppressionWindowMinutes: row.suppressionWindowMinutes,
    active: row.active,
    isDefault: false,
  };
}

export interface UpdatePreferenceInput {
  clinicianNpi: string;
  severityFloor?: NotificationSeverity;
  suppressionWindowMinutes?: number;
  active?: boolean;
}

export async function updateNotificationPreference(
  input: UpdatePreferenceInput,
): Promise<{ persisted: boolean; preference: ClinicianNotificationPreferenceView }> {
  const current = await readNotificationPreference(input.clinicianNpi);
  const next = {
    severityFloor: input.severityFloor ?? current.severityFloor,
    suppressionWindowMinutes:
      input.suppressionWindowMinutes !== undefined
        ? clampSuppressionMinutes(input.suppressionWindowMinutes)
        : current.suppressionWindowMinutes,
    active: input.active ?? current.active,
  };

  try {
    const row = await prisma.clinicianNotificationPreference.upsert({
      where: { clinicianNpi: input.clinicianNpi },
      create: { clinicianNpi: input.clinicianNpi, ...next },
      update: next,
    });
    return {
      persisted: true,
      preference: {
        channels: row.channels,
        severityFloor: next.severityFloor,
        suppressionWindowMinutes: row.suppressionWindowMinutes,
        active: row.active,
        isDefault: false,
      },
    };
  } catch {
    return { persisted: false, preference: current };
  }
}
