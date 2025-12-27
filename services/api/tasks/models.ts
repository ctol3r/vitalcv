/**
 * B310A-API-TASKS: Lifecycle-driven renewal task models
 *
 * Turns lifecycle projections into credential-linked renewal tasks and
 * exports iCalendar feeds for scheduling/automation.
 */

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FutureStateProbabilities } from '../../lifecycle/model/transitionModel.js';

/**
 * Task status values for renewal actions.
 */
export const RenewalTaskStatusSchema = z.enum([
  'PENDING',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'BLOCKED',
]);

export type RenewalTaskStatus = z.infer<typeof RenewalTaskStatusSchema>;

/**
 * Minimal credential context needed to tie tasks back to credentials.
 */
export const CredentialRenewalContextSchema = z.object({
  credentialId: z.string().min(1),
  credentialType: z.string().min(1),
  expiresAt: z.coerce.date(),
  ownerId: z.string().optional(),
  lastRenewedAt: z.coerce.date().optional(),
});

export type CredentialRenewalContext = z.infer<
  typeof CredentialRenewalContextSchema
>;

/**
 * Renewal task model.
 */
export const RenewalTaskSchema = z.object({
  id: z.string(),
  clinicianId: z.string(),
  credentialId: z.string(),
  credentialType: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  status: RenewalTaskStatusSchema,
  priority: z.number().int().min(1).max(10),
  dueDate: z.coerce.date(),
  scheduledWindowEnd: z.coerce.date().optional(),
  triggeredBy: z.enum(['lifecycle_engine', 'manual', 'policy']),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type RenewalTask = z.infer<typeof RenewalTaskSchema>;

export interface LifecycleRenewalGenerationInput {
  clinicianId: string;
  projection: FutureStateProbabilities;
  credentials: CredentialRenewalContext[];
  leadTimeDays?: number;
}

export interface CredentialTaskLink {
  credentialId: string;
  credentialType: string;
  ownerId?: string;
  nextDueDate: Date;
  highestPriority: number;
  tasks: RenewalTask[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Generate renewal tasks from lifecycle projections.
 */
export function generateRenewalTasksFromLifecycle(
  input: LifecycleRenewalGenerationInput
): RenewalTask[] {
  const { clinicianId, projection, credentials, leadTimeDays = 45 } = input;

  const baseLead = Math.max(leadTimeDays, 7); // never schedule less than 1 week ahead
  const now = new Date();
  const tasks: RenewalTask[] = [];

  for (const credential of credentials) {
    const context = CredentialRenewalContextSchema.parse(credential);

    const riskScore = Math.max(
      projection.risk.credentialLapseRisk,
      projection.risk.licenseExpiryRisk
    );
    const horizon = projection.horizons.days90 ?? projection.horizons.days180;
    const additionalLead = Math.round(riskScore * 20); // push earlier when risk is high
    const dueDate = new Date(
      context.expiresAt.getTime() - (baseLead + additionalLead) * DAY_MS
    );
    const safeDueDate = dueDate.getTime() < now.getTime() ? now : dueDate;
    const windowEnd = new Date(
      safeDueDate.getTime() + Math.max(7, 14 - additionalLead) * DAY_MS
    );
    const priority = Math.min(10, 5 + Math.round(riskScore * 5));

    const task: RenewalTask = RenewalTaskSchema.parse({
      id: `renewal-${context.credentialId}-${randomUUID()}`,
      clinicianId,
      credentialId: context.credentialId,
      credentialType: context.credentialType,
      summary: `Renew ${context.credentialType} credential`,
      description: `Generated from lifecycle projection at ${projection.projectedAt.toISOString()} with risk score ${(riskScore * 100).toFixed(0)}%.`,
      status: 'PENDING',
      priority,
      dueDate: safeDueDate,
      scheduledWindowEnd: windowEnd,
      triggeredBy: 'lifecycle_engine',
      metadata: {
        riskScore,
        projectedAt: projection.projectedAt,
        horizon,
        lifecycleRisk: projection.risk,
        expiresAt: context.expiresAt,
        lastRenewedAt: context.lastRenewedAt,
      },
      createdAt: now,
      updatedAt: now,
    });

    tasks.push(task);
  }

  return tasks;
}

/**
 * Link renewal tasks to credentials for quick lookup/queries.
 */
export function linkTasksToCredentials(
  tasks: RenewalTask[],
  credentials: CredentialRenewalContext[]
): CredentialTaskLink[] {
  const credentialIndex = new Map(
    credentials.map((cred) => [cred.credentialId, cred])
  );
  const links = new Map<string, CredentialTaskLink>();

  for (const task of tasks) {
    const credential = credentialIndex.get(task.credentialId);
    if (!credential) {
      continue;
    }

    const existing = links.get(task.credentialId);
    if (!existing) {
      links.set(task.credentialId, {
        credentialId: credential.credentialId,
        credentialType: credential.credentialType,
        ownerId: credential.ownerId,
        nextDueDate: task.dueDate,
        highestPriority: task.priority,
        tasks: [task],
      });
      continue;
    }

    existing.tasks.push(task);
    existing.highestPriority = Math.max(existing.highestPriority, task.priority);
    if (task.dueDate.getTime() < existing.nextDueDate.getTime()) {
      existing.nextDueDate = task.dueDate;
    }
  }

  return Array.from(links.values()).sort(
    (a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime()
  );
}

export interface CalendarExportOptions {
  calendarName?: string;
  productId?: string;
  defaultDurationMinutes?: number;
}

/**
 * Export renewal tasks as an ICS calendar.
 */
export function exportRenewalTasksToICS(
  tasks: RenewalTask[],
  options: CalendarExportOptions = {}
): string {
  const prodId = options.productId ?? 'VitalCV-Lifecycle';
  const calendarName = options.calendarName ?? 'Credential Renewals';
  const defaultDurationMinutes = options.defaultDurationMinutes ?? 30;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//VitalCV//${prodId}//EN`,
    `NAME:${escapeICSText(calendarName)}`,
    `X-WR-CALNAME:${escapeICSText(calendarName)}`,
  ];

  const nowStamp = formatICSDate(new Date());

  for (const task of tasks) {
    const start = formatICSDate(task.dueDate);
    const end = formatICSDate(
      task.scheduledWindowEnd ??
        new Date(task.dueDate.getTime() + defaultDurationMinutes * 60 * 1000)
    );

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeICSText(task.id)}@vitalcv`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART:${start}`);
    lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${escapeICSText(task.summary)}`);
    if (task.description) {
      lines.push(`DESCRIPTION:${escapeICSText(task.description)}`);
    }
    lines.push(
      `STATUS:${task.status === 'COMPLETED' ? 'COMPLETED' : 'CONFIRMED'}`
    );
    lines.push(
      `CATEGORIES:${escapeICSText(`Credential Renewal,${task.credentialType}`)}`
    );
    lines.push(
      `URL:${escapeICSText(`/credentials/${task.credentialId}/renewal`)}`
    );
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}
