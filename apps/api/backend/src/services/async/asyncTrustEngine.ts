/**
 * asyncTrustEngine.ts — Wave 245: Async Trust Engine
 *
 * Core async engine that processes credential monitoring events and updates
 * trust state automatically. Replaces static one-time verification with
 * continuous monitoring — Pillar 4 of the VitalCV platform.
 *
 * Flow:
 *   CredentialEvent → refreshTrustState(npi) → compare bands → mark capsules
 *   AT_RISK → emit alert → return TrustStateChange
 */

import prisma from '../../graphql/prisma_client';
import { appendAuditEvent } from '../audit/auditLedger';
import { checkExclusion } from '../psv/oigLeieChecker';
import { refreshTrustState, type TrustBand } from '../trust/trustStateEngine';
import { capsuleEngine } from '../decision/capsuleEngine';
import { emitAlert } from '../alerts/trustAlerts';
import { log } from '../../obs/logger';
import { type CredentialEvent } from './eventQueue';
import { captureReadinessChange } from '../seal/sealEventCapture';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrustStateChange {
  npi: string;
  previousBand: TrustBand | null;
  newBand: TrustBand;
  degraded: boolean;
  /** IDs of Decision Capsules marked AT_RISK */
  affectedCapsules: string[];
  eventId?: string;
  processedAt: string;
}

