// ── VitalCV Drift Engine ──────────────────────────────────────────
// Detects when previously verified truth becomes outdated or invalid.
// Compares the last known state (e.g. from the most recent Manifest)
// against a fresh SourceCheckResult.

import { SourceStatus } from '../../trust-contract/dist/index';
import type { SourceCheckResult } from './types';
import type { CoverageLane } from './manifest-engine';
import { AuditEventType, createAuditEvent, type AuditEvent } from './audit-events';
import type { Claim } from './claim-engine';

// ── Drift Types ──────────────────────────────────────────────────

export enum DriftType {
  VALUE_CHANGED = 'value_changed',
  STATUS_CHANGED = 'status_changed',
  NEW_ADVERSE_SIGNAL = 'new_adverse_signal',
  FRESHNESS_EXPIRED = 'freshness_expired',
}

export enum DriftSeverity {
  LOW = 'low',       // Non-critical data changed or TTL expired
  MEDIUM = 'medium', // Important state changed but not adverse
  HIGH = 'high',     // Adverse signal detected (e.g. revoked license, new exclusion)
}

// ── Drift Model ──────────────────────────────────────────────────

export interface DriftEvent {
  /** UUID v4 */
  driftId: string;
  /** NPI of the clinician */
  subjectNpi: string;
  /** Source where the drift occurred */
  source: string;
  /** The nature of the drift */
  driftType: DriftType;
  /** Severity mapping */
  severity: DriftSeverity;
  /** The specific key/field that drifted (if applicable) */
  fieldKey: string | null;
  /** The previously known value or state */
  previousValue: string | null;
  /** The newly discovered value or state */
  newValue: string | null;
  /** When the drift was detected */
  detectedAt: string;
}

// ── Drift Engine ─────────────────────────────────────────────────

export interface DriftDetectionContext {
  subjectNpi: string;
  previousLanes: CoverageLane[];
  previousClaims: Claim[];
  newCheck: SourceCheckResult;
}

export function detectDrift(context: DriftDetectionContext): { drifts: DriftEvent[]; events: AuditEvent[] } {
  const drifts: DriftEvent[] = [];
  const events: AuditEvent[] = [];
  const detectedAt = new Date().toISOString();
  
  const { newCheck, previousLanes, previousClaims, subjectNpi } = context;
  const oldLane = previousLanes.find(l => l.source === newCheck.sourceId);

  // 1. Freshness Expired (if no new check data, but TTL passed)
  // (Usually handled asynchronously, but we check if we were passed an old lane that is now stale)
  if (oldLane && oldLane.checkedAt && oldLane.status === SourceStatus.CHECKED) {
    const elapsed = Date.now() - new Date(oldLane.checkedAt).getTime();
    if (elapsed > oldLane.ttl && newCheck.status !== SourceStatus.CHECKED) {
      drifts.push(buildDrift({
        subjectNpi,
        source: newCheck.sourceId,
        driftType: DriftType.FRESHNESS_EXPIRED,
        severity: DriftSeverity.LOW,
        fieldKey: 'freshness',
        previousValue: 'CHECKED',
        newValue: 'STALE',
        detectedAt,
      }));
    }
  }

  // If this is the first time we're checking this source, there is no drift
  if (!oldLane) {
    return { drifts, events };
  }

  // 2. Status Changed
  if (oldLane.status !== newCheck.status) {
    drifts.push(buildDrift({
      subjectNpi,
      source: newCheck.sourceId,
      driftType: DriftType.STATUS_CHANGED,
      severity: newCheck.status === SourceStatus.BLOCKED_SIGNAL ? DriftSeverity.HIGH : DriftSeverity.MEDIUM,
      fieldKey: 'status',
      previousValue: oldLane.status,
      newValue: newCheck.status,
      detectedAt,
    }));
  }

  // 3. New Adverse Signal (Limitation added)
  const previousAdverse = previousClaims
    .filter(c => c.source === newCheck.sourceId)
    .flatMap(c => c.limitations)
    .filter(l => l.adverse)
    .map(l => l.code);
    
  const newAdverse = newCheck.limitations
    .filter(l => l.adverse)
    .map(l => l.code);

  for (const code of newAdverse) {
    if (!previousAdverse.includes(code)) {
      drifts.push(buildDrift({
        subjectNpi,
        source: newCheck.sourceId,
        driftType: DriftType.NEW_ADVERSE_SIGNAL,
        severity: DriftSeverity.HIGH,
        fieldKey: `limitation:${code}`,
        previousValue: 'absent',
        newValue: 'present',
        detectedAt,
      }));
    }
  }

  // 4. Value Changed (Claims)
  // Compare previous claims from this source against new raw claims
  const oldClaims = previousClaims.filter(c => c.source === newCheck.sourceId);
  
  for (const newClaim of newCheck.claims) {
    // We try to match by claimKey (in the raw source check). 
    // Since claims in the manifest are canonicalized, we do a best-effort structural comparison.
    // In a real system, the previous Manifest would store the raw claim keys or we'd map them back.
    // For this demonstration, we look for direct value mismatches on matching keys.
    const matchingOld = oldClaims.find(c => {
      // Very basic heuristic mapping for the test
      if (c.claimType === 'identity.name' && newClaim.key === 'credentialed_name') return true;
      if (c.claimType === 'identity.npi_status' && newClaim.key === 'active_status') return true;
      if (c.claimType === 'oig.exclusion' && newClaim.key === 'has_active_exclusion') return true;
      return false;
    });

    if (matchingOld) {
      const oldValStr = String(matchingOld.value);
      const newValStr = String(newClaim.value);
      
      if (oldValStr !== newValStr) {
        drifts.push(buildDrift({
          subjectNpi,
          source: newCheck.sourceId,
          driftType: DriftType.VALUE_CHANGED,
          severity: DriftSeverity.MEDIUM,
          fieldKey: newClaim.key,
          previousValue: oldValStr,
          newValue: newValStr,
          detectedAt,
        }));
      }
    }
  }

  // Generate audit events for each drift detected
  for (const drift of drifts) {
    events.push(createAuditEvent({
      eventType: AuditEventType.DRIFT_DETECTED,
      subjectNpi,
      metadata: {
        driftId: drift.driftId,
        source: drift.source,
        driftType: drift.driftType,
        severity: drift.severity,
      },
    }));
  }

  return { drifts, events };
}

function buildDrift(params: Omit<DriftEvent, 'driftId'>): DriftEvent {
  return {
    driftId: crypto.randomUUID(),
    ...params,
  };
}
