import { randomUUID } from 'crypto';
import type { CredentialVitalSign } from '@prisma/client';
import type { VitalStatus } from '../health/vitals';

export type HealthAlertAudience = 'recruiter' | 'issuer' | 'clinician';
export type HealthAlertSeverity = 'warning' | 'critical';

export interface HealthAlert {
  id: string;
  clinicianId: string;
  audience: HealthAlertAudience;
  severity: HealthAlertSeverity;
  subject: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface HealthAlertRecipients {
  recruiters: string[];
  issuers: string[];
  clinician?: string;
}

export interface HealthAlertContext {
  clinicianId: string;
  vitals: Array<Pick<CredentialVitalSign, 'component' | 'status' | 'details'>>;
  previousScore?: number;
  currentScore: number;
  recipients: HealthAlertRecipients;
}

const COMPONENT_LABELS: Record<string, string> = {
  license: 'State license',
  board: 'Board certification',
  sanctions: 'Sanctions monitoring',
  npdb: 'NPDB watchlist',
  dea: 'DEA credential',
};

export function evaluateHealthAlerts(context: HealthAlertContext): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  const drop =
    typeof context.previousScore === 'number'
      ? context.currentScore - context.previousScore
      : 0;
  const scoreDropTriggered = drop <= -0.15;
  const criticalVitals = context.vitals.filter((vital) => vital.status === 'critical');

  if (!criticalVitals.length && !scoreDropTriggered) {
    return alerts;
  }

  for (const vital of criticalVitals) {
    alerts.push(
      ...notifyAll({
        clinicianId: context.clinicianId,
        audience: context.recipients,
        severity: 'critical',
        subject: `${componentLabel(vital.component)} moved to CRITICAL`,
        message: `Component ${componentLabel(vital.component)} is blocking readiness. Details: ${summarizeDetails(vital.details)}.`,
        metadata: {
          component: vital.component,
          status: vital.status,
          details: vital.details,
        },
      }),
    );
  }

  if (scoreDropTriggered) {
    alerts.push(
      ...notifyAll({
        clinicianId: context.clinicianId,
        audience: context.recipients,
        severity: 'warning',
        subject: 'Credential health score dropped sharply',
        message: `Health score decreased ${(Math.abs(drop) * 100).toFixed(
          1,
        )} pts to ${(context.currentScore * 100).toFixed(1)}%.`,
        metadata: {
          previousScore: context.previousScore ?? null,
          currentScore: context.currentScore,
        },
      }),
    );
  }

  return dedupeAlerts(alerts);
}

function notifyAll(input: {
  clinicianId: string;
  audience: HealthAlertRecipients;
  severity: HealthAlertSeverity;
  subject: string;
  message: string;
  metadata?: Record<string, unknown>;
}): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  for (const recruiter of input.audience.recruiters ?? []) {
    alerts.push(
      createAlert({
        clinicianId: input.clinicianId,
        audience: 'recruiter',
        severity: input.severity,
        subject: input.subject,
        message: input.message,
        metadata: { ...input.metadata, recipientId: recruiter },
      }),
    );
  }

  for (const issuer of input.audience.issuers ?? []) {
    alerts.push(
      createAlert({
        clinicianId: input.clinicianId,
        audience: 'issuer',
        severity: input.severity,
        subject: input.subject,
        message: input.message,
        metadata: { ...input.metadata, recipientId: issuer },
      }),
    );
  }

  if (input.audience.clinician) {
    alerts.push(
      createAlert({
        clinicianId: input.clinicianId,
        audience: 'clinician',
        severity: input.severity,
        subject: input.subject,
        message: input.message,
        metadata: { ...input.metadata, recipientId: input.audience.clinician },
      }),
    );
  }

  return alerts;
}

function createAlert(details: Omit<HealthAlert, 'id' | 'createdAt'>): HealthAlert {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...details,
  };
}

function dedupeAlerts(alerts: HealthAlert[]): HealthAlert[] {
  const unique = new Map<string, HealthAlert>();
  for (const alert of alerts) {
    const key = `${alert.audience}:${alert.subject}:${alert.severity}`;
    if (!unique.has(key)) {
      unique.set(key, alert);
    }
  }
  return Array.from(unique.values());
}

function componentLabel(component: string): string {
  return COMPONENT_LABELS[component] ?? component;
}

function summarizeDetails(details: CredentialVitalSign['details']): string {
  if (!details) return 'See dashboard for more info.';
  try {
    return JSON.stringify(details);
  } catch (error) {
    return 'See dashboard for more info.';
  }
}










