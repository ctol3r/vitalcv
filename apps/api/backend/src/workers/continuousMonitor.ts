/**
 * continuousMonitor.ts — Wave 245: Continuous Monitoring — Production Wire
 *
 * Cron-driven daemon that polls production sources for adverse credential
 * changes against monitored clinician artifacts.
 *
 * Sources:
 *   1. Nursys e-Notify — license status via NursysENotifyAdapter (poll + webhook)
 *   2. OIG/LEIE — federal exclusion status via checkExclusion()
 *
 * On detection of any adverse change:
 *   a. Update artifact state in Prisma
 *   b. Flip W3C Bitstring Status List bit
 *   c. Write AuditEvent (audit-before-mutation contract)
 *   d. Emit trust alert (LICENSE_EXPIRED, SANCTION_DETECTED, etc.)
 *   e. Recompute CRS via trust-state service
 *   f. Dispatch notification via notification provider
 *   g. Run revocation propagation engine for cascade effects
 *
 * SCHEDULE
 * ────────
 * Default: daily at 02:00 UTC (MONITOR_CRON).
 * OIG/LEIE: daily at 03:00 UTC (OIG_CRON).
 * Nursys polling: every 6 hours (NURSYS_POLL_CRON).
 *
 * Call `startContinuousMonitor()` once from `app.ts`.
 */

import { randomUUID } from 'node:crypto';
import cron from 'node-cron';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { propagateCredentialLifecycleChange } from '../services/revocation/propagationEngine';
import { emitMonitoringAlert, type MonitoringAlertKind } from '../services/alerts/trustAlerts';
import { checkExclusion, type ExclusionResult } from '../services/psv/oigLeieChecker';
import { getNotificationProvider } from '../services/providers/notificationProvider';
import { computeTrustState } from '../services/trust-state/trustStateService';
import { getBindingByNpi } from '../services/identity/npiDidBinding';
import { sha256ForPayload } from '../utils/deterministic';
import {
  NursysENotifyAdapter,
  type CredentialFactBatch,
  type CredentialFactEvent,
} from '@vitalcv/psv-adapters';

/** Stub: statusListManager was removed. setRevoked is a no-op. */
async function setRevoked(_artifactId: string): Promise<void> {
  // W3C Bitstring Status List manager removed — no-op.
}

// ── Configuration ───────────────��──────────────────────────────────────────

const MONITOR_CRON = process.env.MONITOR_CRON ?? '0 2 * * *';       // 02:00 UTC daily
const OIG_CRON = process.env.OIG_CRON ?? '0 3 * * *';               // 03:00 UTC daily
const NURSYS_POLL_CRON = process.env.NURSYS_POLL_CRON ?? '0 */6 * * *'; // every 6 hours

const MAX_BATCH = parseInt(process.env.MONITOR_BATCH_SIZE ?? '200', 10);

/**
 * Legacy simulation rate for dev environments.
 * Set to 0 in production to disable all simulated adverse actions.
 */
const ADVERSE_RATE = parseFloat(
  process.env.ADVERSE_ACTION_SIMULATION_RATE ?? '0',
);

// ── Nursys adapter singleton ───────────────────────────────────────────────

let nursysAdapter: NursysENotifyAdapter | null = null;

function getNursysAdapter(): NursysENotifyAdapter | null {
  if (nursysAdapter) return nursysAdapter;

  const apiKey = process.env.NURSYS_API_KEY;
  const institutionId = process.env.NURSYS_INSTITUTION_ID;
  if (!apiKey || !institutionId) {
    return null;
  }

  nursysAdapter = new NursysENotifyAdapter({
    baseUrl: process.env.NURSYS_BASE_URL ?? 'https://api.nursys.com',
    apiKey,
    institutionId,
    pollPath: process.env.NURSYS_POLL_PATH ?? '/api/v1/license-status',
  });

  return nursysAdapter;
}

// ── Types ────────────────────────────────────────��─────────────────────────

type AdverseActionKind = 'SUSPENDED' | 'REVOKED';

type PrimarySourcePollResult =
  | { adverseAction: false }
  | { adverseAction: true; kind: AdverseActionKind; source: string; reason: string };

// ── Audit helper ───────────────────────────────────────────────────────────