export interface MonitoringCycleReport {
  npisScanned: number;
  stateChanges: TrustStateChange[];
  alerts: number;
  capsulesAffected: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

// ── Band ordering ─────────────────────────────────────────────────────────────

const BAND_ORDER: Record<TrustBand, number> = { L0: 0, L1: 1, L2: 2, L3: 3 };

function isBandDegradation(previous: TrustBand | null, current: TrustBand): boolean {
  if (previous === null) return false;
  return BAND_ORDER[current] < BAND_ORDER[previous];
}

// ── Previous band lookup ──────────────────────────────────────────────────────

async function getPreviousTrustBand(npi: string): Promise<TrustBand | null> {
  try {
    const artifact = await prisma.verificationArtifact.findFirst({
      where: { npi, source: 'TRUST_STATE_ENGINE' },
      orderBy: { verifiedAt: 'desc' },
      select: { trustState: true },
    });
    if (!artifact?.trustState) return null;
    const band = artifact.trustState as TrustBand;
    return ['L0', 'L1', 'L2', 'L3'].includes(band) ? band : null;
  } catch {
    return null;
  }
}

// ── Mark capsules AT_RISK ─────────────────────────────────────────────────────

async function markCapsulesAtRisk(npi: string): Promise<string[]> {
  try {
    const capsules = await capsuleEngine.getCapsulesByNpi(npi);
    const validCapsules = capsules.filter((c) => c.status === 'VALID');

    if (validCapsules.length === 0) return [];

    const ids = validCapsules.map((c) => c.id);

    await prisma.decisionCapsule.updateMany({
      where: { subjectNpi: npi, status: 'VALID' },
      data: { status: 'AT_RISK' },
    });

    log('warn', 'async_trust_engine: capsules_marked_at_risk', { npi, count: ids.length, capsuleIds: ids });
    return ids;
  } catch (err) {
    log('warn', 'async_trust_engine: capsule_mark_error', { npi, error: String(err) });
    return [];
  }
}

// ── Core event processor ──────────────────────────────────────────────────────

/**
 * Process a single credential event:
 * 1. Identify affected NPI
 * 2. Refresh trust state
 * 3. Compare bands
 * 4. If degraded → mark capsules AT_RISK + emit alert
 * 5. Return TrustStateChange
 */
export async function processCredentialEvent(event: CredentialEvent): Promise<TrustStateChange> {
  const { npi, eventId, type } = event;
  const processedAt = new Date().toISOString();

  log('info', 'async_trust_engine: processing_event', { eventId, type, npi });

  // 1. Get previous band before recomputing
  const previousBand = await getPreviousTrustBand(npi);

  // 2. Recompute trust state
  let newState;
  try {
    newState = await refreshTrustState(npi);
  } catch (err) {
    log('error', 'async_trust_engine: refresh_failed', { npi, eventId, error: String(err) });
    const fallbackBand: TrustBand = previousBand ?? 'L0';
    return {
      npi,
      previousBand,
      newBand: fallbackBand,
      degraded: false,
      affectedCapsules: [],
      eventId,
      processedAt,
    };
  }

  const newBand = newState.trustBand;
  const degraded = isBandDegradation(previousBand, newBand);

  let affectedCapsules: string[] = [];

  if (degraded) {
    // 3. Mark Decision Capsules AT_RISK
    affectedCapsules = await markCapsulesAtRisk(npi);

    // 4. Emit trust alert
    try {
      await emitAlert({
        type: 'issuer_trust_degradation',
        severity: newBand === 'L0' ? 'CRITICAL' : 'WARNING',
        title: `Trust state degraded: ${previousBand} → ${newBand}`,
        description: `Clinician NPI ${npi} trust band dropped from ${previousBand} to ${newBand} following a ${type} event. ${affectedCapsules.length} Decision Capsule(s) marked AT_RISK.`,
        subject: npi,
        recommendedAction: `Review credential status for NPI ${npi}. Affected capsules: ${affectedCapsules.length > 0 ? affectedCapsules.join(', ') : 'none'}.`,
      });
    } catch (err) {
      log('warn', 'async_trust_engine: alert_emit_error', { npi, error: String(err) });
    }

    // 5. Audit event
    try {
      await appendAuditEvent({
        category: ['TRUST_STATE_CHANGE'],
        actor: `async-trust-engine`,
        resource: `trust-state:${npi}`,
        severity: 'WARNING',
        requestFields: { eventId, eventType: type, npi },
        resultFields: {
          previousBand,
          newBand,
          degraded: true,
          capsulesAffected: affectedCapsules.length,
        },
      });
    } catch (err) {
      log('warn', 'async_trust_engine: audit_error', { npi, error: String(err) });
    }
  }

  // Wave ROI: Capture readiness change for pilot KPI tracking
  // Only capture when band actually changed (or first time computed)
  if (previousBand !== newBand || previousBand === null) {
    void captureReadinessChange({
      npi,
      previousBand,
      newBand,
      degraded,
      triggerEventType: type,
      triggerEventId: eventId,
      affectedCapsuleCount: affectedCapsules.length,
      processedAt,
    });
  }

  log('info', 'async_trust_engine: event_processed', {
    eventId,
    npi,
    type,
    previousBand,
    newBand,
    degraded,
    capsulesAffected: affectedCapsules.length,
  });

  return {
    npi,
    previousBand,
    newBand,
    degraded,
    affectedCapsules,
    eventId,
    processedAt,
  };
}

// ── Batch processor ───────────────────────────────────────────────────────────

/**
 * Process a batch of events, deduplicating by NPI.
 * Only one trust state recomputation per NPI per batch.
 */
export async function processEventBatch(events: CredentialEvent[]): Promise<TrustStateChange[]> {
  if (events.length === 0) return [];

  // Deduplicate: keep last event per NPI
  const npiToEvent = new Map<string, CredentialEvent>();
  for (const event of events) {
    npiToEvent.set(event.npi, event);
  }

  log('info', 'async_trust_engine: batch_start', {
    totalEvents: events.length,
    uniqueNpis: npiToEvent.size,
  });

  const results: TrustStateChange[] = [];
  for (const [, event] of npiToEvent) {
    const change = await processCredentialEvent(event);
    results.push(change);
  }

  log('info', 'async_trust_engine: batch_complete', {
    processed: results.length,
    degraded: results.filter((r) => r.degraded).length,
  });

  return results;
}

// ── Monitoring cycle ──────────────────────────────────────────────────────────

/**
 * Full monitoring cycle:
 * 1. Scan all monitored NPIs from VerificationArtifact records
 * 2. For each NPI: check expiration windows, run OIG if stale
 * 3. Emit events for any state changes
 * 4. Return report
 */
export async function runMonitoringCycle(): Promise<MonitoringCycleReport> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  log('info', 'async_trust_engine: monitoring_cycle_start', { startedAt });

  // 1. Collect monitored NPIs
  let monitoredNpis: string[] = [];
  try {
    const records = await prisma.verificationArtifact.findMany({
      where: { monitoring: true },
      select: { npi: true },
      distinct: ['npi'],
    });
    monitoredNpis = records.map((r) => r.npi);
  } catch (err) {
    log('error', 'async_trust_engine: npi_scan_error', { error: String(err) });
  }

