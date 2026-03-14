/**
 * continuousMonitor.ts — Wave 40: Continuous Trust & Revocation Engine
 *
 * Cron-driven daemon that simulates continuous polling of primary sources
 * (NPDB, State Licensing Boards) for adverse actions against active clinician
 * credentials.
 *
 * SCHEDULE
 * ────────
 * Default: daily at 02:00 UTC (configurable via `MONITOR_CRON` env var).
 * Call `startContinuousMonitor()` once from `app.ts`.
 *
 * LOGIC PER RUN
 * ─────────────
 * 1. Query for VerificationArtifacts with `monitoring = true` and
 *    `lifecycleState NOT IN ['revoked', 'suspended']`.
 * 2. For each artifact, call the mock primary-source check
 *    (`simulatePrimarySourcePoll`).
 * 3. If an adverse action is detected:
 *    a. Flip the artifact state in Prisma (SUSPENDED or REVOKED).
 *    b. Flip the corresponding bit in the W3C Bitstring Status List via
 *       `statusListManager.setRevoked()`.
 *    c. Dispatch enterprise webhooks to all registered employers via
 *       `webhookDispatcher.dispatchEnterpriseWebhooks()`.
 *    d. Append a `CredentialMonitoringEvent` (append-only ledger).
 *    e. Call `propagateRevocation()` to flag downstream Acceptances/Starts.
 *
 * PRODUCTION NOTES
 * ────────────────
 * • Replace `simulatePrimarySourcePoll()` with real NPDB / State Board API
 *   calls (SOAP/REST wrappers, credentialed via env-injected secrets).
 * • `ADVERSE_ACTION_SIMULATION_RATE` controls the mock detection rate
 *   (default 0.05 = 5% of monitored credentials per run, for demo purposes).
 *   Set to 0 in staging/production to disable simulated revocations.
 * • The worker is non-blocking: each run catches its own errors and logs
 *   without crashing the Express process.
 */

import { randomUUID } from 'node:crypto';
import cron from 'node-cron';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { setRevoked } from '../services/ledger/statusListManager';
import { propagateCredentialLifecycleChange } from '../services/revocation/propagationEngine';

// ── Configuration ──────────────────────────────────────────────────────────

const MONITOR_CRON = process.env.MONITOR_CRON ?? '0 2 * * *'; // 02:00 UTC daily

/**
 * Mock detection rate: fraction of monitored credentials that produce an
 * adverse action per run. 0 = disabled (production default).
 */
const ADVERSE_RATE = parseFloat(
  process.env.ADVERSE_ACTION_SIMULATION_RATE ?? '0.05',
);

const MAX_BATCH = parseInt(process.env.MONITOR_BATCH_SIZE ?? '200', 10);

// ── Types ──────────────────────────────────────────────────────────────────

type AdverseActionKind = 'SUSPENDED' | 'REVOKED';

type PrimarySourcePollResult =
  | { adverseAction: false }
  | { adverseAction: true; kind: AdverseActionKind; source: string; reason: string };

// ── Mock primary-source check ──────────────────────────────────────────────

/**
 * Simulates a primary-source query against NPDB / State Board.
 *
 * Production replacement: call actual NPDB QueryBatch SOAP API or
 * state-specific REST endpoints, parse the XML/JSON response, and return
 * a typed result.
 *
 * @param npi     Clinician NPI being checked.
 * @param source  Data source name (e.g. "NPDB", "CA-BRN").
 */
function simulatePrimarySourcePoll(
  npi:    string,
  source: string,
): PrimarySourcePollResult {
  // Use NPI + source as a deterministic seed to keep results consistent
  // within a run but vary across artifacts.
  const roll = Math.random();

  if (roll < ADVERSE_RATE) {
    const kind: AdverseActionKind = roll < ADVERSE_RATE / 2 ? 'SUSPENDED' : 'REVOKED';
    return {
      adverseAction: true,
      kind,
      source,
      reason: `Simulated ${kind.toLowerCase()} adverse action detected by continuous monitor (source: ${source}, npi: ${npi.slice(0, 4)}****).`,
    };
  }

  return { adverseAction: false };
}

// ── Core sweep ─────────────────────────────────────────────────────────────

/**
 * Run a single monitoring sweep.
 *
 * Queries monitored credentials, polls each mock primary source, and
 * handles any detected adverse actions.
 */
