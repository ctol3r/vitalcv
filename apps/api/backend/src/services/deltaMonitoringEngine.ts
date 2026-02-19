/**
 * Delta Monitoring Engine — Wave Y
 *
 * Detects changes between credential states across monitoring sweeps.
 * Tracks four delta dimensions:
 *   - Expiration date changes
 *   - Lifecycle state changes
 *   - Issuer changes (source field)
 *   - Claim hash changes
 *
 * When a delta is detected:
 *   1. Appends a transparency log entry
 *   2. Creates a CredentialMonitoringEvent
 *   3. Returns deltaDetected = true
 *
 * Deterministic. No randomness. No external SaaS.
 */

import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import { appendArtifactLifecycleEntry } from './transparencyLedger';
import { isStrictTransitionMode } from '../utils/environment';
import { isSameLifecycleState } from '../utils/lifecycleState';
import { log } from '../obs/logger';

// ── Types ───────────────────────────────────────────────────

export type CredentialSnapshot = {
  id: string;
  npi: string;
  source: string;
  status: string;
  checksum: string;
  merkleRoot: string | null;
  lifecycleState: string;
  expiresAt: Date | null;
  claimHashes: Prisma.JsonValue;
  organizationId: string | null;
};

export type DeltaResult = {
  artifactId: string;
  deltaDetected: boolean;
  changes: DeltaChange[];
};

export type DeltaChange = {
  field: string;
  previousValue: string | null;
  currentValue: string | null;
};

// ── Helpers ─────────────────────────────────────────────────

function dateToIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function jsonToString(val: Prisma.JsonValue): string | null {
  if (val === null || val === undefined) return null;
  return JSON.stringify(val);
}

// ── Core detection ──────────────────────────────────────────

export function detectCredentialDelta(
  previousState: CredentialSnapshot,
  currentState: CredentialSnapshot,
): DeltaChange[] {
  const changes: DeltaChange[] = [];

  // Expiration date change
  const prevExpiry = dateToIso(previousState.expiresAt);
  const currExpiry = dateToIso(currentState.expiresAt);
  if (prevExpiry !== currExpiry) {
    changes.push({ field: 'expiresAt', previousValue: prevExpiry, currentValue: currExpiry });
  }

  // Lifecycle state change
  const prevLifecycle = previousState.lifecycleState;
  const currLifecycle = currentState.lifecycleState;
  if (!isSameLifecycleState(prevLifecycle, currLifecycle)) {
    changes.push({
      field: 'lifecycleState',
      previousValue: prevLifecycle.trim().toLowerCase(),
      currentValue: currLifecycle.trim().toLowerCase(),
    });
  }

  // Issuer (source) change
  const prevSource = previousState.source.trim().toLowerCase();
  const currSource = currentState.source.trim().toLowerCase();
  if (prevSource !== currSource) {
    changes.push({ field: 'source', previousValue: prevSource, currentValue: currSource });
  }

  // Claim hash change
  const prevClaims = jsonToString(previousState.claimHashes);
  const currClaims = jsonToString(currentState.claimHashes);
  if (prevClaims !== currClaims) {
    changes.push({ field: 'claimHashes', previousValue: prevClaims, currentValue: currClaims });
  }

  return changes;
}

// ── Persisted delta processing ──────────────────────────────

export async function processCredentialDelta(
  previousState: CredentialSnapshot,
  currentState: CredentialSnapshot,
): Promise<DeltaResult> {
  const changes = detectCredentialDelta(previousState, currentState);

  if (changes.length === 0) {
    return { artifactId: currentState.id, deltaDetected: false, changes: [] };
  }

  const orgId = currentState.organizationId?.trim() ?? null;

  // Append transparency entry for the delta
  await appendArtifactLifecycleEntry(
    {
      id: currentState.id,
      checksum: currentState.checksum,
      merkleRoot: currentState.merkleRoot,
      lifecycleState: currentState.lifecycleState,
      organizationId: orgId,
    },
    {
      strict: isStrictTransitionMode(),
    },
  );

  // Log monitoring event
  if (orgId) {
    try {
      await prisma.credentialMonitoringEvent.create({
        data: {
          artifactId: currentState.id,
          organizationId: orgId,
          eventType: 'delta-detected',
        },
      });
    } catch (error) {
      if (isStrictTransitionMode()) {
        throw new Error(`Unable to record delta monitoring event for artifact ${currentState.id}.`);
      }
      log('error', 'delta_monitoring_event_write_failed', {
        event: 'delta_monitoring_event_write_failed',
        artifactId: currentState.id,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  log('info', 'credential_delta_detected', {
    event: 'credential_delta_detected',
    artifactId: currentState.id,
    organizationId: orgId,
    changeCount: changes.length,
    changedFields: changes.map((c) => c.field),
  });

  return { artifactId: currentState.id, deltaDetected: true, changes };
}
