// @ts-nocheck
/**
 * Failure Isolation Engine — Wave T
 *
 * Centralized failure logging with severity-based escalation.
 * Tracks system-wide failures for observability and strict mode enforcement.
 *
 * Severity levels:
 *   - "warning":  Degraded operation, non-blocking
 *   - "error":    Failed operation, logged for investigation
 *   - "critical": System integrity at risk, blocks operations in strict mode
 *
 * When severity = "critical":
 *   - Enterprise self-test is marked as failed
 *   - Strict mode aborts issuance and lifecycle changes
 *
 * No external SaaS. All data persisted to PostgreSQL.
 */

import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

// ── Types ────────────────────────────────────────────────────

export type FailureSeverity = 'warning' | 'error' | 'critical';

export type FailureContext = {
  artifactId?: string;
  organizationId?: string;
};

export type ObservabilityStatus = {
  recentCriticalFailures: number;
  recentErrorCount: number;
  recentWarningCount: number;
  systemHealthy: boolean;
  lastCriticalAt: string | null;
};

// ── In-memory critical failure flag ──────────────────────────
// Used for fast-path checks in strict mode without DB round-trip

let _criticalFailureDetected = false;

export function hasCriticalFailure(): boolean {
  return _criticalFailureDetected;
}

export function resetCriticalFailureFlag(): void {
  _criticalFailureDetected = false;
}

// ── Core logger ──────────────────────────────────────────────

export async function logSystemFailure(
  component: string,
  severity: FailureSeverity,
  message: string,
  context?: FailureContext,
): Promise<void> {
  // Set critical flag for fast-path checks
  if (severity === 'critical') {
    _criticalFailureDetected = true;
  }

  // Structured log for immediate visibility
  log(severity === 'critical' ? 'error' : severity === 'error' ? 'error' : 'warn', 'system_failure_event', {
    event: 'system_failure_event',
    component,
    severity,
    message,
    artifactId: context?.artifactId ?? null,
    organizationId: context?.organizationId ?? null,
  });

  // Persist to database (fire-and-forget to avoid cascading failures)
  try {
    await prisma.systemFailureEvent.create({
      data: {
        component,
        severity,
        message,
        artifactId: context?.artifactId ?? null,
        organizationId: context?.organizationId ?? null,
      },
    });
  } catch (dbError) {
    // If we can't write the failure event, log to stdout as last resort.
    // This avoids infinite recursion of failure logging.
    log('error', 'failure_isolation_db_write_failed', {
      event: 'failure_isolation_db_write_failed',
      component,
      severity,
      originalMessage: message,
      dbError: dbError instanceof Error ? dbError.message : 'unknown',
    });
  }
}

// ── Observability status query ───────────────────────────────

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function getObservabilityStatus(): Promise<ObservabilityStatus> {
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);

  try {
    const recentEvents = await prisma.systemFailureEvent.findMany({
      where: { createdAt: { gte: cutoff } },
      orderBy: { createdAt: 'desc' },
      select: { severity: true, createdAt: true },
    });

    const criticalEvents = recentEvents.filter((e) => e.severity === 'critical');
    const errorEvents = recentEvents.filter((e) => e.severity === 'error');
    const warningEvents = recentEvents.filter((e) => e.severity === 'warning');

    return {
      recentCriticalFailures: criticalEvents.length,
      recentErrorCount: errorEvents.length,
      recentWarningCount: warningEvents.length,
      systemHealthy: criticalEvents.length === 0,
      lastCriticalAt: criticalEvents.length > 0
        ? criticalEvents[0].createdAt.toISOString()
        : null,
    };
  } catch (error) {
    log('error', 'observability_status_query_failed', {
      event: 'observability_status_query_failed',
      error: error instanceof Error ? error.message : 'unknown',
    });

    // If we can't query failures, assume unhealthy
    return {
      recentCriticalFailures: -1,
      recentErrorCount: -1,
      recentWarningCount: -1,
      systemHealthy: false,
      lastCriticalAt: null,
    };
  }
}

// ── Strict mode enforcement helpers ──────────────────────────

/**
 * Check whether the system is healthy enough to proceed with
 * critical operations. In strict mode, returns false if there
 * are recent critical failures.
 */
export async function isSystemHealthyForOperation(): Promise<boolean> {
  // Fast path: in-memory flag
  if (_criticalFailureDetected) {
    return false;
  }

  // Slow path: check DB for recent critical failures
  const status = await getObservabilityStatus();
  return status.systemHealthy;
}
