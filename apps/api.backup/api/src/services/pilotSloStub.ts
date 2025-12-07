/**
 * S72-D3-B-008: Pilot SLO calculation stub
 *
 * Simple SLO calculation based on last smoke test run.
 * Returns ok if:
 * - Last smoke test was successful (lastOk = true)
 * - Last run was within 24 hours
 *
 * This is a stub implementation. Future versions will implement
 * 7-day rolling window with error budget calculations.
 *
 * Used by /demo/pilot/status endpoint.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// SLO configuration
const SLO_THRESHOLD_HOURS = 24; // Last run must be within 24 hours

/**
 * SLO result interface
 */
export interface PilotSloResult {
  ok: boolean;
  reason?: string;
  lastRunAt?: string;
  lastRunAge?: number; // Age in hours
  lastOk?: boolean;
  threshold: number; // Threshold in hours
}

/**
 * Get pilot SLO status
 *
 * Returns ok if:
 * - Last smoke test passed (lastOk = true)
 * - Last run was within SLO_THRESHOLD_HOURS
 *
 * @returns SLO evaluation result
 */
export async function getPilotSlo(): Promise<PilotSloResult> {
  try {
    // Get latest PilotStatus
    const pilotStatus = await prisma.pilotStatus.findFirst({
      where: {
        orgId: null, // Global/demo
      },
      orderBy: {
        lastRunAt: 'desc',
      },
    });

    // No status found - not ok
    if (!pilotStatus) {
      return {
        ok: false,
        reason: 'no_smoke_test_run',
        threshold: SLO_THRESHOLD_HOURS,
      };
    }

    // Calculate age of last run
    const now = new Date();
    const lastRunAt = new Date(pilotStatus.lastRunAt);
    const ageMs = now.getTime() - lastRunAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    // Check if last run was successful
    if (!pilotStatus.lastOk) {
      return {
        ok: false,
        reason: 'last_smoke_test_failed',
        lastRunAt: lastRunAt.toISOString(),
        lastRunAge: Math.round(ageHours * 100) / 100,
        lastOk: false,
        threshold: SLO_THRESHOLD_HOURS,
      };
    }

    // Check if last run is within threshold
    if (ageHours > SLO_THRESHOLD_HOURS) {
      return {
        ok: false,
        reason: 'smoke_test_stale',
        lastRunAt: lastRunAt.toISOString(),
        lastRunAge: Math.round(ageHours * 100) / 100,
        lastOk: true,
        threshold: SLO_THRESHOLD_HOURS,
      };
    }

    // All checks passed - SLO is met
    return {
      ok: true,
      reason: 'slo_met',
      lastRunAt: lastRunAt.toISOString(),
      lastRunAge: Math.round(ageHours * 100) / 100,
      lastOk: true,
      threshold: SLO_THRESHOLD_HOURS,
    };

  } catch (error: any) {
    console.error('❌ [Pilot SLO] Error calculating SLO:', error);
    return {
      ok: false,
      reason: `error: ${error.message}`,
      threshold: SLO_THRESHOLD_HOURS,
    };
  }
}

/**
 * Check if pilot is ready based on SLO
 *
 * Simple boolean check for quick validation.
 *
 * @returns true if SLO is met, false otherwise
 */
export async function isPilotReady(): Promise<boolean> {
  const slo = await getPilotSlo();
  return slo.ok;
}

/**
 * Get human-readable SLO status message
 *
 * @returns Status message describing current SLO state
 */
export async function getPilotSloMessage(): Promise<string> {
  const slo = await getPilotSlo();

  if (slo.ok) {
    return `✅ Pilot is ready. Last smoke test passed ${slo.lastRunAge?.toFixed(1)}h ago (threshold: ${slo.threshold}h).`;
  }

  switch (slo.reason) {
    case 'no_smoke_test_run':
      return '❌ Pilot not ready: No smoke test has been run yet.';
    case 'last_smoke_test_failed':
      return `❌ Pilot not ready: Last smoke test failed ${slo.lastRunAge?.toFixed(1)}h ago.`;
    case 'smoke_test_stale':
      return `❌ Pilot not ready: Last smoke test is stale (${slo.lastRunAge?.toFixed(1)}h old, threshold: ${slo.threshold}h).`;
    default:
      return `❌ Pilot not ready: ${slo.reason}`;
  }
}