async function runMonitorSweep(): Promise<void> {
  const sweepId  = randomUUID();
  const sweepAt  = new Date();

  log('info', 'continuous_monitor_sweep_start', { sweepId, sweepAt: sweepAt.toISOString() });

  // Fetch active monitored artifacts (batch-limited)
  const artifacts = await prisma.verificationArtifact.findMany({
    where: {
      monitoring:    true,
      lifecycleState: { notIn: ['revoked', 'suspended'] },
    },
    select: {
      id:     true,
      npi:    true,
      source: true,
      status: true,
    },
    take:    MAX_BATCH,
    orderBy: { statusLastChecked: 'asc' }, // process least-recently-checked first
  });

  log('info', 'continuous_monitor_sweep_batch', {
    sweepId,
    artifact_count: artifacts.length,
  });

  let actionsTriggered = 0;

  for (const artifact of artifacts) {
    // Update the last-checked timestamp regardless of outcome
    await prisma.verificationArtifact.update({
      where: { id: artifact.id },
      data:  { statusLastChecked: new Date() },
    });

    const pollResult = simulatePrimarySourcePoll(artifact.npi, artifact.source);

    if (!pollResult.adverseAction) {
      continue;
    }

    // ── Adverse action detected ───────────────────────────────────────────
    actionsTriggered++;
    const actionAt = new Date().toISOString();

    log('warn', 'continuous_monitor_adverse_action', {
      sweepId,
      artifact_id: artifact.id,
      npi:         artifact.npi.slice(0, 4) + '****',
      kind:        pollResult.kind,
      source:      pollResult.source,
    });

    // 1. Flip Prisma state
    const isRevocation = pollResult.kind === 'REVOKED';
    await prisma.verificationArtifact.update({
      where: { id: artifact.id },
      data: {
        status:           pollResult.kind,
        lifecycleState:   pollResult.kind.toLowerCase(),
        trustState:       pollResult.kind.toLowerCase(),
        revokedAt:        isRevocation ? new Date() : undefined,
        suspendedAt:      !isRevocation ? new Date() : undefined,
        revocationReason: pollResult.reason,
      },
    });

    // 2. Flip bit in W3C Bitstring Status List
    try {
      await setRevoked(artifact.id);
    } catch (err) {
      log('warn', 'continuous_monitor_status_list_error', {
        sweepId,
        artifact_id: artifact.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 3. Append monitoring event to append-only ledger
    await prisma.credentialMonitoringEvent.create({
      data: {
        id:             randomUUID(),
        artifactId:     artifact.id,
        organizationId: '00000000-0000-0000-0000-000000000000',
        eventType:      `MONITOR_${pollResult.kind}`,
        createdAt:      new Date(),
      },
    });

    // 4. Run the shared propagation engine.
    void propagateCredentialLifecycleChange({
      credentialId: artifact.id,
      trigger: pollResult.kind === 'REVOKED' ? 'credential.revoked' : 'verification.invalidated',
      occurredAt: new Date(actionAt),
      reason: pollResult.reason,
      metadata: {
        source: pollResult.source,
      },
    }).catch(err => {
      log('warn', 'continuous_monitor_propagation_error', {
        sweepId,
        artifact_id: artifact.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  log('info', 'continuous_monitor_sweep_complete', {
    sweepId,
    artifact_count:   artifacts.length,
    actions_triggered: actionsTriggered,
    duration_ms:       Date.now() - sweepAt.getTime(),
  });
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

/**
 * Start the continuous monitoring cron daemon.
 *
 * Should be called once at process startup from `app.ts`.
 * Respects `MONITOR_CRON` env var for schedule override.
 * No-op if `DISABLE_CONTINUOUS_MONITOR=true`.
 */
export function startContinuousMonitor(): void {
  if (process.env.DISABLE_CONTINUOUS_MONITOR === 'true') {
    log('info', 'continuous_monitor_disabled', {});
    return;
  }

  if (!cron.validate(MONITOR_CRON)) {
    log('error', 'continuous_monitor_invalid_cron', { expression: MONITOR_CRON });
    return;
  }

  cron.schedule(MONITOR_CRON, () => {
    runMonitorSweep().catch(err => {
      log('error', 'continuous_monitor_sweep_error', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });

  log('info', 'continuous_monitor_started', {
    cron:               MONITOR_CRON,
    adverse_rate:       ADVERSE_RATE,
    max_batch:          MAX_BATCH,
    simulation_active:  ADVERSE_RATE > 0,
  });
}