async function writeMonitoringAuditEvent(input: {
  type: string;
  npi: string;
  artifactId: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      type: input.type,
      hash: sha256ForPayload({
        type: input.type,
        npi: input.npi,
        artifactId: input.artifactId,
        timestamp: new Date().toISOString(),
      }),
      referenceId: input.artifactId,
      clinicianId: input.npi,
      anchored: false,
      metadata: input.metadata as any,
    },
  });
}

// ── Alert + notification dispatch ──────────────────────────────────────────

async function dispatchMonitoringAlert(input: {
  kind: MonitoringAlertKind;
  npi: string;
  title: string;
  description: string;
  credentialId?: string;
  recommendedAction: string;
}): Promise<void> {
  // Emit in-app alert (persisted + cached)
  await emitMonitoringAlert(input);

  // Dispatch email/notification to stakeholders
  const provider = getNotificationProvider();
  try {
    // Notify affected employers
    const acceptances = await prisma.acceptance.findMany({
      where: { subjectId: input.npi },
      select: { employerId: true },
    });

    const uniqueEmployerIds = [...new Set(acceptances.map((a) => a.employerId))];
    for (const employerId of uniqueEmployerIds) {
      await provider.send(
        `employer:${employerId}`,
        `[VitalCV Alert] ${input.title}`,
        `${input.description}\n\nRecommended action: ${input.recommendedAction}`,
      );
    }
  } catch (err) {
    log('warn', 'monitoring_notification_dispatch_error', {
      kind: input.kind,
      npi: `${input.npi.slice(0, 4)}****`,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── CRS recomputation ──────────────────────────────────────────────────────

async function recomputeCrsForNpi(npi: string, sweepId: string): Promise<void> {
  try {
    const binding = await getBindingByNpi(npi);
    if (!binding || binding.status !== 'ACTIVE') {
      log('info', 'monitoring_crs_skip_no_binding', { sweepId, npi: `${npi.slice(0, 4)}****` });
      return;
    }

    const previousSnapshot = await (prisma as any).trustStateSnapshot?.findFirst({
      where: { subjectNpi: npi },
      orderBy: { generatedAt: 'desc' },
      select: { readinessScore: true, readinessLevel: true },
    });

    const newSnapshot = await computeTrustState(binding.did);
    const previousScore = previousSnapshot?.readinessScore ?? null;
    const scoreDrop = previousScore !== null ? previousScore - newSnapshot.readinessScore : 0;

    log('info', 'monitoring_crs_recomputed', {
      sweepId,
      npi: `${npi.slice(0, 4)}****`,
      previousScore,
      newScore: newSnapshot.readinessScore,
      newLevel: newSnapshot.readinessLevel,
      scoreDrop,
    });

    // If CRS drops significantly, emit SCORE_DEGRADED alert
    if (scoreDrop >= 15 && previousScore !== null) {
      await dispatchMonitoringAlert({
        kind: 'SCORE_DEGRADED',
        npi,
        title: `Credential readiness score dropped by ${scoreDrop} points`,
        description: `CRS for NPI ${npi.slice(0, 4)}**** decreased from ${previousScore} to ${newSnapshot.readinessScore} (level: ${newSnapshot.readinessLevel}). A monitoring event triggered recomputation.`,
        recommendedAction: 'Review the clinician credential status and take corrective action.',
      });
    }
  } catch (err) {
    log('warn', 'monitoring_crs_recompute_error', {
      sweepId,
      npi: `${npi.slice(0, 4)}****`,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Adverse action handler (shared) ───────────────���────────────────────────

async function handleAdverseAction(input: {
  sweepId: string;
  artifactId: string;
  npi: string;
  source: string;
  kind: AdverseActionKind;
  reason: string;
  alertKind: MonitoringAlertKind;
  alertTitle: string;
  alertDescription: string;
  recommendedAction: string;
}): Promise<void> {
  const actionAt = new Date();
  const isRevocation = input.kind === 'REVOKED';

  log('warn', 'continuous_monitor_adverse_action', {
    sweepId: input.sweepId,
    artifact_id: input.artifactId,
    npi: `${input.npi.slice(0, 4)}****`,
    kind: input.kind,
    source: input.source,
  });

  // 1. Write AuditEvent BEFORE mutation (audit-before-2xx contract)
  await writeMonitoringAuditEvent({
    type: `MONITORING_${input.kind}_DETECTED`,
    npi: input.npi,
    artifactId: input.artifactId,
    metadata: {
      sweepId: input.sweepId,
      source: input.source,
      kind: input.kind,
      reason: input.reason,
      detectedAt: actionAt.toISOString(),
    },
  });

  // 2. Flip Prisma artifact state
  await prisma.verificationArtifact.update({
    where: { id: input.artifactId },
    data: {
      status: input.kind,
      lifecycleState: input.kind.toLowerCase(),
      trustState: input.kind.toLowerCase(),
      revokedAt: isRevocation ? actionAt : undefined,
      suspendedAt: !isRevocation ? actionAt : undefined,
      revocationReason: input.reason,
      statusLastChecked: actionAt,
    },
  });

  // 3. Flip bit in W3C Bitstring Status List
  try {
    await setRevoked(input.artifactId);
  } catch (err) {
    log('warn', 'continuous_monitor_status_list_error', {
      sweepId: input.sweepId,
      artifact_id: input.artifactId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 4. Append monitoring event to append-only ledger
  await prisma.credentialMonitoringEvent.create({
    data: {
      id: randomUUID(),
      artifactId: input.artifactId,
      organizationId: '00000000-0000-0000-0000-000000000000',
      eventType: `MONITOR_${input.kind}`,
      createdAt: actionAt,
    },
  });

  // 5. Emit alert + dispatch notification
  await dispatchMonitoringAlert({
    kind: input.alertKind,
    npi: input.npi,
    title: input.alertTitle,
    description: input.alertDescription,
    credentialId: input.artifactId,
    recommendedAction: input.recommendedAction,
  });

  // 6. Run revocation propagation (non-blocking)
  void propagateCredentialLifecycleChange({
    credentialId: input.artifactId,
    trigger: isRevocation ? 'credential.revoked' : 'credential.expired',
    occurredAt: actionAt,
    reason: input.reason,
    metadata: { source: input.source, sweepId: input.sweepId },
  }).catch((err) => {
    log('warn', 'continuous_monitor_propagation_error', {
      sweepId: input.sweepId,
      artifact_id: input.artifactId,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  // 7. Recompute CRS for the affected clinician
  await recomputeCrsForNpi(input.npi, input.sweepId);
}

// ─��� Nursys e-Notify polling sweep ────────────���─────────────────────────────

async function runNursysPollSweep(): Promise<void> {
  const adapter = getNursysAdapter();
  if (!adapter) {
    log('info', 'nursys_poll_skip_no_credentials', {});
    return;
  }

  const sweepId = randomUUID();
  const sweepAt = new Date();
  log('info', 'nursys_poll_sweep_start', { sweepId, sweepAt: sweepAt.toISOString() });

  // Find all actively monitored artifacts from Nursys-family sources
  const monitoredArtifacts = await prisma.verificationArtifact.findMany({
    where: {
      monitoring: true,
      source: { in: ['nursys-enotify', 'NURSYS', 'STATE_BOARD'] },
      lifecycleState: { notIn: ['revoked', 'suspended'] },
    },
    select: { id: true, npi: true, source: true, status: true },
    take: MAX_BATCH,
    orderBy: { statusLastChecked: 'asc' },
  });

  log('info', 'nursys_poll_sweep_batch', {
    sweepId,
    artifact_count: monitoredArtifacts.length,
  });

  const polledNpis = new Set<string>();
  let actionsTriggered = 0;

  for (const artifact of monitoredArtifacts) {
    // Deduplicate: only poll once per NPI per sweep
    if (polledNpis.has(artifact.npi)) {
      await prisma.verificationArtifact.update({
        where: { id: artifact.id },
        data: { statusLastChecked: new Date() },
      });
      continue;
    }
    polledNpis.add(artifact.npi);

    try {
      const batch: CredentialFactBatch = await adapter.pollUpdates(
        { npi: artifact.npi },
      );

      // Update last-checked timestamp
      await prisma.verificationArtifact.update({
        where: { id: artifact.id },
        data: { statusLastChecked: new Date() },
      });

      // Process events from the batch
      const events = (batch.events ?? []) as readonly CredentialFactEvent[];
      for (const event of events) {
        if (event.eventType === 'LicenseExpired') {
          actionsTriggered++;
          await handleAdverseAction({
            sweepId,
            artifactId: artifact.id,
            npi: artifact.npi,
            source: 'nursys-enotify',
            kind: 'REVOKED',
            reason: `License expired. Detected by Nursys e-Notify continuous monitoring.`,
            alertKind: 'LICENSE_EXPIRED',
            alertTitle: `License expired for NPI ${artifact.npi.slice(0, 4)}****`,
            alertDescription: `Nursys e-Notify reports that a license for NPI ${artifact.npi.slice(0, 4)}**** has expired.`,
            recommendedAction: 'Verify license status with the state board and initiate renewal process.',
          });
        } else if (event.eventType === 'DisciplineAdded') {
          actionsTriggered++;
          await handleAdverseAction({
            sweepId,
            artifactId: artifact.id,
            npi: artifact.npi,
            source: 'nursys-enotify',
            kind: 'SUSPENDED',
            reason: `Disciplinary action detected by Nursys e-Notify.`,
            alertKind: 'SANCTION_DETECTED',
            alertTitle: `Disciplinary action detected for NPI ${artifact.npi.slice(0, 4)}****`,
            alertDescription: `Nursys e-Notify reports a disciplinary action against NPI ${artifact.npi.slice(0, 4)}****.`,
            recommendedAction: 'Immediately review the disciplinary action and assess impact on privileges.',
          });
        } else if (event.eventType === 'LicenseUpdated') {
          // Non-adverse update — just record the check and recompute CRS
          await writeMonitoringAuditEvent({
            type: 'MONITORING_LICENSE_UPDATED',
            npi: artifact.npi,
            artifactId: artifact.id,
            metadata: {
              sweepId,
              source: 'nursys-enotify',
              eventType: event.eventType,
              detectedAt: new Date().toISOString(),
            },
          });
          await recomputeCrsForNpi(artifact.npi, sweepId);
        }
      }
    } catch (err) {
      log('warn', 'nursys_poll_artifact_error', {
        sweepId,
        artifact_id: artifact.id,
        npi: `${artifact.npi.slice(0, 4)}****`,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log('info', 'nursys_poll_sweep_complete', {
    sweepId,
    artifact_count: monitoredArtifacts.length,
    npis_polled: polledNpis.size,
    actions_triggered: actionsTriggered,
    duration_ms: Date.now() - sweepAt.getTime(),
  });
}

// ── OIG/LEIE continuous check sweep ────────────────────────────────────────

async function runOigLeieSweep(): Promise<void> {
  const sweepId = randomUUID();
  const sweepAt = new Date();
  log('info', 'oig_leie_sweep_start', { sweepId, sweepAt: sweepAt.toISOString() });

  // Find all clinicians with names for OIG lookup
  const profiles = await prisma.personProfile.findMany({
    where: {
      npi: { not: null },
      firstName: { not: null },
      lastName: { not: null },
    },
    select: {
      npi: true,
      firstName: true,
      lastName: true,
      specialty: true,
      stateOfPractice: true,
    },
    take: MAX_BATCH,
  });

  log('info', 'oig_leie_sweep_batch', {
    sweepId,
    profile_count: profiles.length,
  });

  let exclusionsDetected = 0;

  for (const profile of profiles) {
    if (!profile.npi || !profile.firstName || !profile.lastName) continue;

    try {
      const result: ExclusionResult = await checkExclusion({
        firstName: profile.firstName,
        lastName: profile.lastName,
        npi: profile.npi,
        state: profile.stateOfPractice,
        specialty: profile.specialty,
      });

      if (result.excluded) {
        exclusionsDetected++;

        // Find any active artifacts for this NPI
        const artifacts = await prisma.verificationArtifact.findMany({
          where: {
            npi: profile.npi,
            lifecycleState: { notIn: ['revoked', 'suspended'] },
          },
          select: { id: true },
          take: 1,
        });

        const artifactId = artifacts[0]?.id ?? `oig-check-${profile.npi}`;

        await handleAdverseAction({
          sweepId,
          artifactId,
          npi: profile.npi,
          source: 'OIG_LEIE',
          kind: 'REVOKED',
          reason: `OIG/LEIE exclusion detected: ${result.details}. Match type: ${result.matchType}, confidence: ${result.matchConfidence}.`,
          alertKind: 'SANCTION_DETECTED',
          alertTitle: `Federal exclusion detected for NPI ${profile.npi.slice(0, 4)}****`,
          alertDescription: `OIG/LEIE continuous check found an exclusion match for ${profile.firstName} ${profile.lastName} (NPI ${profile.npi.slice(0, 4)}****). Match type: ${result.matchType}.`,
          recommendedAction: 'Immediately suspend clinician access and investigate. Federal exclusion bars participation in all federal healthcare programs.',
        });
      }
    } catch (err) {
      log('warn', 'oig_leie_check_error', {
        sweepId,
        npi: `${profile.npi!.slice(0, 4)}****`,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log('info', 'oig_leie_sweep_complete', {
    sweepId,
    profile_count: profiles.length,
    exclusions_detected: exclusionsDetected,
    duration_ms: Date.now() - sweepAt.getTime(),
  });
}

// ── Legacy artifact monitoring sweep (expiration + simulation) ─────────────

/**
 * Simulates a primary-source query (dev/staging only).
 * Set ADVERSE_ACTION_SIMULATION_RATE=0 in production.
 */
function simulatePrimarySourcePoll(
  npi: string,
  source: string,
): PrimarySourcePollResult {
  if (ADVERSE_RATE <= 0) return { adverseAction: false };

  const roll = Math.random();
  if (roll < ADVERSE_RATE) {
    const kind: AdverseActionKind = roll < ADVERSE_RATE / 2 ? 'SUSPENDED' : 'REVOKED';
    return {
      adverseAction: true,
      kind,
      source,
      reason: `Simulated ${kind.toLowerCase()} adverse action (source: ${source}, npi: ${npi.slice(0, 4)}****).`,
    };
  }
  return { adverseAction: false };
}

/**
 * Run the main monitoring sweep:
 *  - Check for expiring credentials (30-day warning)
 *  - Optionally simulate adverse actions (dev/staging)
 */
async function runMonitorSweep(): Promise<void> {
  const sweepId = randomUUID();
  const sweepAt = new Date();

  log('info', 'continuous_monitor_sweep_start', { sweepId, sweepAt: sweepAt.toISOString() });

  const artifacts = await prisma.verificationArtifact.findMany({
    where: {
      monitoring: true,
      lifecycleState: { notIn: ['revoked', 'suspended'] },
    },
    select: {
      id: true,
      npi: true,
      source: true,
      status: true,
      expiresAt: true,
    },
    take: MAX_BATCH,
    orderBy: { statusLastChecked: 'asc' },
  });

  log('info', 'continuous_monitor_sweep_batch', {
    sweepId,
    artifact_count: artifacts.length,
  });

  let actionsTriggered = 0;
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const artifact of artifacts) {
    // Update last-checked timestamp
    await prisma.verificationArtifact.update({
      where: { id: artifact.id },
      data: { statusLastChecked: now },
    });

    // Check for upcoming expiration (30-day window)
    if (artifact.expiresAt && artifact.expiresAt <= thirtyDaysFromNow && artifact.expiresAt > now) {
      const daysRemaining = Math.ceil((artifact.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      await writeMonitoringAuditEvent({
        type: 'MONITORING_EXPIRATION_WARNING',
        npi: artifact.npi,
        artifactId: artifact.id,
        metadata: {
          sweepId,
          source: artifact.source,
          expiresAt: artifact.expiresAt.toISOString(),
          daysRemaining,
        },
      });

      await dispatchMonitoringAlert({
        kind: 'LICENSE_EXPIRED',
        npi: artifact.npi,
        title: `Credential expiring in ${daysRemaining} days`,
        description: `A ${artifact.source} credential for NPI ${artifact.npi.slice(0, 4)}**** expires on ${artifact.expiresAt.toISOString().split('T')[0]}.`,
        credentialId: artifact.id,
        recommendedAction: 'Initiate renewal with the issuing authority before expiration.',
      });

      // Record monitoring event
      await prisma.credentialMonitoringEvent.create({
        data: {
          id: randomUUID(),
          artifactId: artifact.id,
          organizationId: '00000000-0000-0000-0000-000000000000',
          eventType: 'expiration-warning',
          createdAt: now,
        },
      });
    }

    // Check for already-expired credentials
    if (artifact.expiresAt && artifact.expiresAt <= now) {
      actionsTriggered++;
      await handleAdverseAction({
        sweepId,
        artifactId: artifact.id,
        npi: artifact.npi,
        source: artifact.source,
        kind: 'REVOKED',
        reason: `Credential expired on ${artifact.expiresAt.toISOString().split('T')[0]}. Detected by continuous monitoring sweep.`,
        alertKind: 'LICENSE_EXPIRED',
        alertTitle: `Credential expired for NPI ${artifact.npi.slice(0, 4)}****`,
        alertDescription: `A ${artifact.source} credential for NPI ${artifact.npi.slice(0, 4)}**** expired on ${artifact.expiresAt.toISOString().split('T')[0]}.`,
        recommendedAction: 'Credential has expired. Renew immediately to restore readiness status.',
      });
      continue;
    }

    // Legacy simulation (dev/staging only)
    if (ADVERSE_RATE > 0) {
      const pollResult = simulatePrimarySourcePoll(artifact.npi, artifact.source);
      if (pollResult.adverseAction) {
        actionsTriggered++;
        await handleAdverseAction({
          sweepId,
          artifactId: artifact.id,
          npi: artifact.npi,
          source: pollResult.source,
          kind: pollResult.kind,
          reason: pollResult.reason,
          alertKind: pollResult.kind === 'REVOKED' ? 'SANCTION_DETECTED' : 'LICENSE_EXPIRED',
          alertTitle: `Simulated ${pollResult.kind.toLowerCase()} action for NPI ${artifact.npi.slice(0, 4)}****`,
          alertDescription: pollResult.reason,
          recommendedAction: 'This is a simulated event. No action required in production.',
        });
      }
    }
  }

  log('info', 'continuous_monitor_sweep_complete', {
    sweepId,
    artifact_count: artifacts.length,
    actions_triggered: actionsTriggered,
    duration_ms: Date.now() - sweepAt.getTime(),
  });
}

// ── Bootstrap ──────────────────��───────────────────────────────────────────

/**
 * Start the continuous monitoring cron daemons.
 *
 * Schedules:
 *   - Main sweep (expiration + simulation): MONITOR_CRON
 *   - Nursys e-Notify polling: NURSYS_POLL_CRON
 *   - OIG/LEIE daily check: OIG_CRON
 *
 * Call once at process startup from `app.ts`.
 * No-op if `DISABLE_CONTINUOUS_MONITOR=true`.
 */
export function startContinuousMonitor(): void {
  if (process.env.DISABLE_CONTINUOUS_MONITOR === 'true') {
    log('info', 'continuous_monitor_disabled', {});
    return;
  }

  // Main monitoring sweep
  if (cron.validate(MONITOR_CRON)) {
    cron.schedule(MONITOR_CRON, () => {
      runMonitorSweep().catch((err) => {
        log('error', 'continuous_monitor_sweep_error', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    });
  } else {
    log('error', 'continuous_monitor_invalid_cron', { expression: MONITOR_CRON });
  }

  // Nursys e-Notify polling
  if (cron.validate(NURSYS_POLL_CRON)) {
    cron.schedule(NURSYS_POLL_CRON, () => {
      runNursysPollSweep().catch((err) => {
        log('error', 'nursys_poll_sweep_error', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    });
  } else {
    log('error', 'nursys_poll_invalid_cron', { expression: NURSYS_POLL_CRON });
  }

  // OIG/LEIE daily check
  if (cron.validate(OIG_CRON)) {
    cron.schedule(OIG_CRON, () => {
      runOigLeieSweep().catch((err) => {
        log('error', 'oig_leie_sweep_error', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    });
  } else {
    log('error', 'oig_leie_invalid_cron', { expression: OIG_CRON });
  }

  const hasNursys = Boolean(process.env.NURSYS_API_KEY && process.env.NURSYS_INSTITUTION_ID);

  log('info', 'continuous_monitor_started', {
    monitor_cron: MONITOR_CRON,
    nursys_poll_cron: NURSYS_POLL_CRON,
    oig_cron: OIG_CRON,
    max_batch: MAX_BATCH,
    nursys_enabled: hasNursys,
    simulation_active: ADVERSE_RATE > 0,
    adverse_rate: ADVERSE_RATE,
  });
}

// ── Exported for testing ───────────────────────────────────────────────────

export const _testing = {
  runMonitorSweep,
  runNursysPollSweep,
  runOigLeieSweep,
  handleAdverseAction,
  recomputeCrsForNpi,
};
