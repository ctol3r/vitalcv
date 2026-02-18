/**
 * PSV Window Engine — Wave S
 *
 * Implements NCQA-compliant PSV (Primary Source Verification) window
 * tracking with deadline enforcement and warning emission.
 *
 * Window rules:
 *   - NCQA standard mode: 120 calendar days
 *   - Expedited mode:      90 calendar days
 *
 * Compliance check:
 *   psvWindowCompliant = psvCompletedAt <= psvWindowDeadline
 *
 * Warning thresholds:
 *   - 14 days before deadline: emit "psv-window-warning"
 *   - Past deadline:           emit "psv-window-breach"
 *
 * Deterministic date math only. No randomness. No external SaaS.
 */

import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

// ── Constants ────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;
const NCQA_WINDOW_DAYS = 120;
const EXPEDITED_WINDOW_DAYS = 90;
const WARNING_THRESHOLD_DAYS = 14;

export type PSVMode = 'ncqa' | 'expedited';

// ── Deadline computation ─────────────────────────────────────

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function daysRemaining(deadline: Date, now: Date): number {
  return Math.ceil((deadline.getTime() - now.getTime()) / MS_PER_DAY);
}

export function computePSVDeadline(windowStart: Date, mode: PSVMode): Date {
  const windowDays = mode === 'expedited' ? EXPEDITED_WINDOW_DAYS : NCQA_WINDOW_DAYS;
  return addDays(windowStart, windowDays);
}

export function checkPSVCompliance(
  psvCompletedAt: Date | null,
  psvWindowDeadline: Date,
): boolean | null {
  if (psvCompletedAt === null) return null;
  return psvCompletedAt.getTime() <= psvWindowDeadline.getTime();
}

// ── PSV window initialization ────────────────────────────────

export async function initializePSVWindow(
  artifactId: string,
  mode: PSVMode = 'ncqa',
): Promise<void> {
  const now = new Date();
  const deadline = computePSVDeadline(now, mode);

  await prisma.verificationArtifact.update({
    where: { id: artifactId },
    data: {
      psvWindowStart: now,
      psvWindowDeadline: deadline,
      psvWindowCompliant: null,
    },
  });

  log('info', 'psv_window_initialized', {
    event: 'psv_window_initialized',
    artifactId,
    mode,
    windowStart: now.toISOString(),
    deadline: deadline.toISOString(),
  });
}

// ── PSV completion recording ─────────────────────────────────

export async function recordPSVCompletion(artifactId: string): Promise<boolean> {
  const artifact = await prisma.verificationArtifact.findUnique({
    where: { id: artifactId },
    select: { psvWindowDeadline: true },
  });

  if (!artifact?.psvWindowDeadline) {
    log('warn', 'psv_completion_no_window', {
      event: 'psv_completion_no_window',
      artifactId,
    });
    return false;
  }

  const now = new Date();
  const compliant = checkPSVCompliance(now, artifact.psvWindowDeadline);

  await prisma.verificationArtifact.update({
    where: { id: artifactId },
    data: { psvWindowCompliant: compliant },
  });

  return compliant ?? false;
}

// ── Deadline warning engine ──────────────────────────────────

export type PSVWarningEvent = {
  artifactId: string;
  eventType: 'psv-window-warning' | 'psv-window-breach';
  daysRemaining: number;
};

export async function checkPSVDeadlines(
  organizationId: string,
): Promise<PSVWarningEvent[]> {
  const now = new Date();
  const warnings: PSVWarningEvent[] = [];

  const artifacts = await prisma.verificationArtifact.findMany({
    where: {
      organizationId,
      psvWindowDeadline: { not: null },
      psvWindowCompliant: null, // not yet completed
    },
    select: {
      id: true,
      psvWindowDeadline: true,
    },
  });

  for (const artifact of artifacts) {
    if (!artifact.psvWindowDeadline) continue;

    const remaining = daysRemaining(artifact.psvWindowDeadline, now);

    if (remaining <= 0) {
      warnings.push({
        artifactId: artifact.id,
        eventType: 'psv-window-breach',
        daysRemaining: remaining,
      });

      // Log to CredentialMonitoringEvent
      try {
        await prisma.credentialMonitoringEvent.create({
          data: {
            artifactId: artifact.id,
            organizationId,
            eventType: 'psv-window-breach',
          },
        });
      } catch (error) {
        log('error', 'psv_breach_log_failed', {
          event: 'psv_breach_log_failed',
          artifactId: artifact.id,
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    } else if (remaining <= WARNING_THRESHOLD_DAYS) {
      warnings.push({
        artifactId: artifact.id,
        eventType: 'psv-window-warning',
        daysRemaining: remaining,
      });

      try {
        await prisma.credentialMonitoringEvent.create({
          data: {
            artifactId: artifact.id,
            organizationId,
            eventType: 'psv-window-warning',
          },
        });
      } catch (error) {
        log('error', 'psv_warning_log_failed', {
          event: 'psv_warning_log_failed',
          artifactId: artifact.id,
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    }
  }

  if (warnings.length > 0) {
    log('info', 'psv_deadline_check_completed', {
      event: 'psv_deadline_check_completed',
      organizationId,
      warningCount: warnings.filter((w) => w.eventType === 'psv-window-warning').length,
      breachCount: warnings.filter((w) => w.eventType === 'psv-window-breach').length,
    });
  }

  return warnings;
}

// ── PSV status query ─────────────────────────────────────────

export type PSVStatus = {
  windowStart: string | null;
  windowDeadline: string | null;
  compliant: boolean | null;
  daysRemaining: number | null;
};

export async function getPSVStatus(artifactId: string): Promise<PSVStatus | null> {
  const artifact = await prisma.verificationArtifact.findUnique({
    where: { id: artifactId },
    select: {
      psvWindowStart: true,
      psvWindowDeadline: true,
      psvWindowCompliant: true,
    },
  });

  if (!artifact || !artifact.psvWindowStart || !artifact.psvWindowDeadline) {
    return null;
  }

  const now = new Date();
  const remaining = daysRemaining(artifact.psvWindowDeadline, now);

  return {
    windowStart: artifact.psvWindowStart.toISOString(),
    windowDeadline: artifact.psvWindowDeadline.toISOString(),
    compliant: artifact.psvWindowCompliant,
    daysRemaining: remaining,
  };
}