  // Also include NPIs that have VerificationArtifacts (even if monitoring flag is not set)
  // so we don't miss any active clinicians
  try {
    const allNpiRecords = await prisma.verificationArtifact.findMany({
      where: {
        source: { not: 'TRUST_STATE_ENGINE' },
        status: { in: ['ACTIVE', 'VERIFIED'] },
      },
      select: { npi: true },
      distinct: ['npi'],
    });
    const allNpis = allNpiRecords.map((r) => r.npi);
    const combined = new Set([...monitoredNpis, ...allNpis]);
    monitoredNpis = Array.from(combined);
  } catch (err) {
    log('warn', 'async_trust_engine: all_npi_scan_error', { error: String(err) });
  }

  const npisScanned = monitoredNpis.length;
  const stateChanges: TrustStateChange[] = [];
  let alertsEmitted = 0;
  let capsulesAffected = 0;

  // 2. For each NPI, check expiration and stale OIG, then refresh
  const OIG_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  const EXPIRY_WARNING_MS = 30 * 24 * 60 * 60 * 1000; // 30-day warning window

  for (const npi of monitoredNpis) {
    try {
      const previousBand = await getPreviousTrustBand(npi);

      // Check for upcoming expirations
      const now = new Date();
      const expiryWindow = new Date(now.getTime() + EXPIRY_WARNING_MS);

      let hasExpirationAlert = false;
      try {
        const expiringArtifacts = await prisma.verificationArtifact.findMany({
          where: {
            npi,
            expiresAt: { lte: expiryWindow, gte: now },
            source: { not: 'TRUST_STATE_ENGINE' },
          },
          select: { id: true, source: true, expiresAt: true },
        });

        if (expiringArtifacts.length > 0) {
          hasExpirationAlert = true;
          log('info', 'async_trust_engine: expiry_detected', {
            npi,
            count: expiringArtifacts.length,
          });
        }
      } catch (err) {
        log('warn', 'async_trust_engine: expiry_check_error', { npi, error: String(err) });
      }

      // Check if OIG is stale
      let oigIsStale = false;
      try {
        const lastOig = await prisma.verificationArtifact.findFirst({
          where: { npi, source: { contains: 'OIG' } },
          orderBy: { verifiedAt: 'desc' },
          select: { verifiedAt: true },
        });
        if (!lastOig || Date.now() - lastOig.verifiedAt.getTime() > OIG_STALE_MS) {
          oigIsStale = true;
        }
      } catch {
        oigIsStale = false;
      }

      if (oigIsStale) {
        log('info', 'async_trust_engine: oig_stale_refresh', { npi });
        // OIG check runs inside refreshTrustState → computeClinicianTrustState
        // No explicit separate call needed; refreshTrustState covers it
      }

      // Only refresh if there's something worth rechecking
      if (hasExpirationAlert || oigIsStale) {
        const newState = await refreshTrustState(npi);
        const newBand = newState.trustBand;
        const degraded = isBandDegradation(previousBand, newBand);

        let capsuleIds: string[] = [];
        if (degraded) {
          capsuleIds = await markCapsulesAtRisk(npi);
          capsulesAffected += capsuleIds.length;
          alertsEmitted++;

          try {
            await emitAlert({
              type: hasExpirationAlert ? 'credential_expiring' : 'issuer_trust_degradation',
              severity: newBand === 'L0' ? 'CRITICAL' : 'WARNING',
              title: `Monitoring cycle: trust degraded for NPI ${npi}`,
              description: `Monitoring cycle detected trust band drop from ${previousBand} to ${newBand} for NPI ${npi}.`,
              subject: npi,
              recommendedAction: `Review credentials for NPI ${npi}. Capsules affected: ${capsuleIds.length}.`,
            });
          } catch (alertErr) {
            log('warn', 'async_trust_engine: cycle_alert_error', { npi, error: String(alertErr) });
          }

          stateChanges.push({
            npi,
            previousBand,
            newBand,
            degraded,
            affectedCapsules: capsuleIds,
            processedAt: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      log('warn', 'async_trust_engine: npi_cycle_error', { npi, error: String(err) });
    }
  }

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  const report: MonitoringCycleReport = {
    npisScanned,
    stateChanges,
    alerts: alertsEmitted,
    capsulesAffected,
    startedAt,
    completedAt,
    durationMs,
  };

  log('info', 'async_trust_engine: monitoring_cycle_complete', {
    npisScanned,
    stateChanges: stateChanges.length,
    alerts: alertsEmitted,
    capsulesAffected,
    durationMs,
  });

  return report;
}
